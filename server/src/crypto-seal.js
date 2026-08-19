import crypto from 'node:crypto';
import {config} from './config.js';

function key(){
  if(config.dataKey){const b=Buffer.from(config.dataKey,'base64');if(b.length===32)return b;throw new Error('TEAM_APP_DATA_KEY must decode to exactly 32 bytes');}
  if(config.nodeEnv!=='production'&&config.authSecret)return crypto.createHash('sha256').update(`dev-data-key:${config.authSecret}`).digest();
  throw new Error('TEAM_APP_DATA_KEY is not configured');
}
export function seal(value,aad='team-app'){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(aad));const enc=Buffer.concat([cipher.update(Buffer.from(String(value))),cipher.final()]);const tag=cipher.getAuthTag();return Buffer.concat([Buffer.from([1]),iv,tag,enc]);
}
export function unseal(blob,aad='team-app'){
  const b=Buffer.from(blob);if(b[0]!==1)throw new Error('Unsupported encrypted payload');const iv=b.subarray(1,13),tag=b.subarray(13,29),enc=b.subarray(29);const d=crypto.createDecipheriv('aes-256-gcm',key(),iv);d.setAAD(Buffer.from(aad));d.setAuthTag(tag);return Buffer.concat([d.update(enc),d.final()]).toString('utf8');
}
