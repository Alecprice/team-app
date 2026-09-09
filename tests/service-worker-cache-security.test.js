'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.resolve(__dirname,'..','sw.js'),'utf8');
const handlers={};
const puts=[];
const matches=[];
let currentFetch=async()=>new Response('ok',{status:200});

const cache={
  addAll:async()=>{},
  put:async(key,response)=>{puts.push({key,response});}
};
const caches={
  open:async()=>cache,
  keys:async()=>[],
  delete:async()=>true,
  match:async key=>{matches.push(key);return undefined;}
};
const self={
  addEventListener:(type,handler)=>{handlers[type]=handler;},
  clients:{claim:async()=>{}},
  location:{origin:'https://team.example'},
  registration:{showNotification:async()=>{}}
};
const clients={matchAll:async()=>[],openWindow:async()=>{}};

vm.runInNewContext(source,{
  self,clients,caches,
  fetch:(...args)=>currentFetch(...args),
  location:{origin:'https://team.example'},
  URL,Response,Promise,Set,String,Boolean
},{filename:'sw.js'});

assert.equal(typeof handlers.fetch,'function','service worker fetch handler must register');

async function runRequest(request,fetchImpl){
  puts.length=0;
  matches.length=0;
  currentFetch=fetchImpl||currentFetch;
  let responsePromise=null;
  handlers.fetch({request,respondWith(value){responsePromise=Promise.resolve(value);}});
  assert.ok(responsePromise,'same-origin GET must be handled');
  const response=await responsePromise;
  await new Promise(resolve=>setImmediate(resolve));
  return response;
}

(async()=>{
  const sensitiveNav={method:'GET',mode:'navigate',url:'https://team.example/?Invite_Token=SECRET'};
  await runRequest(sensitiveNav,async()=>new Response('shell',{status:200}));
  assert.equal(puts.length,0,'sensitive navigation must never create a cache entry');

  const normalNav={method:'GET',mode:'navigate',url:'https://team.example/?utm_source=coach'};
  await runRequest(normalNav,async()=>new Response('shell',{status:200}));
  assert.equal(puts.length,1,'normal navigation should refresh the offline shell');
  assert.equal(puts[0].key,'./index.html','navigation cache key must remain token-free and canonical');

  const sensitiveAsset={method:'GET',mode:'cors',url:'https://team.example/styles.css?access_token=SECRET'};
  await runRequest(sensitiveAsset,async()=>new Response('css',{status:200}));
  assert.equal(puts.length,0,'non-navigation requests with sensitive query keys must be network-only');
  assert.equal(matches.length,0,'sensitive request URL must not be used for cache lookup');

  const offlineSensitive={method:'GET',mode:'cors',url:'https://team.example/app.js?join_code=SECRET'};
  const offlineResponse=await runRequest(offlineSensitive,async()=>{throw new Error('offline');});
  assert.equal(offlineResponse.status,503,'offline sensitive asset requests must fail closed');
  assert.equal(matches.length,0,'offline sensitive request must not probe a secret-bearing cache key');

  const normalAsset={method:'GET',mode:'cors',url:'https://team.example/styles.css?v=2'};
  await runRequest(normalAsset,async()=>new Response('css',{status:200}));
  assert.equal(puts.length,1,'benign asset requests should retain normal runtime caching');
  assert.equal(puts[0].key,normalAsset,'normal asset caching should preserve the existing request contract');

  console.log('PASS service worker sensitive-query cache isolation');
})().catch(error=>{console.error(error);process.exit(1);});
