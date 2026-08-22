-- Team APP V1.10 -> V1.10.1 security, lifecycle, and scale hardening.
-- Apply to a disposable/release-candidate Neon branch first. Do not run blindly on production.

begin;

-- Preserve the audited V1.10 dispatcher behind a new V1.10.1 policy/lifecycle wrapper.
do $$
begin
  if to_regprocedure('public.app_api_v1_10_core(text,jsonb)') is null then
    alter function public.app_api(text,jsonb) rename to app_api_v1_10_core;
  end if;
end $$;

create or replace function public.app_current_user_id()
returns uuid
language plpgsql
security definer
set search_path to 'public','neon_auth','auth','pg_temp'
as $$
declare
  v_auth_id uuid;
  v_user uuid;
  v_email text;
  v_name text;
  v_old_email text;
  v_old_name text;
begin
  v_auth_id := auth.user_id()::uuid;
  if v_auth_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select email,name into v_email,v_name from neon_auth."user" where id=v_auth_id;
  if v_email is null then raise exception 'auth_user_not_found' using errcode='42501'; end if;

  select id,email,display_name into v_user,v_old_email,v_old_name
    from users where auth_subject=v_auth_id::text;
  if v_user is not null then
    if v_old_email is distinct from v_email or v_old_name is distinct from v_name then
      update users set email=v_email,display_name=v_name,updated_at=now() where id=v_user;
    end if;
    return v_user;
  end if;

  insert into users(auth_subject,email,display_name)
    values(v_auth_id::text,v_email,v_name)
    returning id into v_user;
  return v_user;
end $$;

create or replace function public.app_require_verified_email()
returns void
language plpgsql
security definer
set search_path to 'public','neon_auth','auth','pg_temp'
as $$
declare v_auth_id uuid:=auth.user_id()::uuid; v_verified boolean;
begin
  if v_auth_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce("emailVerified",false) into v_verified from neon_auth."user" where id=v_auth_id;
  if not coalesce(v_verified,false) then raise exception 'email_verification_required' using errcode='42501'; end if;
end $$;

create or replace function public.app_verified_membership_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public','neon_auth','pg_temp'
as $$
declare v_verified boolean;
begin
  select coalesce(au."emailVerified",false) into v_verified
  from users u join neon_auth."user" au on au.id::text=u.auth_subject
  where u.id=new.user_id;
  if not coalesce(v_verified,false) then raise exception 'email_verification_required' using errcode='42501'; end if;
  return new;
end $$;

drop trigger if exists trg_team_membership_verified_email on public.team_memberships;
create trigger trg_team_membership_verified_email
before insert or update of user_id on public.team_memberships
for each row execute function public.app_verified_membership_guard();

-- Member snapshots intentionally exclude coach-private planning, generic attendance, and document metadata.
create or replace function public.app_member_context(p_context jsonb)
returns jsonb
language plpgsql
immutable
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
returns void
language plpgsql
immutable
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

-- Existing key envelopes are immutable. A rotation must use a new key_version.
create or replace function public.app_key_envelope_immutable_guard()
returns trigger
language plpgsql
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
create trigger trg_key_envelope_immutable
before update on public.conversation_key_envelopes
for each row execute function public.app_key_envelope_immutable_guard();

