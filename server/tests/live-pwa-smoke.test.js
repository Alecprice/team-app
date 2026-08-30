import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('live PWA smoke uses deployed demo mode and never needs account credentials',()=>{
  const smoke=read('scripts/live-pwa-smoke.py');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['smoke:pwa'],'python3 scripts/live-pwa-smoke.py');
  assert.match(smoke,/https:\/\/team-app-6mh\.pages\.dev/);
  assert.match(smoke,/\?demo=1/);
  assert.match(smoke,/browser\.new_context/);
  assert.match(smoke,/localStorage\.clear\(\)/);
  assert.doesNotMatch(smoke,/TEAM_APP_SMOKE_(?:EMAIL|PASSWORD)|\/rpc\/app_api|\/api\/auth/,'PWA smoke must not read account credentials or call account APIs');
});

test('live PWA smoke proves service-worker control, offline edit persistence, and reconnect',()=>{
  const smoke=read('scripts/live-pwa-smoke.py');
  for(const token of [
    'navigator.serviceWorker.ready',
    'navigator.serviceWorker.controller',
    'context.set_offline(True)',
    'context.set_offline(False)',
    '#addPlayerBtn',
    'Offline TENX',
    'offline roster edit did not survive a fully offline reload',
    'local offline edit disappeared after reconnect'
  ]) assert.ok(smoke.includes(token),`missing live PWA contract: ${token}`);
});

test('live PWA workflow remains manual-only and credential-free',()=>{
  const workflow=read('.github/workflows/live-pwa-smoke.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s*(?:push|pull_request|schedule):/,'live PWA workflow must remain manual-only');
  assert.doesNotMatch(workflow,/secrets\./,'public demo-mode PWA smoke must not receive repository secrets');
  assert.match(workflow,/python -m playwright install --with-deps chromium/);
  assert.match(workflow,/npm run smoke:pwa/);
});
