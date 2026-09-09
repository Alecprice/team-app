import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('production smoke verifies the centralized sensitive-query cache policy',()=>{
  const smoke=read('scripts/smoke-production.mjs');
  const sw=read('sw.js');

  for(const token of ['SENSITIVE_QUERY_KEYS','hasSensitiveQuery(url)','if(sensitive){']){
    assert.ok(sw.includes(token),`service worker missing ${token}`);
    assert.ok(smoke.includes(token),`production smoke missing ${token}`);
  }
  for(const key of ['invite_token','access_token','join_code','session_token','authorization','secret']){
    assert.ok(sw.includes(`'${key}'`),`service worker missing protected key ${key}`);
    assert.ok(smoke.includes(`'${key}'`),`production smoke missing protected key ${key}`);
  }
  assert.doesNotMatch(smoke,/url\.searchParams\.has\(['"]invite['"]\)/,'production smoke must not require the retired one-off invite guard');
});
