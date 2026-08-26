-- Team APP V1.10 -> V1.10.1 security, lifecycle, and scale hardening.
-- Tested on the v1-10-cloudflare-release-candidate Neon branch first.
-- Do not apply to production until the full release gate passes.

begin;

do $$
begin
  if to_regprocedure('public.app_api_v1_10_core(text,jsonb)') is null then
    alter function public.app_api(text,jsonb) rename to app_api_v1_10_core;
  end if;
end $$;

create or replace function public.app_current_user_id()
returns uuid language plpgsql security definer
set search_path to 'public','neon_auth','auth','pg_temp'
as $$
declare
  v_auth_id uuid; v_user uuid; v_email text; v_name text; v_old_email text; v_old_name text;
begin
  v_auth_id:=auth.user_id()::uuid;
  if v_auth_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select email,name into v_email,v_name from neon_auth."user" where id=v_auth_id;
  if v_email is null then raise exception 'auth_user_not_found' using errcode='42501'; end if;
  select id,email,display_name into v_user,v_old_email,v_old_name from public.users where auth_subject=v_auth_id::text;
  if v_user is not null then
    if v_old_email is distinct from v_email or v_old_name is distinct from v_name then
      update public.users set email=v_email,display_name=v_name,updated_at=now() where id=v_user;
    end if;
    return v_user;
  end if;
  insert into public.users(auth_subject,email,display_name) values(v_auth_id::text,v_email,v_name) returning id into v_user;
  return v_user;
end $$;

create or replace function public.app_require_verified_email()
returns void language plpgsql security definer
set search_path to 'public','neon_auth','auth','pg_temp'
as $$
declare v_auth_id uuid:=auth.user_id()::uuid; v_verified boolean;
begin
  if v_auth_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce("emailVerified",false) into v_verified from neon_auth."user" where id=v_auth_id;
  if not coalesce(v_verified,false) then raise exception 'email_verification_required' using errcode='42501'; end if;
end $$;

alter table public.users add column if not exists adult_attested_at timestamptz;
alter table public.users add column if not exists adult_attestation_version text;

create or replace function public.app_require_adult_attestation()
returns void language plpgsql security definer
set search_path to 'public','pg_temp'
as $adult$
declare v_user uuid:=public.app_current_user_id(); v_at timestamptz;
begin
  select adult_attested_at into v_at from public.users where id=v_user;
  if v_at is null then raise exception 'adult_attestation_required' using errcode='42501'; end if;
end $adult$;

revoke all on function public.app_require_adult_attestation() from public,anonymous,authenticated;

create or replace function public.app_verified_membership_guard()
returns trigger language plpgsql security definer
set search_path to 'public','neon_auth','pg_temp'
as $$
declare v_verified boolean;
begin
  select coalesce(au."emailVerified",false) into v_verified
  from public.users u join neon_auth."user" au on au.id::text=u.auth_subject
  where u.id=new.user_id;
  if not coalesce(v_verified,false) then raise exception 'email_verification_required' using errcode='42501'; end if;
  return new;
end $$;

drop trigger if exists trg_team_membership_verified_email on public.team_memberships;
create trigger trg_team_membership_verified_email
before insert or update of user_id on public.team_memberships
for each row execute function public.app_verified_membership_guard();

create or replace function public.app_member_context(p_context jsonb)
returns jsonb language plpgsql immutable
as $$
declare v jsonb:=coalesce(p_context,'{}'::jsonb); x jsonb; arr jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(v->'players')='array' then
    for x in select * from jsonb_array_elements(v->'players') loop
      arr:=arr||jsonb_build_array(jsonb_build_object(
        'id',x->'id','first',x->'first','last',x->'last',
        'preferredName',coalesce(x->'preferredName','""'::jsonb),
        'number',coalesce(x->'number','""'::jsonb),
        'primary',coalesce(x->'primary','""'::jsonb),
        'secondary',coalesce(x->'secondary','""'::jsonb),
        'status',coalesce(x->'status','"active"'::jsonb),
        'notes',''
      ));
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
  v:=jsonb_set(v,'{documents}','[]'::jsonb,true);
  return v;
end $$;

