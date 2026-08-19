import {seal,unseal} from './crypto-seal.js';
function text(v,max=500){return String(v??'').trim().slice(0,max);}
function jsonObject(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function validColor(v){return /^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):null;}

export async function syncTeamMetadata(client,teamId,teamRecord={}){
  const branding=jsonObject(teamRecord.branding),home=jsonObject(teamRecord.homeLocation),rules=jsonObject(teamRecord.localRuleDetails),layouts=jsonObject(teamRecord.defaultLayouts);
  await client.query(`update teams set name=coalesce(nullif($2,''),name),short_name=nullif($3,''),age_group=nullif($4,''),division=nullif($5,''),
    governing_body=nullif($6,''),rule_source_url=nullif($7,''),local_rules_note=nullif($8,''),local_rule_details=$9::jsonb,
    home_location=$10::jsonb,branding=$11::jsonb,color=coalesce($12,color),default_layouts=$13::jsonb,league_key=nullif($14,''),league_name=nullif($15,''),competition_profile_key=nullif($16,''),rule_label=nullif($17,''),rule_source_note=nullif($18,''),updated_at=now() where id=$1`,[
      teamId,text(teamRecord.name,160),text(teamRecord.shortName,60),text(teamRecord.ageGroup,100),text(teamRecord.division,100),text(teamRecord.governingBody,180),text(teamRecord.ruleSourceUrl,1000),text(teamRecord.localRulesNote,5000),JSON.stringify(rules),JSON.stringify(home),JSON.stringify(branding),validColor(branding.primaryColor||teamRecord.color),JSON.stringify(layouts),text(teamRecord.leagueKey,100),text(teamRecord.leagueName,180),text(teamRecord.competitionProfileId,160),text(teamRecord.ruleSet,220),text(teamRecord.ruleSourceNote,2000)
    ]);
  const staff=Array.isArray(teamRecord.staff)?teamRecord.staff.slice(0,100):[];const ids=[];
  const staffRole=value=>({owner:'owner',admin:'admin','head coach':'coach',coach:'coach','assistant coach':'assistant_coach',assistant_coach:'assistant_coach','team manager':'manager',manager:'manager','volunteer coach':'assistant_coach',scorekeeper:'member',member:'member'}[String(value||'').toLowerCase()]||'assistant_coach');
  for(const member of staff){const clientKey=text(member.id,120)||text(`${member.role}:${member.email}:${member.name}`,120);if(!clientKey)continue;ids.push(clientKey);const roleLabel=text(member.role,80)||'Assistant Coach';await client.query(`insert into team_staff_contacts(team_id,client_key,name,role,role_label,email,phone) values($1,$2,$3,$4::organization_role,$5,$6,$7) on conflict(team_id,client_key) do update set name=excluded.name,role=excluded.role,role_label=excluded.role_label,email=excluded.email,phone=excluded.phone,updated_at=now()`,[teamId,clientKey,text(member.name,160)||'Staff',staffRole(roleLabel),roleLabel,text(member.email,320)||null,text(member.phone,60)||null]);}
  if(ids.length)await client.query('delete from team_staff_contacts where team_id=$1 and not(client_key=any($2::text[]))',[teamId,ids]);else await client.query('delete from team_staff_contacts where team_id=$1',[teamId]);
}

