import webpush from 'web-push';
import {config} from './config.js';
import {query} from './db.js';

let configured=false;
function ensurePush(){
  if(configured)return true;
  if(!config.vapidPublicKey||!config.vapidPrivateKey)return false;
  webpush.setVapidDetails(config.vapidSubject,config.vapidPublicKey,config.vapidPrivateKey);configured=true;return true;
}
export async function registerPush(userId,subscription,userAgent=''){
  const endpoint=subscription?.endpoint,p256dh=subscription?.keys?.p256dh,authKey=subscription?.keys?.auth;
  if(!endpoint||!p256dh||!authKey)throw new Error('Invalid push subscription');
  await query(`insert into push_subscriptions(user_id,endpoint,p256dh,auth,user_agent) values($1,$2,$3,$4,$5)
    on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=now()`,[userId,endpoint,p256dh,authKey,userAgent]);
}
export async function sendPushToUsers(userIds,{title,body,payload={}}){
  if(!userIds.length)return {sent:0,failed:0,disabled:!ensurePush()};
  if(!ensurePush())return {sent:0,failed:0,disabled:true};
  const {rows}=await query(`select id,user_id,endpoint,p256dh,auth from push_subscriptions where user_id=any($1::uuid[])`,[userIds]);
  let sent=0,failed=0;
  await Promise.all(rows.map(async row=>{
    try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({title,body,...payload}));sent++;}
    catch(err){failed++;if(err?.statusCode===404||err?.statusCode===410)await query('delete from push_subscriptions where id=$1',[row.id]);}
  }));
  return {sent,failed,disabled:false};
}
