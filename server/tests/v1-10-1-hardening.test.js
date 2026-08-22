const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('V1.10.1 database hardening migration preserves one client RPC and adds lifecycle guards',()=>{
  const sql=read('sql/upgrade-v1.10-to-v1.10.1-hardening.sql');
  for(const token of [
    'app_api_v1_10_core',
    'app_require_verified_email',
    'trg_team_membership_verified_email',
    "jsonb_set(v,'{documents}','[]'::jsonb,true)",
    'trg_key_envelope_immutable',
    "p_action='member.remove'",
    "p_action='member.role.update'",
    "p_action='team.owner.transfer'",
    "p_action='invitation.revoke'",
    "p_action='join.revoke'",
    'request_payload_too_large',
    'app_validate_team_record',
    'idx_messages_conversation_cursor',
    'alter default privileges in schema public revoke execute on functions from public'
  ]) assert.ok(sql.includes(token),`missing hardening contract: ${token}`);
  assert.match(sql,/revoke all on function public\.app_api_v1_10_core\(text,jsonb\) from authenticated/i);
  assert.match(sql,/grant execute on function public\.app_api\(text,jsonb\) to authenticated/i);
});

test('runtime hardening is loaded before main app and sensitive PWA navigation is normalized',()=>{
  const html=read('index.html'),sw=read('sw.js'),runtime=read('core/hardening-runtime.js');
  assert.ok(html.indexOf('./core/hardening-runtime.js')<html.indexOf('./app.js'));
  assert.ok(sw.includes("url.searchParams.has('invite')"));
  assert.ok(sw.includes("const SHELL_KEY='./index.html'"));
  assert.ok(runtime.includes("DEMO_PREFIX='team-app-demo:'"));
  assert.ok(runtime.includes("teamapp-auth-locked"));
  assert.ok(runtime.includes("teamapp:storage-failure"));
  assert.ok(runtime.includes('BroadcastChannel'));
});
