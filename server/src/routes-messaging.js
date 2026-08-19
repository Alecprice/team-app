import express from 'express';
import {z} from 'zod';
import {query,tx} from './db.js';
import {requireIdentity,requireTeamRole,COACH_ROLES,membershipFor} from './access.js';
import {notifyUsers} from './notifications.js';

const router=express.Router();router.use(requireIdentity);
const b64=z.string().min(8).max(2000000).regex(/^[A-Za-z0-9+/_=-]+$/);

async function conversationMember(conversationId,userId){return (await query('select c.* from conversations c join conversation_members cm on cm.conversation_id=c.id where c.id=$1 and cm.user_id=$2',[conversationId,userId])).rows[0]||null;}

router.put('/crypto-key',async(req,res,next)=>{try{const b=z.object({publicKeyJwk:z.record(z.string(),z.any()),algorithm:z.string().max(80).default('ECDH-P256'),version:z.number().int().min(1).max(100).default(1)}).parse(req.body);await query(`insert into user_crypto_keys(user_id,algorithm,public_key_jwk,version) values($1,$2,$3::jsonb,$4) on conflict(user_id) do update set algorithm=excluded.algorithm,public_key_jwk=excluded.public_key_jwk,version=excluded.version,rotated_at=now()`,[req.teamApp.user.id,b.algorithm,JSON.stringify(b.publicKeyJwk),b.version]);res.json({ok:true});}catch(e){next(e);}});
router.get('/crypto-keys',async(req,res,next)=>{try{const ids=String(req.query.userIds||'').split(',').filter(x=>/^[0-9a-f-]{36}$/i.test(x)).slice(0,100);if(!ids.length)return res.json([]);const {rows}=await query('select user_id,algorithm,public_key_jwk,version from user_crypto_keys where user_id=any($1::uuid[])',[ids]);res.json(rows);}catch(e){next(e);}});

router.post('/teams/:teamId/conversations',requireTeamRole(null),async(req,res,next)=>{try{
  const b=z.object({kind:z.enum(['team','coaches','direct','event']),name:z.string().max(160).optional(),memberUserIds:z.array(z.string().uuid()).max(100).default([]),visibility:z.enum(['team','coaches','guardians','private']).default('team')}).parse(req.body);const teamId=req.params.teamId,role=req.teamMembership.role;
  if(['team','coaches','event'].includes(b.kind)&&!COACH_ROLES.includes(role))return res.status(403).json({error:'coach_role_required'});
  const result=await tx(async c=>{
    const team=(await c.query('select organization_id from teams where id=$1',[teamId])).rows[0];
    const conv=(await c.query('insert into conversations(organization_id,team_id,kind,name,visibility) values($1,$2,$3,$4,$5) returning *',[team.organization_id,teamId,b.kind,b.name||null,b.visibility])).rows[0];
    let members=[req.teamApp.user.id,...b.memberUserIds];
    if(b.kind==='team')members=(await c.query('select user_id from team_memberships where team_id=$1',[teamId])).rows.map(r=>r.user_id);
    if(b.kind==='coaches')members=(await c.query(`select user_id from team_memberships where team_id=$1 and role=any($2::organization_role[])`,[teamId,COACH_ROLES])).rows.map(r=>r.user_id);
    members=[...new Set(members)];for(const uid of members)await c.query('insert into conversation_members(conversation_id,user_id) values($1,$2) on conflict do nothing',[conv.id,uid]);
    return {...conv,memberUserIds:members};
  });res.status(201).json(result);
}catch(e){next(e);}});

router.get('/conversations',async(req,res,next)=>{try{const {rows}=await query(`select c.id,c.team_id,c.kind,c.name,c.visibility,c.created_at,cm.joined_at,mr.last_read_at from conversation_members cm join conversations c on c.id=cm.conversation_id left join message_reads mr on mr.conversation_id=c.id and mr.user_id=cm.user_id where cm.user_id=$1 order by c.created_at desc`,[req.teamApp.user.id]);res.json(rows);}catch(e){next(e);}});

router.get('/conversations/:conversationId/members',async(req,res,next)=>{try{if(!await conversationMember(req.params.conversationId,req.teamApp.user.id))return res.status(403).json({error:'not_a_conversation_member'});const {rows}=await query(`select u.id,u.display_name,u.email,k.algorithm,k.public_key_jwk,k.version from conversation_members cm join users u on u.id=cm.user_id left join user_crypto_keys k on k.user_id=u.id where cm.conversation_id=$1`,[req.params.conversationId]);res.json(rows);}catch(e){next(e);}});

