import test from 'node:test';
import assert from 'node:assert/strict';
import {PUSH_SEND_OPTIONS,cleanupExpiredPush,isExpiredPushError} from '../src/push-delivery.js';

test('push delivery uses a bounded socket timeout and short TTL',()=>{
  assert.deepEqual(PUSH_SEND_OPTIONS,{TTL:120,timeout:8000});
});

test('only gone push subscriptions qualify for cleanup',()=>{
  assert.equal(isExpiredPushError({statusCode:404}),true);
  assert.equal(isExpiredPushError({statusCode:410}),true);
  assert.equal(isExpiredPushError({statusCode:500}),false);
  assert.equal(isExpiredPushError(null),false);
});

test('expired-subscription cleanup failures are contained',async()=>{
  let attempts=0;
  await assert.doesNotReject(async()=>{
    const cleaned=await cleanupExpiredPush({statusCode:410},async()=>{attempts+=1;throw new Error('db unavailable');});
    assert.equal(cleaned,false);
  });
  assert.equal(attempts,1);
});

test('non-expired push failures never invoke cleanup',async()=>{
  let attempts=0;
  const cleaned=await cleanupExpiredPush({statusCode:503},async()=>{attempts+=1;});
  assert.equal(cleaned,false);
  assert.equal(attempts,0);
});
