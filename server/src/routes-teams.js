import express from 'express';
import {z} from 'zod';
import {query,tx} from './db.js';
import {requireIdentity,requireTeamRole,COACH_ROLES,listUserTeams} from './access.js';
import {syncTeamMetadata,syncRosterFromContext,splitTeamContext,sealPrivateTeamState,unsealPrivateTeamState,mergePrivateTeamState,memberSafeTeamState} from './team-state.js';
import {notifyTeam} from './notifications.js';

const router=express.Router();

function eventChangeSummary(beforeState={},afterState={}){
  const before=new Map((Array.isArray(beforeState.events)?beforeState.events:[]).map(e=>[String(e.id),e]));
  const changes=[];
  for(const e of (Array.isArray(afterState.events)?afterState.events:[])){
    const old=before.get(String(e.id));
    if(!old){changes.push({title:'New team event',body:`${e.title||'Event'} was added to the schedule.`,eventId:e.id});continue;}
    const fields=['date','start','end','venue','title'];if(fields.some(k=>String(old[k]??'')!==String(e[k]??'')))changes.push({title:'Schedule updated',body:`${e.title||'Event'} was changed.`,eventId:e.id});
    before.delete(String(e.id));
  }
  for(const old of before.values())changes.push({title:'Event canceled',body:`${old.title||'Event'} was removed from the schedule.`,eventId:old.id});
  return changes.slice(0,10);
}
router.use(requireIdentity);

router.get('/me',async(req,res,next)=>{try{res.json({user:req.teamApp.user,authUser:{id:req.teamApp.session.user.id,email:req.teamApp.session.user.email,name:req.teamApp.session.user.name},teams:await listUserTeams(req.teamApp.user.id)});}catch(e){next(e);}});

const createSchema=z.object({name:z.string().min(1).max(160),shortName:z.string().max(60).optional(),sportKey:z.enum(['baseball','softball','soccer','basketball','football','volleyball']),season:z.string().min(1).max(100),teamRecord:z.record(z.string(),z.any()).optional(),context:z.record(z.string(),z.any()).optional()});
router.post('/teams',async(req,res,next)=>{try{
  const body=createSchema.parse(req.body);const u=req.teamApp.user;const split=splitTeamContext(body.context||{});
  const result=await tx(async c=>{
    let org=(await c.query(`select o.id,o.name from organizations o join organization_memberships om on om.organization_id=o.id where om.user_id=$1 and om.role in ('owner','admin') order by o.created_at limit 1`,[u.id])).rows[0];
    if(!org){org=(await c.query('insert into organizations(name) values($1) returning id,name',[`${req.teamApp.session.user.name||'Coach'} Teams`])).rows[0];await c.query(`insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner') on conflict do nothing`,[org.id,u.id]);}
    const sport=(await c.query('select id,code,name from sports where code=$1',[body.sportKey])).rows[0];if(!sport)throw new Error(`Sport ${body.sportKey} is not seeded`);
    const season=(await c.query('insert into seasons(organization_id,sport_id,name) values($1,$2,$3) returning id,name',[org.id,sport.id,body.season])).rows[0];
    const tr=body.teamRecord||{};
    const team=(await c.query(`insert into teams(organization_id,season_id,name,short_name,age_group,division,governing_body,rule_source_url,local_rules_note,local_rule_details,home_location,branding,color,default_layouts,league_key,league_name,competition_profile_key,rule_label,rule_source_note)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14::jsonb,$15,$16,$17,$18,$19) returning *`,[org.id,season.id,body.name,body.shortName||null,tr.ageGroup||null,tr.division||null,tr.governingBody||null,tr.ruleSourceUrl||null,tr.localRulesNote||null,JSON.stringify(tr.localRuleDetails||{}),JSON.stringify(tr.homeLocation||{}),JSON.stringify(tr.branding||{}),tr.branding?.primaryColor||tr.color||null,JSON.stringify(tr.defaultLayouts||{}),tr.leagueKey||null,tr.leagueName||null,tr.competitionProfileId||null,tr.ruleSet||null,tr.ruleSourceNote||null])).rows[0];
    await c.query(`insert into team_memberships(team_id,user_id,role) values($1,$2,'owner')`,[team.id,u.id]);
    await syncTeamMetadata(c,team.id,tr);
    await c.query(`insert into team_state_snapshots(team_id,state,revision,updated_by) values($1,$2::jsonb,1,$3)`,[team.id,JSON.stringify(split.publicContext),u.id]);
    await c.query(`insert into team_private_state(team_id,encrypted_state,updated_by) values($1,$2,$3) on conflict(team_id) do update set encrypted_state=excluded.encrypted_state,updated_by=excluded.updated_by,updated_at=now()`,[team.id,sealPrivateTeamState(team.id,split.privateState),u.id]);
    await syncRosterFromContext(c,team.id,body.context||{});
    return {team,season,sport,revision:1};
  });
  res.status(201).json(result);
}catch(e){next(e);}});

