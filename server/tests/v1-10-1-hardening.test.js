const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('V1.10.1 database hardening migration preserves one client RPC and adds lifecycle guards',()=>{
  const sql=read('sql/upgrade-v1.10-to-v1.10.1-hardening.sql');
  for(const token of [
    'app_api_v1_10_core','app_require_verified_email','trg_team_membership_verified_email',
    "jsonb_set(v,'{documents}','[]'::jsonb,true)",'trg_key_envelope_immutable',
    "p_action='member.remove'","p_action='member.role.update'","p_action='team.owner.transfer'",
    "p_action='invitation.revoke'","p_action='join.revoke'",'request_payload_too_large',
    'app_validate_team_record','idx_messages_conversation_cursor','access_expiration_required','join_code_uses_out_of_range',
    'alter default privileges in schema public revoke execute on functions from public'
  ]) assert.ok(sql.includes(token),`missing hardening contract: ${token}`);
  assert.match(sql,/revoke all on function public\.app_api_v1_10_core\(text,jsonb\) from authenticated/i);
  assert.match(sql,/grant execute on function public\.app_api\(text,jsonb\) to authenticated/i);
  assert.doesNotMatch(sql,/\bteam_id\s*=\s*team_id\b/i,'migration must not contain ambiguous self-comparison predicates');
  assert.doesNotMatch(sql,/\buser_id\s*=\s*user_id\b/i,'migration must not contain ambiguous user self-comparison predicates');
});

test('runtime hardening is loaded before main app and sensitive PWA navigation is normalized',()=>{
  const html=read('index.html'),sw=read('sw.js'),runtime=read('core/hardening-runtime.js');
  assert.ok(html.indexOf('./core/hardening-runtime.js')<html.indexOf('./app.js'));
  assert.ok(sw.includes("url.searchParams.has('invite')"));
  assert.ok(sw.includes("const SHELL_KEY='./index.html'"));
  assert.ok(runtime.includes("DEMO_PREFIX='team-app-demo:'"));
  assert.ok(runtime.includes('team-app-account:'));
  assert.ok(runtime.includes('migrateUnclaimedState'));
  assert.ok(runtime.includes('teamapp-auth-locked'));
  assert.ok(runtime.includes('teamapp:storage-failure'));
  assert.ok(runtime.includes('BroadcastChannel'));
});

test('cloud admin hardening uses the documented recovery adapter and access lifecycle RPCs',()=>{
  const source=read('client/cloud-admin-hardening.js');
  assert.match(source,/SupabaseAuthAdapter/);
  assert.match(source,/resetPasswordForEmail/);
  for(const action of ['member.role.update','member.remove','team.owner.transfer','invitation.revoke'])assert.ok(source.includes(action),`missing cloud admin action ${action}`);
});

test('mobile invite sharing and cryptographic identifier hardening are present',()=>{
  const cloud=read('client/cloud-entry.js'),app=read('app.js'),headers=read('_headers');
  for(const token of ['textInviteLink','navigator.share','Text invite','Copy link','inviteShareResult'])assert.ok(cloud.includes(token),`missing invite-sharing contract: ${token}`);
  assert.doesNotMatch(app,/Math\.random\s*\(/,'application identifiers must not fall back to Math.random');
  assert.match(app,/crypto\?\.getRandomValues/);
  assert.match(headers,/Cross-Origin-Resource-Policy:\s*same-origin/i);
  assert.match(headers,/X-Permitted-Cross-Domain-Policies:\s*none/i);
  assert.match(headers,/\/build-info\.json[\s\S]*Cache-Control:\s*no-store/i);
});

test('Little League guidance handles same-day division restrictions conservatively',()=>{
  const app=read('app.js');
  assert.match(app,/llb-\(minor\|major\|intermediate\)/);
  assert.match(app,/age12JuniorSenior/);
  assert.match(app,/sameDayThresholdReview/);
  assert.match(app,/combinedToday/);
  assert.match(app,/catcher\/pitcher restrictions/);
});

test('release build has environment-specific endpoints, serialized sync, safer messaging, and build identity',()=>{
  const build=read('scripts/build-cloudflare.js'),smoke=read('scripts/smoke-production.mjs');
  for(const token of [
    'TEAM_APP_NEON_AUTH_URL','TEAM_APP_NEON_DATA_API_URL','build-info.json',
    'Message was not sent. Your draft is still here.','syncTail=Promise.resolve()',
    "document.visibilityState==='visible'",'setInterval(poll,8000)',
    "coach||coachRoles.has(m.role)"
  ]) assert.ok(build.includes(token),`missing release build hardening: ${token}`);
  assert.ok(smoke.includes("'/build-info.json'"));
  assert.ok(smoke.includes('TEAM_APP_EXPECT_COMMIT'));
});
