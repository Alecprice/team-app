import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('production bundle routes Neon Auth through the current Team APP origin',()=>{
  const build=read('scripts/build-cloudflare.js');
  for(const token of [
    "const authUrl=(process.env.TEAM_APP_NEON_AUTH_URL||'').replace",
    "new URL('/api/auth',location.origin)",
    'authDeclaration',
    'authNeedle',
    'contents.replace(authNeedle,authDeclaration)',
    'same-origin Pages proxy (/api/auth)'
  ]) assert.ok(build.includes(token),`missing build auth transport contract: ${token}`);
});

test('Pages auth proxy follows Neon first-party JWT and Safari cookie contract',()=>{
  const proxy=read('functions/api/auth/[[path]].js');
  for(const token of [
    "NEON_AUTH_UPSTREAM='https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth'",
    "TEAM_APP_AUTH_PREFIX='/api/auth'",
    "NEON_AUTH_COOKIE_PREFIX='__Secure-neon-auth'",
    "'set-auth-jwt'",
    "'set-auth-token'",
    "headers.set('X-Neon-Auth-Middleware','true')",
    "headers.set('Origin'",
    'neonCookieHeader',
    'name.startsWith(NEON_AUTH_COOKIE_PREFIX)',
    "redirect:'manual'",
    'getSetCookie',
    'getAll',
    "headers.getAll('Set-Cookie')",
    'encodeURIComponent(segment)',
    "replace(/;\\s*Domain=[^;]+/ig,'')",
    "replace(/;\\s*Partitioned\\b/ig,'')",
    "replace(/;\\s*SameSite=(?:Strict|Lax|None)\\b/ig,'')",
    "value+='; Secure'",
    'SameSite=Lax',
    "out.set('Cache-Control','no-store')",
    "out.set('X-Team-App-Auth-Proxy','1')",
    'rewriteLocation(location,incoming.origin)'
  ]) assert.ok(proxy.includes(token),`missing Neon first-party auth proxy contract: ${token}`);
  assert.doesNotMatch(proxy,/new Headers\(context\.request\.headers\)/,'auth proxy must not blindly forward every browser request header upstream');
  assert.doesNotMatch(proxy,/new Headers\(response\.headers\)/,'auth proxy must not blindly expose every upstream auth response header');
  assert.doesNotMatch(proxy,/searchParams\.get\(['"](?:url|upstream|target)['"]\)/i,'auth proxy must not accept a user-controlled upstream');
  assert.match(proxy,/split\('\/'\).*map\(segment=>encodeURIComponent\(segment\)\)/,'auth path segments must be normalized before the upstream URL is constructed');
});

test('Neon auth client contract requires set-auth-jwt for Data API requests',()=>{
  const cloud=read('client/cloud-entry.js');
  assert.match(cloud,/createClient\(\{auth:\{url:NEON_AUTH_URL\},dataApi:\{url:NEON_DATA_API_URL\}\}\)/);
  assert.match(cloud,/neon\.rpc\('app_api'/);
  const proxy=read('functions/api/auth/[[path]].js');
  assert.match(proxy,/RESPONSE_HEADER_ALLOWLIST=\[[^\]]*'set-auth-jwt'/);
  assert.match(proxy,/response\.headers\.get\(name\)/);
});

test('local and CI release gates compile Pages Functions',()=>{
  const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/ci.yml');
  assert.match(pkg.scripts.dev,/wrangler pages dev dist/);
  assert.match(pkg.scripts['verify:pages-functions'],/wrangler pages functions build functions/);
  assert.match(ci,/Compile Pages auth proxy without deploying/);
  assert.match(ci,/npm run verify:pages-functions/);
});
