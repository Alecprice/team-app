import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,timingSafeHexEqual} from '../src/config.js';

test('timingSafeHexEqual accepts only complete hexadecimal byte strings',()=>{
  const digest=sha256('team-app');
  assert.equal(timingSafeHexEqual(digest,digest),true);
  assert.equal(timingSafeHexEqual(digest,digest.toUpperCase()),true);
  assert.equal(timingSafeHexEqual(digest,sha256('different')),false);
});

test('timingSafeHexEqual rejects malformed values that Buffer hex parsing can truncate',()=>{
  assert.equal(timingSafeHexEqual('a','b'),false);
  assert.equal(timingSafeHexEqual('zz','yy'),false);
  assert.equal(timingSafeHexEqual('aa0','aa1'),false);
  assert.equal(timingSafeHexEqual('',''),false);
  assert.equal(timingSafeHexEqual(null,undefined),false);
});
