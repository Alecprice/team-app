import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeBase64Key} from '../src/base64-key.js';

test('strict base64 key decoder accepts only canonical exact-length keys',()=>{
  const canonical=Buffer.alloc(32,0xab).toString('base64');
  assert.equal(canonical.length,44);
  assert.deepEqual(decodeBase64Key(canonical,32),Buffer.alloc(32,0xab));

  for(const invalid of [
    null,
    undefined,
    '',
    ` ${canonical}`,
    `${canonical} `,
    canonical.replace('q','!'),
    canonical.slice(0,-1),
    `${canonical}=`,
    Buffer.alloc(31,0xab).toString('base64'),
    Buffer.alloc(33,0xab).toString('base64'),
  ]){
    assert.equal(decodeBase64Key(invalid,32),null);
  }
});

test('decoder rejects invalid expected lengths instead of weakening the contract',()=>{
  const canonical=Buffer.alloc(32,1).toString('base64');
  for(const expected of [0,-1,1.5,NaN,Infinity,'32',null])assert.equal(decodeBase64Key(canonical,expected),null);
});
