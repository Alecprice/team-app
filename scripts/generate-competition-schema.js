'use strict';
const fs=require('node:fs');
const path=require('node:path');
const competition=require('../competition-profiles.js');
const root=path.resolve(__dirname,'..');
const schemaPath=path.join(root,'schema.sql');
const BEGIN='-- BEGIN GENERATED COMPETITION PROFILES';
const END='-- END GENERATED COMPETITION PROFILES';
const q=v=>`'${String(v??'').replaceAll("'","''")}'`;
const json=v=>q(JSON.stringify(v))+'::jsonb';
const lines=[BEGIN,'-- Generated from competition-profiles.js. Do not hand-edit this block.'];
let rows=0;
for(const [sportKey,sport] of Object.entries(competition.registry||{})){
  for(const league of sport.leagues||[]){
    for(const profile of league.profiles||[]){
      rows++;
      const config={minAge:profile.minAge??null,maxAge:profile.maxAge??null,gameModel:profile.gameModel||null,defaultLayout:profile.defaultLayout||null,sourceNote:profile.sourceNote||'',secondarySourceUrl:profile.secondarySourceUrl||'',tags:profile.tags||[]};
      lines.push(`insert into competition_profiles(sport_id,profile_key,league_key,league_name,governing_body,division,age_label,season_year,source_url,age_source_url,config) select id,${q(profile.key)},${q(profile.leagueKey||league.key)},${q(profile.leagueName||league.name)},${q(profile.governingBody||league.governingBody||league.name)},${q(profile.division||'')},${q(profile.ageLabel||'')},${profile.seasonYear==null?'null':Number(profile.seasonYear)},${q(profile.sourceUrl||league.sourceUrl||'')},${q(profile.ageSourceUrl||'')},${json(config)} from sports where code=${q(sportKey)} on conflict (sport_id,profile_key) do update set league_key=excluded.league_key,league_name=excluded.league_name,governing_body=excluded.governing_body,division=excluded.division,age_label=excluded.age_label,season_year=excluded.season_year,source_url=excluded.source_url,age_source_url=excluded.age_source_url,config=excluded.config;`);
    }
  }
}
lines.push(END);const block=lines.join('\n')+'\n\n';
let schema=fs.readFileSync(schemaPath,'utf8');let start=schema.indexOf(BEGIN),end=schema.indexOf(END);if(start<0||end<0)throw new Error('Competition profile markers missing');end+=END.length;schema=schema.slice(0,start)+block+schema.slice(end).replace(/^\s*/,'');
if(process.argv.includes('--check')){const original=fs.readFileSync(schemaPath,'utf8');if(original!==schema){console.error('Competition profile/schema drift detected. Run: node scripts/generate-competition-schema.js');process.exit(1);}console.log(`PASS competition schema synchronized: ${rows} profiles`);}else{fs.writeFileSync(schemaPath,schema);console.log(`Generated ${rows} competition profiles into schema.sql`);}
