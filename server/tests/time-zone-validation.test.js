import test from 'node:test';
import assert from 'node:assert/strict';
import { localEventDate } from '../src/time-zone.js';

test('localEventDate accepts real calendar values',()=>{
  assert.equal(localEventDate('2028-02-29','12:30','UTC').toISOString(),'2028-02-29T12:30:00.000Z');
});

test('localEventDate rejects impossible calendar and clock values consistently',()=>{
  for(const [date,time] of [
    ['2026-02-30','12:00'],
    ['2026-13-01','12:00'],
    ['2026-00-10','12:00'],
    ['2026-09-09','24:00'],
    ['2026-09-09','12:60'],
    ['2026-09-09','99:99'],
  ]){
    assert.throws(()=>localEventDate(date,time,'UTC'),/invalid_event_time/,`${date} ${time}`);
  }
});

test('localEventDate keeps DST gaps distinct from malformed input',()=>{
  assert.throws(()=>localEventDate('2026-03-08','02:30','America/New_York'),/nonexistent_local_time/);
});
