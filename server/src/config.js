import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';

function env(name, fallback='') { return process.env[name] ?? fallback; }
function envInt(name, fallback) { const n=Number(env(name, fallback)); return Number.isFinite(n)?n:fallback; }
function splitCsv(value){return String(value||'').split(',').map(x=>x.trim()).filter(Boolean);}

export const config = Object.freeze({
  port: envInt('PORT', 8080),
  nodeEnv: env('NODE_ENV','development'),
  databaseUrl: env('DATABASE_URL'),
  authSecret: env('BETTER_AUTH_SECRET'),
  authUrl: env('BETTER_AUTH_URL',`http://localhost:${envInt('PORT',8080)}`),
  dataKey: env('TEAM_APP_DATA_KEY'),
  trustedOrigins: splitCsv(env('BETTER_AUTH_TRUSTED_ORIGINS',env('BETTER_AUTH_URL',`http://localhost:${envInt('PORT',8080)}`))),
  resendApiKey: env('RESEND_API_KEY'),
  emailFrom: env('EMAIL_FROM','Team APP <team@example.com>'),
  storageProvider: env('STORAGE_PROVIDER','local'),
  localUploadDir: path.resolve(env('LOCAL_UPLOAD_DIR','.team-app-uploads')),
  s3Region: env('S3_REGION','us-east-1'),
  s3Bucket: env('S3_BUCKET'),
  s3Endpoint: env('S3_ENDPOINT'),
  s3AccessKeyId: env('S3_ACCESS_KEY_ID'),
  s3SecretAccessKey: env('S3_SECRET_ACCESS_KEY'),
  s3KmsKeyId: env('S3_KMS_KEY_ID'),
  vapidPublicKey: env('VAPID_PUBLIC_KEY'),
  vapidPrivateKey: env('VAPID_PRIVATE_KEY'),
  vapidSubject: env('VAPID_SUBJECT','mailto:admin@example.com'),
  cronSecret: env('CRON_SECRET'),
  maxUploadBytes: envInt('TEAM_APP_MAX_UPLOAD_MB',25)*1024*1024,
  maxTeamDocumentBytes: envInt('TEAM_APP_MAX_TEAM_STORAGE_MB',500)*1024*1024,
});

export function assertProductionConfig(){
  const missing=[];
  if(!config.databaseUrl)missing.push('DATABASE_URL');
  if(!config.authSecret || config.authSecret.length<32)missing.push('BETTER_AUTH_SECRET (32+ chars)');
  if(config.nodeEnv==='production'&&!config.dataKey)missing.push('TEAM_APP_DATA_KEY');
  if(config.nodeEnv==='production' && config.storageProvider==='local')missing.push('non-local STORAGE_PROVIDER');
  if(missing.length)throw new Error(`Missing required Team APP configuration: ${missing.join(', ')}`);
}

export function authDatabaseUrl(){
  if(!config.databaseUrl)return '';
  const u=new URL(config.databaseUrl);
  const existing=u.searchParams.get('options');
  const option='-c search_path=auth';
  u.searchParams.set('options',existing?`${existing} ${option}`:option);
  return u.toString();
}

export function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
export function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
export function timingSafeHexEqual(a,b){
  try{const aa=Buffer.from(String(a),'hex'),bb=Buffer.from(String(b),'hex');return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}catch{return false;}
}
