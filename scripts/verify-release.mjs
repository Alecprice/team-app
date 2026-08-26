import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const failures = [];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const distExists = file => fs.existsSync(path.join(dist, file));
const pass = message => console.log(`PASS: ${message}`);
const fail = message => { failures.push(message); console.error(`FAIL: ${message}`); };
const assert = (condition, message) => condition ? pass(message) : fail(message);
const sortedEntries = value => Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b));
const sameMap = (left, right) => JSON.stringify(sortedEntries(left)) === JSON.stringify(sortedEntries(right));

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const sw = read('sw.js');
const headers = read('_headers');
const manifest = JSON.parse(read('manifest.webmanifest'));
const wrangler = JSON.parse(read('wrangler.jsonc'));
const workerWrangler = JSON.parse(read('worker/wrangler.jsonc'));
const workerSource = read('worker/src/index.js');
const sourceHtml = read('index.html');
const distHtml = distExists('index.html') ? fs.readFileSync(path.join(dist, 'index.html'), 'utf8') : '';

console.log(`Team APP V${pkg.version} release verification`);

assert(lock.lockfileVersion === 3, 'package-lock uses lockfileVersion 3');
assert(lock.packages?.['']?.version === pkg.version, 'lockfile root version matches package.json');
assert(sameMap(lock.packages?.['']?.dependencies, pkg.dependencies), 'lockfile runtime dependencies match package.json');
assert(sameMap(lock.packages?.['']?.devDependencies, pkg.devDependencies), 'lockfile dev dependencies match package.json');

