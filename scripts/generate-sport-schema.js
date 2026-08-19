'use strict';
const fs=require('node:fs');
const path=require('node:path');
const sports=require('../sports.js');
const root=path.resolve(__dirname,'..');
const schemaPath=path.join(root,'schema.sql');
const BEGIN='-- BEGIN GENERATED SPORT REGISTRY';
const END='-- END GENERATED SPORT REGISTRY';
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const json=v=>q(JSON.stringify(v))+'::jsonb';

const lines=[BEGIN,'-- Generated from sports.js. Do not hand-edit this block.'];
let positionRows=0,layoutRows=0;
for(const sport of Object.values(sports)){
  const config={adapterVersion:sport.adapterVersion,surface:sport.surface,defaultPeriods:sport.defaultPeriods,period:sport.period,sides:sport.sides||[],scoreModel:sport.scoreModel,scoreActions:sport.scoreActions,defaultUnitKey:sport.defaultUnitKey,units:sport.units.map(u=>({key:u.key,label:u.label,defaultLayoutKey:u.defaultLayoutKey,layouts:u.layouts.map(l=>({key:l.key,label:l.label,slotCount:l.slots.length}))})),restrictedRotationPositions:sport.restrictedRotationPositions||[],positionAliases:sport.positionAliases||{},capabilities:sport.capabilities};
  lines.push(`insert into sports(code,name,config) values (${q(sport.key)},${q(sport.name)},${json(config)}) on conflict (code) do update set name=excluded.name, config=excluded.config;`);
  sport.units.forEach(unit=>unit.positions.forEach((pos,i)=>{
    positionRows++;
    const metadata={unitLabel:unit.label};
    lines.push(`insert into sport_positions(sport_id,unit_key,code,name,group_code,sort_order,surface_x,surface_y,metadata) select id,${q(unit.key)},${q(pos.code)},${q(pos.name)},${q(pos.group||'')},${i},${Number(pos.x)},${Number(pos.y)},${json(metadata)} from sports where code=${q(sport.key)} on conflict (sport_id,unit_key,code) do update set name=excluded.name, group_code=excluded.group_code, sort_order=excluded.sort_order, surface_x=excluded.surface_x, surface_y=excluded.surface_y, metadata=excluded.metadata;`);
  }));
  sport.units.forEach(unit=>unit.layouts.forEach(layout=>{
    layoutRows++;const slots=layout.slots.map(slot=>({key:slot.key,roleCode:slot.roleCode,label:slot.label,x:slot.x,y:slot.y}));
    lines.push(`insert into sport_layouts(sport_id,unit_key,code,name,slots,is_default,metadata) select id,${q(unit.key)},${q(layout.key)},${q(layout.label)},${json(slots)},${layout.key===unit.defaultLayoutKey?'true':'false'},'{}'::jsonb from sports where code=${q(sport.key)} on conflict (sport_id,unit_key,code) do update set name=excluded.name, slots=excluded.slots, is_default=excluded.is_default, metadata=excluded.metadata;`);
  }));
}
lines.push(END);
const block=lines.join('\n')+'\n\n';
let schema=fs.readFileSync(schemaPath,'utf8');
let start=schema.indexOf(BEGIN),end=schema.indexOf(END);
if(start>=0&&end>=0){end+=END.length;schema=schema.slice(0,start)+block+schema.slice(end).replace(/^\s*/,'');}
else throw new Error('Could not locate generated sport registry markers in schema.sql');
if(process.argv.includes('--check')){
  const original=fs.readFileSync(schemaPath,'utf8');
  if(original!==schema){console.error('Sport registry/schema drift detected. Run: node scripts/generate-sport-schema.js');process.exit(1);}
  console.log(`PASS generated sport schema is synchronized: ${Object.keys(sports).length} sports, ${positionRows} unit-position rows, ${layoutRows} layout rows`);
}else{
  fs.writeFileSync(schemaPath,schema);
  console.log(`Generated ${Object.keys(sports).length} sports, ${positionRows} unit-position rows and ${layoutRows} layout rows into schema.sql`);
}