router.get('/teams/:teamId/members',requireTeamRole(null),async(req,res,next)=>{try{
  const coach=COACH_ROLES.includes(req.teamMembership.role);const {rows}=await query(`select u.id,u.display_name,${coach?'u.email':'null::citext as email'},tm.role,
    coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'clientKey',a.client_key,'name',trim(a.first_name||' '||a.last_name))) from guardian_relationships gr join athlete_profiles a on a.id=gr.athlete_id join roster_memberships rm on rm.athlete_id=a.id and rm.team_id=tm.team_id where gr.guardian_user_id=u.id),'[]'::jsonb) as athletes
    from team_memberships tm join users u on u.id=tm.user_id where tm.team_id=$1 order by u.display_name nulls last,u.email`,[req.params.teamId]);res.json(rows);
}catch(e){next(e);}});

router.get('/teams/:teamId/state',requireTeamRole(null),async(req,res,next)=>{try{
  const {rows}=await query(`select t.id,t.name,t.short_name,t.age_group,t.division,t.governing_body,t.rule_source_url,t.rule_source_note,t.local_rules_note,t.local_rule_details,t.home_location,t.branding,t.color,t.default_layouts,t.league_key,t.league_name,t.competition_profile_key,t.rule_label,
    s.name as season_name,sp.code as sport_key,coalesce(ts.state,'{}'::jsonb) as state,coalesce(ts.revision,0) as revision,ts.updated_at,tps.encrypted_state,
    coalesce((select jsonb_agg(jsonb_build_object('id',sc.client_key,'name',sc.name,'role',coalesce(sc.role_label,initcap(replace(sc.role::text,'_',' '))),'email',sc.email,'phone',sc.phone) order by sc.created_at) from team_staff_contacts sc where sc.team_id=t.id),'[]'::jsonb) as staff
    from teams t join seasons s on s.id=t.season_id join sports sp on sp.id=s.sport_id left join team_state_snapshots ts on ts.team_id=t.id left join team_private_state tps on tps.team_id=t.id where t.id=$1`,[req.params.teamId]);
  if(!rows[0])return res.status(404).json({error:'team_not_found'});const row=rows[0];if(COACH_ROLES.includes(req.teamMembership.role)){row.state=mergePrivateTeamState(row.state,unsealPrivateTeamState(row.id,row.encrypted_state));}else{row.state=memberSafeTeamState(row.state);row.staff=(Array.isArray(row.staff)?row.staff:[]).map(x=>({id:x.id,name:x.name,role:x.role}));}delete row.encrypted_state;res.json(row);
}catch(e){next(e);}});

const stateSchema=z.object({revision:z.number().int().nonnegative(),context:z.record(z.string(),z.any()),teamRecord:z.record(z.string(),z.any()).optional()});
router.put('/teams/:teamId/state',requireTeamRole(COACH_ROLES),async(req,res,next)=>{try{
  const body=stateSchema.parse(req.body);const userId=req.teamApp.user.id;const teamId=req.params.teamId;const split=splitTeamContext(body.context);
  const result=await tx(async c=>{
    const current=(await c.query('select revision,state from team_state_snapshots where team_id=$1 for update',[teamId])).rows[0];
    const revision=Number(current?.revision||0);if(revision!==body.revision){const fresh=(await c.query('select state,revision,updated_at from team_state_snapshots where team_id=$1',[teamId])).rows[0];return {conflict:true,fresh};}
    const scheduleNotifications=eventChangeSummary(current?.state||{},split.publicContext);
    if(body.teamRecord)await syncTeamMetadata(c,teamId,body.teamRecord);
    await syncRosterFromContext(c,teamId,body.context);
    const updated=(await c.query(`insert into team_state_snapshots(team_id,state,revision,updated_by) values($1,$2::jsonb,1,$3)
      on conflict(team_id) do update set state=excluded.state,revision=team_state_snapshots.revision+1,updated_by=excluded.updated_by,updated_at=now() returning revision,updated_at`,[teamId,JSON.stringify(split.publicContext),userId])).rows[0];
    await c.query(`insert into team_private_state(team_id,encrypted_state,updated_by) values($1,$2,$3) on conflict(team_id) do update set encrypted_state=excluded.encrypted_state,updated_by=excluded.updated_by,updated_at=now()`,[teamId,sealPrivateTeamState(teamId,split.privateState),userId]);
    await c.query(`insert into audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata) select organization_id,$2,'team_state.update','team',$1,jsonb_build_object('revision',$3) from teams where id=$1`,[teamId,userId,updated.revision]);
    return {conflict:false,...updated,scheduleNotifications};
  });
  if(result.conflict)return res.status(409).json({error:'revision_conflict',...result.fresh});
  for(const n of result.scheduleNotifications||[])notifyTeam(teamId,'schedule',{title:n.title,body:n.body,payload:{eventId:n.eventId}},userId).catch(err=>console.error('[schedule-push]',err.message));
  const {scheduleNotifications,...response}=result;res.json(response);
}catch(e){next(e);}});

export default router;
