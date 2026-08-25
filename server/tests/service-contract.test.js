import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('service routes and production boundaries exist',()=>{
  const index=read('server/src/index.js'),teams=read('server/src/routes-teams.js'),invites=read('server/src/routes-invites.js');
  assert.match(index,/toNodeHandler\(auth\)/);assert.ok(index.indexOf("app.all('/api/auth/*'")<index.indexOf('app.use(express.json'),'auth handler must receive raw body before JSON parser');
  assert.match(index,/Content-Security-Policy/);assert.match(index,/X-Content-Type-Options/);assert.match(index,/Permissions-Policy/);
  assert.match(teams,/revision_conflict/);assert.match(teams,/splitTeamContext/);assert.match(teams,/team_private_state/);
  assert.match(invites,/token_hash/);assert.match(invites,/code_hash/);assert.doesNotMatch(invites,/insert into team_invitations[^\n]+token[,)]/i);
});

test('Express access grants are team-scoped and guardian links require an active team athlete',()=>{
  const auth=read('server/src/auth.js'),invites=read('server/src/routes-invites.js');
  assert.match(auth,/requireEmailVerification:true/);
  assert.match(invites,/r\.team_id=\$1 and r\.status='active'/);
  assert.match(invites,/guardian_requires_athlete/);
  assert.match(invites,/z\.literal\('guardian'\)/);
  assert.match(invites,/maxUses:z\.number\(\)\.int\(\)\.min\(1\)\.max\(10\)/);
  assert.match(invites,/organization_memberships\(organization_id,user_id,role\) values\(\$1,\$2,'readonly'\) on conflict\(organization_id,user_id\) do nothing/);
  assert.doesNotMatch(invites,/organization_memberships[\s\S]{0,240}app_role_rank|organization_memberships[\s\S]{0,300}then excluded\.role/);
});

test('messages are ciphertext-only and notifications do not expose content',()=>{
  const messaging=read('server/src/routes-messaging.js'),schema=read('schema.sql');
  assert.match(schema,/ciphertext bytea not null/);assert.match(schema,/nonce bytea not null/);assert.doesNotMatch(schema,/messages[\s\S]{0,500}\bplaintext\b/i);
  assert.match(messaging,/Buffer\.from\(b\.ciphertext,'base64'\)/);assert.match(messaging,/New encrypted message/);assert.doesNotMatch(messaging,/body:`\$\{.*cipher/i);
  assert.match(read('core/e2ee.js'),/AES-GCM/);assert.match(read('core/e2ee.js'),/ECDH/);assert.match(read('core/e2ee.js'),/HKDF/);
});

test('documents have upload completion and acknowledgments',()=>{
  const docs=read('server/src/routes-documents.js'),schema=read('schema.sql');
  assert.match(schema,/upload_completed_at/);assert.match(schema,/document_acknowledgments/);assert.match(docs,/documents\/\:documentId\/complete/);assert.match(docs,/upload_completed_at is not null/);
});

test('forms preserve signature consent and encrypt drawn payloads',()=>{
  const forms=read('server/src/routes-forms.js'),crypto=read('server/src/crypto-seal.js');
  assert.match(forms,/consentText/);assert.match(forms,/seal\(b\.signature\.payload/);assert.match(crypto,/aes-256-gcm/);assert.match(crypto,/TEAM_APP_DATA_KEY/);
});

test('weather and push are event-aware',()=>{
  const cron=read('server/src/routes-cron.js'),sw=read('sw.js'),notify=read('server/src/notifications.js');
  assert.match(cron,/96/);assert.match(cron,/weather_watch_state/);assert.match(sw,/addEventListener\('push'/);assert.match(sw,/notificationclick/);assert.match(notify,/notification_preferences/);
});

test('coach metadata synchronizes staff and league profile context',()=>{
  const sync=read('server/src/team-state.js'),teams=read('server/src/routes-teams.js');
  for(const token of ['league_key','league_name','competition_profile_key','rule_label','rule_source_note','team_staff_contacts'])assert.ok(sync.includes(token)||teams.includes(token),`missing ${token}`);
});

test('custom API mutations are origin protected and documents reject active web content',()=>{
  const index=read('server/src/index.js'),security=read('server/src/request-security.js'),policy=read('server/src/file-policy.js'),docs=read('server/src/routes-documents.js'),storage=read('server/src/storage.js');
  assert.match(index,/protectBrowserMutation/);assert.match(security,/cross_site_request_blocked/);assert.match(security,/origin_not_allowed/);
  assert.match(policy,/file_type_not_allowed/);assert.doesNotMatch(policy,/\.html/);assert.doesNotMatch(policy,/\.svg/);assert.match(docs,/validateTeamDocument/);assert.match(storage,/ResponseContentType:'application\/octet-stream'/);
});

test('guardian event availability is athlete-scoped and audited',()=>{
  const route=read('server/src/routes-availability.js'),schema=read('schema.sql');
  assert.match(schema,/create table event_availability/);assert.match(route,/guardian_relationships/);assert.match(route,/may_update_availability=true/);assert.match(route,/athleteClientKey/);assert.match(route,/event_availability\.update/);
});

test('forms enforce assignment and linked-athlete ownership',()=>{
  const forms=read('server/src/routes-forms.js');
  assert.match(forms,/assignment_not_yours/);assert.match(forms,/athlete_form_access_denied/);assert.match(forms,/assignment_athlete_mismatch/);assert.match(forms,/unknown_field/);
});

test('Little League Game Day guidance is age-aware without hard-locking pitch count',()=>{
  const app=read('app.js'),sync=read('server/src/team-state.js');
  assert.match(app,/littleLeaguePitchGuide/);assert.match(app,/leagueAge/);assert.match(app,/Daily max/);assert.match(app,/Rest if done now/);assert.match(app,/three consecutive days/i);assert.match(sync,/leagueAge/);
});
