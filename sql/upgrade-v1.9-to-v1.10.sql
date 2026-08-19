-- Team APP V1.10 credential-free Neon Data API bridge.
-- All application access goes through app_api(); direct table access is revoked from Data API roles.

create table if not exists team_private_state_json (
  team_id uuid primary key references teams(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists team_document_blobs (
  document_id uuid primary key references team_documents(id) on delete cascade,
  content bytea not null,
  created_at timestamptz not null default now()
);


create table if not exists app_rate_windows (
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  primary key(user_id,action)
);

alter table conversation_key_envelopes add column if not exists sender_public_key_jwk jsonb;

create unique index if not exists uq_form_assignments_target on form_assignments(form_template_id,assigned_user_id,coalesce(athlete_id,'00000000-0000-0000-0000-000000000000'::uuid));

create or replace function app_role_rank(p_role organization_role)
returns integer language sql immutable as $$
  select case p_role::text when 'owner' then 100 when 'admin' then 90 when 'coach' then 80 when 'assistant_coach' then 70 when 'manager' then 65 when 'guardian' then 30 when 'member' then 20 when 'readonly' then 10 else 0 end
$$;

create or replace function app_check_rate(p_user uuid,p_action text,p_limit integer,p_window_seconds integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c integer; started timestamptz; begin
  insert into app_rate_windows(user_id,action,window_started_at,request_count) values(p_user,p_action,now(),1)
  on conflict(user_id,action) do update set
    request_count=case when app_rate_windows.window_started_at <= now()-make_interval(secs=>p_window_seconds) then 1 else app_rate_windows.request_count+1 end,
    window_started_at=case when app_rate_windows.window_started_at <= now()-make_interval(secs=>p_window_seconds) then now() else app_rate_windows.window_started_at end
  returning request_count,window_started_at into c,started;
  if c>p_limit then raise exception 'rate_limit_exceeded:%',p_action using errcode='P0001'; end if;
end $$;

create or replace function app_validate_context(p_context jsonb)
returns void language plpgsql immutable as $$
begin
  if jsonb_typeof(coalesce(p_context,'{}'::jsonb))<>'object' then raise exception 'invalid_team_context'; end if;
  if pg_column_size(coalesce(p_context,'{}'::jsonb))>4194304 then raise exception 'team_state_too_large'; end if;
  if p_context ? 'players' and (jsonb_typeof(p_context->'players')<>'array' or jsonb_array_length(p_context->'players')>500) then raise exception 'invalid_players'; end if;
  if p_context ? 'events' and (jsonb_typeof(p_context->'events')<>'array' or jsonb_array_length(p_context->'events')>1000) then raise exception 'invalid_events'; end if;
  if p_context ? 'practices' and (jsonb_typeof(p_context->'practices')<>'array' or jsonb_array_length(p_context->'practices')>1000) then raise exception 'invalid_practices'; end if;
end $$;

create or replace function app_validate_document(p_name text,p_mime text)
returns void language plpgsql immutable as $$
declare n text:=lower(coalesce(p_name,'')); m text:=lower(split_part(coalesce(p_mime,'application/octet-stream'),';',1)); begin
  if n !~ '\.(pdf|png|jpe?g|webp|txt|csv|docx?|xlsx?)$' then raise exception 'file_type_not_allowed'; end if;
  if m in ('text/html','application/xhtml+xml','image/svg+xml','text/javascript','application/javascript','application/x-javascript') then raise exception 'content_type_not_allowed'; end if;
end $$;

create or replace function app_current_user_id()
returns uuid
language plpgsql
security definer
set search_path=public,neon_auth,auth,pg_temp
as $$
declare
  v_auth_id uuid;
  v_user uuid;
  v_email text;
  v_name text;
begin
  v_auth_id := auth.user_id()::uuid;
  if v_auth_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select email,name into v_email,v_name from neon_auth."user" where id=v_auth_id;
  if v_email is null then raise exception 'auth_user_not_found' using errcode='42501'; end if;
  insert into users(auth_subject,email,display_name)
    values(v_auth_id::text,v_email,v_name)
    on conflict(auth_subject) do update set email=excluded.email,display_name=excluded.display_name,updated_at=now()
    returning id into v_user;
  return v_user;
end $$;

create or replace function app_team_role(p_team uuid,p_user uuid)
returns organization_role
language sql
security definer
stable
set search_path=public,pg_temp
as $$ select role from team_memberships where team_id=p_team and user_id=p_user $$;

create or replace function app_is_coach(p_team uuid,p_user uuid)
returns boolean
language sql
security definer
stable
set search_path=public,pg_temp
as $$ select coalesce(app_team_role(p_team,p_user)::text in ('owner','admin','coach','assistant_coach','manager'),false) $$;

create or replace function app_public_context(p_context jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare v jsonb:=coalesce(p_context,'{}'::jsonb); begin
  if jsonb_typeof(v->'players')='array' then
    v:=jsonb_set(v,'{players}',coalesce((select jsonb_agg(case when jsonb_typeof(x)='object' then (x-'notes')||jsonb_build_object('notes','') else x end) from jsonb_array_elements(v->'players') x),'[]'::jsonb),true);
  end if;
  v:=jsonb_set(v,'{playerDevelopment}','{}'::jsonb,true);
  return v;
end $$;

create or replace function app_private_context(p_context jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare notes jsonb:='{}'::jsonb; x jsonb; begin
  if jsonb_typeof(p_context->'players')='array' then
    for x in select * from jsonb_array_elements(p_context->'players') loop
      if coalesce(x->>'id','')<>'' and coalesce(x->>'notes','')<>'' then notes:=notes||jsonb_build_object(x->>'id',x->>'notes'); end if;
    end loop;
  end if;
  return jsonb_build_object('playerNotes',notes,'playerDevelopment',case when jsonb_typeof(p_context->'playerDevelopment')='object' then p_context->'playerDevelopment' else '{}'::jsonb end);
end $$;

create or replace function app_merge_context(p_public jsonb,p_private jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare v jsonb:=coalesce(p_public,'{}'::jsonb); notes jsonb:=coalesce(p_private->'playerNotes','{}'::jsonb); x jsonb; arr jsonb:='[]'::jsonb; begin
  if jsonb_typeof(v->'players')='array' then
    for x in select * from jsonb_array_elements(v->'players') loop
      arr:=arr||jsonb_build_array(x||jsonb_build_object('notes',coalesce(notes->>coalesce(x->>'id',''),'')));
    end loop;
    v:=jsonb_set(v,'{players}',arr,true);
  end if;
  v:=jsonb_set(v,'{playerDevelopment}',case when jsonb_typeof(p_private->'playerDevelopment')='object' then p_private->'playerDevelopment' else '{}'::jsonb end,true);
  return v;
end $$;

create or replace function app_member_context(p_context jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare v jsonb:=coalesce(p_context,'{}'::jsonb); x jsonb; arr jsonb:='[]'::jsonb; begin
  if jsonb_typeof(v->'players')='array' then
    for x in select * from jsonb_array_elements(v->'players') loop
      arr:=arr||jsonb_build_array(jsonb_build_object('id',x->'id','first',x->'first','last',x->'last','preferredName',coalesce(x->'preferredName','""'::jsonb),'number',coalesce(x->'number','""'::jsonb),'primary',coalesce(x->'primary','""'::jsonb),'secondary',coalesce(x->'secondary','""'::jsonb),'status',coalesce(x->'status','"active"'::jsonb),'attendance',coalesce(x->'attendance','"unknown"'::jsonb),'notes',''));
    end loop;
  end if;
  v:=jsonb_set(v,'{players}',arr,true);
  v:=jsonb_set(v,'{playerDevelopment}','{}'::jsonb,true);
  v:=jsonb_set(v,'{unitAssignments}','{}'::jsonb,true);
  v:=jsonb_set(v,'{unitLayoutKeys}','{}'::jsonb,true);
  v:=jsonb_set(v,'{sequenceOrder}','[]'::jsonb,true);
  v:=jsonb_set(v,'{lineupPresets}','[]'::jsonb,true);
  v:=jsonb_set(v,'{gameSessions}','{}'::jsonb,true);
  v:=jsonb_set(v,'{activeGameEventId}','null'::jsonb,true);
  v:=jsonb_set(v,'{practices}','[]'::jsonb,true);
  v:=jsonb_set(v,'{weatherCache}','{}'::jsonb,true);
  return v;
end $$;

create or replace function app_sync_roster(p_team uuid,p_context jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_org uuid; p jsonb; v_key text; v_ath uuid; v_seen uuid[]:='{}'; v_secondary text[]; begin
  select organization_id into v_org from teams where id=p_team;
  if v_org is null then raise exception 'team_not_found'; end if;
  if jsonb_typeof(p_context->'players')='array' then
    for p in select * from jsonb_array_elements(p_context->'players') limit 500 loop
      v_key:=left(coalesce(p->>'id',''),120); if v_key='' then continue; end if;
      insert into athlete_profiles(organization_id,client_key,first_name,last_name,preferred_name,status)
      values(v_org,v_key,left(coalesce(nullif(p->>'first',''),'Player'),100),left(coalesce(nullif(p->>'last',''),'Unknown'),100),nullif(left(coalesce(p->>'preferredName',''),100),''),case when p->>'status'='inactive' then 'inactive'::athlete_status else 'active'::athlete_status end)
      on conflict(organization_id,client_key) where client_key is not null do update set first_name=excluded.first_name,last_name=excluded.last_name,preferred_name=excluded.preferred_name,status=excluded.status,updated_at=now()
      returning id into v_ath;
      v_seen:=array_append(v_seen,v_ath);
      select coalesce(array_agg(left(trim(x),40)) filter(where trim(x)<>''),'{}'::text[]) into v_secondary from unnest(string_to_array(coalesce(p->>'secondary',''),',')) x;
      insert into roster_memberships(team_id,athlete_id,jersey_number,primary_position,secondary_positions,sport_attributes,status)
      values(p_team,v_ath,nullif(left(coalesce(p->>'number',''),30),''),nullif(left(coalesce(p->>'primary',''),40),''),v_secondary,
        jsonb_build_object('bats',left(coalesce(p->>'bats',''),10),'throws',left(coalesce(p->>'throws',''),10),'attendance',left(coalesce(p->>'attendance',''),20),'leagueAge',case when coalesce(p->>'leagueAge','')~'^[0-9]+$' then (p->>'leagueAge')::int else null end),
        case when p->>'status'='inactive' then 'inactive'::athlete_status else 'active'::athlete_status end)
      on conflict(team_id,athlete_id) do update set jersey_number=excluded.jersey_number,primary_position=excluded.primary_position,secondary_positions=excluded.secondary_positions,sport_attributes=excluded.sport_attributes,status=excluded.status,updated_at=now();
    end loop;
  end if;
  if cardinality(v_seen)>0 then update roster_memberships set status='inactive',updated_at=now() where team_id=p_team and not(athlete_id=any(v_seen));
  else update roster_memberships set status='inactive',updated_at=now() where team_id=p_team; end if;
end $$;

create or replace function app_sync_staff(p_team uuid,p_team_record jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare s jsonb; v_key text; v_seen text[]:='{}'; v_label text; v_role organization_role; begin
  if jsonb_typeof(p_team_record->'staff')='array' then
    for s in select * from jsonb_array_elements(p_team_record->'staff') limit 100 loop
      v_label:=left(coalesce(nullif(s->>'role',''),'Assistant Coach'),80);
      v_key:=left(coalesce(nullif(s->>'id',''),v_label||':'||coalesce(s->>'email','')||':'||coalesce(s->>'name','')),120); if v_key='' then continue; end if;
      v_seen:=array_append(v_seen,v_key);
      v_role:=case lower(v_label) when 'owner' then 'owner' when 'admin' then 'admin' when 'head coach' then 'coach' when 'coach' then 'coach' when 'assistant coach' then 'assistant_coach' when 'assistant_coach' then 'assistant_coach' when 'team manager' then 'manager' when 'manager' then 'manager' when 'scorekeeper' then 'member' else 'assistant_coach' end;
      insert into team_staff_contacts(team_id,client_key,name,role,role_label,email,phone)
      values(p_team,v_key,left(coalesce(nullif(s->>'name',''),'Staff'),160),v_role,v_label,nullif(left(coalesce(s->>'email',''),320),''),nullif(left(coalesce(s->>'phone',''),60),''))
      on conflict(team_id,client_key) do update set name=excluded.name,role=excluded.role,role_label=excluded.role_label,email=excluded.email,phone=excluded.phone,updated_at=now();
    end loop;
  end if;
  if cardinality(v_seen)>0 then delete from team_staff_contacts where team_id=p_team and not(client_key=any(v_seen)); else delete from team_staff_contacts where team_id=p_team; end if;
end $$;

create or replace function app_api(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,neon_auth,auth,pg_temp
as $$
declare
  u uuid:=app_current_user_id();
  aid uuid:=auth.user_id()::uuid;
  v_role organization_role;
  v_team uuid;
  org_id uuid;
  sport_id uuid;
  season_id uuid;
  v_id uuid;
  v_id2 uuid;
  v_revision bigint;
  v_current bigint;
  v_token text;
  v_hash text;
  v_code text;
  v_email text;
  v_json jsonb;
  v_private jsonb;
  v_state jsonb;
  v_row jsonb;
  v_list jsonb;
  v_bool boolean;
  v_text text;
  v_count int;
  f jsonb;
  a jsonb;
begin
  perform app_check_rate(u,'all',1200,60);
  if p_action='team.create' then perform app_check_rate(u,'team.create',20,86400); end if;
  if p_action='team.state.update' then perform app_check_rate(u,'team.state.update',120,60); end if;
  if p_action='invitation.create' then perform app_check_rate(u,'invitation.create',20,3600); end if;
  if p_action='join.create' then perform app_check_rate(u,'join.create',20,3600); end if;
  if p_action='conversation.create' then perform app_check_rate(u,'conversation.create',60,3600); end if;
  if p_action='form.create' then perform app_check_rate(u,'form.create',50,3600); end if;
  if p_action='form.assign' then perform app_check_rate(u,'form.assign',200,3600); end if;
  if p_action='crypto.put' then perform app_check_rate(u,'crypto.put',30,3600); end if;
  if p_action='join.redeem' then perform app_check_rate(u,'join.redeem',30,3600); end if;
  if p_action='document.upload' then perform app_check_rate(u,'document.upload',20,3600); end if;
  if p_action='conversation.message.send' then perform app_check_rate(u,'conversation.message.send',120,60); end if;
  if p_action='form.submit' then perform app_check_rate(u,'form.submit',30,60); end if;
  -- Account / team discovery
  if p_action='me' then
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'short_name',t.short_name,'role',tm.role,'sport_key',sp.code,'sport_name',sp.name,'season_name',s.name) order by t.created_at),'[]'::jsonb)
      into v_list from team_memberships tm join teams t on t.id=tm.team_id join seasons s on s.id=t.season_id join sports sp on sp.id=s.sport_id where tm.user_id=u;
    return jsonb_build_object('user',(select to_jsonb(x) from (select id,email,display_name from users where id=u) x),'authUser',(select jsonb_build_object('id',id,'email',email,'name',name) from neon_auth."user" where id=aid),'teams',v_list);
  end if;

  if p_action='team.create' then
    if coalesce(p_payload->>'name','')='' then raise exception 'team_name_required'; end if;
    perform app_validate_context(coalesce(p_payload->'context','{}'::jsonb));
    select id into sport_id from sports where code=p_payload->>'sportKey'; if sport_id is null then raise exception 'sport_not_seeded'; end if;
    select o.id into org_id from organizations o join organization_memberships om on om.organization_id=o.id where om.user_id=u and om.role in ('owner','admin') order by o.created_at limit 1;
    if org_id is null then insert into organizations(name) values(coalesce((select name from neon_auth."user" where id=aid),'Coach')||' Teams') returning id into org_id; insert into organization_memberships values(org_id,u,'owner',now()); end if;
    insert into seasons(organization_id,sport_id,name) values(org_id,sport_id,left(coalesce(nullif(p_payload->>'season',''),extract(year from current_date)::text||' Season'),100)) returning id into season_id;
    f:=coalesce(p_payload->'teamRecord','{}'::jsonb);
    insert into teams(organization_id,season_id,name,short_name,age_group,division,governing_body,rule_source_url,local_rules_note,local_rule_details,home_location,branding,color,default_layouts,league_key,league_name,competition_profile_key,rule_label,rule_source_note)
      values(org_id,season_id,left(p_payload->>'name',160),nullif(left(coalesce(p_payload->>'shortName',f->>'shortName',''),60),''),nullif(left(coalesce(f->>'ageGroup',''),100),''),nullif(left(coalesce(f->>'division',''),100),''),nullif(left(coalesce(f->>'governingBody',''),180),''),nullif(left(coalesce(f->>'ruleSourceUrl',''),1000),''),nullif(left(coalesce(f->>'localRulesNote',''),5000),''),coalesce(f->'localRuleDetails','{}'::jsonb),coalesce(f->'homeLocation','{}'::jsonb),coalesce(f->'branding','{}'::jsonb),nullif(left(coalesce(f#>>'{branding,primaryColor}',f->>'color',''),20),''),coalesce(f->'defaultLayouts','{}'::jsonb),nullif(left(coalesce(f->>'leagueKey',''),100),''),nullif(left(coalesce(f->>'leagueName',''),180),''),nullif(left(coalesce(f->>'competitionProfileId',''),160),''),nullif(left(coalesce(f->>'ruleSet',''),220),''),nullif(left(coalesce(f->>'ruleSourceNote',''),2000),'')) returning id into v_team;
    insert into team_memberships values(v_team,u,'owner',now());
    v_state:=app_public_context(coalesce(p_payload->'context','{}'::jsonb)); v_private:=app_private_context(coalesce(p_payload->'context','{}'::jsonb));
    insert into team_state_snapshots(team_id,state,revision,updated_by) values(v_team,v_state,1,u);
    insert into team_private_state_json(team_id,state,updated_by) values(v_team,v_private,u);
    perform app_sync_roster(v_team,coalesce(p_payload->'context','{}'::jsonb)); perform app_sync_staff(v_team,f);
    insert into audit_events(organization_id,actor_user_id,action,entity_type,entity_id) values(org_id,u,'team.create','team',v_team::text);
    return jsonb_build_object('team',jsonb_build_object('id',v_team,'name',p_payload->>'name'),'revision',1);
  end if;

  v_team:=nullif(p_payload->>'teamId','')::uuid;
  if v_team is not null then v_role:=app_team_role(v_team,u); end if;

  if p_action='team.state.get' then
    if v_role is null then raise exception 'not_a_team_member' using errcode='42501'; end if;
    select coalesce(ts.revision,0),coalesce(ts.state,'{}'::jsonb),coalesce(tp.state,'{}'::jsonb),
      jsonb_build_object('id',t.id,'name',t.name,'short_name',t.short_name,'age_group',t.age_group,'division',t.division,'governing_body',t.governing_body,'rule_source_url',t.rule_source_url,'rule_source_note',t.rule_source_note,'local_rules_note',t.local_rules_note,'local_rule_details',t.local_rule_details,'home_location',t.home_location,'branding',t.branding,'color',t.color,'default_layouts',t.default_layouts,'league_key',t.league_key,'league_name',t.league_name,'competition_profile_key',t.competition_profile_key,'rule_label',t.rule_label,'season_name',s.name,'sport_key',sp.code)
      into v_revision,v_state,v_private,v_json from teams t join seasons s on s.id=t.season_id join sports sp on sp.id=s.sport_id left join team_state_snapshots ts on ts.team_id=t.id left join team_private_state_json tp on tp.team_id=t.id where t.id=v_team;
    if app_is_coach(v_team,u) then v_state:=app_merge_context(v_state,v_private); else v_state:=app_member_context(v_state); end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',sc.client_key,'name',sc.name,'role',coalesce(sc.role_label,initcap(replace(sc.role::text,'_',' '))),'email',case when app_is_coach(v_team,u) then sc.email else null end,'phone',case when app_is_coach(v_team,u) then sc.phone else null end) order by sc.created_at),'[]'::jsonb) into v_list from team_staff_contacts sc where sc.team_id=v_team;
    return v_json||jsonb_build_object('state',v_state,'revision',v_revision,'staff',v_list,'role',v_role);
  end if;

  if p_action='team.state.update' then
    if not app_is_coach(v_team,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    perform app_validate_context(coalesce(p_payload->'context','{}'::jsonb));
    v_revision:=coalesce((p_payload->>'revision')::bigint,0);
    f:=coalesce(p_payload->'teamRecord','{}'::jsonb);
    v_state:=app_public_context(coalesce(p_payload->'context','{}'::jsonb)); v_private:=app_private_context(coalesce(p_payload->'context','{}'::jsonb));
    -- Atomic optimistic write: only one caller holding the expected revision can advance it.
    update team_state_snapshots set state=v_state,revision=revision+1,updated_by=u,updated_at=now() where team_id=v_team and revision=v_revision returning revision into v_current;
    if not found then select coalesce(revision,0) into v_current from team_state_snapshots where team_id=v_team; return jsonb_build_object('error','revision_conflict','status',409,'revision',coalesce(v_current,0),'state',(select state from team_state_snapshots where team_id=v_team)); end if;
    v_revision:=v_current;
    update teams set name=coalesce(nullif(left(f->>'name',160),''),name),short_name=nullif(left(coalesce(f->>'shortName',''),60),''),age_group=nullif(left(coalesce(f->>'ageGroup',''),100),''),division=nullif(left(coalesce(f->>'division',''),100),''),governing_body=nullif(left(coalesce(f->>'governingBody',''),180),''),rule_source_url=nullif(left(coalesce(f->>'ruleSourceUrl',''),1000),''),local_rules_note=nullif(left(coalesce(f->>'localRulesNote',''),5000),''),local_rule_details=coalesce(f->'localRuleDetails','{}'::jsonb),home_location=coalesce(f->'homeLocation','{}'::jsonb),branding=coalesce(f->'branding','{}'::jsonb),color=coalesce(nullif(left(coalesce(f#>>'{branding,primaryColor}',f->>'color',''),20),''),color),default_layouts=coalesce(f->'defaultLayouts','{}'::jsonb),league_key=nullif(left(coalesce(f->>'leagueKey',''),100),''),league_name=nullif(left(coalesce(f->>'leagueName',''),180),''),competition_profile_key=nullif(left(coalesce(f->>'competitionProfileId',''),160),''),rule_label=nullif(left(coalesce(f->>'ruleSet',''),220),''),rule_source_note=nullif(left(coalesce(f->>'ruleSourceNote',''),2000),''),updated_at=now() where id=v_team;
    insert into team_private_state_json(team_id,state,updated_by) values(v_team,v_private,u) on conflict(team_id) do update set state=excluded.state,updated_by=excluded.updated_by,updated_at=now();
    perform app_sync_roster(v_team,coalesce(p_payload->'context','{}'::jsonb)); perform app_sync_staff(v_team,f);
    insert into audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata) select organization_id,u,'team_state.update','team',v_team::text,jsonb_build_object('revision',v_revision) from teams where id=v_team;
    return jsonb_build_object('revision',v_revision,'updated_at',now());
  end if;

  if p_action='team.members' then
    if v_role is null then raise exception 'not_a_team_member' using errcode='42501'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'display_name',x.display_name,'email',case when app_is_coach(v_team,u) then x.email else null end,'role',x.role,'athletes',x.athletes) order by x.display_name),'[]'::jsonb) into v_list from (
      select us.id,us.display_name,us.email,tm.role,coalesce((select jsonb_agg(jsonb_build_object('id',ap.id,'clientKey',ap.client_key,'name',trim(ap.first_name||' '||ap.last_name))) from guardian_relationships gr join athlete_profiles ap on ap.id=gr.athlete_id join roster_memberships rm on rm.athlete_id=ap.id and rm.team_id=tm.team_id where gr.guardian_user_id=us.id),'[]'::jsonb) athletes from team_memberships tm join users us on us.id=tm.user_id where tm.team_id=v_team
    ) x;
    return v_list;
  end if;

  -- Invitations / join codes. In this credential-free staging path, the invitation URL is returned for the coach to share.
  if p_action='invitation.create' then
    if coalesce(v_role::text,'') not in ('owner','admin','coach') then raise exception 'admin_role_required' using errcode='42501'; end if;
    if coalesce(p_payload->>'role','guardian') not in ('assistant_coach','manager','guardian','readonly') then raise exception 'invalid_invitation_role'; end if;
    v_email:=lower(left(coalesce(p_payload->>'email',''),320)); if v_email='' then raise exception 'email_required'; end if;
    v_token:=encode(gen_random_bytes(24),'hex'); v_hash:=encode(digest(v_token,'sha256'),'hex');
    v_id2:=null;
    if coalesce(p_payload->>'athleteClientKey','')<>'' then select ap.id into v_id2 from roster_memberships rm join athlete_profiles ap on ap.id=rm.athlete_id where rm.team_id=v_team and ap.client_key=p_payload->>'athleteClientKey' limit 1; end if;
    insert into team_invitations(team_id,athlete_id,email,role,token_hash,expires_at,created_by) values(v_team,v_id2,v_email,coalesce(nullif(p_payload->>'role',''),'guardian')::organization_role,v_hash,now()+make_interval(hours=>least(greatest(coalesce((p_payload->>'expiresHours')::int,72),1),336)),u) returning id into v_id;
    return jsonb_build_object('id',v_id,'email',v_email,'role',coalesce(nullif(p_payload->>'role',''),'guardian'),'token',v_token,'inviteUrl','?invite='||v_token);
  end if;

  if p_action='invitation.list' then
    if coalesce(v_role::text,'') not in ('owner','admin','coach') then raise exception 'admin_role_required' using errcode='42501'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_list from (select id,email,role,expires_at,accepted_at,revoked_at,created_at from team_invitations where team_id=v_team limit 100) x; return v_list;
  end if;

  if p_action='invitation.accept' then
    v_token:=coalesce(p_payload->>'token',''); v_hash:=encode(digest(v_token,'sha256'),'hex'); v_email:=lower(coalesce((select email from neon_auth."user" where id=aid),''));
    select i.id,i.team_id,i.athlete_id,i.role,t.organization_id,t.name into v_id,v_team,v_id2,v_role,org_id,v_text from team_invitations i join teams t on t.id=i.team_id where i.token_hash=v_hash and i.revoked_at is null and i.accepted_at is null and i.expires_at>now() and lower(i.email)=v_email limit 1;
    if v_id is null then raise exception 'invitation_expired_or_invalid'; end if;
    insert into team_memberships(team_id,user_id,role) values(v_team,u,v_role) on conflict(team_id,user_id) do update set role=case when app_role_rank(excluded.role)>app_role_rank(team_memberships.role) then excluded.role else team_memberships.role end;
    insert into organization_memberships(organization_id,user_id,role) values(org_id,u,v_role) on conflict(organization_id,user_id) do update set role=case when app_role_rank(excluded.role)>app_role_rank(organization_memberships.role) then excluded.role else organization_memberships.role end;
    if v_id2 is not null and v_role='guardian' then insert into guardian_relationships(athlete_id,guardian_user_id,relationship_label) values(v_id2,u,'Guardian') on conflict do nothing; end if;
    update team_invitations set accepted_by=u,accepted_at=now() where id=v_id;
    return jsonb_build_object('teamId',v_team,'teamName',v_text,'role',v_role);
  end if;

  if p_action='join.create' then
    if coalesce(v_role::text,'') not in ('owner','admin','coach') then raise exception 'admin_role_required' using errcode='42501'; end if;
    if coalesce(p_payload->>'role','guardian') <> 'guardian' then raise exception 'invalid_join_role'; end if;
    v_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,8)); v_hash:=encode(digest(v_code,'sha256'),'hex'); v_id2:=null;
    if coalesce(p_payload->>'athleteClientKey','')<>'' then select ap.id into v_id2 from roster_memberships rm join athlete_profiles ap on ap.id=rm.athlete_id where rm.team_id=v_team and ap.client_key=p_payload->>'athleteClientKey' limit 1; end if;
    insert into team_join_codes(team_id,athlete_id,role,code_hash,code_hint,max_uses,expires_at,created_by) values(v_team,v_id2,coalesce(nullif(p_payload->>'role',''),'guardian')::organization_role,v_hash,right(v_code,4),least(greatest(coalesce((p_payload->>'maxUses')::int,1),1),100),case when p_payload ? 'expiresHours' then now()+make_interval(hours=>least(greatest((p_payload->>'expiresHours')::int,1),2160)) else null end,u) returning id into v_id;
    return jsonb_build_object('id',v_id,'role',coalesce(nullif(p_payload->>'role',''),'guardian'),'code',v_code,'code_hint',right(v_code,4));
  end if;

  if p_action='join.redeem' then
    v_code:=upper(regexp_replace(coalesce(p_payload->>'code',''),'[^A-Z0-9]','','g')); v_hash:=encode(digest(v_code,'sha256'),'hex');
    -- Conditional UPDATE claims one permitted use atomically, so concurrent redeems cannot exceed max_uses.
    v_id:=null; update team_join_codes set use_count=use_count+1,is_active=case when use_count+1>=max_uses then false else is_active end where code_hash=v_hash and is_active and use_count<max_uses and (expires_at is null or expires_at>now()) returning id,team_id,athlete_id,role into v_id,v_team,v_id2,v_role;
    if v_id is null then raise exception 'code_expired_or_invalid'; end if;
    select organization_id,name into org_id,v_text from teams where id=v_team;
    insert into team_memberships(team_id,user_id,role) values(v_team,u,v_role) on conflict(team_id,user_id) do update set role=case when app_role_rank(excluded.role)>app_role_rank(team_memberships.role) then excluded.role else team_memberships.role end;
    insert into organization_memberships(organization_id,user_id,role) values(org_id,u,v_role) on conflict(organization_id,user_id) do update set role=case when app_role_rank(excluded.role)>app_role_rank(organization_memberships.role) then excluded.role else organization_memberships.role end;
    if v_id2 is not null and v_role='guardian' then insert into guardian_relationships(athlete_id,guardian_user_id,relationship_label) values(v_id2,u,'Guardian') on conflict do nothing; end if;
    return jsonb_build_object('teamId',v_team,'teamName',v_text,'role',v_role);
  end if;

  -- Documents (5 MB cap for the credential-free Data API staging transport).
  if p_action='document.list' then
    if v_role is null then raise exception 'not_a_team_member' using errcode='42501'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_list from (
      select d.id,d.name,d.content_type,d.byte_size,d.category,d.visibility,d.description,d.sha256,d.created_at,d.uploaded_by,exists(select 1 from document_acknowledgments da where da.document_id=d.id and da.user_id=u) acknowledged
      from team_documents d where d.team_id=v_team and d.upload_completed_at is not null and (d.visibility='team' or (v_role='guardian' and d.visibility='guardians') or (app_is_coach(v_team,u) and d.visibility in ('guardians','coaches')) or (d.visibility='private' and d.uploaded_by=u))
    ) x; return v_list;
  end if;

  if p_action='document.upload' then
    if not app_is_coach(v_team,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('documents:'||v_team::text,0));
    v_text:=left(coalesce(p_payload->>'name',''),220); if v_text='' then raise exception 'file_name_required'; end if;
    perform app_validate_document(v_text,coalesce(p_payload->>'contentType','application/octet-stream'));
    if length(coalesce(p_payload->>'contentBase64',''))>7200000 then raise exception 'file_too_large'; end if;
    select count(*),coalesce(sum(byte_size),0) into v_count,v_current from team_documents where team_id=v_team and upload_completed_at is not null;
    if v_count>=100 then raise exception 'team_document_count_limit'; end if;
    v_revision:=octet_length(decode(coalesce(p_payload->>'contentBase64',''),'base64')); if v_current+v_revision>52428800 then raise exception 'team_document_storage_limit'; end if;
    v_id:=gen_random_uuid();
    insert into team_documents(id,team_id,uploaded_by,name,content_type,byte_size,category,visibility,storage_key,description,sha256,upload_completed_at)
      values(v_id,v_team,u,v_text,left(coalesce(p_payload->>'contentType','application/octet-stream'),180),octet_length(decode(coalesce(p_payload->>'contentBase64',''),'base64')),left(coalesce(nullif(p_payload->>'category',''),'General'),100),coalesce(nullif(p_payload->>'visibility',''),'team')::visibility_scope,'neon:'||v_id::text,nullif(left(coalesce(p_payload->>'description',''),3000),''),encode(digest(decode(coalesce(p_payload->>'contentBase64',''),'base64'),'sha256'),'hex'),now());
    if (select byte_size from team_documents where id=v_id)>5242880 then delete from team_documents where id=v_id; raise exception 'file_too_large_5mb'; end if;
    insert into team_document_blobs(document_id,content) values(v_id,decode(coalesce(p_payload->>'contentBase64',''),'base64'));
    return jsonb_build_object('documentId',v_id,'ok',true);
  end if;

  if p_action='document.get' then
    v_id:=(p_payload->>'documentId')::uuid; select team_id into v_team from team_documents where id=v_id; v_role:=app_team_role(v_team,u); if v_role is null then raise exception 'not_a_team_member' using errcode='42501'; end if;
    select jsonb_build_object('id',d.id,'name',d.name,'contentType',d.content_type,'contentBase64',encode(b.content,'base64')) into v_json from team_documents d join team_document_blobs b on b.document_id=d.id where d.id=v_id and (d.visibility='team' or (v_role='guardian' and d.visibility='guardians') or (app_is_coach(v_team,u) and d.visibility in ('guardians','coaches')) or (d.visibility='private' and d.uploaded_by=u)); if v_json is null then raise exception 'document_not_visible'; end if; return v_json;
  end if;

  if p_action='document.ack' then v_id:=(p_payload->>'documentId')::uuid; select team_id into v_team from team_documents where id=v_id; v_role:=app_team_role(v_team,u); if v_role is null then raise exception 'not_a_team_member'; end if; if not exists(select 1 from team_documents d where d.id=v_id and (d.visibility='team' or (v_role='guardian' and d.visibility='guardians') or (app_is_coach(v_team,u) and d.visibility in ('guardians','coaches')) or (d.visibility='private' and d.uploaded_by=u))) then raise exception 'document_not_visible' using errcode='42501'; end if; insert into document_acknowledgments(document_id,user_id) values(v_id,u) on conflict(document_id,user_id) do update set acknowledged_at=now(); return jsonb_build_object('ok',true,'acknowledgedAt',now()); end if;
  if p_action='document.delete' then v_id:=(p_payload->>'documentId')::uuid; if not app_is_coach(v_team,u) then raise exception 'coach_role_required'; end if; if exists(select 1 from team_documents where id=v_id and team_id=v_team and visibility='private' and uploaded_by<>u) then raise exception 'private_document_not_owned' using errcode='42501'; end if; delete from team_documents where id=v_id and team_id=v_team; return jsonb_build_object('ok',true); end if;

  -- Availability
  if p_action='availability.get' then
    if v_role is null then raise exception 'not_a_team_member'; end if; v_text:=p_payload->>'eventId';
    if not exists(select 1 from team_state_snapshots ts where ts.team_id=v_team and exists(select 1 from jsonb_array_elements(coalesce(ts.state->'events','[]'::jsonb)) e where e->>'id'=v_text)) then raise exception 'event_not_found'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.athlete_name),'[]'::jsonb) into v_list from (
      select ap.id,ap.client_key,trim(ap.first_name||' '||ap.last_name) athlete_name,rm.jersey_number,coalesce(ea.status,'') status,ea.note,ea.updated_at from roster_memberships rm join athlete_profiles ap on ap.id=rm.athlete_id left join event_availability ea on ea.team_id=rm.team_id and ea.athlete_id=ap.id and ea.event_client_id=v_text where rm.team_id=v_team and rm.status='active' and (app_is_coach(v_team,u) or exists(select 1 from guardian_relationships gr where gr.athlete_id=ap.id and gr.guardian_user_id=u))
    ) x; return v_list;
  end if;
  if p_action='availability.set' then
    if v_role is null then raise exception 'not_a_team_member'; end if; v_text:=p_payload->>'eventId'; if not exists(select 1 from team_state_snapshots ts where ts.team_id=v_team and exists(select 1 from jsonb_array_elements(coalesce(ts.state->'events','[]'::jsonb)) e where e->>'id'=v_text)) then raise exception 'event_not_found'; end if; select ap.id into v_id from roster_memberships rm join athlete_profiles ap on ap.id=rm.athlete_id where rm.team_id=v_team and ap.client_key=p_payload->>'athleteClientKey' and rm.status='active' limit 1; if v_id is null then raise exception 'athlete_not_found'; end if;
    if not app_is_coach(v_team,u) and not exists(select 1 from guardian_relationships where athlete_id=v_id and guardian_user_id=u and may_update_availability) then raise exception 'availability_not_allowed' using errcode='42501'; end if;
    insert into event_availability(team_id,event_client_id,athlete_id,status,note,updated_by) values(v_team,v_text,v_id,(p_payload->>'status'),nullif(left(coalesce(p_payload->>'note',''),500),''),u) on conflict(team_id,event_client_id,athlete_id) do update set status=excluded.status,note=excluded.note,updated_by=excluded.updated_by,updated_at=now(); return jsonb_build_object('ok',true);
  end if;

  -- User E2EE public keys and conversations
  if p_action='crypto.put' then insert into user_crypto_keys(user_id,algorithm,public_key_jwk,version) values(u,left(coalesce(p_payload->>'algorithm','ECDH-P256'),80),coalesce(p_payload->'publicKeyJwk','{}'::jsonb),coalesce((p_payload->>'version')::int,1)) on conflict(user_id) do update set algorithm=excluded.algorithm,public_key_jwk=excluded.public_key_jwk,version=excluded.version,rotated_at=now(); return jsonb_build_object('ok',true); end if;
  if p_action='crypto.get' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_list from (select k.user_id,k.algorithm,k.public_key_jwk,k.version from user_crypto_keys k where k.user_id in (select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'userIds','[]'::jsonb))) and exists(select 1 from team_memberships mine join team_memberships theirs on theirs.team_id=mine.team_id where mine.user_id=u and theirs.user_id=k.user_id)) x; return v_list; end if;

  if p_action='conversation.create' then
    if v_role is null then raise exception 'not_a_team_member'; end if; if coalesce(p_payload->>'kind','direct') not in ('direct','team','coaches','event') then raise exception 'invalid_conversation_kind'; end if; if coalesce(p_payload->>'kind','direct') in ('team','coaches','event') and not app_is_coach(v_team,u) then raise exception 'coach_role_required'; end if;
    select organization_id into org_id from teams where id=v_team; perform pg_advisory_xact_lock(hashtextextended('conversation:'||v_team::text,0)); if (select count(*) from conversations where team_id=v_team)>=250 then raise exception 'team_conversation_limit'; end if; insert into conversations(organization_id,team_id,kind,name,visibility) values(org_id,v_team,left(coalesce(p_payload->>'kind','direct'),30),nullif(left(coalesce(p_payload->>'name',''),160),''),coalesce(nullif(p_payload->>'visibility',''),'team')::visibility_scope) returning id into v_id;
    if p_payload->>'kind'='team' then for v_id2 in select user_id from team_memberships where team_id=v_team loop insert into conversation_members values(v_id,v_id2,now()) on conflict do nothing; end loop;
    elsif p_payload->>'kind'='coaches' then for v_id2 in select user_id from team_memberships where team_id=v_team and role::text in ('owner','admin','coach','assistant_coach','manager') loop insert into conversation_members values(v_id,v_id2,now()) on conflict do nothing; end loop;
    else insert into conversation_members values(v_id,u,now()) on conflict do nothing; for v_id2 in select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'memberUserIds','[]'::jsonb)) loop if exists(select 1 from team_memberships where team_id=v_team and user_id=v_id2) then insert into conversation_members values(v_id,v_id2,now()) on conflict do nothing; end if; end loop; if p_payload->>'kind'='direct' and (select count(*) from conversation_members where conversation_id=v_id)<2 then delete from conversations where id=v_id; raise exception 'direct_recipient_required'; end if; end if;
    return (select to_jsonb(c)||jsonb_build_object('memberUserIds',(select coalesce(jsonb_agg(user_id),'[]'::jsonb) from conversation_members where conversation_id=c.id)) from conversations c where c.id=v_id);
  end if;
  if p_action='conversation.list' then select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_list from (select c.id,c.team_id,c.kind,c.name,c.visibility,c.created_at,cm.joined_at,mr.last_read_at from conversation_members cm join conversations c on c.id=cm.conversation_id left join message_reads mr on mr.conversation_id=c.id and mr.user_id=cm.user_id where cm.user_id=u and (v_team is null or c.team_id=v_team)) x; return v_list; end if;
  v_id:=nullif(p_payload->>'conversationId','')::uuid;
  if p_action like 'conversation.%' and v_id is not null and not exists(select 1 from conversation_members where conversation_id=v_id and user_id=u) then raise exception 'not_a_conversation_member' using errcode='42501'; end if;
  if p_action='conversation.members' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_list from (select us.id,us.display_name,case when app_is_coach(c.team_id,u) or us.id=u then us.email else null end email,k.algorithm,k.public_key_jwk,k.version from conversation_members cm join conversations c on c.id=cm.conversation_id join users us on us.id=cm.user_id left join user_crypto_keys k on k.user_id=us.id where cm.conversation_id=v_id) x; return v_list; end if;
  if p_action='conversation.envelopes.put' then select public_key_jwk into v_json from user_crypto_keys where user_id=u; if v_json is null then raise exception 'sender_crypto_key_missing'; end if; if jsonb_array_length(coalesce(p_payload->'envelopes','[]'::jsonb))>200 then raise exception 'too_many_key_envelopes'; end if; for a in select * from jsonb_array_elements(coalesce(p_payload->'envelopes','[]'::jsonb)) loop if length(coalesce(a->>'wrappedKey',''))>4096 or length(coalesce(a->>'nonce',''))>256 then raise exception 'invalid_key_envelope'; end if; if exists(select 1 from conversation_members where conversation_id=v_id and user_id=(a->>'recipientUserId')::uuid) then insert into conversation_key_envelopes(conversation_id,recipient_user_id,sender_user_id,sender_public_key_jwk,key_version,wrapped_key,nonce) values(v_id,(a->>'recipientUserId')::uuid,u,v_json,coalesce((p_payload->>'keyVersion')::int,1),decode(a->>'wrappedKey','base64'),decode(a->>'nonce','base64')) on conflict(conversation_id,recipient_user_id,key_version) do update set sender_user_id=excluded.sender_user_id,sender_public_key_jwk=excluded.sender_public_key_jwk,wrapped_key=excluded.wrapped_key,nonce=excluded.nonce,created_at=now(); end if; end loop; return jsonb_build_object('ok',true); end if;
  if p_action='conversation.envelope.get' then select jsonb_build_object('key_version',e.key_version,'sender_user_id',e.sender_user_id,'wrapped_key',encode(e.wrapped_key,'base64'),'nonce',encode(e.nonce,'base64'),'sender_public_key',coalesce(e.sender_public_key_jwk,k.public_key_jwk)) into v_json from conversation_key_envelopes e left join user_crypto_keys k on k.user_id=e.sender_user_id where e.conversation_id=v_id and e.recipient_user_id=u and (p_payload->>'keyVersion' is null or e.key_version=(p_payload->>'keyVersion')::int) order by e.key_version desc limit 1; if v_json is null then raise exception 'key_envelope_not_found'; end if; return v_json; end if;
  if p_action='conversation.message.send' then if length(coalesce(p_payload->>'ciphertext',''))<1 or length(coalesce(p_payload->>'ciphertext',''))>32768 or length(coalesce(p_payload->>'nonce',''))<8 or length(coalesce(p_payload->>'nonce',''))>256 or length(coalesce(p_payload->>'clientMessageId',''))<1 or length(coalesce(p_payload->>'clientMessageId',''))>160 then raise exception 'invalid_message_payload'; end if; insert into messages(conversation_id,sender_user_id,ciphertext,nonce,crypto_version,client_message_id) values(v_id,u,decode(p_payload->>'ciphertext','base64'),decode(p_payload->>'nonce','base64'),left(coalesce(p_payload->>'cryptoVersion','v1'),80),left(p_payload->>'clientMessageId',160)) on conflict(sender_user_id,client_message_id) do update set client_message_id=excluded.client_message_id returning id,sent_at into v_id2,v_text; return jsonb_build_object('id',v_id2,'sent_at',v_text); end if;
  if p_action='conversation.message.list' then if coalesce(p_payload->>'after','')='' then select coalesce(jsonb_agg(to_jsonb(x) order by x.sent_at,x.id),'[]'::jsonb) into v_list from (select * from (select m.id,m.sender_user_id,us.display_name sender_name,encode(m.ciphertext,'base64') ciphertext,encode(m.nonce,'base64') nonce,m.crypto_version,m.client_message_id,m.sent_at,m.edited_at,m.deleted_at from messages m join users us on us.id=m.sender_user_id where m.conversation_id=v_id order by m.sent_at desc,m.id desc limit 250) q order by sent_at asc,id asc) x; else select coalesce(jsonb_agg(to_jsonb(x) order by x.sent_at,x.id),'[]'::jsonb) into v_list from (select m.id,m.sender_user_id,us.display_name sender_name,encode(m.ciphertext,'base64') ciphertext,encode(m.nonce,'base64') nonce,m.crypto_version,m.client_message_id,m.sent_at,m.edited_at,m.deleted_at from messages m join users us on us.id=m.sender_user_id where m.conversation_id=v_id and (m.sent_at>(p_payload->>'after')::timestamptz or (m.sent_at=(p_payload->>'after')::timestamptz and (coalesce(p_payload->>'afterId','')='' or m.id::text>p_payload->>'afterId'))) order by m.sent_at asc,m.id asc limit 250) x; end if; return v_list; end if;
  if p_action='conversation.read' then insert into message_reads(conversation_id,user_id,last_read_at) values(v_id,u,now()) on conflict(conversation_id,user_id) do update set last_read_at=now(); return jsonb_build_object('ok',true); end if;

  -- Forms
  if p_action='form.list' then
    if v_role is null then raise exception 'not_a_team_member'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_list from (select ft.id,ft.title,ft.description,ft.visibility,ft.schema,ft.requires_signature,ft.created_at,coalesce((select jsonb_agg(jsonb_build_object('id',fa.id,'athlete_id',fa.athlete_id,'athlete_name',case when ap.id is not null then trim(ap.first_name||' '||ap.last_name) end,'due_at',fa.due_at,'submitted',exists(select 1 from form_submissions fs where fs.assignment_id=fa.id and fs.submitted_by=u)) order by fa.created_at) from form_assignments fa left join athlete_profiles ap on ap.id=fa.athlete_id where fa.form_template_id=ft.id and fa.assigned_user_id=u),'[]'::jsonb) my_assignments from form_templates ft where ft.team_id=v_team and ft.archived_at is null and (app_is_coach(v_team,u) or (ft.visibility in ('team','guardians') and exists(select 1 from form_assignments mine where mine.form_template_id=ft.id and mine.assigned_user_id=u)))) x; return v_list;
  end if;
  if p_action='form.create' then
    if not app_is_coach(v_team,u) then raise exception 'coach_role_required'; end if; if btrim(coalesce(p_payload->>'title',''))='' then raise exception 'form_title_required'; end if; if jsonb_typeof(coalesce(p_payload->'fields','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'fields','[]'::jsonb))>50 then raise exception 'invalid_form_fields'; end if; if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'fields','[]'::jsonb)) x where btrim(coalesce(x->>'id',''))='' or length(x->>'id')>80 or btrim(coalesce(x->>'label',''))='' or length(x->>'label')>300 or coalesce(x->>'type','text') not in ('text','textarea','number','date','yes_no','checkbox','select')) then raise exception 'invalid_form_field'; end if; if exists(select 1 from (select x->>'id' id,count(*) c from jsonb_array_elements(coalesce(p_payload->'fields','[]'::jsonb)) x group by x->>'id' having count(*)>1) d) then raise exception 'duplicate_form_field'; end if; if coalesce(p_payload->>'visibility','guardians') not in ('team','guardians','coaches','private') then raise exception 'invalid_form_visibility'; end if; insert into form_templates(team_id,title,description,visibility,schema,requires_signature,created_by) values(v_team,left(p_payload->>'title',180),nullif(left(coalesce(p_payload->>'description',''),3000),''),coalesce(nullif(p_payload->>'visibility',''),'guardians')::visibility_scope,jsonb_build_object('fields',coalesce(p_payload->'fields','[]'::jsonb)),coalesce((p_payload->>'requiresSignature')::boolean,false),u) returning id into v_id; return jsonb_build_object('id',v_id);
  end if;
  if p_action='form.assign' then
    if not app_is_coach(v_team,u) then raise exception 'coach_role_required'; end if; v_id:=(p_payload->>'formId')::uuid; v_id2:=(p_payload->>'userId')::uuid; if not exists(select 1 from form_templates where id=v_id and team_id=v_team and archived_at is null) or not exists(select 1 from team_memberships where team_id=v_team and user_id=v_id2) then raise exception 'invalid_assignment'; end if; if exists(select 1 from form_templates where id=v_id and visibility::text in ('coaches','private')) and not app_is_coach(v_team,v_id2) then raise exception 'restricted_form_requires_coach_assignee'; end if; org_id:=null; if coalesce(p_payload->>'athleteClientKey','')<>'' then select ap.id into org_id from roster_memberships rm join athlete_profiles ap on ap.id=rm.athlete_id where rm.team_id=v_team and ap.client_key=p_payload->>'athleteClientKey' limit 1; if org_id is null then raise exception 'athlete_not_on_team'; end if; if not exists(select 1 from guardian_relationships where athlete_id=org_id and guardian_user_id=v_id2) then raise exception 'athlete_not_linked_to_assigned_user'; end if; end if; sport_id:=null; select fa.id into sport_id from form_assignments fa where fa.form_template_id=v_id and fa.assigned_user_id=v_id2 and fa.athlete_id is not distinct from org_id order by fa.created_at desc limit 1; if sport_id is not null then return jsonb_build_object('id',sport_id,'existing',true); end if; insert into form_assignments(form_template_id,athlete_id,assigned_user_id,due_at,created_by) values(v_id,org_id,v_id2,nullif(p_payload->>'dueAt','')::timestamptz,u) on conflict do nothing returning id into sport_id; if sport_id is null then select fa.id into sport_id from form_assignments fa where fa.form_template_id=v_id and fa.assigned_user_id=v_id2 and fa.athlete_id is not distinct from org_id order by fa.created_at desc limit 1; return jsonb_build_object('id',sport_id,'existing',true); end if; return jsonb_build_object('id',sport_id); end if;
  if p_action='form.assignments' then if not app_is_coach(v_team,u) then raise exception 'coach_role_required'; end if; v_id:=(p_payload->>'formId')::uuid; select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_list from (select fa.id,fa.athlete_id,fa.assigned_user_id,fa.due_at,fa.created_at,us.display_name assigned_user_name,us.email assigned_user_email,case when ap.id is not null then trim(ap.first_name||' '||ap.last_name) end athlete_name,exists(select 1 from form_submissions fs where fs.assignment_id=fa.id) submitted from form_assignments fa left join users us on us.id=fa.assigned_user_id left join athlete_profiles ap on ap.id=fa.athlete_id where fa.form_template_id=v_id) x; return v_list; end if;
  if p_action='form.submit' then
    v_id:=(p_payload->>'formId')::uuid; select ft.schema,ft.requires_signature,ft.visibility::text into v_json,v_bool,v_text from form_templates ft where ft.id=v_id and ft.team_id=v_team and ft.archived_at is null; if v_json is null then raise exception 'form_not_found'; end if; if v_text in ('coaches','private') and not app_is_coach(v_team,u) then raise exception 'form_not_visible' using errcode='42501'; end if;
    if jsonb_typeof(coalesce(p_payload->'answers','{}'::jsonb)) <> 'object' then raise exception 'invalid_answers'; end if; if pg_column_size(coalesce(p_payload->'answers','{}'::jsonb))>131072 then raise exception 'answers_too_large'; end if;
    if exists(select 1 from jsonb_object_keys(coalesce(p_payload->'answers','{}'::jsonb)) k where not exists(select 1 from jsonb_array_elements(coalesce(v_json->'fields','[]'::jsonb)) fld where fld->>'id'=k)) then raise exception 'unknown_form_field'; end if;
    for f in select value from jsonb_array_elements(coalesce(v_json->'fields','[]'::jsonb)) loop
      v_text:=coalesce(p_payload->'answers'->>(f->>'id'),'');
      if length(v_text)>4000 then raise exception 'form_field_too_large:%',f->>'id'; end if;
      if (f->>'type')='number' and v_text<>'' and v_text!~'^[-+]?[0-9]+([.][0-9]+)?$' then raise exception 'invalid_number_field:%',f->>'id'; end if;
      if (f->>'type')='yes_no' and v_text<>'' and v_text not in ('Yes','No') then raise exception 'invalid_yes_no_field:%',f->>'id'; end if;
      if (f->>'type')='checkbox' and (p_payload->'answers' ? (f->>'id')) and jsonb_typeof(p_payload->'answers'->(f->>'id'))<>'boolean' then raise exception 'invalid_checkbox_field:%',f->>'id'; end if;
      if (f->>'type')='date' and v_text<>'' and v_text!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid_date_field:%',f->>'id'; end if;
      if coalesce((f->>'required')::boolean,false) and (not (coalesce(p_payload->'answers','{}'::jsonb) ? (f->>'id')) or case when f->>'type'='checkbox' then jsonb_typeof(p_payload->'answers'->(f->>'id'))<>'boolean' or p_payload->'answers'->>(f->>'id')<>'true' else btrim(v_text)='' end) then raise exception 'required_form_field_missing:%',f->>'id'; end if;
    end loop;
    if coalesce(v_bool,false) and (jsonb_typeof(p_payload->'signature')<>'object' or btrim(coalesce(p_payload#>>'{signature,name}',''))='' or btrim(coalesce(p_payload#>>'{signature,consentText}',''))='') then raise exception 'signature_required'; end if;
    v_id2:=null; org_id:=null;
    if coalesce(p_payload->>'assignmentId','')<>'' then select fa.id,fa.athlete_id into v_id2,org_id from form_assignments fa where fa.id=(p_payload->>'assignmentId')::uuid and fa.form_template_id=v_id and (app_is_coach(v_team,u) or fa.assigned_user_id=u) limit 1; if v_id2 is null then raise exception 'assignment_not_found_or_not_yours' using errcode='42501'; end if;
    elsif not app_is_coach(v_team,u) then select count(*) into v_count from form_assignments fa where fa.form_template_id=v_id and fa.assigned_user_id=u; if v_count=0 then raise exception 'form_not_assigned_to_user' using errcode='42501'; elsif v_count>1 then raise exception 'assignment_selection_required'; end if; select fa.id,fa.athlete_id into v_id2,org_id from form_assignments fa where fa.form_template_id=v_id and fa.assigned_user_id=u limit 1; end if;
    insert into form_submissions(form_template_id,assignment_id,athlete_id,submitted_by,answers) values(v_id,v_id2,org_id,u,coalesce(p_payload->'answers','{}'::jsonb)) on conflict(form_template_id,assignment_id,submitted_by) do update set answers=excluded.answers,updated_at=now() returning id into v_id2;
    if jsonb_typeof(p_payload->'signature')='object' then f:=p_payload->'signature'; insert into form_signatures(submission_id,signer_user_id,signer_name,consent_text,signature_type) values(v_id2,u,left(coalesce(f->>'name',''),200),left(coalesce(f->>'consentText',''),2000),coalesce(nullif(f->>'type',''),'typed')) on conflict(submission_id) do update set signer_user_id=excluded.signer_user_id,signer_name=excluded.signer_name,consent_text=excluded.consent_text,signature_type=excluded.signature_type,signed_at=now(); end if;
    return jsonb_build_object('submissionId',v_id2,'submittedAt',now());
  end if;
  if p_action='form.submissions' then if not app_is_coach(v_team,u) then raise exception 'coach_role_required'; end if; v_id:=(p_payload->>'formId')::uuid; select coalesce(jsonb_agg(to_jsonb(x) order by x.submitted_at desc),'[]'::jsonb) into v_list from (select fs.id,fs.athlete_id,fs.submitted_by,fs.answers,fs.submitted_at,fs.updated_at,us.display_name submitted_by_name,sg.signed_at,sg.signer_name from form_submissions fs join form_templates ft on ft.id=fs.form_template_id left join users us on us.id=fs.submitted_by left join form_signatures sg on sg.submission_id=fs.id where ft.team_id=v_team and ft.id=v_id) x; return v_list; end if;

  if p_action='prefs.get' then if v_role is null then raise exception 'not_a_team_member'; end if; select jsonb_build_object('messages',coalesce(np.messages,true),'schedule',coalesce(np.schedule,true),'weather',coalesce(np.weather,true),'documents',coalesce(np.documents,true),'forms',coalesce(np.forms,true)) into v_json from (select 1) q left join notification_preferences np on np.user_id=u and np.team_id=v_team; return coalesce(v_json,'{"messages":true,"schedule":true,"weather":true,"documents":true,"forms":true}'::jsonb); end if;
  if p_action='prefs.set' then if v_role is null then raise exception 'not_a_team_member'; end if; insert into notification_preferences(user_id,team_id,messages,schedule,weather,documents,forms) values(u,v_team,coalesce((p_payload->>'messages')::boolean,true),coalesce((p_payload->>'schedule')::boolean,true),coalesce((p_payload->>'weather')::boolean,true),coalesce((p_payload->>'documents')::boolean,true),coalesce((p_payload->>'forms')::boolean,true)) on conflict(user_id,team_id) do update set messages=excluded.messages,schedule=excluded.schedule,weather=excluded.weather,documents=excluded.documents,forms=excluded.forms,updated_at=now(); return jsonb_build_object('ok',true); end if;

  raise exception 'unknown_action:%',p_action;
end $$;

-- Data API is RPC-only for Team APP. No authenticated user gets direct table privileges.
revoke all on all tables in schema public from authenticated, anonymous;
revoke all on all sequences in schema public from authenticated, anonymous;
grant usage on schema public to authenticated;
-- Upgrade-safe RPC lock-down: existing databases may still contain pre-dispatcher
-- app_* RPCs. Revoke every app_* function from PUBLIC and client roles first,
-- then expose only the audited dispatcher to authenticated users.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'app\_%' escape '\\'
  loop
    execute format('revoke all on function %s from public, authenticated, anonymous',r.signature);
  end loop;
end $$;
grant execute on function app_api(text,jsonb) to authenticated;