create or replace function public.app_api(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','neon_auth','auth','pg_temp'
as $$
declare
  u uuid;
  payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  team_id uuid;
  target_user uuid;
  actor_role organization_role;
  target_role organization_role;
  new_role organization_role;
  object_id uuid;
  org_id uuid;
begin
  if pg_column_size(payload)>8388608 then raise exception 'request_payload_too_large'; end if;

  if p_action in ('team.create','team.state.update') then
    perform app_validate_team_record(coalesce(payload->'teamRecord','{}'::jsonb));
  end if;
  if p_action='document.upload' and coalesce(payload->>'category','') ~* '^medical\s*/\s*safety$' then
    raise exception 'medical_documents_require_restricted_storage' using errcode='42501';
  end if;
  if p_action in ('team.create','invitation.accept','join.redeem') then perform app_require_verified_email(); end if;

  if p_action in ('team.create','form.create','invitation.create','join.create') then
    u:=app_current_user_id();
    if p_action='team.create' and (select count(*) from team_memberships where user_id=u)>=25 then raise exception 'account_team_limit'; end if;
    if p_action<>'team.create' then team_id:=(payload->>'teamId')::uuid; end if;
    if p_action='form.create' and (select count(*) from form_templates where team_id=team_id and archived_at is null)>=200 then raise exception 'team_form_limit'; end if;
    if p_action='invitation.create' and (select count(*) from team_invitations where team_id=team_id and accepted_at is null and revoked_at is null and expires_at>now())>=200 then raise exception 'active_invitation_limit'; end if;
    if p_action='join.create' and (select count(*) from team_join_codes where team_id=team_id and is_active and (expires_at is null or expires_at>now()))>=50 then raise exception 'active_join_code_limit'; end if;
  end if;

  if p_action in ('invitation.create','join.create') and coalesce(payload->>'role','guardian')='guardian' and nullif(payload->>'athleteClientKey','') is null then
    raise exception 'guardian_requires_athlete' using errcode='42501';
  end if;

  if p_action='member.role.update' then
    u:=app_current_user_id();team_id:=(payload->>'teamId')::uuid;target_user:=(payload->>'userId')::uuid;new_role:=(payload->>'role')::organization_role;
    actor_role:=app_team_role(team_id,u);target_role:=app_team_role(team_id,target_user);
    if actor_role is null or target_role is null then raise exception 'not_a_team_member' using errcode='42501'; end if;
    if new_role='owner' then raise exception 'use_owner_transfer'; end if;
    if target_role='owner' then raise exception 'owner_role_protected' using errcode='42501'; end if;
    if actor_role<>'owner' and (app_role_rank(actor_role)<=app_role_rank(target_role) or app_role_rank(actor_role)<=app_role_rank(new_role)) then raise exception 'role_change_not_allowed' using errcode='42501'; end if;
    update team_memberships set role=new_role where team_id=team_id and user_id=target_user;
    return jsonb_build_object('ok',true,'rekeyRequired',true);
  end if;

  if p_action='member.remove' then
    u:=app_current_user_id();team_id:=(payload->>'teamId')::uuid;target_user:=(payload->>'userId')::uuid;
    actor_role:=app_team_role(team_id,u);target_role:=app_team_role(team_id,target_user);
    if target_role is null then raise exception 'not_a_team_member'; end if;
    if target_role='owner' then raise exception 'owner_role_protected' using errcode='42501'; end if;
    if target_user<>u and (actor_role is null or (actor_role<>'owner' and app_role_rank(actor_role)<=app_role_rank(target_role))) then raise exception 'member_remove_not_allowed' using errcode='42501'; end if;
    delete from conversation_members cm using conversations c where cm.conversation_id=c.id and c.team_id=team_id and cm.user_id=target_user;
    delete from guardian_relationships gr where gr.guardian_user_id=target_user and exists(select 1 from roster_memberships rm where rm.team_id=team_id and rm.athlete_id=gr.athlete_id);
    delete from team_memberships where team_id=team_id and user_id=target_user;
    select organization_id into org_id from teams where id=team_id;
    insert into audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata) values(org_id,u,'team.member.remove','team_membership',target_user::text,jsonb_build_object('teamId',team_id,'rekeyRequired',true));
    return jsonb_build_object('ok',true,'rekeyRequired',true);
  end if;

  if p_action='team.owner.transfer' then
    u:=app_current_user_id();team_id:=(payload->>'teamId')::uuid;target_user:=(payload->>'userId')::uuid;
    if app_team_role(team_id,u)<>'owner' then raise exception 'owner_role_required' using errcode='42501'; end if;
    if app_team_role(team_id,target_user) is null then raise exception 'target_not_team_member'; end if;
    update team_memberships set role='admin' where team_id=team_id and user_id=u;
    update team_memberships set role='owner' where team_id=team_id and user_id=target_user;
    return jsonb_build_object('ok',true,'rekeyRequired',true);
  end if;

  if p_action='invitation.revoke' then
    u:=app_current_user_id();team_id:=(payload->>'teamId')::uuid;object_id:=(payload->>'invitationId')::uuid;
    if not app_is_coach(team_id,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    update team_invitations set revoked_at=now() where id=object_id and team_id=team_id and accepted_at is null;
    if not found then raise exception 'invitation_not_revocable'; end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='join.revoke' then
    u:=app_current_user_id();team_id:=(payload->>'teamId')::uuid;object_id:=(payload->>'joinCodeId')::uuid;
    if not app_is_coach(team_id,u) then raise exception 'coach_role_required' using errcode='42501'; end if;
    update team_join_codes set is_active=false where id=object_id and team_id=team_id and is_active;
    if not found then raise exception 'join_code_not_revocable'; end if;
    return jsonb_build_object('ok',true);
  end if;

  return public.app_api_v1_10_core(p_action,payload);
end $$;

-- Exact hot-path indexes identified in the V1.10 scale audit.
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

-- Future functions created by this owner no longer default to PUBLIC execute.
alter default privileges in schema public revoke execute on functions from public;

commit;