create or replace function public.app_validate_team_record(p_record jsonb)
returns void language plpgsql immutable
as $$
declare r jsonb:=coalesce(p_record,'{}'::jsonb); b jsonb; l jsonb; s jsonb;
begin
  if jsonb_typeof(r)<>'object' then raise exception 'invalid_team_record'; end if;
  if pg_column_size(r)>2621440 then raise exception 'team_record_too_large'; end if;
  if length(coalesce(r->>'name',''))>160 or length(coalesce(r->>'shortName',''))>60 or length(coalesce(r->>'season',''))>100 then raise exception 'invalid_team_identity'; end if;
  if length(coalesce(r->>'ruleSourceUrl',''))>2000 or (coalesce(r->>'ruleSourceUrl','')<>'' and coalesce(r->>'ruleSourceUrl','') !~* '^https?://') then raise exception 'invalid_rule_source_url'; end if;
  b:=coalesce(r->'branding','{}'::jsonb);
  if jsonb_typeof(b)<>'object' then raise exception 'invalid_branding'; end if;
  if coalesce(b->>'primaryColor','')<>'' and b->>'primaryColor' !~* '^#[0-9a-f]{6}$' then raise exception 'invalid_brand_color'; end if;
  if coalesce(b->>'secondaryColor','')<>'' and b->>'secondaryColor' !~* '^#[0-9a-f]{6}$' then raise exception 'invalid_brand_color'; end if;
  if length(coalesce(b->>'logoDataUrl',''))>2000000 then raise exception 'team_logo_too_large'; end if;
  if coalesce(b->>'logoDataUrl','')<>'' and b->>'logoDataUrl' !~* '^data:image/(png|jpeg|webp|gif);base64,' then raise exception 'invalid_team_logo'; end if;
  l:=coalesce(r->'homeLocation','{}'::jsonb);
  if jsonb_typeof(l)<>'object' then raise exception 'invalid_home_location'; end if;
  if l ? 'lat' and jsonb_typeof(l->'lat') not in ('number','null') then raise exception 'invalid_home_latitude'; end if;
  if l ? 'lon' and jsonb_typeof(l->'lon') not in ('number','null') then raise exception 'invalid_home_longitude'; end if;
  s:=coalesce(r->'staff','[]'::jsonb);
  if jsonb_typeof(s)<>'array' or jsonb_array_length(s)>50 then raise exception 'invalid_staff'; end if;
  if r ? 'defaultLayouts' and jsonb_typeof(r->'defaultLayouts')<>'object' then raise exception 'invalid_default_layouts'; end if;
end $$;

create or replace function public.app_key_envelope_immutable_guard()
returns trigger language plpgsql
as $$
begin
  if new.sender_user_id is distinct from old.sender_user_id
     or new.sender_public_key_jwk is distinct from old.sender_public_key_jwk
     or new.wrapped_key is distinct from old.wrapped_key
     or new.nonce is distinct from old.nonce then
    raise exception 'key_envelope_immutable';
  end if;
  new.created_at:=old.created_at;
  return new;
end $$;

drop trigger if exists trg_key_envelope_immutable on public.conversation_key_envelopes;
create trigger trg_key_envelope_immutable before update on public.conversation_key_envelopes
for each row execute function public.app_key_envelope_immutable_guard();

create table if not exists public.pending_conversation_rekeys (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  prior_key_version integer not null check(prior_key_version>=0),
  reason text not null check(reason in ('member_removed','coach_access_revoked')),
  requested_by uuid not null references public.users(id),
  requested_at timestamptz not null default now(),
  last_error text
);
revoke all on table public.pending_conversation_rekeys from public,anonymous,authenticated;

