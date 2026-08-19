import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {config} from './config.js';

let s3;
function s3Client(){
  if(!s3){
    const options={region:config.s3Region};
    if(config.s3Endpoint)options.endpoint=config.s3Endpoint;
    if(config.s3AccessKeyId&&config.s3SecretAccessKey)options.credentials={accessKeyId:config.s3AccessKeyId,secretAccessKey:config.s3SecretAccessKey};
    s3=new S3Client(options);
  }
  return s3;
}
export function safeFilename(name){return String(name||'file').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,180)||'file';}
export function storageKey(teamId,documentId,name){return `teams/${teamId}/documents/${documentId}/${crypto.randomUUID()}-${safeFilename(name)}`;}
export function s3Encryption(){return config.s3KmsKeyId?{ServerSideEncryption:'aws:kms',SSEKMSKeyId:config.s3KmsKeyId}:{ServerSideEncryption:'AES256'};}

export async function prepareUpload({teamId,documentId,name,contentType}){
  const key=storageKey(teamId,documentId,name);
  if(config.storageProvider==='s3'){
    if(!config.s3Bucket)throw new Error('S3_BUCKET is required for S3 storage');
    const encryption=s3Encryption();
    const command=new PutObjectCommand({Bucket:config.s3Bucket,Key:key,ContentType:contentType||'application/octet-stream',...encryption});
    const url=await getSignedUrl(s3Client(),command,{expiresIn:10*60});
    const headers={'Content-Type':contentType||'application/octet-stream','x-amz-server-side-encryption':encryption.ServerSideEncryption};
    if(encryption.SSEKMSKeyId)headers['x-amz-server-side-encryption-aws-kms-key-id']=encryption.SSEKMSKeyId;
    return {provider:'s3',storageKey:key,uploadUrl:url,headers,expiresIn:600};
  }
  await fs.mkdir(config.localUploadDir,{recursive:true});
  return {provider:'local',storageKey:key,uploadUrl:null,headers:{}};
}

export async function saveLocalFile(key,buffer){const full=path.join(config.localUploadDir,key);await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,buffer,{mode:0o600});return full;}
export function localPath(key){return path.join(config.localUploadDir,key);}
export async function prepareDownload(key,filename){
  if(config.storageProvider==='s3'){
    const command=new GetObjectCommand({Bucket:config.s3Bucket,Key:key,ResponseContentDisposition:`attachment; filename="${safeFilename(filename)}"`,ResponseContentType:'application/octet-stream'});
    return {provider:'s3',url:await getSignedUrl(s3Client(),command,{expiresIn:5*60})};
  }
  return {provider:'local',path:localPath(key)};
}
export async function deleteStoredFile(key){
  if(config.storageProvider==='s3')return s3Client().send(new DeleteObjectCommand({Bucket:config.s3Bucket,Key:key}));
  try{await fs.unlink(localPath(key));}catch(err){if(err?.code!=='ENOENT')throw err;}
}
