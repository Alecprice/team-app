import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const source=fs.readFileSync(path.join(root,'client/cloud-entry.js'),'utf8');

test('offline queue preserves account ownership and optimistic base revision',()=>{
  assert.match(source,/queue\.put\(remoteId,\{ownerUserId,baseRevision,teamRecord:p\.teamRecord,context:p\.context\}\)/);
  assert.match(source,/revision:baseRevision,teamRecord:p\.teamRecord,context:p\.context/);
  assert.match(source,/existingAny\?\.ownerUserId&&existingAny\.ownerUserId!==ownerUserId/);
  assert.doesNotMatch(source,/revision:revisions\.get\(id\)\|\|0,teamRecord:p\.teamRecord,context:p\.context/);
});

test('login hydration does not overwrite teams with queued local changes',()=>{
  assert.match(source,/const queued=new Map\(await queuedRows\(\)\)/);
  assert.match(source,/const cloudTeams=slots\.filter\(Boolean\)/);
  assert.match(source,/if\(queued\.size\)\{for\(const detail of cloudTeams\)if\(!queued\.has\(detail\.id\)\)runtime\?\.replaceOneCloudTeam\?\.\(detail\);\}/);
  assert.match(source,/reason:'queued_revision_missing'/);
});

test('manual sync reports conflicts instead of claiming success',()=>{
  assert.match(source,/return syncResult\('conflict'/);
  assert.match(source,/syncResultMessage\(result\)/);
  assert.doesNotMatch(source,/syncActive\(true\)\.then\(\(\)=>alert\('Sync complete\.'\)\)/);
});

test('choosing the cloud copy explicitly discards the queued local snapshot',()=>{
  assert.match(source,/conflicts\.delete\(rid\);await removeQueued\(rid\);runtime\.replaceOneCloudTeam/);
});

test('only transient sync failures are converted into queued retries',()=>{
  assert.match(source,/if\(!e\.status\|\|e\.status===429\|\|e\.status>=500\)\{const queued=await queuePayload\(p\)/);
  assert.match(source,/if\(e\.status===401\)\{handleAuthLoss\(\);return syncResult\('auth-lost'/);
});
