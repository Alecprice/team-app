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
const wranglerSource = read('wrangler.jsonc');
const wrangler = JSON.parse(wranglerSource);
const sourceHtml = read('index.html');
const distHtml = distExists('index.html') ? fs.readFileSync(path.join(dist, 'index.html'), 'utf8') : '';

console.log(`Team APP V${pkg.version} release verification`);

assert(lock.lockfileVersion === 3, 'package-lock uses lockfileVersion 3');
assert(lock.packages?.['']?.version === pkg.version, 'lockfile root version matches package.json');
assert(sameMap(lock.packages?.['']?.dependencies, pkg.dependencies), 'lockfile runtime dependencies match package.json');
assert(sameMap(lock.packages?.['']?.devDependencies, pkg.devDependencies), 'lockfile dev dependencies match package.json');

assert(sw.includes(`const CACHE='team-app-live-v${pkg.version}'`), `service-worker cache namespace matches V${pkg.version}`);
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
  './cloud-client.js',
  './app.js'
]) {
  assert(sourceHtml.includes(required), `source shell references ${required}`);
  assert(distHtml.includes(required), `dist shell references ${required}`);
}
assert(sourceHtml.indexOf('./core/cloud-queue.js') < sourceHtml.indexOf('./cloud-client.js'), 'offline queue loads before cloud client');
assert(sourceHtml.indexOf('./app.js') < sourceHtml.indexOf('./core/connectivity-status.js'), 'connectivity enhancer loads after main app');

assert(manifest.display === 'standalone', 'manifest uses standalone display mode');
assert(Boolean(manifest.start_url), 'manifest has start_url');
for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons?.find(item => item.sizes === size);
  assert(Boolean(icon), `manifest declares ${size} icon`);
  if (icon?.src) assert(distExists(icon.src.replace(/^\.\//, '')), `dist contains ${size} icon`);
}

assert(wrangler.name === 'team-app', 'Wrangler project name is team-app');
assert(wrangler.pages_build_output_dir === './dist', 'Wrangler Pages output is ./dist');
assert(/^\d{4}-\d{2}-\d{2}$/.test(String(wrangler.compatibility_date || '')), 'Wrangler compatibility date is explicit');

for (const file of [
  'index.html',
  'styles.css',
  'app.js',
  'cloud-client.js',
  'core/cloud-queue.js',
  'core/connectivity-status.js',
  'core/connectivity-status.css',
  'sw.js',
  'manifest.webmanifest',
  '_headers'
]) assert(distExists(file), `dist contains ${file}`);

const cloudPath = path.join(dist, 'cloud-client.js');
if (fs.existsSync(cloudPath)) {
  const size = fs.statSync(cloudPath).size;
  assert(size > 5000, `production cloud-client.js is bundled (${size} bytes)`);
  const cloud = fs.readFileSync(cloudPath, 'utf8');
  assert(cloud.includes('TEAM_APP_CLOUD_QUEUE'), 'production cloud bundle contains offline queue integration');
  assert(cloud.includes('app_api'), 'production cloud bundle contains consolidated Neon RPC path');
}

for (const header of [
  'Content-Security-Policy:',
  'Strict-Transport-Security:',
  'X-Content-Type-Options:',
  'X-Frame-Options:',
  'Referrer-Policy:',
  'Permissions-Policy:'
]) assert(headers.includes(header), `_headers contains ${header.slice(0, -1)}`);

for (const directive of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
  assert(headers.includes(directive), `CSP contains ${directive}`);
}
assert(headers.includes('neonauth.c-12.us-east-1.aws.neon.tech'), 'CSP allows Neon Auth endpoint');
assert(headers.includes('apirest.c-12.us-east-1.aws.neon.tech'), 'CSP allows Neon Data API endpoint');
assert(headers.includes('https://api.weather.gov'), 'CSP allows National Weather Service API');
assert(/\/sw\.js\s+[\s\S]*Cache-Control:\s*public, max-age=0, must-revalidate/.test(headers), 'service worker response is configured for revalidation');
assert(/\/index\.html\s+[\s\S]*Cache-Control:\s*public, max-age=0, must-revalidate/.test(headers), 'index response is configured for revalidation');

if (failures.length) {
  console.error(`\nRelease verification FAILED with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nRelease verification PASSED. Build, lockfile, PWA/runtime wiring, Cloudflare config, and baseline security contracts are aligned.');