create or replace function public.app_join_code_create_v1_10_1(p_team uuid,p_user uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $join$
declare v_code text; v_hash text; v_athlete uuid; v_id uuid; v_expires integer; v_uses integer;
begin
  if coalesce(public.app_team_role(p_team,p_user)::text,'') not in ('owner','admin','coach') then raise exception 'admin_role_required' using errcode='42501'; end if;
  if coalesce(p_payload->>'role','guardian')<>'guardian' then raise exception 'invalid_join_role'; end if;
  if nullif(p_payload->>'athleteClientKey','') is null then raise exception 'guardian_requires_athlete' using errcode='42501'; end if;
  v_expires:=(p_payload->>'expiresHours')::integer; v_uses:=coalesce((p_payload->>'maxUses')::integer,1);
  select ap.id into v_athlete from public.roster_memberships rm join public.athlete_profiles ap on ap.id=rm.athlete_id where rm.team_id=p_team and ap.client_key=p_payload->>'athleteClientKey' limit 1;
  if v_athlete is null then raise exception 'athlete_not_found' using errcode='42501'; end if;
  v_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,12)); v_hash:=encode(digest(v_code,'sha256'),'hex');
  insert into public.team_join_codes(team_id,athlete_id,role,code_hash,code_hint,max_uses,expires_at,created_by)
    values(p_team,v_athlete,'guardian',v_hash,right(v_code,4),v_uses,now()+make_interval(hours=>v_expires),p_user)
    returning id into v_id;
  return jsonb_build_object('id',v_id,'role','guardian','code',v_code,'code_hint',right(v_code,4));
end $join$;

revoke all on function public.app_join_code_create_v1_10_1(uuid,uuid,jsonb) from public,anonymous,authenticated;

