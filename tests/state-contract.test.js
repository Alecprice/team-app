const fs=require('fs');
const src=fs.readFileSync('app.js','utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(src.includes('version:8'),'default state must be version 7');
assert(src.includes('teamContexts:{team1:buildTeamContext'),'default state must isolate team data');
assert(src.includes("const TEAM_CONTEXT_FIELDS=['players','periodCount','activeUnitKey','unitAssignments','unitLayoutKeys','sequenceOrder'"),'team context contract missing');
assert(src.includes('function attachContextAccessors(container)'),'team-context compatibility accessors missing');
assert(src.includes('periodCount=sp.defaultPeriods'),'team contexts must use sport periods');
assert(src.includes('sequenceOrder:players.map'),'team contexts must use sequenceOrder');
assert(src.includes('lineupPresets:[]'),'team contexts must use lineupPresets');
assert(src.includes('documents:[]'),'team contexts must isolate document metadata');
assert(src.includes('competitionProfileId'),'team records must retain age/division competition profile');
assert(src.includes('homeLocation'),'team records must retain home location');
assert(src.includes('branding'),'team records must retain branding');
assert(src.includes('unitAssignments','unitLayoutKeys'),'team contexts must isolate lineup assignments by unit');
assert(src.includes('activeUnitKey'),'team contexts must track active lineup unit');
assert(src.includes('pitchesByPeriod'),'game state must use pitchesByPeriod');
assert(src.includes('currentPeriod:1'),'game state must use currentPeriod');
assert(src.includes('periodScores'),'game state must support period/set scoring');
assert(src.includes("sportDef().scoreModel==='period'"),'score behavior must be sport-adapter driven');
// Legacy vocabulary is allowed only inside migration helpers.
const migration=src.slice(src.indexOf('function normalizeGameSession'),src.indexOf('function sportDefFromState'));
const outside=src.replace(migration,'');
for(const token of ['state.innings','state.battingOrder','currentInning','pitchByInning','defensivePresets','data-inning','addInning','clearInning','balanceNextInning']){
  assert(!outside.includes(token),`legacy token leaked outside migration: ${token}`);
}
console.log('PASS generic state + isolated team-context contract');
