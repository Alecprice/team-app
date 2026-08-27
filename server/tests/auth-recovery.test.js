import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('password recovery owns request, reset-token completion, and signed-in password change',()=>{
  const recovery=read('client/auth-recovery.js');
  for(const token of [
    "'/request-password-reset'",
    "'/reset-password'",
    "'/change-password'",
    "credentials:'include'",
    "RESET_MARKER='teamapp-reset'",
    "params.get('token')",
    'revokeOtherSessions:true',
    'MIN_PASSWORD_LENGTH=10',
    'New passwords do not match.',
    'If an account exists for that email',
    'showRecoveryRequest',
    'showResetPassword',
    'showChangePassword'
  ]) assert.ok(recovery.includes(token),`missing auth recovery contract: ${token}`);
  assert.match(recovery,/original\.cloneNode\(true\)/,'complete recovery must replace the legacy forgot-password listener rather than stacking duplicate requests');
  assert.match(recovery,/for\(const key of \[RESET_MARKER,'token','error','error_description'\]\)url\.searchParams\.delete\(key\)/,'reset secrets must be removed from the browser URL after use');
});

test('auth recovery is bundled and receives the first-party auth URL transform',()=>{
  const entry=read('client/cloud-entry-hardened.js'),build=read('scripts/build-cloudflare.js');
  assert.match(entry,/import '\.\/auth-recovery\.js';/);
  assert.match(build,/cloud-entry\|cloud-admin-hardening\|auth-recovery/);
  assert.match(build,/authNeedle/);
  assert.match(build,/authDeclaration/);
  assert.match(build,/contents\.replace\(authNeedle,authDeclaration\)/);
  assert.match(build,/new URL\('\/api\/auth',location\.origin\)/);
});
