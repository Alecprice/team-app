'use strict';
const assert=require('node:assert/strict');
const sports=require('../sport-content.js');

for(const [key,sport] of Object.entries(sports)){
  const positions=sport.allPositions||sport.positions||[];
  const lessons=sport.lessons||{};
  assert.equal(Object.keys(lessons).length,positions.length,`${key}: every registered position needs a lesson`);
  for(const pos of positions){
    const l=lessons[pos.code];
    assert.ok(l,`${key}/${pos.code}: missing lesson`);
    assert.ok(l.title&&l.where&&l.tip,`${key}/${pos.code}: incomplete lesson summary`);
    assert.ok(Array.isArray(l.responsibilities)&&l.responsibilities.length>=2,`${key}/${pos.code}: responsibilities too thin`);
    assert.ok(Array.isArray(l.skills)&&l.skills.length>=2,`${key}/${pos.code}: skills too thin`);
  }
  const drills=sport.drills||[];
  assert.ok(drills.length>=6,`${key}: needs a useful drill library`);
  const ids=drills.map(d=>d.id);assert.equal(new Set(ids).size,ids.length,`${key}: duplicate drill id`);
  for(const d of drills){
    assert.ok(d.id&&d.title&&d.category&&d.focus&&d.equipment,`${key}: incomplete drill metadata`);
    assert.ok(Number.isFinite(d.minutes)&&d.minutes>0&&d.minutes<=30,`${key}/${d.id}: invalid drill length`);
    assert.ok(Array.isArray(d.steps)&&d.steps.length>=3,`${key}/${d.id}: drill instructions too thin`);
  }
  const map=sport.skillDrillMap||{};const drillSet=new Set(ids);
  for(const [skillKey] of sport.developmentSkills||[]){
    assert.ok(Array.isArray(map[skillKey])&&map[skillKey].length>=1,`${key}/${skillKey}: no development drill recommendations`);
    for(const id of map[skillKey])assert.ok(drillSet.has(id),`${key}/${skillKey}: unknown mapped drill ${id}`);
  }
}

for(const key of ['softball','soccer','basketball','football','volleyball'])assert.equal(sports[key].contentStatus,'reviewed-fundamentals',`${key}: content status missing`);
assert.match(sports.football.lessons.QB.tip,/snap|footwork/i,'football QB lesson should stay fundamentals-first');
assert.ok(sports.football.drills.some(d=>/without contact|flag pull|two-hand tag/i.test(`${d.focus} ${d.steps.join(' ')}`)),'football library should include a non-contact safety path');
console.log(`PASS sport coaching content parity: ${Object.keys(sports).length} sports have lessons, drills and development mappings`);
