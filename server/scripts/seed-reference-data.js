import pg from 'pg';
import {createRequire} from 'node:module';
import {config} from '../src/config.js';
const require=createRequire(import.meta.url);const SPORTS=require('../../sports.js');const COMPETITION=require('../../competition-profiles.js');const {Pool}=pg;
if(!config.databaseUrl)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:config.databaseUrl,max:1,application_name:'team-app-reference-seed'});
try{
  await pool.query('begin');
  for(const sport of Object.values(SPORTS)){
    const cfg={adapterVersion:sport.adapterVersion,surface:sport.surface,defaultPeriods:sport.defaultPeriods,period:sport.period,sides:sport.sides||[],scoreModel:sport.scoreModel,scoreActions:sport.scoreActions,defaultUnitKey:sport.defaultUnitKey,units:sport.units.map(u=>({key:u.key,label:u.label,defaultLayoutKey:u.defaultLayoutKey,layouts:u.layouts.map(l=>({key:l.key,label:l.label,slotCount:l.slots.length}))})),restrictedRotationPositions:sport.restrictedRotationPositions||[],positionAliases:sport.positionAliases||{},capabilities:sport.capabilities};
    await pool.query(`insert into sports(code,name,config) values($1,$2,$3::jsonb) on conflict(code) do update set name=excluded.name,config=excluded.config`,[sport.key,sport.name,JSON.stringify(cfg)]);
    const sportId=(await pool.query('select id from sports where code=$1',[sport.key])).rows[0].id;
    const hasPositions=(await pool.query("select to_regclass('public.sport_positions') is not null as ok")).rows[0].ok;
    const hasLayouts=(await pool.query("select to_regclass('public.sport_layouts') is not null as ok")).rows[0].ok;
    if(hasPositions)for(const unit of sport.units)for(const [i,pos] of unit.positions.entries())await pool.query(`insert into sport_positions(sport_id,unit_key,code,name,group_code,sort_order,surface_x,surface_y,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) on conflict(sport_id,unit_key,code) do update set name=excluded.name,group_code=excluded.group_code,sort_order=excluded.sort_order,surface_x=excluded.surface_x,surface_y=excluded.surface_y,metadata=excluded.metadata`,[sportId,unit.key,pos.code,pos.name,pos.group||'',i,pos.x,pos.y,JSON.stringify({unitLabel:unit.label})]);
    if(hasLayouts)for(const unit of sport.units)for(const layout of unit.layouts)await pool.query(`insert into sport_layouts(sport_id,unit_key,code,name,slots,is_default,metadata) values($1,$2,$3,$4,$5::jsonb,$6,'{}'::jsonb) on conflict(sport_id,unit_key,code) do update set name=excluded.name,slots=excluded.slots,is_default=excluded.is_default`,[sportId,unit.key,layout.key,layout.label,JSON.stringify(layout.slots.map(x=>({key:x.key,roleCode:x.roleCode,label:x.label,x:x.x,y:x.y}))),layout.key===unit.defaultLayoutKey]);
  }
  let profiles=0;
  for(const [sportKey,sport] of Object.entries(COMPETITION.registry||{})){
    const sportId=(await pool.query('select id from sports where code=$1',[sportKey])).rows[0]?.id;if(!sportId)continue;
    for(const league of sport.leagues||[])for(const profile of league.profiles||[]){profiles++;const data={minAge:profile.minAge??null,maxAge:profile.maxAge??null,gameModel:profile.gameModel||null,defaultLayout:profile.defaultLayout||null,sourceNote:profile.sourceNote||'',secondarySourceUrl:profile.secondarySourceUrl||'',tags:profile.tags||[]};await pool.query(`insert into competition_profiles(sport_id,profile_key,league_key,league_name,governing_body,division,age_label,season_year,source_url,age_source_url,config) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) on conflict(sport_id,profile_key) do update set league_key=excluded.league_key,league_name=excluded.league_name,governing_body=excluded.governing_body,division=excluded.division,age_label=excluded.age_label,season_year=excluded.season_year,source_url=excluded.source_url,age_source_url=excluded.age_source_url,config=excluded.config`,[sportId,profile.key,profile.leagueKey||league.key,profile.leagueName||league.name,profile.governingBody||league.governingBody||league.name,profile.division||'',profile.ageLabel||'',profile.seasonYear??null,profile.sourceUrl||league.sourceUrl||'',profile.ageSourceUrl||'',JSON.stringify(data)]);}
  }
  await pool.query('commit');console.log(`Team APP reference data seeded: ${Object.keys(SPORTS).length} sports, ${profiles} competition profiles.`);
}catch(err){await pool.query('rollback').catch(()=>{});throw err;}finally{await pool.end();}
