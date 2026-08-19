import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {localEventDate,isValidTimeZone} from '../src/time-zone.js';
import {forecastFor,weatherMeaningfullyChanged} from '../src/weather.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

function fakeIndexedDB(backing=new Map()){
  function dbDef(name){if(!backing.has(name))backing.set(name,{stores:new Map()});return backing.get(name);}
  return {open(name){
    const req={result:null,error:null};
    queueMicrotask(()=>{
      const def=dbDef(name), existed=def.stores.size>0;
      const db={
        objectStoreNames:{contains:n=>def.stores.has(n)},
        createObjectStore(n,opts={}){if(!def.stores.has(n))def.stores.set(n,{keyPath:opts.keyPath||null,map:new Map()});return {};},
        transaction(n){
          const tx={oncomplete:null,onerror:null,error:null};
          const store=()=>{if(!def.stores.has(n))throw new Error('store_missing');return def.stores.get(n)};
          tx.objectStore=()=>({
            get(key){const r={result:undefined,error:null};queueMicrotask(()=>{r.result=store().map.get(key);r.onsuccess?.();});return r;},
            getAll(){const r={result:undefined,error:null};queueMicrotask(()=>{r.result=[...store().map.values()];r.onsuccess?.();});return r;},
            put(value,key){const st=store();const k=key??(st.keyPath?value?.[st.keyPath]:undefined);if(k===undefined)throw new Error('key_required');st.map.set(k,value);queueMicrotask(()=>tx.oncomplete?.());},
            delete(key){store().map.delete(key);queueMicrotask(()=>tx.oncomplete?.());}
          });return tx;
        },close(){}
      };
      req.result=db;
      if(!existed)req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  }};
}
function storageStub(shared=new Map()){return {getItem:k=>shared.has(k)?shared.get(k):null,setItem:(k,v)=>shared.set(k,String(v)),removeItem:k=>shared.delete(k)};}
function browserVm(code,{idbBacking=new Map(),localBacking=new Map()}={}){
  const ctx={crypto:webcrypto,TextEncoder,TextDecoder,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),indexedDB:fakeIndexedDB(idbBacking),localStorage:storageStub(localBacking),console,Date,setTimeout,clearTimeout,structuredClone};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);return ctx;
}

test('time-zone conversion handles DST and rejects nonexistent local wall time',()=>{
  assert.equal(isValidTimeZone('America/New_York'),true);
  assert.equal(isValidTimeZone('Mars/Olympus_Mons'),false);
  assert.equal(localEventDate('2026-03-07','18:00','America/New_York').toISOString(),'2026-03-07T23:00:00.000Z');
  assert.equal(localEventDate('2026-03-09','18:00','America/New_York').toISOString(),'2026-03-09T22:00:00.000Z');
  assert.throws(()=>localEventDate('2026-03-08','02:30','America/New_York'),/nonexistent_local_time/);
});

test('weather monitor summarizes NWS data, detects meaningful change, and fails closed on provider outage',async()=>{
  const old=global.fetch;
  try{
    global.fetch=async url=>{
      const u=String(url);
      if(u.includes('/points/'))return new Response(JSON.stringify({properties:{forecastHourly:'https://weather.test/hourly'}}),{status:200});
      if(u==='https://weather.test/hourly')return new Response(JSON.stringify({properties:{periods:[{startTime:'2026-08-19T14:00:00Z',endTime:'2026-08-19T15:00:00Z',temperature:84,probabilityOfPrecipitation:{value:20}},{startTime:'2026-08-19T15:00:00Z',endTime:'2026-08-19T16:00:00Z',temperature:88,probabilityOfPrecipitation:{value:60}}]}}),{status:200});
      if(u.includes('/alerts/active'))return new Response(JSON.stringify({features:[{id:'alert-1',properties:{event:'Severe Thunderstorm Warning',severity:'Severe',headline:'Storm',expires:'2026-08-19T17:00:00Z'}}]}),{status:200});
      throw new Error(`unexpected ${u}`);
    };
    const f=await forecastFor(36,-82,'2026-08-19T14:15:00Z','2026-08-19T15:30:00Z');
    assert.deepEqual(f.summary,{minTemp:84,maxTemp:88,maxRain:60});assert.equal(f.alerts[0].id,'alert-1');
    assert.equal(weatherMeaningfullyChanged({summary:{maxRain:20},alerts:[]},f),true);
    assert.equal(weatherMeaningfullyChanged({summary:{maxRain:50},alerts:[{id:'alert-1'}]},{summary:{maxRain:60},alerts:[{id:'alert-1'}]}),false);
    global.fetch=async()=>new Response('down',{status:503});
    await assert.rejects(()=>forecastFor(36,-82,'2026-08-19T14:00:00Z','2026-08-19T15:00:00Z'),/NWS 503/);
  }finally{global.fetch=old;}
});

