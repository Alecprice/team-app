import express from 'express';
import {z} from 'zod';
import {query} from './db.js';
import {requireIdentity,requireTeamRole,COACH_ROLES} from './access.js';

const router=express.Router();router.use(requireIdentity);
const responseSchema=z.object({athleteClientKey:z.string().min(1).max(140),status:z.enum(['yes','no','maybe']),note:z.string().max(500).optional()});

async function eventExists(teamId,eventId){
  const {rows}=await query('select state from team_state_snapshots where team_id=$1',[teamId]);
  const events=Array.isArray(rows[0]?.state?.events)?rows[0].state.events:[];
  return events.some(e=>String(e?.id)===String(eventId));
}

router.get('/teams/:teamId/events/:eventId/availability',requireTeamRole(null),async(req,res,next)=>{try{
  if(!await eventExists(req.params.teamId,req.params.eventId))return res.status(404).json({error:'event_not_found'});
  const coach=COACH_ROLES.includes(req.teamMembership.role);
  const params=[req.params.teamId,req.params.eventId,req.teamApp.user.id];
  const visibility=coach?'true':`exists(select 1 from guardian_relationships gr where gr.athlete_id=a.id and gr.guardian_user_id=$3)`;
  const {rows}=await query(`select a.id,a.client_key,trim(a.first_name||' '||a.last_name) as athlete_name,rm.jersey_number,
    coalesce(ea.status,'') as status,ea.note,ea.updated_at
    from roster_memberships rm join athlete_profiles a on a.id=rm.athlete_id
    left join event_availability ea on ea.team_id=rm.team_id and ea.athlete_id=a.id and ea.event_client_id=$2
    where rm.team_id=$1 and rm.status='active' and ${visibility}
    order by nullif(regexp_replace(coalesce(rm.jersey_number,''),'\\D','','g'),'')::int nulls last,a.last_name,a.first_name`,params);
  res.json(rows);
}catch(e){next(e);}});

router.put('/teams/:teamId/events/:eventId/availability',requireTeamRole(null),async(req,res,next)=>{try{
  const b=responseSchema.parse(req.body);if(!await eventExists(req.params.teamId,req.params.eventId))return res.status(404).json({error:'event_not_found'});
  const {rows}=await query(`select a.id from athlete_profiles a join roster_memberships rm on rm.athlete_id=a.id where rm.team_id=$1 and a.client_key=$2 and rm.status='active'`,[req.params.teamId,b.athleteClientKey]);
  const athlete=rows[0];if(!athlete)return res.status(404).json({error:'athlete_not_found'});
  if(!COACH_ROLES.includes(req.teamMembership.role)){
    const allowed=(await query(`select 1 from guardian_relationships where athlete_id=$1 and guardian_user_id=$2 and may_update_availability=true`,[athlete.id,req.teamApp.user.id])).rows[0];
    if(!allowed)return res.status(403).json({error:'availability_not_allowed'});
  }
  const saved=(await query(`insert into event_availability(team_id,event_client_id,athlete_id,status,note,updated_by) values($1,$2,$3,$4,$5,$6)
    on conflict(team_id,event_client_id,athlete_id) do update set status=excluded.status,note=excluded.note,updated_by=excluded.updated_by,updated_at=now()
    returning status,note,updated_at`,[req.params.teamId,req.params.eventId,athlete.id,b.status,b.note||null,req.teamApp.user.id])).rows[0];
  await query(`insert into audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    select organization_id,$2,'event_availability.update','event',$3,jsonb_build_object('athlete_id',$4,'status',$5) from teams where id=$1`,[req.params.teamId,req.teamApp.user.id,String(req.params.eventId),athlete.id,b.status]);
  res.json(saved);
}catch(e){next(e);}});

export default router;
