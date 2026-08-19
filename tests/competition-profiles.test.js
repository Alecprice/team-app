'use strict';
const assert=require('node:assert/strict');
const competition=require('../competition-profiles.js');
const sports=require('../sports.js');
assert.equal(competition.version,1);
for(const key of Object.keys(sports)){
  const cfg=competition.registry[key];assert.ok(cfg,`${key}: competition registry missing`);assert.ok(cfg.leagues.length>=1,`${key}: needs at least one league option`);
  const ids=new Set();for(const league of cfg.leagues){assert.ok(league.key&&league.name,`${key}: bad league`);assert.ok(Array.isArray(league.profiles)&&league.profiles.length,`${key}/${league.key}: profiles missing`);for(const p of league.profiles){assert.ok(p.key&&p.label,`${key}: bad competition profile`);assert.ok(!ids.has(p.key),`${key}: duplicate profile ${p.key}`);ids.add(p.key);assert.ok(p.governingBody,`${key}/${p.key}: governing body missing`);}}
}
const baseball=competition.registry.baseball.profileMap;assert.equal(baseball['llb-major'].minAge,9);assert.equal(baseball['llb-major'].maxAge,12);assert.equal(baseball['llb-intermediate'].minAge,11);assert.equal(baseball['llb-intermediate'].maxAge,13);
const soccer=competition.registry.soccer.profileMap;assert.equal(soccer['uss-u9-u10'].gameModel,'7v7');assert.equal(soccer['uss-u11-u12'].defaultLayout,'9v9');
console.log('PASS competition profiles: age/division and league registry validated');
