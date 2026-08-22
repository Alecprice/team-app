import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('connectivity indicator is wired, accessible, queue-aware, and offline-cached',()=>{
  const html=read('index.html'),script=read('core/connectivity-status.js'),css=read('core/connectivity-status.css'),sw=read('sw.js');
  assert.match(html,/core\/connectivity-status\.css/);
  assert.match(html,/core\/connectivity-status\.js/);
  assert.ok(html.indexOf('./app.js')<html.indexOf('./core/connectivity-status.js'),'status enhancer should load after the main app');
  assert.match(script,/role','status'/);
  assert.match(script,/aria-live','polite'/);
  assert.match(script,/TEAM_APP_CLOUD_QUEUE/);
  assert.match(script,/addEventListener\('online'/);
  assert.match(script,/addEventListener\('offline'/);
  assert.match(css,/@media \(max-width:760px\)/);
  assert.match(css,/connectivity-label/);
  assert.match(sw,/\.\/core\/connectivity-status\.css/);
  assert.match(sw,/\.\/core\/connectivity-status\.js/);
});
