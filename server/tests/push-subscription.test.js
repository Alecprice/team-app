import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_ENDPOINT_LENGTH,MAX_KEY_LENGTH,MAX_USER_AGENT_LENGTH,normalizePushRegistration} from '../src/push-subscription.js';

const valid={endpoint:'https://push.example.test/subscription',keys:{p256dh:'p256dh-key',auth:'auth-key'}};

test('push registration normalizes valid HTTPS subscriptions',()=>{
  assert.deepEqual(normalizePushRegistration(valid,'  Team App Browser  '),{
    endpoint:valid.endpoint,p256dh:'p256dh-key',auth:'auth-key',userAgent:'Team App Browser'
  });
});

test('push registration rejects malformed or unsafe endpoints and keys',()=>{
  for(const subscription of [null,[],{},
    {...valid,endpoint:'http://push.example.test/subscription'},
    {...valid,endpoint:'https://user:pass@push.example.test/subscription'},
    {...valid,endpoint:'x'.repeat(MAX_ENDPOINT_LENGTH+1)},
    {...valid,keys:{...valid.keys,p256dh:'x'.repeat(MAX_KEY_LENGTH+1)}},
    {...valid,keys:{...valid.keys,auth:''}},
  ]) assert.equal(normalizePushRegistration(subscription),null);
});

test('push registration bounds user-agent metadata without rejecting the subscription',()=>{
  const normalized=normalizePushRegistration(valid,'x'.repeat(MAX_USER_AGENT_LENGTH+50));
  assert.equal(normalized.userAgent.length,MAX_USER_AGENT_LENGTH);
});
