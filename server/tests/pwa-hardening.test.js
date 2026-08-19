import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../../sw.js',import.meta.url),'utf8');
function harness(){
  const handlers={},shell=new Response('<html>shell</html>',{status:200,headers:{'content-type':'text/html'}});
  const ctx={self:{addEventListener:(n,fn)=>handlers[n]=fn,skipWaiting:()=>Promise.resolve(),clients:{claim:()=>Promise.resolve()}},caches:{open:async()=>({addAll:async()=>{}}),keys:async()=>[],delete:async()=>true,match:async req=>String(req).includes('index.html')?shell.clone():undefined},fetch:async()=>{throw new Error('offline')},URL,Response,Promise,console,location:{origin:'https://team.test'}};
  vm.createContext(ctx);vm.runInContext(code,ctx);return {handlers,ctx};
}
test('service worker only returns app shell for navigation; missing offline assets get 503',async()=>{
  const {handlers}=harness();assert.ok(handlers.fetch);
  let p;handlers.fetch({request:{method:'GET',url:'https://team.test/route',mode:'navigate'},respondWith:x=>p=x});let r=await p;assert.equal(r.status,200);assert.match(await r.text(),/shell/);
  handlers.fetch({request:{method:'GET',url:'https://team.test/missing.js',mode:'cors'},respondWith:x=>p=x});r=await p;assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/<html>/i);
});