test('E2EE retains historical conversation keys across key rotation and rejects wrong-version decrypt',async()=>{
  const code=read('core/e2ee.js'),a=browserVm(code),b=browserVm(code);const conv='11111111-1111-4111-8111-111111111111';
  const pubA=await a.TEAM_APP_E2EE.publicJwk(),pubB=await b.TEAM_APP_E2EE.publicJwk();
  const k1=await a.TEAM_APP_E2EE.createConversationKey(conv,1),env1=await a.TEAM_APP_E2EE.wrapKeyFor(conv,1,k1,pubB);await b.TEAM_APP_E2EE.unwrapKey(conv,1,pubA,env1.wrappedKey,env1.nonce);
  const m1=await a.TEAM_APP_E2EE.encryptMessage(conv,1,k1,'before rotation');assert.equal(await b.TEAM_APP_E2EE.decryptMessage(conv,1,await b.TEAM_APP_E2EE.conversationKey(conv,1),m1.ciphertext,m1.nonce),'before rotation');
  const k2=await a.TEAM_APP_E2EE.createConversationKey(conv,2),env2=await a.TEAM_APP_E2EE.wrapKeyFor(conv,2,k2,pubB);await b.TEAM_APP_E2EE.unwrapKey(conv,2,pubA,env2.wrappedKey,env2.nonce);
  const m2=await a.TEAM_APP_E2EE.encryptMessage(conv,2,k2,'after rotation');assert.equal(await b.TEAM_APP_E2EE.decryptMessage(conv,2,await b.TEAM_APP_E2EE.conversationKey(conv,2),m2.ciphertext,m2.nonce),'after rotation');
  assert.equal(await b.TEAM_APP_E2EE.decryptMessage(conv,1,await b.TEAM_APP_E2EE.conversationKey(conv,1),m1.ciphertext,m1.nonce),'before rotation');
  await assert.rejects(async()=>b.TEAM_APP_E2EE.decryptMessage(conv,2,await b.TEAM_APP_E2EE.conversationKey(conv,2),m1.ciphertext,m1.nonce));
});

test('offline cloud queue survives module reload, bounds growth, and preserves overwrite/remove behavior',async()=>{
  const code=read('core/cloud-queue.js'),idb=new Map(),local=new Map();let c=browserVm(code,{idbBacking:idb,localBacking:local});const pad='x'.repeat(65536);
  assert.equal(c.TEAM_APP_CLOUD_QUEUE.limits.maxEntries,100);
  for(let i=0;i<100;i++)assert.equal(await c.TEAM_APP_CLOUD_QUEUE.put(`team-${i}`,{context:{seq:i,pad}}),true);
  assert.equal(await c.TEAM_APP_CLOUD_QUEUE.put('team-100',{context:{seq:100,pad}}),false);
  assert.equal(await c.TEAM_APP_CLOUD_QUEUE.put('team-10',{context:{seq:999,pad}}),true);let entries=await c.TEAM_APP_CLOUD_QUEUE.entries();assert.equal(entries.length,100);assert.equal(entries.find(([id])=>id==='team-10')[1].context.seq,999);
  assert.equal(await c.TEAM_APP_CLOUD_QUEUE.put('oversize',{context:{pad:'x'.repeat(c.TEAM_APP_CLOUD_QUEUE.limits.maxItemBytes+1)}}),false);
  c=browserVm(code,{idbBacking:idb,localBacking:local});entries=await c.TEAM_APP_CLOUD_QUEUE.entries();assert.equal(entries.length,100);
  await c.TEAM_APP_CLOUD_QUEUE.remove('team-10');assert.equal((await c.TEAM_APP_CLOUD_QUEUE.entries()).length,99);await c.TEAM_APP_CLOUD_QUEUE.clear();assert.equal((await c.TEAM_APP_CLOUD_QUEUE.entries()).length,0);
});

