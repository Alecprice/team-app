import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('browser cloud client stays on the unified Neon SDK vanilla surface',()=>{
  const client=read('client/cloud-entry.js');
  const pkg=JSON.parse(read('package.json'));
  assert.match(client,/import\s*\{\s*createClient\s*\}\s*from\s*['"]@neondatabase\/neon-js['"]/);
  assert.doesNotMatch(client,/from\s*['"]@neondatabase\/auth-ui/);
  assert.doesNotMatch(client,/from\s*['"]@daveyplate\/better-auth-ui/);
  assert.doesNotMatch(client,/from\s*['"]better-auth/);
  assert.equal(pkg.dependencies['@neondatabase/neon-js'],'0.7.0-beta');
  assert.equal(pkg.dependencies['@neondatabase/auth-ui'],undefined);
  assert.equal(pkg.dependencies['better-auth'],undefined);
});
