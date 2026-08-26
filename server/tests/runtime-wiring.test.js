import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('production shell wires offline cloud queue before cloud client',()=>{
  const html=read('index.html');
  const queue='./core/cloud-queue.js';
  const cloud='./cloud-client.js';
  assert.ok(html.includes(queue),'index.html must load the offline cloud queue');
  assert.ok(html.includes(cloud),'index.html must load the cloud client');
  assert.ok(html.indexOf(queue)<html.indexOf(cloud),'offline queue must load before cloud-client.js');
});

test('offline queue is shipped and consumed by the production cloud path',()=>{
  const sw=read('sw.js');
  const client=read('client/cloud-entry.js');
  const build=read('scripts/build-cloudflare.js');
  assert.match(sw,/\.\/core\/cloud-queue\.js/);
  assert.match(client,/TEAM_APP_CLOUD_QUEUE/);
  assert.match(build,/for\(const dir of \['core','icons'\]\)/);
});
