import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('live account smoke is opt-in, synthetic, and read-only by default',()=>{
  const smoke=read('scripts/live-account-smoke.mjs');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['smoke:account'],'node scripts/live-account-smoke.mjs');
  for(const name of ['TEAM_APP_SMOKE_EMAIL','TEAM_APP_SMOKE_PASSWORD','TEAM_APP_SMOKE_MUTATE','TEAM_APP_SMOKE_GUARDIAN'])assert.match(smoke,new RegExp(name));
  assert.match(smoke,/const MUTATE=.*TEAM_APP_SMOKE_MUTATE/);
  assert.match(smoke,/const GUARDIAN=.*TEAM_APP_SMOKE_GUARDIAN/);
  assert.match(smoke,/if\(MUTATE\)\{const team=await createTeamAndRace\(coach\)/);
  assert.match(smoke,/mutation gate is disabled; production team data was not changed/);
  assert.match(smoke,/Do not use a real family account/);
  assert.doesNotMatch(smoke,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,'smoke source must not contain a hard-coded account email');
});

test('live account smoke proves first-party auth, JWT access, atomic conflict, and guardian role boundaries',()=>{
  const smoke=read('scripts/live-account-smoke.mjs');
  for(const token of [
    '/api/auth','/sign-in/email','/get-session','/rpc/app_api',
    "coach.api('me',{})","coach.api('team.create'","coach.api('team.state.get'","coach.api('team.state.update'",
    "coach.api('invitation.create'","guardian.api('invitation.accept'","guardian.api('team.state.get'","guardian.rawApi('team.state.update'",
    'revision_conflict','coach_role_required','Promise.all','CLEANUP_REQUIRED'
  ]) assert.ok(smoke.includes(token),`missing live smoke contract: ${token}`);
  assert.match(smoke,/if\(response\.ok\)fail\('Anonymous Data API request unexpectedly succeeded\.'/);
  assert.match(smoke,/conflicts\.length!==1\|\|successes\.length!==1/);
  assert.match(smoke,/Coach and guardian smoke accounts must be different synthetic adults/);
  assert.match(smoke,/state\?\.role!=='guardian'/);
});

test('live account smoke workflow cannot run automatically and does not allow a user-controlled credential destination',()=>{
  const workflow=read('.github/workflows/live-account-smoke.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s*(?:push|pull_request|schedule):/,'live credential workflow must remain manual-only');
  assert.match(workflow,/guardian:[\s\S]*default: false/);
  for(const secret of ['TEAM_APP_SMOKE_EMAIL','TEAM_APP_SMOKE_PASSWORD','TEAM_APP_SMOKE_GUARDIAN_EMAIL','TEAM_APP_SMOKE_GUARDIAN_PASSWORD'])assert.match(workflow,new RegExp(`secrets\\.${secret}`));
  assert.match(workflow,/TEAM_APP_SMOKE_MUTATE: \$\{\{ inputs\.mutate \}\}/);
  assert.match(workflow,/TEAM_APP_SMOKE_GUARDIAN: \$\{\{ inputs\.guardian \}\}/);
  assert.doesNotMatch(workflow,/TEAM_APP_BASE_URL:\s*\$\{\{/,'workflow must not accept a user-controlled destination for smoke credentials');
});
