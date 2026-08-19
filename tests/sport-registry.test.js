'use strict';
const assert=require('node:assert/strict');
const sports=require('../sports.js');
const expected=['baseball','softball','soccer','basketball','football','volleyball'];
assert.deepEqual(Object.keys(sports).sort(),expected.sort(),'registry must contain the six initial sport templates');
const allowedSurfaces=new Set(['diamond','pitch','court','gridiron','volleyball']);
const requiredCaps=['roster','availability','schedule','weather','practice','development','learning','lineupSurface','rotationPlanning','gameDay','attendance','score','substitutions'];
for(const [key,sport] of Object.entries(sports)){
  assert.equal(sport.key,key,`${key}: key mismatch`);assert.ok(sport.name&&sport.emoji,`${key}: missing display metadata`);assert.ok(allowedSurfaces.has(sport.surface),`${key}: unknown surface ${sport.surface}`);
  assert.ok(Number.isInteger(sport.defaultPeriods)&&sport.defaultPeriods>=1&&sport.defaultPeriods<=20,`${key}: invalid default period count`);assert.ok(sport.period?.singular&&sport.period?.plural,`${key}: missing period terminology`);assert.ok(['cumulative','period'].includes(sport.scoreModel),`${key}: invalid score model`);assert.equal(sport.adapterVersion,2,`${key}: unsupported adapter version`);
  assert.ok(Array.isArray(sport.units)&&sport.units.length>=1,`${key}: missing standardized units`);assert.ok(sport.units.some(u=>u.key===sport.defaultUnitKey),`${key}: default unit missing`);
  const unitKeys=sport.units.map(u=>u.key);assert.equal(new Set(unitKeys).size,unitKeys.length,`${key}: duplicate unit key`);
  const all=[];
  for(const unit of sport.units){
    assert.ok(unit.label&&Array.isArray(unit.positions)&&unit.positions.length>=5,`${key}/${unit.key}: invalid unit`);const codes=unit.positions.map(p=>p.code);assert.equal(new Set(codes).size,codes.length,`${key}/${unit.key}: duplicate position code`);
    for(const pos of unit.positions){assert.ok(pos.name&&pos.group,`${key}/${unit.key}/${pos.code}: missing name/group`);assert.ok(Number.isFinite(pos.x)&&pos.x>=0&&pos.x<=100,`${key}/${unit.key}/${pos.code}: x out of range`);assert.ok(Number.isFinite(pos.y)&&pos.y>=0&&pos.y<=100,`${key}/${unit.key}/${pos.code}: y out of range`);all.push(pos.code);}
    assert.ok(Array.isArray(unit.layouts)&&unit.layouts.length>=1,`${key}/${unit.key}: missing layouts`);assert.ok(unit.layouts.some(l=>l.key===unit.defaultLayoutKey),`${key}/${unit.key}: default layout missing`);const layoutKeys=unit.layouts.map(l=>l.key);assert.equal(new Set(layoutKeys).size,layoutKeys.length,`${key}/${unit.key}: duplicate layout key`);
    for(const layout of unit.layouts){assert.ok(layout.label&&Array.isArray(layout.slots)&&layout.slots.length>=1,`${key}/${unit.key}/${layout.key}: bad layout`);const slotKeys=layout.slots.map(x=>x.key);assert.equal(new Set(slotKeys).size,slotKeys.length,`${key}/${unit.key}/${layout.key}: duplicate slot key`);for(const slot of layout.slots){assert.ok(codes.includes(slot.roleCode),`${key}/${unit.key}/${layout.key}: unknown role ${slot.roleCode}`);assert.ok(Number.isFinite(slot.x)&&slot.x>=0&&slot.x<=100&&Number.isFinite(slot.y)&&slot.y>=0&&slot.y<=100,`${key}/${unit.key}/${layout.key}/${slot.key}: coordinates out of range`);}}
  }
  assert.equal(sport.allPositions.length,all.length,`${key}: allPositions drift`);assert.equal(new Set(all).size,all.length,`${key}: position codes must be unique across units`);const allSet=new Set(all);
  for(const cap of requiredCaps)assert.equal(sport.capabilities?.[cap],true,`${key}: missing shared capability ${cap}`);
  if(sport.capabilities.pitchTracking)assert.ok(allSet.has('P'),`${key}: pitch tracking requires P position`);if(sport.capabilities.sequenceOrder)assert.ok(sport.sequence?.label,`${key}: ordered sequence requires sequence metadata`);
  for(const restricted of sport.restrictedRotationPositions||[])assert.ok(allSet.has(restricted),`${key}: restricted position ${restricted} not registered`);
  for(const [alias,targets] of Object.entries(sport.positionAliases||{})){assert.ok(alias&&Array.isArray(targets),`${key}: bad alias`);for(const target of targets)assert.ok(allSet.has(target),`${key}: alias ${alias} points to unknown ${target}`);}
  for(const lesson of Object.keys(sport.lessons||{}))assert.ok(allSet.has(lesson),`${key}: lesson for unregistered position ${lesson}`);
  const drillIds=(sport.drills||[]).map(d=>d.id);assert.equal(new Set(drillIds).size,drillIds.length,`${key}: duplicate drill id`);for(const d of sport.drills||[]){assert.ok(d.title&&Number.isFinite(d.minutes)&&d.minutes>0,`${key}/${d.id}: invalid drill`);assert.ok(Array.isArray(d.steps)&&d.steps.length>=2,`${key}/${d.id}: drill needs steps`);}
  assert.ok(Array.isArray(sport.practiceTemplate)&&sport.practiceTemplate.length>=5,`${key}: practice template missing`);assert.ok(Array.isArray(sport.ruleSets)&&sport.ruleSets.length>=1,`${key}: rule sets missing`);assert.ok(Array.isArray(sport.scoreActions)&&sport.scoreActions.length>=1,`${key}: score actions missing`);for(const action of sport.scoreActions){assert.ok(action.label&&Number.isInteger(action.value)&&action.value>0,`${key}: invalid score action`);}
}
assert.equal(sports.football.units.length,3,'football must expose offense, defense, special teams units');
assert.equal(sports.volleyball.scoreModel,'period','volleyball must use per-set scoring');
assert.deepEqual(sports.basketball.scoreActions.map(a=>a.value),[1,2,3],'basketball scoring actions must expose 1/2/3 points');
assert.ok(sports.football.scoreActions.some(a=>a.value===6),'football scoring actions must expose touchdown value');
for(const key of ['baseball','softball','soccer','basketball','football'])assert.equal(sports[key].scoreModel,'cumulative',`${key}: expected cumulative scoring`);
console.log(`PASS sport registry: ${Object.keys(sports).length} sports, unit model validated`);

assert.equal(sports.soccer.unitMap.default.layoutMap['11v11-442'].slots.filter(s=>s.roleCode==='ST').length,2,'soccer 4-4-2 must support duplicate striker roles through unique slots');
assert.equal(sports.volleyball.unitMap.default.layouts.length,6,'volleyball must expose six rotation layouts');
