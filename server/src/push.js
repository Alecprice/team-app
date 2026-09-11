import webpush from 'web-push';
import {config} from './config.js';
import {query} from './db.js';
import {PUSH_SEND_OPTIONS,cleanupExpiredPush,summarizePushDeliveries} from './push-delivery.js';
import {normalizePushSubscription} from './push-subscription.js';

let configured=false;
function ensurePush(){
  if(configured)return true;
  if(!config.vapidPublicKey||!config.vapidPrivateKey)return false;
  webpush.setVapidDetails(config.vapidSubject,config.vapidPublicKey,config.vapidPrivateKey);configured=true;return true;
}
export async function registerPush(userId,subscription,userAgent=''){
  const normalized=normalizePushSubscription(subscription);
  if(!normalized)throw new Error('Invalid push subscription');
  const {endpoint,keys:{p256dh,auth:authKey}}=normalized;
  await query(`insert into push_subscriptions(user_id,endpoint,p256dh,auth,user_agent) values($1,$2,$3,$4,$5)
    on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=now()`,[userId,endpoint,p256dh,authKey,userAgent]);
}
export async function sendPushToUsers(userIds,{title,body,payload={}}){
  if(!userIds.length)return {sent:0,failed:0,deliveredUserIds:[],disabled:!ensurePush()};
  if(!ensurePush())return {sent:0,failed:0,deliveredUserIds:[],disabled:true};
  const {rows}=await query(`select id,user_id,endpoint,p256dh,auth from push_subscriptions where user_id=any($1::uuid[])`,[userIds]);
  const results=await Promise.all(rows.map(async row=>{
    try{
      await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({title,body,...payload}),PUSH_SEND_OPTIONS);
      return {ok:true,userId:row.user_id};
    }
    catch(err){
      await cleanupExpiredPush(err,()=>query('delete from push_subscriptions where id=$1',[row.id]));
      return {ok:false,userId:row.user_id};
    }
  }));
  return {...summarizePushDeliveries(results),disabled:false};
}
