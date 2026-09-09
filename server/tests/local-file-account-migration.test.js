import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const fileStore=fs.readFileSync(path.join(root,'core/file-store.js'),'utf8');
const hardening=fs.readFileSync(path.join(root,'core/hardening-runtime.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('local documents keep blob bytes in the account-scoped file store',()=>{
  assert.match(app,/await FILE_STORE\.put\(team\(\)\.id,id,file\)/);
  assert.match(app,/await FILE_STORE\.get\(team\(\)\.id,id\)/);
  assert.match(fileStore,/function storageKey\(teamId,fileId\)\{return `\$\{account\(\)\}:\$\{teamId\}:\$\{fileId\}`;\}/);
});

test('first-login migration moves unclaimed blobs without overwriting an account copy',()=>{
  assert.match(fileStore,/async function migrateUnclaimed\(userId\)/);
  assert.match(fileStore,/if\(value\?\.accountId!==['"]unclaimed['"]\)\{cursor\.continue\(\);return;\}/);
  assert.match(fileStore,/const target=store\.get\(targetKey\)/);
  assert.match(fileStore,/if\(!target\.result\)\{store\.put\(\{\.\.\.value,key:targetKey,accountId\}\);moved\+=1;\}/);
  assert.match(fileStore,/cursor\.delete\(\);cursor\.continue\(\)/);
  assert.match(fileStore,/TEAM_APP_FILE_STORE=\{put,get,remove,removeTeam,migrateUnclaimed\}/);
});

test('account namespace switch waits for blob migration and preserves originals on failure',()=>{
  assert.match(hardening,/if\(!previousAccount\)\{/);
  assert.match(hardening,/const migrateFiles=root\.TEAM_APP_FILE_STORE\?\.migrateUnclaimed/);
  assert.match(hardening,/accountMigrationUser=nextAccount/);
  assert.match(hardening,/Promise\.resolve\(migrateFiles\(nextAccount\)\)\.then\(\(\)=>\{accountMigrationUser='';finishAccountNamespace\(nextAccount,previousAccount\);\}\)\.catch/);
  assert.match(hardening,/Local documents could not be moved into your signed-in account yet/);
  assert.doesNotMatch(hardening,/catch\([^)]*\)=>\{[^}]*finishAccountNamespace\(nextAccount,previousAccount\)/s);
});
