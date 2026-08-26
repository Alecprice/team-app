import express from 'express';
import crypto from 'node:crypto';
import {z} from 'zod';
import {query,tx} from './db.js';
import {requireIdentity,requireTeamRole,ADMIN_ROLES} from './access.js';
import {config,randomToken,sha256} from './config.js';
import {sendTeamInvitationEmail} from './email.js';

const router=express.Router();router.use(requireIdentity);
const roles=['assistant_coach','manager','guardian','readonly'];
const inviteSchema=z.object({email:z.string().email(),role:z.enum(roles),athleteId:z.string().uuid().optional(),athleteClientKey:z.string().max(120).optional(),expiresHours:z.number().int().min(1).max(168).default(72)});

async function resolveInvitationAthlete(teamId,{athleteId,athleteClientKey},role){
  if(role!=='guardian')return null;
  if(!athleteId&&!athleteClientKey)throw Object.assign(new Error('guardian_requires_athlete'),{status:400});
  const params=athleteId?[teamId,athleteId]:[teamId,athleteClientKey];
  const predicate=athleteId?'a.id=$2':'a.client_key=$2';
  const athlete=(await query(`select a.id from roster_memberships r join athlete_profiles a on a.id=r.athlete_id where r.team_id=$1 and r.status='active' and ${predicate} limit 1`,params)).rows[0];
  if(!athlete)throw Object.assign(new Error('athlete_not_on_team'),{status:400});
  return athlete.id;
}

router.post('/teams/:teamId/invitations',requireTeamRole(ADMIN_ROLES),async(req,res,next)=>{try{
  const body=inviteSchema.parse(req.body),token=randomToken(32),hash=sha256(token),teamId=req.params.teamId;
  const athleteId=await resolveInvitationAthlete(teamId,body,body.role);
  const {rows}=await query(`insert into team_invitations(team_id,athlete_id,email,role,token_hash,expires_at,created_by)
    values($1,$2,$3,$4::organization_role,$5,now()+($6||' hours')::interval,$7) returning id,email,role,expires_at`,[teamId,athleteId,body.email.toLowerCase(),body.role,hash,body.expiresHours,req.teamApp.user.id]);
  const team=req.teamMembership.team_name;const url=`${config.authUrl.replace(/\/$/,'')}/?invite=${encodeURIComponent(token)}`;
  await sendTeamInvitationEmail({email:body.email,teamName:team,role:body.role,url,inviterName:req.teamApp.session.user.name||req.teamApp.session.user.email});
  res.status(201).json({...rows[0],inviteUrl:config.nodeEnv==='production'?undefined:url});
}catch(e){next(e);}});

router.get('/teams/:teamId/invitations',requireTeamRole(ADMIN_ROLES),async(req,res,next)=>{try{const {rows}=await query(`select id,email,role,expires_at,accepted_at,revoked_at,created_at from team_invitations where team_id=$1 order by created_at desc limit 100`,[req.params.teamId]);res.json(rows);}catch(e){next(e);}});

router.post('/invitations/accept',async(req,res,next)=>{try{
  const token=String(req.body?.token||'');if(token.length<20)return res.status(400).json({error:'invalid_invitation'});const hash=sha256(token),user=req.teamApp.user,email=String(req.teamApp.session.user.email||'').toLowerCase();
  const result=await tx(async c=>{
    const inv=(await c.query(`select i.*,t.organization_id,t.name as team_name from team_invitations i join teams t on t.id=i.team_id where i.token_hash=$1 for update`,[hash])).rows[0];
    if(!inv||inv.revoked_at||inv.accepted_at||new Date(inv.expires_at)<=new Date())return {error:'invitation_expired_or_invalid'};
    if(String(inv.email).toLowerCase()!==email)return {error:'invitation_email_mismatch'};
    await c.query(`insert into team_memberships(team_id,user_id,role) values($1,$2,$3) on conflict(team_id,user_id) do update set role=case when case excluded.role::text when 'owner' then 100 when 'admin' then 90 when 'coach' then 80 when 'assistant_coach' then 70 when 'manager' then 65 when 'guardian' then 30 when 'member' then 20 when 'readonly' then 10 else 0 end>case team_memberships.role::text when 'owner' then 100 when 'admin' then 90 when 'coach' then 80 when 'assistant_coach' then 70 when 'manager' then 65 when 'guardian' then 30 when 'member' then 20 when 'readonly' then 10 else 0 end then excluded.role else team_memberships.role end`,[inv.team_id,user.id,inv.role]);
    await c.query(`insert into organization_memberships(organization_id,user_id,role) values($1,$2,'readonly') on conflict(organization_id,user_id) do nothing`,[inv.organization_id,user.id]);
    if(inv.athlete_id&&inv.role==='guardian')await c.query(`insert into guardian_relationships(athlete_id,guardian_user_id,relationship_label) values($1,$2,'Guardian') on conflict do nothing`,[inv.athlete_id,user.id]);
    await c.query('update team_invitations set accepted_by=$2,accepted_at=now() where id=$1',[inv.id,user.id]);
    return {teamId:inv.team_id,teamName:inv.team_name,role:inv.role};
  });
  if(result.error)return res.status(400).json(result);res.json(result);
}catch(e){next(e);}});

function humanCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:8},()=>alphabet[crypto.randomInt(0,alphabet.length)]).join('');}
const codeSchema=z.object({role:z.literal('guardian').default('guardian'),athleteId:z.string().uuid().optional(),athleteClientKey:z.string().max(120).optional(),maxUses:z.number().int().min(1).max(10).default(1),expiresHours:z.number().int().min(1).max(168)});
router.post('/teams/:teamId/join-codes',requireTeamRole(ADMIN_ROLES),async(req,res,next)=>{try{
  const body=codeSchema.parse(req.body);const athleteId=await resolveInvitationAthlete(req.params.teamId,body,'guardian');let code,hash;for(let i=0;i<5;i++){code=humanCode();hash=sha256(code);const exists=(await query('select 1 from team_join_codes where code_hash=$1',[hash])).rowCount;if(!exists)break;}
  const expires=new Date(Date.now()+body.expiresHours*3600000);
  const {rows}=await query(`insert into team_join_codes(team_id,athlete_id,role,code_hash,code_hint,max_uses,expires_at,created_by) values($1,$2,$3::organization_role,$4,$5,$6,$7,$8) returning id,role,code_hint,max_uses,expires_at`,[req.params.teamId,athleteId,body.role,hash,code.slice(-4),body.maxUses,expires,req.teamApp.user.id]);
  res.status(201).json({...rows[0],code});
}catch(e){next(e);}});

router.post('/join-codes/redeem',async(req,res,next)=>{try{
  const code=String(req.body?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<6)return res.status(400).json({error:'invalid_code'});const hash=sha256(code),user=req.teamApp.user;
  const result=await tx(async c=>{
    const rec=(await c.query(`select j.*,t.organization_id,t.name as team_name from team_join_codes j join teams t on t.id=j.team_id where j.code_hash=$1 for update`,[hash])).rows[0];
    if(!rec||!rec.is_active||rec.use_count>=rec.max_uses||(rec.expires_at&&new Date(rec.expires_at)<=new Date()))return {error:'code_expired_or_invalid'};
    await c.query(`insert into team_memberships(team_id,user_id,role) values($1,$2,$3) on conflict(team_id,user_id) do update set role=case when case excluded.role::text when 'owner' then 100 when 'admin' then 90 when 'coach' then 80 when 'assistant_coach' then 70 when 'manager' then 65 when 'guardian' then 30 when 'member' then 20 when 'readonly' then 10 else 0 end>case team_memberships.role::text when 'owner' then 100 when 'admin' then 90 when 'coach' then 80 when 'assistant_coach' then 70 when 'manager' then 65 when 'guardian' then 30 when 'member' then 20 when 'readonly' then 10 else 0 end then excluded.role else team_memberships.role end`,[rec.team_id,user.id,rec.role]);
    await c.query(`insert into organization_memberships(organization_id,user_id,role) values($1,$2,'readonly') on conflict(organization_id,user_id) do nothing`,[rec.organization_id,user.id]);
    if(rec.athlete_id&&rec.role==='guardian')await c.query(`insert into guardian_relationships(athlete_id,guardian_user_id,relationship_label) values($1,$2,'Guardian') on conflict do nothing`,[rec.athlete_id,user.id]);
    await c.query(`update team_join_codes set use_count=use_count+1,is_active=case when use_count+1>=max_uses then false else is_active end where id=$1`,[rec.id]);
    return {teamId:rec.team_id,teamName:rec.team_name,role:rec.role};
  });
  if(result.error)return res.status(400).json(result);res.json(result);
}catch(e){next(e);}});

export default router;