export async function syncRosterFromContext(client,teamId,context={}){
  const teamResult=await client.query('select organization_id from teams where id=$1',[teamId]);
  if(!teamResult.rows[0])throw new Error('Team not found');
  const orgId=teamResult.rows[0].organization_id;
  const players=(Array.isArray(context.players)?context.players:[]).filter(p=>p&&typeof p==='object').slice(0,500);
  const seen=[];
  for(const p of players){
    const clientKey=text(p.id,120)||null;if(!clientKey)continue;
    const athlete=await client.query(`insert into athlete_profiles(organization_id,client_key,first_name,last_name,preferred_name,status)
      values($1,$2,$3,$4,$5,$6::athlete_status)
      on conflict(organization_id,client_key) where client_key is not null do update set first_name=excluded.first_name,last_name=excluded.last_name,preferred_name=excluded.preferred_name,status=excluded.status,updated_at=now()
      returning id`,[orgId,clientKey,text(p.first,100)||'Player',text(p.last,100)||'Unknown',text(p.preferredName,100)||null,p.status==='inactive'?'inactive':'active']);
    const athleteId=athlete.rows[0].id;seen.push(athleteId);
    const secondary=String(p.secondary||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,20);
    await client.query(`insert into roster_memberships(team_id,athlete_id,jersey_number,primary_position,secondary_positions,sport_attributes,status)
      values($1,$2,$3,$4,$5,$6::jsonb,$7::athlete_status)
      on conflict(team_id,athlete_id) do update set jersey_number=excluded.jersey_number,primary_position=excluded.primary_position,secondary_positions=excluded.secondary_positions,sport_attributes=excluded.sport_attributes,status=excluded.status,updated_at=now()`,[
        teamId,athleteId,text(p.number,30)||null,text(p.primary,40)||null,secondary,JSON.stringify({bats:text(p.bats,10),throws:text(p.throws,10),attendance:text(p.attendance,20),leagueAge:Number.isFinite(Number(p.leagueAge))?Number(p.leagueAge):null}),p.status==='inactive'?'inactive':'active'
      ]);
    const note=text(p.notes,10000);await client.query('update roster_memberships set coach_notes_encrypted=$3 where team_id=$1 and athlete_id=$2',[teamId,athleteId,note?seal(note,`roster-note:${teamId}:${athleteId}`):null]);
  }
  if(seen.length)await client.query(`update roster_memberships set status='inactive',updated_at=now() where team_id=$1 and not(athlete_id=any($2::uuid[]))`,[teamId,seen]);
  else await client.query(`update roster_memberships set status='inactive',updated_at=now() where team_id=$1`,[teamId]);
}

export function splitTeamContext(context={}){
  const publicContext=JSON.parse(JSON.stringify(context&&typeof context==='object'?context:{}));
  const playerNotes={};
  if(Array.isArray(publicContext.players))for(const p of publicContext.players){if(p&&p.id&&p.notes){playerNotes[String(p.id)]=String(p.notes);p.notes='';}}
  const privateState={playerNotes,playerDevelopment:publicContext.playerDevelopment&&typeof publicContext.playerDevelopment==='object'?publicContext.playerDevelopment:{}};
  publicContext.playerDevelopment={};
  return {publicContext,privateState};
}
export function sealPrivateTeamState(teamId,privateState={}){return seal(JSON.stringify(privateState),`team-private:${teamId}`);}
export function unsealPrivateTeamState(teamId,blob){if(!blob)return {};try{return JSON.parse(unseal(blob,`team-private:${teamId}`));}catch{return {};}}
export function mergePrivateTeamState(context={},privateState={}){
  const merged=JSON.parse(JSON.stringify(context&&typeof context==='object'?context:{}));const notes=privateState.playerNotes||{};
  if(Array.isArray(merged.players))for(const p of merged.players)if(p&&p.id)p.notes=String(notes[String(p.id)]||'');
  merged.playerDevelopment=privateState.playerDevelopment&&typeof privateState.playerDevelopment==='object'?privateState.playerDevelopment:{};return merged;
}

export function memberSafeTeamState(context={}){
  const c=JSON.parse(JSON.stringify(context&&typeof context==='object'?context:{}));
  c.players=(Array.isArray(c.players)?c.players:[]).map(p=>({id:p.id,first:p.first,last:p.last,preferredName:p.preferredName||'',number:p.number||'',primary:p.primary||'',secondary:p.secondary||'',status:p.status||'active',attendance:p.attendance||'unknown',notes:''}));
  c.playerDevelopment={};c.unitAssignments={};c.unitLayoutKeys={};c.sequenceOrder=[];c.lineupPresets=[];c.gameSessions={};c.activeGameEventId=null;c.practices=[];c.weatherCache={};
  return c;
}