create or replace function public.app_api(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer
set search_path to 'public','neon_auth','auth','pg_temp'
as $$
declare
  u uuid; payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_team uuid; v_target uuid; v_object uuid; v_org uuid;
  v_expires integer; v_max_uses integer;
  actor_role organization_role; target_role organization_role; new_role organization_role; prior_org_role organization_role;
  delegated_result jsonb; affected_conversations jsonb:='[]'::jsonb;
  v_conversation uuid; v_prior_version integer; v_key_version integer; v_expected integer; v_supplied integer; v_complete boolean;
begin
  if pg_column_size(payload)>8388608 then raise exception 'request_payload_too_large'; end if;
  if p_action in ('team.create','team.state.update') then perform public.app_validate_team_record(coalesce(payload->'teamRecord','{}'::jsonb)); end if;
  if p_action='document.upload' and coalesce(payload->>'category','') ~* '^medical\s*/\s*safety$' then raise exception 'medical_documents_require_restricted_storage' using errcode='42501'; end if;
  if p_action in ('team.create','invitation.accept','join.redeem') then perform public.app_require_verified_email(); end if;
  if p_action='account.status' then
    u:=public.app_current_user_id();
    return jsonb_build_object(
      'adultAttested',(select adult_attested_at is not null from public.users where id=u),
      'adultAttestedAt',(select adult_attested_at from public.users where id=u),
      'adultAttestationVersion',(select adult_attestation_version from public.users where id=u)
    );
  end if;
  if p_action='account.adult.attest' then
    u:=public.app_current_user_id();
    if coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'adult_confirmation_required' using errcode='22023'; end if;
    update public.users set adult_attested_at=coalesce(adult_attested_at,now()),adult_attestation_version=coalesce(nullif(payload->>'version',''),'2026-08-24') where id=u;
    return jsonb_build_object('ok',true,'adultAttested',true);
  end if;
  if p_action in ('team.create','invitation.accept','join.redeem') then perform public.app_require_adult_attestation(); end if;

  -- A rekey is an all-or-nothing epoch transition. Team administrators may rotate
  -- affected direct conversations without being able to read their old history.
  if p_action in ('conversation.rekey.status','conversation.rekey.put') then
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid; v_conversation:=(payload->>'conversationId')::uuid;
    v_prior_version:=coalesce((payload->>'priorKeyVersion')::integer,0);
    if not public.app_is_coach(v_team,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    if not exists(select 1 from public.conversations c where c.id=v_conversation and c.team_id=v_team) then raise exception 'conversation_not_on_team' using errcode='42501'; end if;
    select pr.prior_key_version into v_expected from public.pending_conversation_rekeys pr where pr.conversation_id=v_conversation and pr.team_id=v_team for update;
    if not found then
      if p_action='conversation.rekey.status' then return jsonb_build_object('ok',true,'complete',true,'keyVersion',(select coalesce(max(e.key_version),0) from public.conversation_key_envelopes e where e.conversation_id=v_conversation)); end if;
      raise exception 'rekey_not_required' using errcode='22023';
    end if;
    if v_prior_version<>v_expected then raise exception 'stale_rekey_task' using errcode='40001'; end if;
    select coalesce(max(e.key_version),0) into v_expected from public.conversation_key_envelopes e where e.conversation_id=v_conversation;
    if p_action='conversation.rekey.status' then
      v_complete:=v_expected>v_prior_version and not exists(select 1 from public.conversation_members cm where cm.conversation_id=v_conversation and not exists(select 1 from public.conversation_key_envelopes e where e.conversation_id=v_conversation and e.recipient_user_id=cm.user_id and e.key_version=v_expected));
      if v_complete then delete from public.pending_conversation_rekeys where conversation_id=v_conversation; end if;
      return jsonb_build_object('ok',true,'complete',v_complete,'keyVersion',v_expected);
    end if;
    v_key_version:=(payload->>'keyVersion')::integer;
    if v_key_version<>v_prior_version+1 then raise exception 'invalid_rekey_version' using errcode='22023'; end if;
    if v_expected>v_prior_version then
      if exists(select 1 from public.conversation_members cm where cm.conversation_id=v_conversation and not exists(select 1 from public.conversation_key_envelopes e where e.conversation_id=v_conversation and e.recipient_user_id=cm.user_id and e.key_version=v_expected)) then raise exception 'incomplete_existing_rekey'; end if;
      delete from public.pending_conversation_rekeys where conversation_id=v_conversation;
      return jsonb_build_object('ok',true,'alreadyRotated',true,'keyVersion',v_expected);
    end if;
    if v_expected<>v_prior_version then raise exception 'stale_rekey_version'; end if;
    if exists(select 1 from public.conversation_members cm left join public.user_crypto_keys k on k.user_id=cm.user_id where cm.conversation_id=v_conversation and k.user_id is null) then raise exception 'member_crypto_key_missing'; end if;
    select count(*) into v_expected from public.conversation_members cm where cm.conversation_id=v_conversation;
    select count(distinct x.recipient_id) into v_supplied from (select (e->>'recipientUserId')::uuid recipient_id from jsonb_array_elements(coalesce(payload->'envelopes','[]'::jsonb)) e) x;
    if v_expected=0 or v_supplied<>v_expected or jsonb_array_length(coalesce(payload->'envelopes','[]'::jsonb))<>v_expected or exists(select 1 from jsonb_array_elements(coalesce(payload->'envelopes','[]'::jsonb)) e where not exists(select 1 from public.conversation_members cm where cm.conversation_id=v_conversation and cm.user_id=(e->>'recipientUserId')::uuid)) then raise exception 'rekey_recipient_mismatch' using errcode='22023'; end if;
    select public_key_jwk into delegated_result from public.user_crypto_keys where user_id=u; if delegated_result is null then raise exception 'sender_crypto_key_missing'; end if;
    for delegated_result in select * from jsonb_array_elements(payload->'envelopes') loop
      if length(coalesce(delegated_result->>'wrappedKey',''))>4096 or length(coalesce(delegated_result->>'nonce',''))>256 then raise exception 'invalid_key_envelope'; end if;
      insert into public.conversation_key_envelopes(conversation_id,recipient_user_id,sender_user_id,sender_public_key_jwk,key_version,wrapped_key,nonce)
      values(v_conversation,(delegated_result->>'recipientUserId')::uuid,u,(select public_key_jwk from public.user_crypto_keys where user_id=u),v_key_version,decode(delegated_result->>'wrappedKey','base64'),decode(delegated_result->>'nonce','base64'));
    end loop;
    select c.organization_id into v_org from public.conversations c where c.id=v_conversation;
    insert into public.audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_org,u,'conversation.rekey','conversation',v_conversation::text,jsonb_build_object('teamId',v_team,'priorKeyVersion',v_prior_version,'keyVersion',v_key_version,'recipientCount',v_expected));
    delete from public.pending_conversation_rekeys where conversation_id=v_conversation;
    return jsonb_build_object('ok',true,'keyVersion',v_key_version);
  end if;

  if p_action in ('team.create','form.create','invitation.create','join.create') then
    u:=public.app_current_user_id();
    if p_action='team.create' and (select count(*) from public.team_memberships tm where tm.user_id=u)>=25 then raise exception 'account_team_limit'; end if;
    if p_action<>'team.create' then v_team:=(payload->>'teamId')::uuid; end if;
    if p_action='form.create' and (select count(*) from public.form_templates ft where ft.team_id=v_team and ft.archived_at is null)>=200 then raise exception 'team_form_limit'; end if;
    if p_action='invitation.create' and (select count(*) from public.team_invitations ti where ti.team_id=v_team and ti.accepted_at is null and ti.revoked_at is null and ti.expires_at>now())>=200 then raise exception 'active_invitation_limit'; end if;
    if p_action='join.create' and (select count(*) from public.team_join_codes jc where jc.team_id=v_team and jc.is_active and (jc.expires_at is null or jc.expires_at>now()))>=50 then raise exception 'active_join_code_limit'; end if;
  end if;

  if p_action in ('invitation.create','join.create') and coalesce(payload->>'role','guardian')='guardian' and nullif(payload->>'athleteClientKey','') is null then raise exception 'guardian_requires_athlete' using errcode='42501'; end if;

  if p_action='invitation.create' and coalesce(payload->>'role','guardian')='guardian' then
    v_team:=(payload->>'teamId')::uuid;
    if not exists(
      select 1 from public.roster_memberships rm join public.athlete_profiles ap on ap.id=rm.athlete_id
      where rm.team_id=v_team and rm.status='active' and ap.client_key=payload->>'athleteClientKey'
    ) then raise exception 'athlete_not_on_team' using errcode='42501'; end if;
  end if;

  if p_action in ('invitation.create','join.create') then
    if coalesce(payload->>'expiresHours','') !~ '^[0-9]+$' then raise exception 'access_expiration_required' using errcode='22023'; end if;
    v_expires:=(payload->>'expiresHours')::integer;
    if v_expires<1 or v_expires>168 then raise exception 'access_expiration_out_of_range' using errcode='22023'; end if;
  end if;
  if p_action='join.create' then
    if coalesce(payload->>'maxUses','1') !~ '^[0-9]+$' then raise exception 'invalid_join_code_uses' using errcode='22023'; end if;
    v_max_uses:=coalesce((payload->>'maxUses')::integer,1);
    if v_max_uses<1 or v_max_uses>10 then raise exception 'join_code_uses_out_of_range' using errcode='22023'; end if;
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid;
    perform public.app_check_rate(u,'all',1200,60); perform public.app_check_rate(u,'join.create',20,3600);
    return public.app_join_code_create_v1_10_1(v_team,u,payload);
  end if;

  if p_action='member.role.update' then
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid; v_target:=(payload->>'userId')::uuid; new_role:=(payload->>'role')::organization_role;
    actor_role:=public.app_team_role(v_team,u); target_role:=public.app_team_role(v_team,v_target);
    if actor_role is null or target_role is null then raise exception 'not_a_team_member' using errcode='42501'; end if;
    if new_role='owner' then raise exception 'use_owner_transfer'; end if;
    if target_role='owner' then raise exception 'owner_role_protected' using errcode='42501'; end if;
    if new_role='guardian' and not exists(
      select 1 from public.guardian_relationships gr
      join public.roster_memberships rm on rm.athlete_id=gr.athlete_id
      where gr.guardian_user_id=v_target and rm.team_id=v_team
    ) then raise exception 'guardian_requires_athlete' using errcode='42501'; end if;
    if actor_role<>'owner' and (public.app_role_rank(actor_role)<=public.app_role_rank(target_role) or public.app_role_rank(actor_role)<=public.app_role_rank(new_role)) then raise exception 'role_change_not_allowed' using errcode='42501'; end if;
    if target_role::text in ('owner','admin','coach','assistant_coach','manager') and new_role::text not in ('owner','admin','coach','assistant_coach','manager') then
      select coalesce(jsonb_agg(jsonb_build_object('conversationId',q.id,'priorKeyVersion',q.prior_version)),'[]'::jsonb) into affected_conversations from (select c.id,coalesce(max(e.key_version),0) prior_version from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id left join public.conversation_key_envelopes e on e.conversation_id=c.id where c.team_id=v_team and c.kind='coaches' and cm.user_id=v_target group by c.id) q;
      delete from public.conversation_members cm using public.conversations c where cm.conversation_id=c.id and c.team_id=v_team and c.kind='coaches' and cm.user_id=v_target;
      insert into public.pending_conversation_rekeys(conversation_id,team_id,prior_key_version,reason,requested_by) select (x->>'conversationId')::uuid,v_team,(x->>'priorKeyVersion')::integer,'coach_access_revoked',u from jsonb_array_elements(affected_conversations) x on conflict(conversation_id) do update set prior_key_version=least(pending_conversation_rekeys.prior_key_version,excluded.prior_key_version),requested_at=now(),requested_by=excluded.requested_by;
    end if;
    update public.team_memberships tm set role=new_role where tm.team_id=v_team and tm.user_id=v_target;
    return jsonb_build_object('ok',true,'rekeyRequired',jsonb_array_length(affected_conversations)>0,'affectedConversations',affected_conversations);
  end if;

  if p_action='member.remove' then
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid; v_target:=(payload->>'userId')::uuid;
    actor_role:=public.app_team_role(v_team,u); target_role:=public.app_team_role(v_team,v_target);
    if target_role is null then raise exception 'not_a_team_member'; end if;
    if target_role='owner' then raise exception 'owner_role_protected' using errcode='42501'; end if;
    if v_target<>u and (actor_role is null or (actor_role<>'owner' and public.app_role_rank(actor_role)<=public.app_role_rank(target_role))) then raise exception 'member_remove_not_allowed' using errcode='42501'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('conversationId',q.id,'priorKeyVersion',q.prior_version)),'[]'::jsonb) into affected_conversations from (select c.id,coalesce(max(e.key_version),0) prior_version from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id left join public.conversation_key_envelopes e on e.conversation_id=c.id where c.team_id=v_team and cm.user_id=v_target group by c.id) q;
    delete from public.conversation_members cm using public.conversations c where cm.conversation_id=c.id and c.team_id=v_team and cm.user_id=v_target;
    insert into public.pending_conversation_rekeys(conversation_id,team_id,prior_key_version,reason,requested_by) select (x->>'conversationId')::uuid,v_team,(x->>'priorKeyVersion')::integer,'member_removed',u from jsonb_array_elements(affected_conversations) x on conflict(conversation_id) do update set prior_key_version=least(pending_conversation_rekeys.prior_key_version,excluded.prior_key_version),requested_at=now(),requested_by=excluded.requested_by;
    delete from public.guardian_relationships gr where gr.guardian_user_id=v_target and exists(select 1 from public.roster_memberships rm where rm.team_id=v_team and rm.athlete_id=gr.athlete_id);
    delete from public.team_memberships tm where tm.team_id=v_team and tm.user_id=v_target;
    select t.organization_id into v_org from public.teams t where t.id=v_team;
    insert into public.audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_org,u,'team.member.remove','team_membership',v_target::text,jsonb_build_object('teamId',v_team,'rekeyRequired',jsonb_array_length(affected_conversations)>0,'affectedConversations',affected_conversations));
    return jsonb_build_object('ok',true,'rekeyRequired',jsonb_array_length(affected_conversations)>0,'affectedConversations',affected_conversations);
  end if;

  if p_action='team.owner.transfer' then
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid; v_target:=(payload->>'userId')::uuid;
    if public.app_team_role(v_team,u)<>'owner' then raise exception 'owner_role_required' using errcode='42501'; end if;
    if public.app_team_role(v_team,v_target) is null then raise exception 'target_not_team_member'; end if;
    update public.team_memberships tm set role='admin' where tm.team_id=v_team and tm.user_id=u;
    update public.team_memberships tm set role='owner' where tm.team_id=v_team and tm.user_id=v_target;
    return jsonb_build_object('ok',true,'rekeyRequired',false,'affectedConversations','[]'::jsonb);
  end if;

  if p_action='invitation.revoke' then
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid; v_object:=(payload->>'invitationId')::uuid;
    if not public.app_is_coach(v_team,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    update public.team_invitations ti set revoked_at=now() where ti.id=v_object and ti.team_id=v_team and ti.accepted_at is null;
    if not found then raise exception 'invitation_not_revocable'; end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='join.revoke' then
    u:=public.app_current_user_id(); v_team:=(payload->>'teamId')::uuid; v_object:=(payload->>'joinCodeId')::uuid;
    if not public.app_is_coach(v_team,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    update public.team_join_codes jc set is_active=false where jc.id=v_object and jc.team_id=v_team and jc.is_active;
    if not found then raise exception 'join_code_not_revocable'; end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='conversation.message.send' then
    v_conversation:=(payload->>'conversationId')::uuid;
    if exists(select 1 from public.pending_conversation_rekeys pr where pr.conversation_id=v_conversation) then raise exception 'conversation_rekey_pending' using errcode='55000'; end if;
    select coalesce(max(e.key_version),0) into v_key_version from public.conversation_key_envelopes e where e.conversation_id=v_conversation;
    if v_key_version>0 and coalesce(substring(payload->>'cryptoVersion' from 'v([0-9]+)$'),'0')::integer<>v_key_version then raise exception 'stale_message_key_version' using errcode='40001'; end if;
  end if;

  -- The legacy core mirrors team roles into organization membership. Preserve an
  -- existing organization role and give new team invite/code recipients only the
  -- non-administrative organization baseline so team access cannot escalate org access.
  if p_action='invitation.accept' then
    u:=public.app_current_user_id();
    select t.organization_id into v_org from public.team_invitations ti join public.teams t on t.id=ti.team_id
      where ti.token_hash=encode(digest(coalesce(payload->>'token',''),'sha256'),'hex') limit 1;
    if v_org is not null then select om.role into prior_org_role from public.organization_memberships om where om.organization_id=v_org and om.user_id=u for update; end if;
    delegated_result:=public.app_api_v1_10_core(p_action,payload);
    if v_org is not null then update public.organization_memberships set role=coalesce(prior_org_role,'readonly') where organization_id=v_org and user_id=u; end if;
    return delegated_result;
  end if;
  if p_action='join.redeem' then
    u:=public.app_current_user_id();
    select t.organization_id into v_org from public.team_join_codes jc join public.teams t on t.id=jc.team_id
      where jc.code_hash=encode(digest(upper(regexp_replace(coalesce(payload->>'code',''),'[^A-Z0-9]','','g')),'sha256'),'hex') limit 1;
    if v_org is not null then select om.role into prior_org_role from public.organization_memberships om where om.organization_id=v_org and om.user_id=u for update; end if;
    delegated_result:=public.app_api_v1_10_core(p_action,payload);
    if v_org is not null then update public.organization_memberships set role=coalesce(prior_org_role,'readonly') where organization_id=v_org and user_id=u; end if;
    return delegated_result;
  end if;
  return public.app_api_v1_10_core(p_action,payload);
end $$;

create index if not exists idx_team_memberships_user_team on public.team_memberships(user_id,team_id);
create index if not exists idx_conversation_members_user_conversation on public.conversation_members(user_id,conversation_id);
create index if not exists idx_messages_conversation_cursor on public.messages(conversation_id,sent_at,id);
create index if not exists idx_guardian_relationships_user_athlete on public.guardian_relationships(guardian_user_id,athlete_id);
create index if not exists idx_audit_events_org_created on public.audit_events(organization_id,created_at desc);

revoke all on function public.app_api_v1_10_core(text,jsonb) from public;
revoke all on function public.app_api_v1_10_core(text,jsonb) from anonymous;
revoke all on function public.app_api_v1_10_core(text,jsonb) from authenticated;
revoke all on function public.app_api(text,jsonb) from public;
revoke all on function public.app_api(text,jsonb) from anonymous;
grant execute on function public.app_api(text,jsonb) to authenticated;
alter default privileges in schema public revoke execute on functions from public;

commit;
