import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('production bundle routes Neon Auth through the Team APP origin',()=>{
  const build=read('scripts/build-cloudflare.js');
  assert.match(build,/const authUrl=process\.env\.TEAM_APP_NEON_AUTH_URL\|\|'\/api\/auth'/);
  assert.match(build,/replaceAll\(DEFAULT_AUTH,authUrl\)/);
  assert.match(build,/Auth transport:/);
});

test('Pages auth proxy is fixed to Neon Auth and preserves first-party session cookies',()=>{
  const proxy=read('functions/api/auth/[[path]].js');
  for(const token of [
    "NEON_AUTH_UPSTREAM='https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth'",
    "TEAM_APP_AUTH_PREFIX='/api/auth'",
    "redirect:'manual'",
    "headers.delete('host')",
    'getSetCookie',
    "out.delete('set-cookie')",
    "replace(/;\\s*Domain=[^;]+/ig,'')",
    "out.set('Cache-Control','no-store')",
    "out.set('X-Team-App-Auth-Proxy','1')",
    'rewriteLocation(location,incoming.origin)'
  ]) assert.ok(proxy.includes(token),`missing first-party auth proxy contract: ${token}`);
  assert.doesNotMatch(proxy,/searchParams\.get\(['"](?:url|upstream|target)['"]\)/i,'auth proxy must not accept a user-controlled upstream');
});

test('local and CI release gates compile Pages Functions',()=>{
  const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/ci.yml');
  assert.match(pkg.scripts.dev,/wrangler pages dev dist/);
  assert.match(pkg.scripts['verify:pages-functions'],/wrangler pages functions build functions/);
  assert.match(ci,/Compile Pages auth proxy without deploying/);
  assert.match(ci,/npm run verify:pages-functions/);
});