test('production build dependencies are exact and currently published',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.dependencies['@neondatabase/neon-js'],'0.6.2-beta');
  assert.equal(pkg.devDependencies.esbuild,'0.28.1');
  for(const spec of [...Object.values(pkg.dependencies||{}),...Object.values(pkg.devDependencies||{})]) assert.doesNotMatch(spec,/^[~^*]|\bx\b/i);
});

test('hardening contracts cover sync quotas, role preservation, scoped messaging, keyed E2EE envelopes, and explicit form assignment',()=>{
  const sql=read('sql/data-api-rpc.sql'),client=read('client/cloud-entry.js'),forms=read('server/src/routes-forms.js'),msg=read('server/src/routes-messaging.js'),schema=read('schema.sql');
  for(const token of ['app_check_rate','app_validate_context','team_state_too_large','invalid_players','invalid_events','team_document_count_limit','team_document_storage_limit','team_conversation_limit','answers_too_large','assignment_selection_required','athlete_not_linked_to_assigned_user','restricted_form_requires_coach_assignee','form_not_visible','sender_public_key_jwk'])assert.ok(sql.includes(token),`SQL hardening missing ${token}`);
  assert.match(client,/conversations\?teamId=/);assert.match(client,/p_after_id/);assert.doesNotMatch(client,/encryptMessage\(conv\.id,1,/);assert.match(client,/current\.keyVersion/);assert.match(client,/my_assignments/);assert.match(client,/assignmentId/);assert.match(client,/await queuePayload\(p\)/);assert.match(client,/handleAuthLoss/);assert.match(client,/session expired/i);
  assert.match(forms,/assignment_selection_required/);assert.match(forms,/athlete_not_linked_to_assigned_user/);assert.match(forms,/restricted_form_requires_coach_assignee/);assert.match(forms,/answers_too_large/);assert.match(forms,/value!==true/);
  assert.match(msg,/sender_public_key_jwk/);assert.match(msg,/afterId/);assert.match(msg,/teamId/);assert.match(msg,/team_conversation_limit/);assert.match(msg,/canSeeEmails/);assert.match(msg,/messageB64/);
  assert.match(schema,/sender_public_key_jwk jsonb/);
  assert.match(sql,/where team_id=v_team and revision=v_revision returning revision into v_current/);
  assert.match(sql,/use_count<max_uses/);
  assert.match(sql,/uq_form_assignments_target/);
  assert.match(sql,/app_validate_document/);
  assert.match(sql,/where n\.nspname='public' and p\.proname like 'app\\_%'/);
  assert.match(sql,/revoke all on function %s from public, authenticated, anonymous/);
  assert.match(sql,/grant execute on function app_api\(text,jsonb\) to authenticated/);
  const docs=read('server/src/routes-documents.js'),storage=read('server/src/storage.js'),index=read('server/src/index.js'),headers=read('_headers'),wrangler=read('wrangler.jsonc');
  assert.match(docs,/function canViewDocument/);
  assert.match(docs,/private_document_not_owned/);
  assert.match(docs,/inspectStoredFile/);
  assert.match(storage,/HeadObjectCommand/);
  assert.match(index,/err\?\.status/);
  assert.match(headers,/Content-Security-Policy/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(wrangler,/pages_build_output_dir/);
  assert.match(wrangler,/2026-08-19/);
});
