import {query} from './db.js';
import {sendPushToUsers} from './push.js';
const allowed=new Set(['messages','schedule','weather','documents','forms']);
export async function notifyUsers(userIds,teamId,category,{title,body,payload={}}){
  if(!allowed.has(category))throw new Error('Unknown notification category');const unique=[...new Set((userIds||[]).filter(Boolean))];if(!unique.length)return {sent:0,failed:0};
  const ids=(await query(`select x.user_id from unnest($1::uuid[]) x(user_id) left join notification_preferences np on np.user_id=x.user_id and np.team_id=$2 where coalesce(np.${category},true)=true`,[unique,teamId])).rows.map(r=>r.user_id);if(!ids.length)return {sent:0,failed:0};
  await query(`insert into notification_events(user_id,team_id,kind,title,body,payload) select unnest($1::uuid[]),$2,$3,$4,$5,$6::jsonb`,[ids,teamId,category,title,body,JSON.stringify(payload)]);
  const result=await sendPushToUsers(ids,{title,body,payload:{teamId,category,...payload}});if(!result.disabled)await query(`update notification_events set sent_at=now() where team_id=$1 and user_id=any($2::uuid[]) and kind=$3 and sent_at is null and failed_at is null`,[teamId,ids,category]);return result;
}
export async function notifyTeam(teamId,category,{title,body,payload={}},excludeUserId=null){
  if(!allowed.has(category))throw new Error('Unknown notification category');
  const sql=`select tm.user_id from team_memberships tm left join notification_preferences np on np.user_id=tm.user_id and np.team_id=tm.team_id where tm.team_id=$1 ${excludeUserId?'and tm.user_id<>$2':''} and coalesce(np.${category},true)=true`;
  const params=excludeUserId?[teamId,excludeUserId]:[teamId];const ids=(await query(sql,params)).rows.map(r=>r.user_id);if(!ids.length)return {sent:0,failed:0};
  await query(`insert into notification_events(user_id,team_id,kind,title,body,payload) select unnest($1::uuid[]),$2,$3,$4,$5,$6::jsonb`,[ids,teamId,category,title,body,JSON.stringify(payload)]);
  const result=await sendPushToUsers(ids,{title,body,payload:{teamId,category,...payload}});
  if(!result.disabled)await query(`update notification_events set sent_at=now() where team_id=$1 and user_id=any($2::uuid[]) and kind=$3 and sent_at is null and failed_at is null`,[teamId,ids,category]);
  return result;
}