assert(sw.includes(`const CACHE='team-app-live-v${pkg.version}`), `service-worker cache namespace is in the V${pkg.version} family`);
assert(!sw.includes('c.put(event.request,copy));}return res;}).catch(async()=>{const cached=await caches.match(event.request)'), 'service-worker no longer blindly caches navigation URLs containing query secrets');
const assetsMatch = sw.match(/const ASSETS=\[(.*?)\];/s);
if (!assetsMatch) {
  fail('service-worker precache asset list could not be parsed');
} else {
  const assets = [...assetsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert(assets.length >= 10, `service worker precaches ${assets.length} core assets`);
  assert(new Set(assets).size === assets.length, 'service-worker precache list has no duplicates');
  for (const asset of assets) {
    const normalized = asset.replace(/^\.\//, '');
    if (!normalized) continue;
    assert(exists(normalized), `source precache asset exists: ${normalized}`);
    assert(distExists(normalized), `dist precache asset exists: ${normalized}`);
  }
}

for (const required of [
  './core/cloud-queue.js',
  './core/connectivity-status.js',
  './core/connectivity-status.css',
  './core/hardening-runtime.js',
  './core/hardening-runtime.css',
  './cloud-client.js',
  './app.js'
]) {
  assert(sourceHtml.includes(required), `source shell references ${required}`);
  assert(distHtml.includes(required), `dist shell references ${required}`);
}
assert(sourceHtml.indexOf('./core/cloud-queue.js') < sourceHtml.indexOf('./cloud-client.js'), 'offline queue loads before cloud client');
assert(sourceHtml.indexOf('./cloud-client.js') < sourceHtml.indexOf('./core/hardening-runtime.js'), 'hardening runtime loads after cloud client');
assert(sourceHtml.indexOf('./core/hardening-runtime.js') < sourceHtml.indexOf('./app.js'), 'hardening runtime loads before main app');
assert(sourceHtml.indexOf('./app.js') < sourceHtml.indexOf('./core/connectivity-status.js'), 'connectivity enhancer loads after main app');

assert(manifest.id === './', 'manifest has stable app id');
assert(manifest.scope === './', 'manifest scope is explicit');
assert(manifest.start_url === './', 'manifest start_url is canonical');
assert(manifest.display === 'standalone', 'manifest uses standalone display mode');
assert(manifest.lang === 'en-US', 'manifest language is explicit');
const shortcutUrls=(manifest.shortcuts||[]).map(x=>x.url);
assert(shortcutUrls.includes('./#schedule'), 'manifest exposes Schedule shortcut');
assert(shortcutUrls.includes('./#lineup'), 'manifest exposes Lineups shortcut');
for (const shortcut of manifest.shortcuts||[]) assert(Boolean(shortcut.name&&shortcut.short_name&&shortcut.description&&shortcut.url), `manifest shortcut is complete: ${shortcut.short_name||shortcut.name||'unnamed'}`);
for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons?.find(item => item.sizes === size);
  assert(Boolean(icon), `manifest declares ${size} icon`);
  if (icon?.src) assert(distExists(icon.src.replace(/^\.\//, '')), `dist contains ${size} icon`);
}

assert(wrangler.name === 'team-app', 'Wrangler Pages project name is team-app');
assert(wrangler.pages_build_output_dir === './dist', 'Wrangler Pages output is ./dist');
assert(/^\d{4}-\d{2}-\d{2}$/.test(String(wrangler.compatibility_date || '')), 'Pages Wrangler compatibility date is explicit');
assert(workerWrangler.name === 'team-app-jobs', 'scheduled Worker name is team-app-jobs');
assert(workerWrangler.main === 'src/index.js', 'scheduled Worker entry point is explicit');
assert(/^\d{4}-\d{2}-\d{2}$/.test(String(workerWrangler.compatibility_date || '')), 'Worker compatibility date is explicit');
assert(workerWrangler.vars?.APP_ORIGIN === 'https://team-app-6mh.pages.dev', 'Worker app origin matches expected canonical Pages origin');
assert(Array.isArray(workerWrangler.triggers?.crons) && workerWrangler.triggers.crons.length === 1, 'scheduled Worker has exactly one cron trigger');
assert(workerSource.includes(`const VERSION='${pkg.version}'`), `Worker health version matches V${pkg.version}`);
assert(workerSource.includes("mode:'scaffold'"), 'Worker health explicitly reports scaffold mode');
assert(workerSource.includes('deliveryEnabled:false'), 'Worker health explicitly reports delivery disabled');

for (const file of [
  'index.html','styles.css','app.js','cloud-client.js','build-info.json','core/cloud-queue.js','core/connectivity-status.js','core/connectivity-status.css','core/hardening-runtime.js','core/hardening-runtime.css','sw.js','manifest.webmanifest','_headers'
]) assert(distExists(file), `dist contains ${file}`);

if (distExists('build-info.json')) {
  try {
    const info=JSON.parse(fs.readFileSync(path.join(dist,'build-info.json'),'utf8'));
    assert(info.app==='team-app','build identity names Team APP');
    assert(info.version===pkg.version,'build identity version matches package.json');
    assert(typeof info.environment==='string'&&info.environment.length>0,'build identity includes environment');
    assert(typeof info.commit==='string'&&info.commit.length>0,'build identity includes commit');
    assert(!Number.isNaN(Date.parse(info.builtAt)),'build identity includes parseable build time');
  } catch(error) { fail(`build-info.json is invalid: ${error.message}`); }
}

const cloudPath = path.join(dist, 'cloud-client.js');
if (fs.existsSync(cloudPath)) {
  const size = fs.statSync(cloudPath).size;
  assert(size > 5000, `production cloud-client.js is bundled (${size} bytes)`);
  const cloud = fs.readFileSync(cloudPath, 'utf8');
  assert(cloud.includes('TEAM_APP_CLOUD_QUEUE'), 'production cloud bundle contains offline queue integration');
  assert(cloud.includes('app_api'), 'production cloud bundle contains consolidated Neon RPC path');
  assert(cloud.includes('Message was not sent. Your draft is still here.'), 'production cloud bundle preserves a message draft when send fails');
  assert(cloud.includes('member.role.update')&&cloud.includes('member.remove')&&cloud.includes('team.owner.transfer'), 'production cloud bundle contains access lifecycle controls');
}

for (const header of ['Content-Security-Policy:','Strict-Transport-Security:','X-Content-Type-Options:','X-Frame-Options:','Referrer-Policy:','Permissions-Policy:']) assert(headers.includes(header), `_headers contains ${header.slice(0, -1)}`);
for (const directive of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) assert(headers.includes(directive), `CSP contains ${directive}`);
assert(headers.includes('neonauth.c-12.us-east-1.aws.neon.tech'), 'CSP allows Neon Auth endpoint');
assert(headers.includes('apirest.c-12.us-east-1.aws.neon.tech'), 'CSP allows Neon Data API endpoint');
assert(headers.includes('https://api.weather.gov'), 'CSP allows National Weather Service API');
assert(/\/sw\.js\s+[\s\S]*Cache-Control:\s*public, max-age=0, must-revalidate/.test(headers), 'service worker response is configured for revalidation');
assert(/\/index\.html\s+[\s\S]*Cache-Control:\s*public, max-age=0, must-revalidate/.test(headers), 'index response is configured for revalidation');

if (failures.length) { console.error(`\nRelease verification FAILED with ${failures.length} issue(s).`);process.exit(1); }
console.log('\nRelease verification PASSED. Build identity, lockfile, installed-PWA/runtime wiring, cloud access controls, Cloudflare configs, Worker scaffold, and baseline security contracts are aligned.');