router.put('/conversations/:conversationId/key-envelopes',async(req,res,next)=>{try{
  if(!await conversationMember(req.params.conversationId,req.teamApp.user.id))return res.status(403).json({error:'not_a_conversation_member'});
  const b=z.object({keyVersion:z.number().int().min(1).max(1000),envelopes:z.array(z.object({recipientUserId:z.string().uuid(),wrappedKey:b64,nonce:b64})).min(1).max(200)}).parse(req.body);
  await tx(async c=>{for(const e of b.envelopes)await c.query(`insert into conversation_key_envelopes(conversation_id,recipient_user_id,sender_user_id,key_version,wrapped_key,nonce) values($1,$2,$3,$4,$5,$6) on conflict(conversation_id,recipient_user_id,key_version) do update set sender_user_id=excluded.sender_user_id,wrapped_key=excluded.wrapped_key,nonce=excluded.nonce,created_at=now()`,[req.params.conversationId,e.recipientUserId,req.teamApp.user.id,b.keyVersion,Buffer.from(e.wrappedKey,'base64'),Buffer.from(e.nonce,'base64')]);});res.json({ok:true});
}catch(e){next(e);}});
router.get('/conversations/:conversationId/key-envelope',async(req,res,next)=>{try{if(!await conversationMember(req.params.conversationId,req.teamApp.user.id))return res.status(403).json({error:'not_a_conversation_member'});const {rows}=await query(`select e.key_version,e.sender_user_id,encode(e.wrapped_key,'base64') as wrapped_key,encode(e.nonce,'base64') as nonce,k.public_key_jwk as sender_public_key from conversation_key_envelopes e join user_crypto_keys k on k.user_id=e.sender_user_id where e.conversation_id=$1 and e.recipient_user_id=$2 order by e.key_version desc limit 1`,[req.params.conversationId,req.teamApp.user.id]);if(!rows[0])return res.status(404).json({error:'key_envelope_not_found'});res.json(rows[0]);}catch(e){next(e);}});

router.post('/conversations/:conversationId/messages',async(req,res,next)=>{try{
  if(!await conversationMember(req.params.conversationId,req.teamApp.user.id))return res.status(403).json({error:'not_a_conversation_member'});const b=z.object({ciphertext:b64,nonce:b64,cryptoVersion:z.string().max(80),clientMessageId:z.string().min(8).max(160)}).parse(req.body);
  const {rows}=await query(`insert into messages(conversation_id,sender_user_id,ciphertext,nonce,crypto_version,client_message_id) values($1,$2,$3,$4,$5,$6) on conflict(sender_user_id,client_message_id) do update set client_message_id=excluded.client_message_id returning id,sent_at`,[req.params.conversationId,req.teamApp.user.id,Buffer.from(b.ciphertext,'base64'),Buffer.from(b.nonce,'base64'),b.cryptoVersion,b.clientMessageId]);
  const conv=await conversationMember(req.params.conversationId,req.teamApp.user.id);const members=(await query('select user_id from conversation_members where conversation_id=$1 and user_id<>$2',[req.params.conversationId,req.teamApp.user.id])).rows.map(r=>r.user_id);notifyUsers(members,conv.team_id,'messages',{title:'New encrypted message',body:'A teammate sent you a private Team APP message.',payload:{conversationId:req.params.conversationId}},).catch(()=>{});res.status(201).json(rows[0]);
}catch(e){next(e);}});
router.get('/conversations/:conversationId/messages',async(req,res,next)=>{try{if(!await conversationMember(req.params.conversationId,req.teamApp.user.id))return res.status(403).json({error:'not_a_conversation_member'});const after=req.query.after?new Date(String(req.query.after)):new Date(0);const {rows}=await query(`select m.id,m.sender_user_id,u.display_name as sender_name,encode(m.ciphertext,'base64') as ciphertext,encode(m.nonce,'base64') as nonce,m.crypto_version,m.client_message_id,m.sent_at,m.edited_at,m.deleted_at from messages m join users u on u.id=m.sender_user_id where m.conversation_id=$1 and m.sent_at>$2 order by m.sent_at asc limit 250`,[req.params.conversationId,after]);res.json(rows);}catch(e){next(e);}});
router.post('/conversations/:conversationId/read',async(req,res,next)=>{try{if(!await conversationMember(req.params.conversationId,req.teamApp.user.id))return res.status(403).json({error:'not_a_conversation_member'});await query(`insert into message_reads(conversation_id,user_id,last_read_at) values($1,$2,now()) on conflict(conversation_id,user_id) do update set last_read_at=now()`,[req.params.conversationId,req.teamApp.user.id]);res.json({ok:true});}catch(e){next(e);}});

export default router;
