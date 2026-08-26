import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const source=fs.readFileSync(path.join(root,'worker/src/index.js'),'utf8');
const workerPromise=import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`).then(m=>m.default);

test('scheduled Worker exposes explicit scaffold health without enabling delivery',async()=>{
  const worker=await workerPromise;
  const env={APP_ORIGIN:'https://team-app-6mh.pages.dev'};
  const response=await worker.fetch(new Request('https://jobs.example/health'),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.service,'team-app-jobs');
  assert.equal(body.version,'1.10.0');
  assert.equal(body.mode,'scaffold');
  assert.equal(body.deliveryEnabled,false);
  assert.equal(body.appOrigin,env.APP_ORIGIN);
  assert.ok(!Number.isNaN(Date.parse(body.time)));
});

test('scheduled Worker health supports HEAD and rejects unsafe methods',async()=>{
  const worker=await workerPromise;
  const env={APP_ORIGIN:'https://team-app-6mh.pages.dev'};
  const head=await worker.fetch(new Request('https://jobs.example/health',{method:'HEAD'}),env);
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  const post=await worker.fetch(new Request('https://jobs.example/health',{method:'POST'}),env);
  assert.equal(post.status,405);
  assert.deepEqual(await post.json(),{ok:false,error:'method_not_allowed'});
  const missing=await worker.fetch(new Request('https://jobs.example/nope'),env);
  assert.equal(missing.status,404);
  assert.deepEqual(await missing.json(),{ok:false,error:'not_found'});
});
