import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithTimeout} from '../src/fetch-timeout.js';

test('bounded fetch preserves successful responses and supplies an abort signal',async()=>{
  let observedSignal=null;
  const response={ok:true};
  const result=await fetchWithTimeout(async(_input,init)=>{observedSignal=init.signal;return response;},'https://example.test',{method:'POST'},50);
  assert.equal(result,response);
  assert.equal(observedSignal instanceof AbortSignal,true);
  assert.equal(observedSignal.aborted,false);
});

test('bounded fetch aborts stalled providers with a stable timeout code',async()=>{
  const keepAlive=setTimeout(()=>{},100);
  try{
    const stalled=async(_input,init)=>new Promise((resolve,reject)=>{
      init.signal.addEventListener('abort',()=>reject(new Error('aborted')), {once:true});
    });
    await assert.rejects(
      fetchWithTimeout(stalled,'https://example.test',{},5),
      error=>error?.code==='request_timeout'&&error?.message==='Request timed out'
    );
  }finally{
    clearTimeout(keepAlive);
  }
});

test('bounded fetch rejects invalid timeout configuration before network work',async()=>{
  let calls=0;
  const fake=async()=>{calls+=1;return {ok:true};};
  for(const timeout of [0,-1,Number.NaN,Number.POSITIVE_INFINITY]){
    await assert.rejects(fetchWithTimeout(fake,'https://example.test',{},timeout),/timeoutMs must be a positive finite number/);
  }
  assert.equal(calls,0);
});
