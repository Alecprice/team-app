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

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const sw = read('sw.js');
const headers = read('_headers');
const manifest = JSON.parse(read('manifest.webmanifest'));
const wrangler = JSON.parse(read('wrangler.jsonc'));

console.log(`Team APP V${pkg.version} release verification`);

assert(lock.lockfileVersion === 3, 'package-lock uses lockfileVersion 3');
assert(JSON.stringify(lock.packages?.['']?.dependencies || {}) === JSON.stringify(pkg.dependencies || {}), 'lockfile runtime dependencies match package.json');
assert(JSON.stringify(lock.packages?.['']?.devDependencies || {}) === JSON.stringify(pkg.devDependencies || {}), 'lockfile dev dependencies match package.json');

assert(sw.includes(`const CACHE='team-app-live-v${pkg.version}'`), `service-worker cache namespace matches V${pkg.version}`);
const assetsMatch = sw.match(/const ASSETS=\[(.*?)\];/s);
if (!assetsMatch) {
  fail('service-worker precache asset list could not be parsed');
} else {
  const assets = [...assetsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert(assets.length >= 10, `service worker precaches ${assets.length} core assets`);
  for (const asset of assets) {
    const normalized = asset.replace(/^\.\//, '');
    if (!normalized) continue;
    assert(exists(normalized), `source precache asset exists: ${normalized}`);
    assert(distExists(normalized), `dist precache asset exists: ${normalized}`);
  }
}

assert(manifest.display === 'standalone', 'manifest uses standalone display mode');
assert(Boolean(manifest.start_url), 'manifest has start_url');
for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons?.find(item => item.sizes === size);
  assert(Boolean(icon), `manifest declares ${size} icon`);
  if (icon?.src) assert(distExists(icon.src.replace(/^\.\//, '')), `dist contains ${size} icon`);
}

assert(wrangler.name === 'team-app', 'Wrangler project name is team-app');
assert(wrangler.pages_build_output_dir === './dist', 'Wrangler Pages output is ./dist');

for (const file of ['index.html', 'styles.css', 'app.js', 'cloud-client.js', 'sw.js', 'manifest.webmanifest', '_headers']) {
  assert(distExists(file), `dist contains ${file}`);
}

const cloudPath = path.join(dist, 'cloud-client.js');
if (fs.existsSync(cloudPath)) {
  const size = fs.statSync(cloudPath).size;
  assert(size > 5000, `production cloud-client.js is bundled (${size} bytes)`);
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

if (failures.length) {
  console.error(`\nRelease verification FAILED with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nRelease verification PASSED. Build, lockfile, PWA assets, Cloudflare config, and baseline security contracts are aligned.');
