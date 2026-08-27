import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('cloud client supports Neon managed auth, Data API sync, invites, docs, forms and E2EE messages',()=>{const c=read('client/cloud-entry.js');const sql=read('sql/data-api-rpc.sql');for(const token of ['createClient','NEON_AUTH_URL','NEON_DATA_API_URL','signUp.email','signIn.email','rpc(','app_team_update','app_invitation_create','app_join_create','app_document_upload','app_form_submit','app_message_send','scheduleSync','revision','uploadDocument','acknowledge','createConversation','wrapKeyFor','encryptMessage','enablePush','openAvailability','notification-preferences','data-direct-user','data-manage-form'])assert.ok(c.includes(token),`cloud client missing ${token}`);assert.ok(!c.includes('signIn.passkey'), 'managed Neon client should not advertise unsupported passkey sign-in');assert.match(c,/neon\.rpc\('app_api'/,'client must use the single checked-in Data API RPC');assert.ok(!sql.includes('create or replace function app_me('),'SQL must not depend on generated compatibility RPC wrappers');assert.match(sql,/grant execute on function app_api\(text,jsonb\) to authenticated/);assert.match(sql,/invalid_invitation_role/);assert.match(sql,/invalid_join_role/);assert.match(sql,/document_not_visible/);assert.match(sql,/unknown_form_field/);assert.match(sql,/signature_required/);assert.match(sql,/direct_recipient_required/);assert.match(sql,/invalid_message_payload/);assert.match(sql,/invalid_form_fields/);});
test('app exposes cloud runtime without breaking local first storage',()=>{const a=read('app.js');assert.match(a,/window\.TeamAppRuntime/);assert.match(a,/getActiveCloudPayload/);assert.match(a,/replaceCloudTeams/);assert.match(a,/TeamAppCloud\?\.scheduleSync/);assert.match(a,/meta\.cloud/);});
test('service worker excludes API from offline cache and handles push',()=>{const sw=read('sw.js');assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);assert.match(sw,/team-app-live-v1\.10\.0/);assert.match(sw,/showNotification/);});

test('successful email/password auth reloads before protected Data API bootstrap',()=>{
  const c=read('client/cloud-entry.js');
  const start=c.indexOf("el.querySelector('#cloudAuthForm').onsubmit");
  const end=c.indexOf('function showFirstTeam()',start);

  assert.ok(start>=0&&end>start,'email/password auth handler missing');

  const authHandler=c.slice(start,end);

  assert.match(authHandler,/signUp\.email/);
  assert.match(authHandler,/signIn\.email/);
  assert.ok(
    !authHandler.includes('closeOverlay();await afterLogin();'),
    'email/password auth must not immediately bootstrap protected Data API calls'
  );
  assert.ok(
    authHandler.includes('closeOverlay();location.reload();return;'),
    'successful email/password auth must reload into a fresh Neon session'
  );
});
