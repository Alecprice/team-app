-- Team APP V1.8 service-layer additions.
-- Apply after the core schema.sql.

alter table athlete_profiles add column if not exists client_key text;
create unique index if not exists uq_athlete_org_client_key on athlete_profiles(organization_id,client_key) where client_key is not null;

create table if not exists team_state_snapshots (
  team_id uuid primary key references teams(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid references athlete_profiles(id) on delete cascade,
  email citext not null,
  role organization_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references users(id),
  accepted_by uuid references users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists team_join_codes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid references athlete_profiles(id) on delete cascade,
  role organization_role not null default 'guardian',
  code_hash text not null unique,
  code_hint text not null,
  max_uses int not null default 1 check(max_uses > 0),
  use_count int not null default 0 check(use_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists document_acknowledgments (
  document_id uuid not null references team_documents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  primary key(document_id,user_id)
);

create table if not exists form_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,
  description text,
  visibility visibility_scope not null default 'guardians',
  schema jsonb not null default '{"fields":[]}'::jsonb,
  requires_signature boolean not null default false,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references form_templates(id) on delete cascade,
  athlete_id uuid references athlete_profiles(id) on delete cascade,
  assigned_user_id uuid references users(id) on delete cascade,
  due_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_form_assignments_target on form_assignments(form_template_id,assigned_user_id,coalesce(athlete_id,'00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references form_templates(id) on delete cascade,
  assignment_id uuid references form_assignments(id) on delete set null,
  athlete_id uuid references athlete_profiles(id) on delete set null,
  submitted_by uuid not null references users(id),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(form_template_id,assignment_id,submitted_by)
);

create table if not exists form_signatures (
  submission_id uuid primary key references form_submissions(id) on delete cascade,
  signer_user_id uuid not null references users(id),
  signer_name text not null,
  consent_text text not null,
  signature_type text not null check(signature_type in ('typed','drawn')),
  signature_payload_encrypted bytea,
  signed_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create table if not exists user_crypto_keys (
  user_id uuid primary key references users(id) on delete cascade,
  algorithm text not null default 'ECDH-P256',
  public_key_jwk jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table if not exists conversation_key_envelopes (
  conversation_id uuid not null references conversations(id) on delete cascade,
  recipient_user_id uuid not null references users(id) on delete cascade,
  sender_user_id uuid not null references users(id),
  sender_public_key_jwk jsonb,
  key_version int not null default 1,
  wrapped_key bytea not null,
  nonce bytea not null,
  algorithm text not null default 'ECDH-P256/HKDF-SHA256/AES-GCM',
  created_at timestamptz not null default now(),
  primary key(conversation_id,recipient_user_id,key_version)
);
alter table conversation_key_envelopes add column if not exists sender_public_key_jwk jsonb;

create table if not exists message_reads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint)
);

create table if not exists notification_preferences (
  user_id uuid not null references users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  messages boolean not null default true,
  schedule boolean not null default true,
  weather boolean not null default true,
  documents boolean not null default true,
  forms boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id,team_id)
);

create table if not exists notification_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists weather_watch_state (
  team_id uuid not null references teams(id) on delete cascade,
  event_client_id text not null,
  event_name text,
  starts_at timestamptz,
  latitude double precision,
  longitude double precision,
  last_summary jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  primary key(team_id,event_client_id)
);

create index if not exists idx_team_invites_email on team_invitations(email,expires_at) where accepted_at is null and revoked_at is null;
create index if not exists idx_join_codes_team on team_join_codes(team_id,is_active);
create index if not exists idx_forms_team on form_templates(team_id,created_at desc) where archived_at is null;
create index if not exists idx_form_assign_user on form_assignments(assigned_user_id,due_at);
create index if not exists idx_push_user on push_subscriptions(user_id);
create index if not exists idx_notifications_unsent on notification_events(user_id,created_at) where sent_at is null and failed_at is null;

-- V1.8 upload lifecycle
alter table team_documents add column if not exists upload_completed_at timestamptz;
create index if not exists idx_team_documents_completed on team_documents(team_id,created_at desc) where upload_completed_at is not null;

-- Encrypted coach-private team state
create table if not exists team_private_state (
  team_id uuid primary key references teams(id) on delete cascade,
  encrypted_state bytea not null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- V1.8 cloud metadata compatibility
alter table teams add column if not exists league_key text;
alter table teams add column if not exists league_name text;
alter table teams add column if not exists competition_profile_key text;
alter table teams add column if not exists rule_label text;
alter table teams add column if not exists rule_source_note text;
alter table team_staff_contacts add column if not exists client_key text;
create unique index if not exists uq_team_staff_client_key on team_staff_contacts(team_id,client_key) where client_key is not null;

alter table team_staff_contacts add column if not exists role_label text;


create table if not exists event_availability (
  team_id uuid not null references teams(id) on delete cascade,
  event_client_id text not null,
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  status text not null check (status in ('yes','no','maybe')),
  note text,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(team_id,event_client_id,athlete_id)
);
create index if not exists idx_event_availability_team_event on event_availability(team_id,event_client_id);
