import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePushSubscription} from '../src/push-subscription.js';

test('normalizes a valid HTTPS push subscription without changing key material',()=>{
  assert.deepEqual(normalizePushSubscription({endpoint:' https://push.example/sub/123 ',keys:{p256dh:' key-a ',auth:' auth-a '}}),{
    endpoint:'https://push.example/sub/123',keys:{p256dh:'key-a',auth:'auth-a'}
  });
});

test('rejects malformed subscription containers and endpoints',()=>{
  for(const value of [null,[],{},'bad',{endpoint:'http://push.example/sub',keys:{p256dh:'a',auth:'b'}},{endpoint:'https://user:pass@push.example/sub',keys:{p256dh:'a',auth:'b'}},{endpoint:'x'.repeat(2050),keys:{p256dh:'a',auth:'b'}}]){
    assert.equal(normalizePushSubscription(value),null);
  }
});

test('rejects missing, blank, non-string, or oversized push keys',()=>{
  const base={endpoint:'https://push.example/sub'};
  for(const keys of [null,[],{}, {p256dh:'',auth:'b'}, {p256dh:'a',auth:'   '}, {p256dh:42,auth:'b'}, {p256dh:'a',auth:'x'.repeat(513)}]){
    assert.equal(normalizePushSubscription({...base,keys}),null);
  }
});
