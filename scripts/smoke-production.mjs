import process from 'node:process';

const rawBase = process.argv[2] || process.env.TEAM_APP_BASE_URL || 'https://team-app.pages.dev';
const base = rawBase.replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function get(path, { expectType } = {}) {
  const url = `${base}${path}`;
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'team-app-production-smoke/1.0' }
    });
  } catch (error) {
    fail(`${path} request failed: ${error.message}`);
    return null;
  }

  if (!response.ok) {
    fail(`${path} returned HTTP ${response.status}`);
    return { response, body: '' };
  }

  pass(`${path} returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (expectType && !type.toLowerCase().includes(expectType.toLowerCase())) {
    fail(`${path} content-type ${JSON.stringify(type)} did not include ${expectType}`);
  } else if (expectType) {
    pass(`${path} content-type includes ${expectType}`);
  }

  return { response, body: await response.text() };
}

console.log(`Team APP production smoke: ${base}`);

const home = await get('/', { expectType: 'text/html' });
if (home) {
  const requiredHeaders = [
    'content-security-policy',
    'x-content-type-options',
    'x-frame-options',
    'strict-transport-security',
    'referrer-policy',
    'permissions-policy'
  ];
  for (const name of requiredHeaders) {
    if (home.response.headers.get(name)) pass(`home has ${name}`);
    else fail(`home is missing ${name}`);
  }

  for (const needle of [
    'manifest.webmanifest',
    'app.js',
    'cloud-client.js',
    'core/cloud-queue.js',
    'core/connectivity-status.js',
    'core/connectivity-status.css'
  ]) {
    if (home.body.includes(needle)) pass(`home references ${needle}`);
    else fail(`home does not reference ${needle}`);
  }
}

const publicAssets = [
  ['/cloud-client.js', 'javascript'],
  ['/core/cloud-queue.js', 'javascript'],
  ['/core/connectivity-status.js', 'javascript'],
  ['/core/connectivity-status.css', 'text/css']
];
for (const [path, type] of publicAssets) {
  const asset = await get(path, { expectType: type });
  if (path === '/cloud-client.js' && asset) {
    if (asset.body.length > 5000) pass(`cloud-client.js looks like a production bundle (${asset.body.length} bytes)`);
    else fail(`cloud-client.js is unexpectedly small (${asset.body.length} bytes)`);
  }
}

const sw = await get('/sw.js', { expectType: 'javascript' });
if (sw) {
  const cacheControl = sw.response.headers.get('cache-control') || '';
  if (/max-age=0|no-cache|must-revalidate/i.test(cacheControl)) pass('service worker cache policy supports prompt updates');
  else fail(`service worker cache-control is unexpected: ${JSON.stringify(cacheControl)}`);
  for (const needle of ['./core/cloud-queue.js', './core/connectivity-status.js', './core/connectivity-status.css']) {
    if (sw.body.includes(needle)) pass(`service worker precaches ${needle}`);
    else fail(`service worker does not precache ${needle}`);
  }
}

const manifest = await get('/manifest.webmanifest');
if (manifest) {
  try {
    const data = JSON.parse(manifest.body);
    if (data.display === 'standalone') pass('manifest display is standalone');
    else fail(`manifest display is ${JSON.stringify(data.display)}`);
    if (data.start_url) pass('manifest has start_url');
    else fail('manifest is missing start_url');
    if (Array.isArray(data.icons) && data.icons.some(icon => icon?.sizes === '192x192') && data.icons.some(icon => icon?.sizes === '512x512')) {
      pass('manifest has 192x192 and 512x512 icons');
    } else {
      fail('manifest is missing required 192x192/512x512 icons');
    }
  } catch (error) {
    fail(`manifest is not valid JSON: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`\nProduction smoke FAILED with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nProduction smoke PASSED. Public assets, offline wiring, and baseline security headers look healthy.');
