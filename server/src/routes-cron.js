import express from 'express';
import {query} from './db.js';
import {config} from './config.js';
import {forecastFor,weatherMeaningfullyChanged} from './weather.js';
import {notifyTeam} from './notifications.js';
import {localEventDate} from './time-zone.js';
const router=express.Router();
function authCron(req){const token=req.get('authorization')?.replace(/^Bearer\s+/i,'')||req.query.secret;return config.cronSecret&&token===config.cronSecret;}

router.post('/cron/weather',async(req,res,next)=>{try{
  if(!authCron(req))return res.status(401).json({error:'invalid_cron_secret'});const {rows}=await query(`select ts.team_id,ts.state,t.name,t.home_location from team_state_snapshots ts join teams t on t.id=ts.team_id`);let checked=0,changed=0,errors=0;
  for(const row of rows){const ctx=row.state||{},events=Array.isArray(ctx.events)?ctx.events:[],tz=row.home_location?.timezone||'UTC';for(const ev of events){try{
    if(!ev?.outdoor||!ev.date||!ev.start||ev.lat==null||ev.lon==null)continue;const start=localEventDate(ev.date,ev.start,tz),end=localEventDate(ev.date,ev.end||ev.start,tz);const hours=(start-Date.now())/3600000;if(hours<-2||hours>96)continue;checked++;
    const nextForecast=await forecastFor(Number(ev.lat),Number(ev.lon),start.toISOString(),end.toISOString());const prev=(await query('select last_summary from weather_watch_state where team_id=$1 and event_client_id=$2',[row.team_id,String(ev.id)])).rows[0]?.last_summary||{};
    const meaningful=weatherMeaningfullyChanged(prev,nextForecast);await query(`insert into weather_watch_state(team_id,event_client_id,event_name,starts_at,latitude,longitude,last_summary,last_checked_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,now()) on conflict(team_id,event_client_id) do update set event_name=excluded.event_name,starts_at=excluded.starts_at,latitude=excluded.latitude,longitude=excluded.longitude,last_summary=excluded.last_summary,last_checked_at=now()`,[row.team_id,String(ev.id),String(ev.title||'Outdoor event'),start,Number(ev.lat),Number(ev.lon),JSON.stringify(nextForecast)]);
    if(meaningful){changed++;const alert=nextForecast.alerts?.[0];const body=alert?`${alert.event}: ${alert.headline||'Weather alert affects this event.'}`:`Weather changed for ${ev.title}: rain risk is now up to ${nextForecast.summary.maxRain}%`;await notifyTeam(row.team_id,'weather',{title:alert?'Weather alert':'Event weather changed',body,payload:{eventId:ev.id}});}
  }catch(err){errors++;console.error('[weather-cron]',row.team_id,ev?.id,err.message);}}}
  res.json({ok:true,checked,changed,errors});
}catch(e){next(e);}});
export default router;
