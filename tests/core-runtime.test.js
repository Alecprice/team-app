'use strict';
const assert=require('node:assert/strict');
const sports=require('../sports.js');
const core=require('../core/sport-runtime.js');

const soccer=sports.soccer.unitMap.default;
const oldLayout=soccer.layoutMap['11v11-433'];
const newLayout=soccer.layoutMap['11v11-442'];
const assignments={};oldLayout.slots.forEach((slot,i)=>assignments[slot.key]=`p${i+1}`);
const oldST=assignments.ST,oldCM=assignments.CM;
const remapped=core.remapAssignmentsForLayout(assignments,oldLayout,newLayout);
assert.equal(remapped.ST1,oldST,'role remapper must carry ST into ST1');
assert.equal(remapped.CM1,oldCM,'role remapper must carry CM into CM1');
assert.equal(remapped.ST2,undefined,'new duplicate ST slot should remain open when only one prior ST exists');
assert.equal(remapped.CM2,undefined,'new duplicate CM slot should remain open when only one prior CM exists');
assert.equal(core.layoutRoleForSlot(newLayout,'ST2'),'ST');
assert.equal(core.normalizeLayoutKey(soccer,'bogus'),soccer.defaultLayoutKey);

let check=core.validateAssignments(remapped,newLayout,Object.values(assignments));
assert.equal(check.valid,true,JSON.stringify(check.errors));
check=core.validateAssignments({ST1:'p1',ST2:'p1'},newLayout,['p1']);
assert.equal(check.valid,false);assert.ok(check.errors.some(e=>e.code==='duplicate_player'));
check=core.validateAssignments({NOPE:'p1'},newLayout,['p1']);
assert.equal(check.valid,false);assert.ok(check.errors.some(e=>e.code==='unknown_slot'));
assert.deepEqual(core.benchPlayerIds(['p1','p2','p3'],{GK:'p1',LB:'p3'}),['p2']);
assert.equal(core.roleCounts({ST1:'p1',ST2:'p2',CM1:'p3'},newLayout).ST,2);

for(const sport of Object.values(sports))for(const unit of sport.units)for(const layout of unit.layouts){
  assert.equal(core.validateAssignments({},layout).valid,true,`${sport.key}/${unit.key}/${layout.key}`);
}
console.log('PASS shared sport runtime: layout remap, validation, bench and role helpers');
