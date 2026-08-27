import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('password reset callback accepts Better Auth token query without custom marker',()=>{
  const callback=read('client/auth-recovery-callback.js');
  assert.match(callback,/params\.get\('token'\)/);
  assert.match(callback,/error==='INVALID_TOKEN'/);
  assert.match(callback,/teamapp-reset=1\\\?token=/,'legacy malformed reset callbacks remain recoverable');
  assert.match(callback,/history\.replaceState\(null,'',location\.pathname\+location\.hash\)/,'reset token must be removed from the address bar immediately');
});

test('password reset request lets Better Auth own the callback query string',()=>{
  const callback=read('client/auth-recovery-callback.js');
  assert.match(callback,/request-password-reset/);
  assert.match(callback,/redirect\.searchParams\.delete\(RESET_MARKER\)/);
  assert.match(callback,/redirectTo:redirect\.toString\(\)/);
});

test('Safari reset callback handler is bundled after the primary recovery module',()=>{
  const entry=read('client/cloud-entry-hardened.js');
  const recovery=entry.indexOf("import './auth-recovery.js';");
  const callback=entry.indexOf("import './auth-recovery-callback.js';");
  assert.ok(recovery>=0&&callback>recovery,'callback compatibility handler must load after primary recovery module');
});
