import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {z} from 'zod';
import {query} from './db.js';
import {requireIdentity,requireTeamRole,COACH_ROLES,membershipFor} from './access.js';
import {config} from './config.js';
import {prepareUpload,saveLocalFile,prepareDownload,deleteStoredFile} from './storage.js';
import {notifyTeam} from './notifications.js';
import {validateTeamDocument} from './file-policy.js';

const router=express.Router();router.use(requireIdentity);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:config.maxUploadBytes,files:1}});
const metaSchema=z.object({name:z.string().min(1).max(220),contentType:z.string().max(180).optional(),byteSize:z.number().int().nonnegative().max(config.maxUploadBytes),category:z.string().max(100).default('General'),visibility:z.enum(['coaches','team','guardians','private']).default('team'),description:z.string().max(3000).optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/i).optional()});

router.get('/teams/:teamId/documents',requireTeamRole(null),async(req,res,next)=>{try{
  const role=req.teamMembership.role;let scope=`visibility='team'`;if(role==='guardian')scope=`visibility in ('team','guardians')`;if(COACH_ROLES.includes(role))scope=`(visibility in ('team','guardians','coaches') or (visibility='private' and uploaded_by=$2))`;
  const {rows}=await query(`select d.id,d.name,d.content_type,d.byte_size,d.category,d.visibility,d.description,d.sha256,d.created_at,d.uploaded_by,
    exists(select 1 from document_acknowledgments a where a.document_id=d.id and a.user_id=$2) as acknowledged
    from team_documents d where d.team_id=$1 and d.upload_completed_at is not null and ${scope} order by d.created_at desc`,[req.params.teamId,req.teamApp.user.id]);res.json(rows);
}catch(e){next(e);}});

router.post('/teams/:teamId/documents/init',requireTeamRole(COACH_ROLES),async(req,res,next)=>{try{
  const body=metaSchema.parse(req.body),policy=validateTeamDocument(body.name,body.contentType||'application/octet-stream');if(!policy.ok)return res.status(400).json({error:policy.error});const id=crypto.randomUUID();const prepared=await prepareUpload({teamId:req.params.teamId,documentId:id,name:body.name,contentType:body.contentType});
  await query(`insert into team_documents(id,team_id,uploaded_by,name,content_type,byte_size,category,visibility,storage_key,description,sha256) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,req.params.teamId,req.teamApp.user.id,body.name,body.contentType||'application/octet-stream',body.byteSize,body.category,body.visibility,prepared.storageKey,body.description||null,body.sha256||null]);
  res.status(201).json({documentId:id,...prepared,localUploadUrl:prepared.provider==='local'?`/api/teams/${req.params.teamId}/documents/${id}/content`:null});
}catch(e){next(e);}});

router.put('/teams/:teamId/documents/:documentId/content',requireTeamRole(COACH_ROLES),upload.single('file'),async(req,res,next)=>{try{
  if(config.storageProvider!=='local')return res.status(409).json({error:'direct_upload_required'});if(!req.file)return res.status(400).json({error:'file_required'});
  const {rows}=await query('select storage_key,byte_size from team_documents where id=$1 and team_id=$2',[req.params.documentId,req.params.teamId]);if(!rows[0])return res.status(404).json({error:'document_not_found'});
  if(req.file.size>config.maxUploadBytes)return res.status(413).json({error:'file_too_large'});
  const meta=(await query('select name,content_type from team_documents where id=$1 and team_id=$2',[req.params.documentId,req.params.teamId])).rows[0];const policy=validateTeamDocument(meta?.name,req.file.mimetype||meta?.content_type||'application/octet-stream');if(!policy.ok)return res.status(400).json({error:policy.error});
  const sha=crypto.createHash('sha256').update(req.file.buffer).digest('hex');await saveLocalFile(rows[0].storage_key,req.file.buffer);await query('update team_documents set byte_size=$2,sha256=$3,upload_completed_at=now(),updated_at=now() where id=$1',[req.params.documentId,req.file.size,sha]);const d=(await query('select name from team_documents where id=$1',[req.params.documentId])).rows[0];notifyTeam(req.params.teamId,'documents',{title:'New team document',body:`${d?.name||'A document'} was shared with the team.`,payload:{documentId:req.params.documentId}},req.teamApp.user.id).catch(()=>{});res.json({ok:true,sha256:sha});
}catch(e){next(e);}});


router.post('/teams/:teamId/documents/:documentId/complete',requireTeamRole(COACH_ROLES),async(req,res,next)=>{try{
  const {rows}=await query(`update team_documents set upload_completed_at=coalesce(upload_completed_at,now()),updated_at=now() where id=$1 and team_id=$2 returning id,name`,[req.params.documentId,req.params.teamId]);if(!rows[0])return res.status(404).json({error:'document_not_found'});
  notifyTeam(req.params.teamId,'documents',{title:'New team document',body:`${rows[0].name} was shared with the team.`,payload:{documentId:rows[0].id}},req.teamApp.user.id).catch(()=>{});res.json({ok:true});
}catch(e){next(e);}});

router.get('/documents/:documentId/download',async(req,res,next)=>{try{
  const {rows}=await query('select * from team_documents where id=$1 and upload_completed_at is not null',[req.params.documentId]);const d=rows[0];if(!d)return res.status(404).json({error:'document_not_found'});
  const membership=await membershipFor(d.team_id,req.teamApp.user.id);if(!membership)return res.status(403).json({error:'not_a_team_member'});
  if(d.visibility==='coaches'&&!COACH_ROLES.includes(membership.role))return res.status(403).json({error:'document_not_visible'});
  if(d.visibility==='private'&&d.uploaded_by!==req.teamApp.user.id)return res.status(403).json({error:'document_not_visible'});
  const prepared=await prepareDownload(d.storage_key,d.name);if(prepared.provider==='s3')return res.json({url:prepared.url,expiresIn:300});
  if(!fs.existsSync(prepared.path))return res.status(404).json({error:'file_not_uploaded'});res.download(prepared.path,d.name);
}catch(e){next(e);}});

router.post('/documents/:documentId/acknowledge',async(req,res,next)=>{try{
  const {rows}=await query('select team_id from team_documents where id=$1',[req.params.documentId]);if(!rows[0])return res.status(404).json({error:'document_not_found'});if(!await membershipFor(rows[0].team_id,req.teamApp.user.id))return res.status(403).json({error:'not_a_team_member'});
  const ip=String(req.ip||'');const ipHash=ip?crypto.createHash('sha256').update(ip).digest('hex'):null;await query(`insert into document_acknowledgments(document_id,user_id,ip_hash,user_agent) values($1,$2,$3,$4) on conflict(document_id,user_id) do update set acknowledged_at=now(),ip_hash=excluded.ip_hash,user_agent=excluded.user_agent`,[req.params.documentId,req.teamApp.user.id,ipHash,req.get('user-agent')||null]);res.json({ok:true,acknowledgedAt:new Date().toISOString()});
}catch(e){next(e);}});

router.delete('/teams/:teamId/documents/:documentId',requireTeamRole(COACH_ROLES),async(req,res,next)=>{try{
  const {rows}=await query('delete from team_documents where id=$1 and team_id=$2 returning storage_key',[req.params.documentId,req.params.teamId]);if(!rows[0])return res.status(404).json({error:'document_not_found'});await deleteStoredFile(rows[0].storage_key);res.json({ok:true});
}catch(e){next(e);}});

export default router;
