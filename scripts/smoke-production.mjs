import process from 'node:process';

const rawBase = process.argv[2] || process.env.TEAM_APP_BASE_URL || 'https://team-app-6mh.pages.dev';
const base = rawBase.replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const expectedCommit = process.env.TEAM_APP_EXPECT_COMMIT || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '';
const expectedVersion = process.env.TEAM_APP_EXPECT_VERSION || '';
const failures = [];

function fail(message) { failures.push(message); console.error(`FAIL: ${message}`); }
function pass(message) { console.log(`PASS: ${message}`); }

async function get(path, { expectType } = {}) {
  const url = `${base}${path}`;
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'team-app-production-smoke/1.1', 'cache-control': 'no-cache' }
    });
  } catch (error) {
    fail(`${path} request failed: ${error.message}`);return null;
  }
  if (!response.ok) { fail(`${path} returned HTTP ${response.status}`);return { response, body: '' }; }
  pass(`${path} returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (expectType && !type.toLowerCase().includes(expectType.toLowerCase())) fail(`${path} content-type ${JSON.stringify(type)} did not include ${expectType}`);
  else if (expectType) pass(`${path} content-type includes ${expectType}`);
  return { response, body: await response.text() };
}

console.log(`Team APP production smoke: ${base}`);

const buildInfo = await get('/build-info.json', { expectType: 'json' });
if (buildInfo) {
  try {
    const info=JSON.parse(buildInfo.body);
    if(info.app==='team-app')pass('build identity belongs to Team APP');else fail(`unexpected build app ${JSON.stringify(info.app)}`);
    if(info.commit)pass(`deployed build reports commit ${info.commit}`);else fail('build identity is missing commit');
    if(info.version)pass(`deployed build reports version ${info.version}`);else fail('build identity is missing version');
    if(expectedCommit){if(info.commit===expectedCommit)pass(`deployed commit matches expected ${expectedCommit}`);else fail(`deployed commit ${info.commit} does not match expected ${expectedCommit}`);}
    if(expectedVersion){if(info.version===expectedVersion)pass(`deployed version matches expected ${expectedVersion}`);else fail(`deployed version ${info.version} does not match expected ${expectedVersion}`);}
  } catch(error){fail(`build-info.json is not valid JSON: ${error.message}`);}
}

const home = await get('/', { expectType: 'text/html' });
if (home) {
  for (const name of ['content-security-policy','x-content-type-options','x-frame-options','strict-transport-security','referrer-policy','permissions-policy']) {
    if (home.response.headers.get(name)) pass(`home has ${name}`);else fail(`home is missing ${name}`);
  }
  for (const needle of ['manifest.webmanifest','app.js','cloud-client.js','core/cloud-queue.js','core/connectivity-status.js','core/connectivity-status.css','core/hardening-runtime.js','core/hardening-runtime.css']) {
    if (home.body.includes(needle)) pass(`home references ${needle}`);else fail(`home does not reference ${needle}`);
  }
}

const authProxy = await get('/api/auth/get-session', { expectType: 'json' });
if (authProxy) {
  const marker=authProxy.response.headers.get('x-team-app-auth-proxy');
  if(marker==='1')pass('auth session endpoint is served by the Team APP first-party proxy');else fail(`auth proxy marker is missing or unexpected: ${JSON.stringify(marker)}`);
  const cacheControl=authProxy.response.headers.get('cache-control')||'';
  if(/no-store/i.test(cacheControl))pass('auth proxy session response is not cached');else fail(`auth proxy cache-control is unexpected: ${JSON.stringify(cacheControl)}`);
  try{JSON.parse(authProxy.body||'null');pass('auth proxy session response is valid JSON');}catch(error){fail(`auth proxy session response is not valid JSON: ${error.message}`);}
}

const publicAssets = [
  ['/cloud-client.js', 'javascript'],['/core/cloud-queue.js', 'javascript'],['/core/connectivity-status.js', 'javascript'],['/core/connectivity-status.css', 'text/css'],['/core/hardening-runtime.js','javascript'],['/core/hardening-runtime.css','text/css']
];
for (const [path, type] of publicAssets) {
  const asset = await get(path, { expectType: type });
  if (path === '/cloud-client.js' && asset) {
    if (asset.body.length > 5000) pass(`cloud-client.js looks like a production bundle (${asset.body.length} bytes)`);else fail(`cloud-client.js is unexpectedly small (${asset.body.length} bytes)`);
    if(asset.body.includes('/api/auth'))pass('cloud-client.js uses the same-origin auth route');else fail('cloud-client.js is missing the same-origin auth route');
    if(asset.body.includes('ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth'))fail('cloud-client.js still contains the cross-origin Neon Auth endpoint');else pass('cloud-client.js does not call Neon Auth cross-origin');
  }
}

const sw = await get('/sw.js', { expectType: 'javascript' });
if (sw) {
  const cacheControl = sw.response.headers.get('cache-control') || '';
  if (/max-age=0|no-cache|must-revalidate/i.test(cacheControl)) pass('service worker cache policy supports prompt updates');else fail(`service worker cache-control is unexpected: ${JSON.stringify(cacheControl)}`);
  for (const needle of ['./core/cloud-queue.js','./core/connectivity-status.js','./core/connectivity-status.css','./core/hardening-runtime.js','./core/hardening-runtime.css']) {
    if (sw.body.includes(needle)) pass(`service worker precaches ${needle}`);else fail(`service worker does not precache ${needle}`);
  }
  if(sw.body.includes("url.searchParams.has('invite')"))pass('service worker rejects sensitive invite navigation cache keys');else fail('service worker sensitive-navigation guard missing');
}

const manifest = await get('/manifest.webmanifest');
if (manifest) {
  try {
    const data = JSON.parse(manifest.body);
    if (data.display === 'standalone') pass('manifest display is standalone');else fail(`manifest display is ${JSON.stringify(data.display)}`);
    if (data.start_url) pass('manifest has start_url');else fail('manifest is missing start_url');
    if (Array.isArray(data.icons) && data.icons.some(icon => icon?.sizes === '192x192') && data.icons.some(icon => icon?.sizes === '512x512')) pass('manifest has 192x192 and 512x512 icons');else fail('manifest is missing required 192x192/512x512 icons');
  } catch (error) { fail(`manifest is not valid JSON: ${error.message}`); }
}

if (failures.length) { console.error(`\nProduction smoke FAILED with ${failures.length} issue(s).`);process.exit(1); }
console.log('\nProduction smoke PASSED. Build identity, first-party auth, public assets, offline wiring, and baseline security headers look healthy.');
