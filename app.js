(() => {
  'use strict';

  const STORAGE_KEY = 'team-app-service-v1.10-state';
  const LEGACY_STORAGE_KEYS = ['team-app-service-v1.9-state','team-app-service-v1.8-state','team-app-coach-v1.7-state','team-app-multisport-v1-state','team-app-baseball-v1-state'];
  const SPORTS = window.TEAM_APP_SPORTS || {};
  const CORE = window.TEAM_APP_CORE || {};
  const COMPETITION = window.TEAM_APP_COMPETITION_PROFILES || {registry:{}};
  const FILE_STORE = window.TEAM_APP_FILE_STORE || null;
  const DEVELOPMENT_STAGES = [
    {value:'',label:'Not assessed'},
    {value:'learning',label:'Learning'},
    {value:'developing',label:'Developing'},
    {value:'consistent',label:'Consistent'}
  ];
  function sportKey(t){
    if(t?.sportKey && SPORTS[t.sportKey]) return t.sportKey;
    const name=String(t?.sport||'baseball').toLowerCase();
    return Object.keys(SPORTS).find(k=>SPORTS[k].name.toLowerCase()===name) || 'baseball';
  }
  function sportDef(){return SPORTS[sportKey(team())] || SPORTS.baseball;}
  function sportUnits(sp=sportDef()){return Array.isArray(sp.units)&&sp.units.length?sp.units:[{key:'default',label:'Positions',positions:sp.positions||[]}];}
  function defaultUnitKey(sp=sportDef()){return sp.defaultUnitKey||sportUnits(sp)[0]?.key||'default';}
  function currentUnitKey(){const sp=sportDef();const key=state?.activeUnitKey;return sportUnits(sp).some(u=>u.key===key)?key:defaultUnitKey(sp);}
  function unitDef(key=currentUnitKey()){const sp=sportDef();return sp.unitMap?.[key]||sportUnits(sp).find(u=>u.key===key)||sportUnits(sp)[0];}
  function unitLayouts(key=currentUnitKey()){const unit=unitDef(key);return Array.isArray(unit?.layouts)&&unit.layouts.length?unit.layouts:[];}
  function defaultLayoutKey(key=currentUnitKey()){const unit=unitDef(key);return unit?.defaultLayoutKey||unitLayouts(key)[0]?.key||'standard';}
  function teamDefaultLayoutKey(unitKey=currentUnitKey(),record=team()){const unit=unitDef(unitKey);const key=record?.defaultLayouts?.[unitKey];return unit?.layoutMap?.[key]?key:(unit?.defaultLayoutKey||unit?.layouts?.[0]?.key||'standard');}
  function layoutKeyFromMaps(maps,unitKey,period){const unit=unitDef(unitKey);const key=maps?.[unitKey]?.[period];return unit?.layoutMap?.[key]?key:(unit?.defaultLayoutKey||unit?.layouts?.[0]?.key||'standard');}
  function teamLayoutKey(period=currentPeriod,unitKey=currentUnitKey()){return layoutKeyFromMaps(teamContextFor(state)?.unitLayoutKeys,unitKey,period);}
  function teamLayoutDef(period=currentPeriod,unitKey=currentUnitKey()){const unit=unitDef(unitKey);return unit?.layoutMap?.[teamLayoutKey(period,unitKey)]||unit?.layouts?.[0]||null;}
  function layoutSlots(period=currentPeriod,unitKey=currentUnitKey()){return teamLayoutDef(period,unitKey)?.slots||[];}
  function layoutSlot(slotKey,period=currentPeriod,unitKey=currentUnitKey()){return teamLayoutDef(period,unitKey)?.slotMap?.[slotKey]||null;}
  function gameLayoutKey(g,period=g?.currentPeriod,unitKey=g?.activeUnitKey){return layoutKeyFromMaps(g?.unitLayoutKeys,unitKey||defaultUnitKey(),period);}
  function gameLayoutDef(g,period=g?.currentPeriod,unitKey=g?.activeUnitKey){const unit=unitDef(unitKey||defaultUnitKey());return unit?.layoutMap?.[gameLayoutKey(g,period,unitKey)]||unit?.layouts?.[0]||null;}
  function gameLayoutSlots(g,period=g?.currentPeriod,unitKey=g?.activeUnitKey){return gameLayoutDef(g,period,unitKey)?.slots||[];}
  function slotLabel(slot,withRole=false){if(!slot)return '';const role=positionName(slot.roleCode);return withRole&&slot.key!==slot.roleCode?`${slot.key} · ${role}`:role;}
  function sportPositions(){return (unitDef()?.positions||[]).map(p=>p.code);}
  function positionsForUnit(key){const sp=sportDef();const unit=sp.unitMap?.[key]||sportUnits(sp).find(u=>u.key===key)||sportUnits(sp)[0];return (unit?.positions||[]).map(p=>p.code);}
  function unitLabel(key=currentUnitKey()){return (sportDef().unitMap?.[key]||sportUnits().find(u=>u.key===key))?.label||'Positions';}
  function allSportPositions(){return (sportDef().allPositions||sportDef().positions||[]).map(p=>p.code);}
  function positionDef(code){return unitDef()?.positionMap?.[code] || sportDef().positionMap?.[code] || sportDef().allPositions?.find(p=>p.code===code) || sportDef().positions?.find(p=>p.code===code);}
  function positionName(code){return positionDef(code)?.name || code;}
  function periodSingular(){return sportDef().period?.singular || 'period';}
  function periodPlural(){return sportDef().period?.plural || 'periods';}
  function sportLessons(){return sportDef().lessons || {};}
  function sportDrills(){return sportDef().drills || [];}
  function developmentSkills(){return (sportDef().developmentSkills||[]).map(([key,label])=>({key,label}));}
  function sportCapability(name){return Boolean(sportDef().capabilities?.[name]);}
  function isPositionGroup(pos,group){return positionDef(pos)?.group===group;}
  function sportPositionOptions(){
    const codes=[...new Set(allSportPositions())]; const aliases=Object.keys(sportDef().positionAliases||{});
    return [...codes,...aliases.filter(x=>!codes.includes(x))];
  }
  function expandListedPosition(code,set){
    (sportDef().positionAliases?.[code]||[]).forEach(x=>set.add(x));
  }
  function periodLabel(n){return `${periodSingular().replace(/^./,c=>c.toUpperCase())} ${n}`;}
  function sportPracticeTemplate(){return (sportDef().practiceTemplate||[]).map((x,i)=>({id:`tpl${i+1}`,title:x[0],minutes:Number(x[1]),category:x[2]}));}
  function competitionSport(key=sportKey(team())){return COMPETITION.registry?.[key]||{leagues:[],leagueMap:{},profileMap:{}};}
  function competitionLeague(record=team()){const cfg=competitionSport(sportKey(record));return cfg.leagueMap?.[record.leagueKey]||cfg.leagues?.[0]||null;}
  function competitionProfile(record=team()){const cfg=competitionSport(sportKey(record));return cfg.profileMap?.[record.competitionProfileId]||null;}
  function validTimeZone(value){try{new Intl.DateTimeFormat('en-US',{timeZone:String(value)}).format(new Date());return true;}catch{return false;}}
  function normalizeLocation(raw){const x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const lat=x.lat==null||x.lat===''?null:Number(x.lat),lon=x.lon==null||x.lon===''?null:Number(x.lon);const fallbackTz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch{return 'UTC';}})();const requested=String(x.timezone||fallbackTz);return {name:String(x.name||''),address:String(x.address||''),city:String(x.city||''),state:String(x.state||''),zip:String(x.zip||''),lat:Number.isFinite(lat)&&lat>=-90&&lat<=90?lat:null,lon:Number.isFinite(lon)&&lon>=-180&&lon<=180?lon:null,timezone:validTimeZone(requested)?requested:fallbackTz};}
  function normalizeBranding(raw){const x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const logo=String(x.logoDataUrl||'');const safeLogo=/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(logo)&&logo.length<=2_000_000?logo:'';return {primaryColor:/^#[0-9a-f]{6}$/i.test(String(x.primaryColor||''))?String(x.primaryColor):'#0f4c3a',secondaryColor:/^#[0-9a-f]{6}$/i.test(String(x.secondaryColor||''))?String(x.secondaryColor):'#f2c94c',logoDataUrl:safeLogo};}
  function normalizeRuleDetails(raw){const x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return {format:String(x.format||''),duration:String(x.duration||''),participation:String(x.participation||''),scoring:String(x.scoring||''),safety:String(x.safety||'')};}
  function normalizeStaff(raw){return (Array.isArray(raw)?raw:[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map((x,i)=>({id:String(x.id||`staff-${i+1}`),name:String(x.name||'').trim(),role:String(x.role||'Assistant Coach').trim(),email:String(x.email||'').trim(),phone:String(x.phone||'').trim()})).filter(x=>x.name);}
  function teamSetupScore(record=team()){const checks=[record.name,record.season,record.ageGroup||record.division,record.leagueName||record.leagueKey,record.homeLocation?.name||record.homeLocation?.city,record.branding?.logoDataUrl,(record.staff||[]).length];return Math.round(checks.filter(Boolean).length/checks.length*100);}
  function teamRuleLabel(record=team()){const p=competitionProfile(record);return p?.label||record.division||record.ageGroup||record.ruleSet||'Custom rules';}
  function teamLocationLabel(record=team()){const l=record.homeLocation||{};return [l.name,[l.city,l.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')||'Home location not set';}

  const demoPlayers = [
    ['Ethan','Carter','12','SS','2B, CF','R','R'],
    ['Liam','Brooks','7','2B','SS, OF','R','R'],
    ['Mason','Reed','18','1B','3B, P','L','L'],
    ['Noah','Grant','4','CF','SS, LF','R','R'],
    ['Caleb','Hayes','22','C','1B','R','R'],
    ['Owen','Parker','9','3B','P, 1B','R','R'],
    ['Lucas','Ward','3','LF','CF, RF','R','L'],
    ['Jack','Turner','16','RF','LF, 2B','L','R'],
    ['Henry','Scott','5','P','3B, SS','R','R'],
    ['Eli','Bennett','11','2B','OF','R','R'],
    ['Ryan','Cooper','14','OF','1B','R','R'],
    ['Cole','Foster','2','OF','2B','R','L']
  ].map((p,i)=>({id:`p${i+1}`,first:p[0],last:p[1],number:p[2],primary:p[3],secondary:p[4],throws:p[5],bats:p[6],status:'active',attendance:'yes',notes:''}));

  const TEAM_CONTEXT_FIELDS=['players','periodCount','activeUnitKey','unitAssignments','unitLayoutKeys','sequenceOrder','lineupPresets','playerDevelopment','practices','events','weatherCache','gameSessions','activeGameEventId','documents'];
  function sportByKey(key){return SPORTS[key]||SPORTS.baseball;}
  function buildTeamContext(key,{demo=false,defaultLayouts={}}={}){
    const sp=sportByKey(key);const players=demo&&key==='baseball'?demoPlayers.map(p=>({...p})):[];const periodCount=sp.defaultPeriods||1;
    const units=Array.isArray(sp.units)&&sp.units.length?sp.units:[{key:'default',label:'Positions',positions:sp.positions||[]}];const activeUnitKey=sp.defaultUnitKey||units[0].key;
    const unitAssignments={},unitLayoutKeys={};units.forEach(unit=>{unitAssignments[unit.key]={};unitLayoutKeys[unit.key]={};const defaultLayout=unit.layoutMap?.[unit.defaultLayoutKey]||unit.layouts?.[0];const seededCodes=(defaultLayout?.slots||[]).map(slot=>slot.key);const seeded=demo&&players.length&&unit.key===activeUnitKey?baseAssignments(players,seededCodes):{};for(let i=1;i<=periodCount;i++){unitAssignments[unit.key][i]=demo&&unit.key===activeUnitKey?{...seeded}:{};unitLayoutKeys[unit.key][i]=unit.layoutMap?.[defaultLayouts?.[unit.key]]?defaultLayouts[unit.key]:(unit.defaultLayoutKey||unit.layouts?.[0]?.key||'standard');}});
    return {
      players,periodCount,activeUnitKey,unitAssignments,unitLayoutKeys,sequenceOrder:players.map(p=>p.id),lineupPresets:[],playerDevelopment:{},
      practices:(sp.practiceTemplate||[]).map((x,i)=>({id:`pr${i+1}`,title:x[0],minutes:Number(x[1]),category:x[2]})),
      events:demo&&key==='baseball'?[{id:'e1',type:'Practice',title:'First Practice',date:localDateValue(),start:'18:00',end:'19:30',venue:'Main Baseball Field',outdoor:true,lat:null,lon:null,notes:'Arrive 15 minutes early.'}]:[],
      weatherCache:{},gameSessions:{},activeGameEventId:null,documents:[]
    };
  }

  function normalizeGameSession(g,context,sp){
    if(!g||typeof g!=='object')return null;const units=sportUnits(sp);const defaultKey=sp.defaultUnitKey||units[0]?.key||'default';
    g.currentPeriod=Math.max(1,Number(g.currentPeriod ?? g.currentInning)||1);delete g.currentInning;
    g.activeUnitKey=units.some(u=>u.key===g.activeUnitKey)?g.activeUnitKey:defaultKey;
    const legacyAssignments=g.assignments&&typeof g.assignments==='object'?g.assignments:null;
    g.unitAssignments=g.unitAssignments&&typeof g.unitAssignments==='object'&&!Array.isArray(g.unitAssignments)?g.unitAssignments:{};if(legacyAssignments&&!g.unitAssignments[g.activeUnitKey])g.unitAssignments[g.activeUnitKey]=legacyAssignments;delete g.assignments;
    g.unitLayoutKeys=g.unitLayoutKeys&&typeof g.unitLayoutKeys==='object'&&!Array.isArray(g.unitLayoutKeys)?g.unitLayoutKeys:{};
    units.forEach(unit=>{g.unitAssignments[unit.key]=g.unitAssignments[unit.key]&&typeof g.unitAssignments[unit.key]==='object'?g.unitAssignments[unit.key]:{};g.unitLayoutKeys[unit.key]=g.unitLayoutKeys[unit.key]&&typeof g.unitLayoutKeys[unit.key]==='object'?g.unitLayoutKeys[unit.key]:{};for(let i=1;i<=context.periodCount;i++){g.unitAssignments[unit.key][i]=g.unitAssignments[unit.key][i]&&typeof g.unitAssignments[unit.key][i]==='object'&&!Array.isArray(g.unitAssignments[unit.key][i])?g.unitAssignments[unit.key][i]:{};const lk=g.unitLayoutKeys[unit.key][i];g.unitLayoutKeys[unit.key][i]=unit.layoutMap?.[lk]?lk:(unit.defaultLayoutKey||unit.layouts?.[0]?.key||'standard');}});
    g.sequenceOrder=Array.isArray(g.sequenceOrder)?g.sequenceOrder:Array.isArray(g.battingOrder)?g.battingOrder:[...context.sequenceOrder];delete g.battingOrder;
    g.sequenceIndex=Math.max(0,Number(g.sequenceIndex ?? g.battingIndex)||0);delete g.battingIndex;
    g.pitchesByPeriod=g.pitchesByPeriod&&typeof g.pitchesByPeriod==='object'?g.pitchesByPeriod:(g.pitchByInning&&typeof g.pitchByInning==='object'?g.pitchByInning:{});delete g.pitchByInning;
    g.pitchCounts=g.pitchCounts&&typeof g.pitchCounts==='object'?g.pitchCounts:{};g.periodScores=g.periodScores&&typeof g.periodScores==='object'?g.periodScores:{};g.attendance=g.attendance&&typeof g.attendance==='object'?g.attendance:{};g.undo=Array.isArray(g.undo)?g.undo:[];
    g.substitutions=Array.isArray(g.substitutions)?g.substitutions.map(x=>({...x,period:Number(x.period ?? x.inning)||1,unitKey:x.unitKey||defaultKey})):[];g.substitutions.forEach(x=>delete x.inning);
    return g;
  }
  function normalizeTeamContext(raw,teamRecord){
    const sp=sportByKey(sportKey(teamRecord));const base=buildTeamContext(sp.key,{defaultLayouts:teamRecord?.defaultLayouts||{}});const units=sportUnits(sp);const c=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const seenPlayerIds=new Set();c.players=(Array.isArray(c.players)?c.players:[]).filter(p=>p&&typeof p==='object'&&!Array.isArray(p)).map((p,i)=>{let id=String(p.id||`player-${i+1}`);while(seenPlayerIds.has(id))id=`${id}-${i+1}`;seenPlayerIds.add(id);return {...p,id,first:String(p.first||''),last:String(p.last||''),number:String(p.number||''),primary:String(p.primary||''),secondary:String(p.secondary||''),leagueAge:Number.isFinite(Number(p.leagueAge))?Math.max(0,Math.min(99,Number(p.leagueAge))):null,status:p.status==='inactive'?'inactive':'active',attendance:['yes','no','maybe','unknown'].includes(p.attendance)?p.attendance:'unknown',notes:String(p.notes||'')};});const legacyPeriodCount=c.periodCount ?? c.innings;c.periodCount=Math.max(1,Math.min(40,Number(legacyPeriodCount)||sp.defaultPeriods||1));delete c.innings;
    const defaultKey=sp.defaultUnitKey||units[0]?.key||'default';c.activeUnitKey=units.some(u=>u.key===c.activeUnitKey)?c.activeUnitKey:defaultKey;
    const legacyAssignments=c.assignments&&typeof c.assignments==='object'?c.assignments:null;c.unitAssignments=c.unitAssignments&&typeof c.unitAssignments==='object'&&!Array.isArray(c.unitAssignments)?c.unitAssignments:{};if(legacyAssignments&&!c.unitAssignments[c.activeUnitKey])c.unitAssignments[c.activeUnitKey]=legacyAssignments;delete c.assignments;
    c.unitLayoutKeys=c.unitLayoutKeys&&typeof c.unitLayoutKeys==='object'&&!Array.isArray(c.unitLayoutKeys)?c.unitLayoutKeys:{};
    units.forEach(unit=>{c.unitAssignments[unit.key]=c.unitAssignments[unit.key]&&typeof c.unitAssignments[unit.key]==='object'?c.unitAssignments[unit.key]:{};c.unitLayoutKeys[unit.key]=c.unitLayoutKeys[unit.key]&&typeof c.unitLayoutKeys[unit.key]==='object'?c.unitLayoutKeys[unit.key]:{};for(let i=1;i<=c.periodCount;i++){c.unitAssignments[unit.key][i]=c.unitAssignments[unit.key][i]&&typeof c.unitAssignments[unit.key][i]==='object'&&!Array.isArray(c.unitAssignments[unit.key][i])?c.unitAssignments[unit.key][i]:{};const lk=c.unitLayoutKeys[unit.key][i];c.unitLayoutKeys[unit.key][i]=unit.layoutMap?.[lk]?lk:(unit.layoutMap?.[teamRecord?.defaultLayouts?.[unit.key]]?teamRecord.defaultLayouts[unit.key]:(unit.defaultLayoutKey||unit.layouts?.[0]?.key||'standard'));}});
    const legacySequence=Array.isArray(c.sequenceOrder)?c.sequenceOrder:Array.isArray(c.battingOrder)?c.battingOrder:[];c.sequenceOrder=legacySequence.filter(id=>c.players.some(p=>p.id===id));c.players.forEach(p=>{if(!c.sequenceOrder.includes(p.id))c.sequenceOrder.push(p.id);});delete c.battingOrder;
    c.lineupPresets=Array.isArray(c.lineupPresets)?c.lineupPresets:Array.isArray(c.defensivePresets)?c.defensivePresets:[];delete c.defensivePresets;c.lineupPresets=c.lineupPresets.filter(pr=>pr&&typeof pr==='object'&&!Array.isArray(pr)).map(pr=>{const unitKey=units.some(u=>u.key===(pr.unitKey||defaultKey))?(pr.unitKey||defaultKey):defaultKey;const unit=sp.unitMap?.[unitKey]||units.find(u=>u.key===unitKey);const layoutKey=unit?.layoutMap?.[pr.layoutKey]?pr.layoutKey:(unit?.defaultLayoutKey||unit?.layouts?.[0]?.key||'standard');return {...pr,unitKey,layoutKey};});
    c.playerDevelopment=c.playerDevelopment&&typeof c.playerDevelopment==='object'&&!Array.isArray(c.playerDevelopment)?c.playerDevelopment:{};
    c.practices=(Array.isArray(c.practices)?c.practices:base.practices).filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map((x,i)=>({...x,id:String(x.id||`practice-${i+1}`),title:String(x.title||'Practice activity'),minutes:Math.max(1,Number(x.minutes)||10),category:String(x.category||'Team')}));
    c.events=(Array.isArray(c.events)?c.events:[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map((x,i)=>({...x,id:String(x.id||`event-${i+1}`),title:String(x.title||'Event'),type:String(x.type||'Practice')}));c.weatherCache=c.weatherCache&&typeof c.weatherCache==='object'&&!Array.isArray(c.weatherCache)?c.weatherCache:{};
    c.gameSessions=c.gameSessions&&typeof c.gameSessions==='object'?c.gameSessions:{};Object.keys(c.gameSessions).forEach(k=>{const g=normalizeGameSession(c.gameSessions[k],c,sp);if(!g)delete c.gameSessions[k];});c.activeGameEventId=c.events.some(e=>e.id===c.activeGameEventId)?c.activeGameEventId:null;c.documents=(Array.isArray(c.documents)?c.documents:[]).filter(d=>d&&typeof d==='object'&&!Array.isArray(d)).map((d,i)=>({id:String(d.id||`doc-${i+1}`),name:String(d.name||'Team document'),type:String(d.type||'application/octet-stream'),size:Math.max(0,Number(d.size)||0),category:String(d.category||'General'),visibility:['coaches','team','guardians'].includes(d.visibility)?d.visibility:'team',uploadedAt:String(d.uploadedAt||new Date().toISOString()),description:String(d.description||''),cloud:Boolean(d.cloud)}));return c;
  }

  function teamContextFor(container,teamId=container.currentTeamId){
    const t=(container.teams||[]).find(x=>x.id===teamId)||(container.teams||[])[0];if(!t)return null;
    container.teamContexts=container.teamContexts&&typeof container.teamContexts==='object'?container.teamContexts:{};
    if(!container.teamContexts[t.id])container.teamContexts[t.id]=buildTeamContext(sportKey(t),{defaultLayouts:t.defaultLayouts||{}});
    return container.teamContexts[t.id];
  }
  function attachContextAccessors(container){
    TEAM_CONTEXT_FIELDS.forEach(field=>Object.defineProperty(container,field,{configurable:true,enumerable:false,get(){return teamContextFor(container)?.[field];},set(value){const c=teamContextFor(container);if(c)c[field]=value;}}));
    Object.defineProperty(container,'assignments',{configurable:true,enumerable:false,get(){const c=teamContextFor(container);if(!c)return {};const key=c.activeUnitKey||defaultUnitKey();c.unitAssignments[key]=c.unitAssignments[key]||{};return c.unitAssignments[key];},set(value){const c=teamContextFor(container);if(!c)return;const key=c.activeUnitKey||defaultUnitKey();c.unitAssignments[key]=value;}});
    return container;
  }

  function baseAssignments(players,positions=(SPORTS.baseball?.positions||[]).map(p=>p.code)){
    const a = {};
    positions.forEach((pos,i)=> a[pos] = players[i]?.id || null);
    return a;
  }
  const initial = baseAssignments(demoPlayers);

  function defaultState(){
    const teamRecord={id:'team1',name:'My Baseball Team',shortName:'',sport:'Baseball',sportKey:'baseball',season:`${new Date().getFullYear()} Season`,ageGroup:'',division:'',leagueKey:'recreation',leagueName:'Local Recreation League',governingBody:'Local league',competitionProfileId:'',ruleSet:'Custom / Recreation',ruleSourceUrl:'',ruleSourceNote:'',localRulesNote:'',localRuleDetails:normalizeRuleDetails({}),homeLocation:normalizeLocation({}),branding:normalizeBranding({}),staff:[],defaultLayouts:{default:'standard'},color:'#0f4c3a'};
    return {version:8,currentTeamId:'team1',teams:[teamRecord],teamContexts:{team1:buildTeamContext('baseball',{demo:true})},settings:{notifications:true,weatherAlerts:true,showDemoNotice:true}};
  }


  let state = attachContextAccessors(loadState());
  let currentView = (location.hash || '#home').slice(1);
  let selectedPlayerId = null;
  let currentPeriod = 1;
  let draggedPlayerId = null;
  let modal = null;
  let toastTimer = null;
  let balanceProposal = null;

  const memoryStorage=new Map();
  function storageGet(key){try{return window.localStorage.getItem(key);}catch(_e){return memoryStorage.has(key)?memoryStorage.get(key):null;}}
  function storageSet(key,value){try{window.localStorage.setItem(key,value);return true;}catch(_e){memoryStorage.set(key,String(value));return false;}}
  function storageRemove(key){try{window.localStorage.removeItem(key);}catch(_e){memoryStorage.delete(key);}}
  function normalizeState(parsed){
    const fallback=defaultState();if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return fallback;parsed.version=8;
    const rawTeams=Array.isArray(parsed.teams)&&parsed.teams.length?parsed.teams:fallback.teams;const usedTeamIds=new Set();
    parsed.teams=rawTeams.filter(t=>t==null||typeof t==='object').map((t,i)=>{const source=t&&typeof t==='object'?t:{};let id=String(source.id||`team-${i+1}`);while(usedTeamIds.has(id))id=`${id}-${i+1}`;usedTeamIds.add(id);const key=sportKey(source);const sp=sportByKey(key);const defaultLayouts={};sp.units.forEach(u=>{const lk=source.defaultLayouts?.[u.key];defaultLayouts[u.key]=u.layoutMap?.[lk]?lk:(u.defaultLayoutKey||u.layouts?.[0]?.key||'standard');});const cfg=competitionSport(key);const league=cfg.leagueMap?.[source.leagueKey]||cfg.leagues?.[0]||null;const profile=cfg.profileMap?.[source.competitionProfileId]||null;return {...source,id,name:String(source.name||`${sp.name} Team`),shortName:String(source.shortName||''),sport:sp.name,sportKey:key,season:String(source.season||'Season'),ageGroup:String(source.ageGroup||profile?.ageLabel||''),division:String(source.division||profile?.division||''),leagueKey:String(source.leagueKey||league?.key||'recreation'),leagueName:String(source.leagueName||league?.name||'Local Recreation League'),governingBody:String(source.governingBody||profile?.governingBody||league?.governingBody||'Local league'),competitionProfileId:String(source.competitionProfileId||''),ruleSet:String(source.ruleSet||profile?.label||sp.ruleSets?.[0]||'Custom / Recreation'),ruleSourceUrl:String(source.ruleSourceUrl||profile?.sourceUrl||league?.sourceUrl||''),ruleSourceNote:String(source.ruleSourceNote||profile?.sourceNote||''),localRulesNote:String(source.localRulesNote||''),localRuleDetails:normalizeRuleDetails(source.localRuleDetails),homeLocation:normalizeLocation(source.homeLocation),branding:normalizeBranding(source.branding||{primaryColor:source.color}),staff:normalizeStaff(source.staff),defaultLayouts,color:normalizeBranding(source.branding||{primaryColor:source.color}).primaryColor};});
    if(!parsed.teams.length)parsed.teams=fallback.teams;if(!parsed.teams.some(t=>t.id===parsed.currentTeamId))parsed.currentTeamId=parsed.teams[0].id;
    const existingContexts=parsed.teamContexts&&typeof parsed.teamContexts==='object'?parsed.teamContexts:{};
    // V1–V3 stored one active team's data at the root. Move that payload into its team context once.
    const hasLegacyRoot=TEAM_CONTEXT_FIELDS.some(field=>Object.prototype.hasOwnProperty.call(parsed,field));
    if(hasLegacyRoot){
      const legacy={};TEAM_CONTEXT_FIELDS.forEach(field=>{if(Object.prototype.hasOwnProperty.call(parsed,field)){legacy[field]=parsed[field];delete parsed[field];}});
      // Older builds used baseball-specific names before the generic V3 migration.
      if(Object.prototype.hasOwnProperty.call(parsed,'assignments')){legacy.assignments=parsed.assignments;delete parsed.assignments;}
      if(Object.prototype.hasOwnProperty.call(parsed,'innings')){legacy.innings=parsed.innings;delete parsed.innings;}
      if(Object.prototype.hasOwnProperty.call(parsed,'battingOrder')){legacy.battingOrder=parsed.battingOrder;delete parsed.battingOrder;}
      if(Object.prototype.hasOwnProperty.call(parsed,'defensivePresets')){legacy.defensivePresets=parsed.defensivePresets;delete parsed.defensivePresets;}
      existingContexts[parsed.currentTeamId]={...(existingContexts[parsed.currentTeamId]||{}),...legacy};
    }
    parsed.teamContexts={};
    parsed.teams.forEach(t=>{parsed.teamContexts[t.id]=normalizeTeamContext(existingContexts[t.id],t);});
    parsed.settings={...fallback.settings,...(parsed.settings&&typeof parsed.settings==='object'&&!Array.isArray(parsed.settings)?parsed.settings:{})};
    return parsed;
  }

  function sportDefFromState(candidate){
    const t=(candidate.teams||[]).find(x=>x.id===candidate.currentTeamId)||(candidate.teams||[])[0];return SPORTS[sportKey(t)]||SPORTS.baseball;
  }
  function loadState(){
    try{
      let raw=storageGet(STORAGE_KEY); let migratedFromLegacy=false;
      if(!raw){for(const key of LEGACY_STORAGE_KEYS){raw=storageGet(key);if(raw){migratedFromLegacy=true;break;}}}
      const parsed = raw ? JSON.parse(raw) : null;
      if(parsed && [1,2,3,4,5,6,7,8].includes(parsed.version)){
        const normalized=normalizeState(parsed);
        if(migratedFromLegacy) queueMicrotask(()=>{try{storageSet(STORAGE_KEY,JSON.stringify(normalized));}catch(_e){}});
        return normalized;
      }
    }catch(_e){}
    return defaultState();
  }
  function save(){const ok=storageSet(STORAGE_KEY,JSON.stringify(state));if(!ok)console.warn('Team APP is using temporary in-memory storage for this session.');window.TeamAppCloud?.scheduleSync?.();}
  function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
  function safeHttpsUrl(v=''){try{const u=new URL(String(v));return u.protocol==='https:'?u.href:'';}catch{return '';}}
  function uid(prefix){let token=globalThis.crypto?.randomUUID?.().replace(/-/g,'');if(!token&&globalThis.crypto?.getRandomValues){const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}if(!token)throw new Error('Secure random number generation is unavailable on this device.');return `${prefix}${token}`;}
  function team(){return state.teams.find(t=>t.id===state.currentTeamId) || state.teams[0];}
  function coachUI(){return !window.TeamAppCloud?.session || window.TeamAppCloud?.canCoach?.()!==false;}
  function cloudRole(){return window.TeamAppCloud?.roleForActiveTeam?.()||null;}
  function activePlayers(){return state.players.filter(p=>p.status==='active');}
  function player(id){return state.players.find(p=>p.id===id);}
  function initials(p){return `${p.first?.[0]||''}${p.last?.[0]||''}`.toUpperCase();}
  function fullName(p){return `${p.first} ${p.last}`.trim();}
  function minutesTotal(){return state.practices.reduce((s,p)=>s+Number(p.minutes||0),0);}
  function developmentProfile(playerId){
    if(!state.playerDevelopment[playerId])state.playerDevelopment[playerId]={skills:{},goals:[],notes:''};
    const d=state.playerDevelopment[playerId];d.skills=d.skills||{};d.goals=d.goals||[];d.notes=d.notes||'';return d;
  }
  function recommendedDrillsFor(playerId){
    const d=developmentProfile(playerId);const ids=[];
    const map=sportDef().skillDrillMap||{};developmentSkills().forEach(sk=>{if(['learning','developing'].includes(d.skills?.[sk.key]||''))ids.push(...(map[sk.key]||[]));});
    return [...new Set(ids)].map(id=>sportDrills().find(x=>x.id===id)).filter(Boolean);
  }
  function listedPositions(p){
    const raw=[p.primary,...String(p.secondary||'').split(',')].map(x=>String(x||'').trim().toUpperCase()).filter(Boolean);
    const set=new Set(raw);raw.forEach(code=>expandListedPosition(code,set));return set;
  }
  function positionCountBefore(playerId,pos,beforePeriod){let n=0;for(let i=1;i<beforePeriod;i++){if(positionForPlayer(i,playerId)===pos)n++;}return n;}
  function prettyDate(date){
    if(!date) return '';
    const d = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(d);
  }
  function prettyTime(time){
    if(!time) return '';
    const [h,m]=time.split(':').map(Number); const d=new Date(); d.setHours(h,m,0,0);
    return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(d);
  }
  function showToast(message){
    document.querySelector('.toast')?.remove();
    const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),2200);
  }

  function icon(name){
    const icons={home:'⌂',roster:'◉',lineup:'◇',gameday:'◆',practice:'▤',schedule:'▣',learn:'◎',bell:'◌',settings:'⚙'};
    return icons[name]||'•';
  }

  function render(){
    if(!['home','coach','roster','lineup','gameday','practice','schedule','learn'].includes(currentView)) currentView='home';
    if(!coachUI()&&['coach','lineup','gameday','practice'].includes(currentView))currentView='home';
    const root=document.getElementById('app');
    root.innerHTML=`
      <div class="app-shell">
        ${renderTopbar()}
        <main class="main">${renderView()}</main>
        ${renderBottomNav()}
      </div>
      ${modal ? renderModal() : ''}
    `;
    bindCommon();
    bindView();
    if(modal) bindModal();
  }

  function renderTopbar(){
    const t=team();
    const logo=t.branding?.logoDataUrl;const primary=t.branding?.primaryColor||'#0f4c3a';
    return `<header class="topbar" style="--team-primary:${esc(primary)}"><div class="topbar-inner">
      <div class="brand-mark team-brand-mark" aria-label="Team APP">${logo?`<img src="${esc(logo)}" alt="${esc(t.name)} icon">`:'TA'}</div>
      <div class="team-switcher">
        <button id="teamSwitcher" aria-label="Switch or manage teams">
          <div class="eyebrow">${esc(sportDef().emoji)} ${esc(sportDef().name)} · ${esc(t.season)}</div>
          <div class="team-name">${esc(t.name)} ▾</div>
        </button>
      </div>
      <button class="icon-btn cloud-account-btn" id="cloudAccountBtn" aria-label="Account & cloud sync">☁</button>
      ${coachUI()?`<button class="icon-btn game-day-top-btn" id="gameDayBtn" aria-label="Open Game Day">${icon('gameday')}</button>`:''}
      <button class="icon-btn" id="notificationsBtn" aria-label="Notifications">${icon('bell')}<span class="badge-dot"></span></button>
      ${coachUI()?`<button class="icon-btn" id="settingsBtn" aria-label="Coach center">${icon('settings')}</button>`:''}
    </div></header>`;
  }

  function renderBottomNav(){
    const items=coachUI()?[['home','Home'],['roster','Roster'],['lineup','Lineup'],['practice','Practice'],['schedule','Schedule'],['learn','Learn']]:[['home','Home'],['roster','Roster'],['schedule','Schedule'],['learn','Learn']];
    return `<nav class="bottom-nav" aria-label="Primary navigation"><div class="bottom-nav-inner">
      ${items.map(([k,label])=>`<button class="nav-btn ${currentView===k?'active':''}" data-nav="${k}" aria-current="${currentView===k?'page':'false'}"><span class="nav-icon">${icon(k)}</span><span>${label}</span></button>`).join('')}
    </div></nav>`;
  }

  function renderView(){
    return ({home:renderHome,coach:renderCoachCenter,roster:renderRoster,lineup:renderLineup,gameday:renderGameDay,practice:renderPractice,schedule:renderSchedule,learn:renderLearn})[currentView]();
  }

  function renderHome(){
    const today=new Date();today.setHours(0,0,0,0);
    const ordered=[...state.events].sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    const next=ordered.find(e=>new Date(`${e.date}T23:59:59`)>=today) || ordered.at(-1);
    const attending=activePlayers().filter(p=>p.attendance==='yes').length;
    const sp=sportDef();
    return `<div class="page-head"><div><div class="eyebrow">${coachUI()?'Coach dashboard':'Team dashboard'}</div><h1>${esc(sp.name)} ${coachUI()?'command center':'team home'}</h1><p>${coachUI()?'Roster, lineup, practice and game-day planning in one shared Team APP workflow.':'Schedule, roster, team communication, forms, documents and learning in one place.'}</p></div></div>
      ${state.settings.showDemoNotice?`<div class="notice" style="margin-bottom:14px"><strong>Demo roster loaded.</strong> Replace these fictional players with your real roster from the Roster tab. <button id="dismissDemo" class="secondary-btn small-btn" style="margin-left:6px">Dismiss</button></div>`:''}
      <div class="dashboard-layout">
        <div class="grid">
          <section class="card hero">
            <div class="eyebrow muted-on-dark">${esc(team().season)}</div>
            <h2 style="font-size:26px;margin:4px 0 6px">${esc(sp.emoji)} ${esc(team().name)}</h2>
            <div class="muted-on-dark">${esc(teamRuleLabel(team()))}${team().leagueName?` · ${esc(team().leagueName)}`:''}</div>
            <div class="kpis">
              <div class="kpi"><strong>${activePlayers().length}</strong><span>Active players</span></div>
              <div class="kpi"><strong>${attending}</strong><span>Available</span></div>
              <div class="kpi"><strong>${state.periodCount}</strong><span>Planned ${esc(periodPlural())}</span></div>
            </div>
          </section>
          <div class="action-row" aria-label="Quick actions">${coachUI()?`
            <button class="quick-action" data-go="coach">⚙ Team setup</button>
            <button class="quick-action" data-go="roster">＋ Add player</button>
            <button class="quick-action" data-go="lineup">◇ Build lineup</button>
            <button class="quick-action game-day-action" data-go="gameday">◆ Game Day</button>
            <button class="quick-action" data-go="practice">▤ Plan practice</button>
            <button class="quick-action" data-go="schedule">＋ Add event</button>`:`
            <button class="quick-action" data-go="schedule">▣ View schedule</button>
            <button class="quick-action" data-go="roster">◎ Team roster</button>
            <button class="quick-action" data-go="learn">◇ Learn ${esc(sp.name)}</button>`}</div>
          ${next?renderEventCard(next,true):''}
        </div>
        <div class="grid">
          <section class="card"><div class="card-title-row"><div><h3>Roster snapshot</h3><div class="card-sub">Availability for your next session</div></div><button class="secondary-btn small-btn" data-go="roster">View all</button></div>
            <div class="roster-list">${activePlayers().slice(0,6).map(p=>renderPlayerRow(p,true)).join('')}</div>
          </section>
          ${coachUI()?`<section class="card"><div class="card-title-row"><div><h3>Practice plan</h3><div class="card-sub">${minutesTotal()} minutes · ${state.practices.length} activities</div></div><button class="secondary-btn small-btn" data-go="practice">Edit</button></div>
            <div class="timeline">${state.practices.slice(0,4).map(a=>`<div class="timeline-item"><div class="timeline-time">${a.minutes}m</div><div><div class="timeline-name">${esc(a.title)}</div><div class="timeline-meta">${esc(a.category)}</div></div><span>›</span></div>`).join('')}</div>
          </section>`:''}
        </div>
      </div>${window.TeamAppCloud?.renderCoachPanel?.()||''}`;
  }

  function formatBytes(n){const x=Number(n)||0;if(x<1024)return `${x} B`;if(x<1024*1024)return `${(x/1024).toFixed(x<10240?1:0)} KB`;return `${(x/1024/1024).toFixed(1)} MB`;}
  function renderCoachCenter(){
    const t=team(),score=teamSetupScore(t),profile=competitionProfile(t),league=competitionLeague(t),loc=t.homeLocation||{},brand=t.branding||normalizeBranding({}),docs=state.documents||[],staff=t.staff||[];
    const ruleUrl=safeHttpsUrl(t.ruleSourceUrl||profile?.sourceUrl||league?.sourceUrl||'');
    const setupItems=[['Team identity',Boolean(t.name&&t.season)],['Age / division',Boolean(t.ageGroup||t.division||profile)],['League / rules',Boolean(t.leagueName||t.leagueKey)],['Home location',Boolean(loc.name||loc.city)],['Team branding',Boolean(brand.logoDataUrl)],['Coaching staff',staff.length>0],['Shared documents',docs.length>0]];
    return `<div class="page-head"><div><div class="eyebrow">Coach center</div><h1>Run ${esc(t.name)}</h1><p>Team identity, competition rules, staff, branding, location and documents in one place.</p></div><button class="primary-btn" id="editTeamSetupBtn">Edit team setup</button></div>
      <section class="card coach-readiness" style="--team-primary:${esc(brand.primaryColor)};--team-secondary:${esc(brand.secondaryColor)}"><div class="coach-brand-preview">${brand.logoDataUrl?`<img src="${esc(brand.logoDataUrl)}" alt="${esc(t.name)} logo">`:`<div class="coach-logo-placeholder">${esc(sportDef().emoji)}</div>`}<div><div class="eyebrow">Setup readiness</div><h2>${esc(t.name)}</h2><p>${esc(sportDef().name)} · ${esc(t.season)} · ${esc(teamRuleLabel(t))}</p></div><strong class="setup-score">${score}%</strong></div><div class="setup-progress"><span style="width:${score}%"></span></div><div class="setup-checks">${setupItems.map(([label,ok])=>`<span class="${ok?'ready':'pending'}">${ok?'✓':'○'} ${esc(label)}</span>`).join('')}</div></section>
      <div class="coach-center-grid">
        <section class="card"><div class="card-title-row"><div><h3>Identity & branding</h3><div class="card-sub">What families and players see.</div></div><button class="secondary-btn small-btn" id="uploadLogoBtn">${brand.logoDataUrl?'Replace icon':'Upload icon'}</button></div><input id="teamLogoInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><div class="identity-preview"><div class="identity-icon" style="background:${esc(brand.primaryColor)}">${brand.logoDataUrl?`<img src="${esc(brand.logoDataUrl)}" alt="">`:esc(sportDef().emoji)}</div><div><strong>${esc(t.name)}</strong><span>${esc(t.shortName||'No short name')} · ${esc(t.season)}</span></div></div><div class="brand-swatches"><span style="background:${esc(brand.primaryColor)}"></span><span style="background:${esc(brand.secondaryColor)}"></span><small>Team colors</small></div></section>
        <section class="card"><div class="card-title-row"><div><h3>League & competition</h3><div class="card-sub">Age-specific rule context.</div></div><button class="secondary-btn small-btn" id="editRulesBtn">Edit</button></div><div class="detail-stack"><div><span>League</span><strong>${esc(t.leagueName||league?.name||'Not selected')}</strong></div><div><span>Division / age</span><strong>${esc(teamRuleLabel(t))}</strong></div><div><span>Governing body</span><strong>${esc(t.governingBody||profile?.governingBody||'Local league')}</strong></div><div><span>Rule season/version</span><strong>${esc(String(profile?.seasonYear||'Local / custom'))}</strong></div></div>${ruleUrl?`<a class="source-link" href="${esc(ruleUrl)}" target="_blank" rel="noopener">Open official rule source ↗</a>`:`<div class="notice compact"><strong>No official source attached.</strong> Upload the league rulebook below or add its official link in Team Setup.</div>`}${t.localRulesNote?`<div class="local-rule-note"><strong>Local rules / overrides</strong><p>${esc(t.localRulesNote)}</p></div>`:''}${Object.values(t.localRuleDetails||{}).some(Boolean)?`<div class="rule-detail-grid">${[['Format',t.localRuleDetails?.format],['Time',t.localRuleDetails?.duration],['Participation',t.localRuleDetails?.participation],['Scoring',t.localRuleDetails?.scoring],['Safety',t.localRuleDetails?.safety]].filter(x=>x[1]).map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`:''}</section>
        <section class="card"><div class="card-title-row"><div><h3>Home location</h3><div class="card-sub">Used for venue defaults and weather.</div></div><button class="secondary-btn small-btn" id="useTeamLocationBtn">Use phone location</button></div><div class="location-card"><strong>${esc(loc.name||'Home facility not set')}</strong><span>${esc([loc.address,[loc.city,loc.state,loc.zip].filter(Boolean).join(' ')].filter(Boolean).join(' · ')||'Add an address/city in Team Setup')}</span>${loc.lat!=null&&loc.lon!=null?`<small>${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</small>`:''}</div></section>
        <section class="card"><div class="card-title-row"><div><h3>Coaching staff</h3><div class="card-sub">Head coach, assistants and team managers.</div></div><button class="primary-btn small-btn" id="addStaffBtn">＋ Staff</button></div>${staff.length?`<div class="staff-list">${staff.map(x=>`<div class="staff-row"><div class="avatar">${esc(x.name.split(/\s+/).map(y=>y[0]).join('').slice(0,2).toUpperCase())}</div><div><strong>${esc(x.name)}</strong><span>${esc(x.role)}${x.email?` · ${esc(x.email)}`:''}</span></div><button class="secondary-btn small-btn" data-edit-staff="${esc(x.id)}">Edit</button></div>`).join('')}</div>`:`<div class="empty-state"><strong>Add your coaching staff</strong>Assistant coaches and managers can later receive their own role-based access.</div>`}</section>
      </div>
      <section class="card" style="margin-top:14px"><div class="card-title-row"><div><h3>Team documents</h3><div class="card-sub">Share schedules, league rules, handbooks, forms and team files.</div></div><button class="primary-btn" id="uploadDocumentBtn">＋ Upload document</button></div>${docs.length?`<div class="document-list">${docs.map(d=>`<div class="document-row"><div class="document-icon">${d.type.includes('pdf')?'PDF':'FILE'}</div><div class="document-main"><strong>${esc(d.name)}</strong><span>${esc(d.category)} · ${formatBytes(d.size)} · ${esc(d.visibility)}${d.cloud?' · cloud':''}</span>${d.description?`<small>${esc(d.description)}</small>`:''}</div><div class="document-actions"><button class="secondary-btn small-btn" data-download-doc="${esc(d.id)}">Open</button><button class="danger-btn small-btn" data-delete-doc="${esc(d.id)}">Delete</button></div></div>`).join('')}</div>`:`<div class="empty-state"><strong>No documents shared yet</strong>Upload your league rulebook, team handbook, schedule, consent forms or practice resources.</div>`}</section>${window.TeamAppCloud?.renderCoachPanel?.()||''}`;
  }

  function renderPlayerRow(p,compact=false){
    const att={yes:'✓ Attending',no:'✕ Unavailable',maybe:'? Maybe'}[p.attendance]||'No response';
    if(compact)return `<${coachUI()?'button':'div'} class="player-row" ${coachUI()?`data-edit-player="${p.id}"`:''} style="width:100%;text-align:left"><div class="avatar">${esc(initials(p))}</div><div class="player-main"><div class="player-name">${esc(fullName(p))}</div><div class="player-meta">#${esc(p.number||'—')} · ${esc(p.primary||'Unassigned')} · ${esc(att)}</div></div><div class="jersey">#${esc(p.number||'—')}</div></${coachUI()?'button':'div'}>`;
    const dev=developmentProfile(p.id);const goals=dev.goals?.length||0;
    return `<div class="player-row"><div class="avatar">${esc(initials(p))}</div><div class="player-main"><div class="player-name">${esc(fullName(p))}</div><div class="player-meta">#${esc(p.number||'—')} · ${esc(p.primary||'Unassigned')} · ${esc(att)}${goals?` · ${goals} goal${goals===1?'':'s'}`:''}</div></div>${coachUI()?`<div class="roster-actions"><button class="secondary-btn small-btn" data-dev-player="${p.id}">Develop</button><button class="secondary-btn small-btn" data-edit-player="${p.id}">Details</button></div>`:''}</div>`;
  }


  function cloneAssignments(source=state.assignments){
    const copy={};Object.keys(source||{}).forEach(k=>{copy[k]={...(source[k]||{})};});return copy;
  }
  function cloneUnitAssignments(source=teamContextFor(state)?.unitAssignments||{}){
    const copy={};Object.keys(source||{}).forEach(unit=>copy[unit]=cloneAssignments(source[unit]));return copy;
  }
  function cloneUnitLayoutKeys(source=teamContextFor(state)?.unitLayoutKeys||{}){
    const copy={};Object.keys(source||{}).forEach(unit=>copy[unit]={...(source[unit]||{})});return copy;
  }
  function ensurePeriodAcrossUnits(period){const c=teamContextFor(state);if(!c)return;sportUnits().forEach(u=>{c.unitAssignments[u.key]=c.unitAssignments[u.key]||{};c.unitAssignments[u.key][period]=c.unitAssignments[u.key][period]||{};c.unitLayoutKeys[u.key]=c.unitLayoutKeys[u.key]||{};if(!u.layoutMap?.[c.unitLayoutKeys[u.key][period]])c.unitLayoutKeys[u.key][period]=teamDefaultLayoutKey(u.key);});}
  function gameAssignments(g,unitKey=g?.activeUnitKey){if(!g)return {};const key=unitKey||defaultUnitKey();g.unitAssignments=g.unitAssignments||{};g.unitAssignments[key]=g.unitAssignments[key]||{};return g.unitAssignments[key];}
  function gameEvent(eventId){return state.events.find(e=>e.id===eventId)||null;}
  function gameSession(eventId=state.activeGameEventId){return eventId?ensureGameSession(eventId):null;}
  function defaultCheckIn(p){return p.attendance==='no'?'out':p.attendance==='yes'?'present':'pending';}
  function ensureGameSession(eventId){
    if(!eventId)return null;
    if(!state.gameSessions[eventId]){
      const attendance={};activePlayers().forEach(p=>attendance[p.id]=defaultCheckIn(p));
      state.gameSessions[eventId]={eventId,active:false,startedAt:null,endedAt:null,currentPeriod:1,activeUnitKey:state.activeUnitKey||defaultUnitKey(),half:sportDef().sides?.[0]||'',scoreFor:0,scoreAgainst:0,periodScores:{},sequenceIndex:0,pitchCounts:{},pitchesByPeriod:{},substitutions:[],attendance,unitAssignments:cloneUnitAssignments(),unitLayoutKeys:cloneUnitLayoutKeys(),sequenceOrder:[...state.sequenceOrder],undo:[]};
    }
    const g=normalizeGameSession(state.gameSessions[eventId],teamContextFor(state),sportDef());
    if(sportDef().sides?.length && !sportDef().sides.includes(g.half))g.half=sportDef().sides[0];if(!sportDef().sides?.length)g.half='';
    g.sequenceOrder=g.sequenceOrder||[...state.sequenceOrder];activePlayers().forEach(p=>{if(!g.attendance[p.id])g.attendance[p.id]=defaultCheckIn(p);});return g;
  }
  function snapshotGame(g){
    const pitchesByPeriod={};Object.keys(g.pitchesByPeriod||{}).forEach(k=>pitchesByPeriod[k]={...(g.pitchesByPeriod[k]||{})});
    return {active:g.active,startedAt:g.startedAt,endedAt:g.endedAt,currentPeriod:g.currentPeriod,activeUnitKey:g.activeUnitKey,half:g.half,scoreFor:g.scoreFor,scoreAgainst:g.scoreAgainst,periodScores:JSON.parse(JSON.stringify(g.periodScores||{})),sequenceIndex:g.sequenceIndex,sequenceOrder:[...(g.sequenceOrder||[])],pitchCounts:{...g.pitchCounts},pitchesByPeriod,attendance:{...g.attendance},unitAssignments:cloneUnitAssignments(g.unitAssignments),unitLayoutKeys:cloneUnitLayoutKeys(g.unitLayoutKeys),substitutions:[...(g.substitutions||[])]};
  }
  function pushGameUndo(g,label){g.undo=g.undo||[];g.undo.push({label,state:snapshotGame(g)});if(g.undo.length>25)g.undo.shift();}
  function currentGamePitcher(g){if(!sportCapability('pitchTracking'))return null;const a=gameAssignments(g)?.[g.currentPeriod]||{};const slot=gameLayoutSlots(g).find(x=>x.roleCode==='P');return player(slot?a[slot.key]:null);}

  function checkedInCount(g,status='present'){return activePlayers().filter(p=>(g.attendance?.[p.id]||'pending')===status).length;}
  function displayedScore(g,side){
    if(sportDef().scoreModel==='period'){const row=g.periodScores?.[g.currentPeriod]||{};return Math.max(0,Number(row[side]||0));}
    return Math.max(0,Number(side==='for'?g.scoreFor:g.scoreAgainst)||0);
  }
  function adjustGameScore(g,side,delta){
    if(sportDef().scoreModel==='period'){g.periodScores=g.periodScores||{};const row=g.periodScores[g.currentPeriod]||(g.periodScores[g.currentPeriod]={for:0,against:0});row[side]=Math.max(0,Number(row[side]||0)+delta);return;}
    const key=side==='for'?'scoreFor':'scoreAgainst';g[key]=Math.max(0,Number(g[key]||0)+delta);
  }
  function renderPeriodScoreStrip(g){
    if(sportDef().scoreModel!=='period')return '';
    return `<div class="period-score-strip">${Array.from({length:state.periodCount},(_,i)=>i+1).map(n=>{const row=g.periodScores?.[n]||{};return `<span class="${n===g.currentPeriod?'active':''}"><b>${n}</b>${Number(row.for||0)}–${Number(row.against||0)}</span>`;}).join('')}</div>`;
  }
  function renderExtraScoreActions(side){
    const actions=(sportDef().scoreActions||[]).filter(a=>Number(a.value)>1);
    if(!actions.length)return '';
    return `<div class="score-quick-actions">${actions.map(a=>`<button data-score-side="${side}" data-score-value="${Number(a.value)}" aria-label="Add ${esc(a.label)} for ${side==='for'?team().name:'opponent'}">${esc(a.label)} +${Number(a.value)}</button>`).join('')}</div>`;
  }
  function gameLineupDiff(g){
    const assignments=gameAssignments(g),now=assignments?.[g.currentPeriod]||{},next=assignments?.[g.currentPeriod+1]||{};
    const nowSlots=gameLayoutSlots(g,g.currentPeriod,g.activeUnitKey),nextSlots=gameLayoutSlots(g,g.currentPeriod+1,g.activeUnitKey);if(!Object.keys(next).length&&!nextSlots.length)return [];
    const keys=[...new Set([...nowSlots.map(s=>s.key),...nextSlots.map(s=>s.key)])],nowMap=Object.fromEntries(nowSlots.map(s=>[s.key,s])),nextMap=Object.fromEntries(nextSlots.map(s=>[s.key,s]));
    return keys.flatMap(key=>{const from=now[key],to=next[key];if(from===to&&Boolean(nowMap[key])===Boolean(nextMap[key]))return [];const fp=player(from),tp=player(to),slot=nextMap[key]||nowMap[key];return [{pos:key,label:slot?slotLabel(slot,true):key,from:fp?fullName(fp):'Open',to:tp?fullName(tp):'Open'}];});
  }

  function littleLeagueRestDays(age,pitches){
    if(!pitches)return 0;const bands=age>=15?[[76,4],[61,3],[46,2],[31,1],[1,0]]:[[66,4],[51,3],[36,2],[21,1],[1,0]];return bands.find(([min])=>pitches>=min)?.[1]??0;
  }
  function littleLeaguePitchGuide(p,pitches,eventId){
    if(sportKey(team())!=='baseball'||team().leagueKey!=='little-league')return null;
    const age=Number(p?.leagueAge);if(!Number.isFinite(age)||age<6||age>16)return {missingAge:true};
    const daily=age<=8?50:age<=10?75:age<=12?85:95,rest=littleLeagueRestDays(age,pitches);
    const event=state.events.find(e=>String(e.id)===String(eventId));let eligibility=null,sameDayPitches=0;
    if(event?.date){
      const current=new Date(`${event.date}T12:00:00`);
      const appearances=Object.entries(state.gameSessions||{}).map(([id,g])=>{const ev=state.events.find(e=>String(e.id)===String(id));const n=Number(g?.pitchCounts?.[p.id]||0);return ev?.date&&n>0&&String(id)!==String(eventId)?{id,date:new Date(`${ev.date}T12:00:00`),dateText:ev.date,pitches:n}:null;}).filter(Boolean);
      const history=appearances.filter(x=>x.date<current).sort((a,b)=>b.date-a.date),sameDay=appearances.filter(x=>x.dateText===event.date);
      sameDayPitches=sameDay.reduce((sum,x)=>sum+x.pitches,0);
      const last=history[0];if(last){const days=Math.round((current-last.date)/86400000),needed=littleLeagueRestDays(age,last.pitches);eligibility={eligible:days>needed,daysSince:days,needed,last};}
      const daysWithPitches=new Set(history.map(x=>x.dateText));const yesterday=new Date(current);yesterday.setDate(yesterday.getDate()-1);const twoAgo=new Date(current);twoAgo.setDate(twoAgo.getDate()-2);const iso=d=>d.toISOString().slice(0,10);if(daysWithPitches.has(iso(yesterday))&&daysWithPitches.has(iso(twoAgo)))eligibility={...(eligibility||{}),eligible:false,threeConsecutive:true};
      if(sameDay.length){
        const profile=String(team().competitionProfileId||'').toLowerCase();
        const oneGameOnly=/llb-(minor|major|intermediate)/.test(profile);
        const juniorSenior=/llb-(junior|senior)/.test(profile);
        const age12JuniorSenior=juniorSenior&&age===12;
        const firstGameOver30=juniorSenior&&sameDay.some(x=>x.pitches>30);
        if(oneGameOnly||age12JuniorSenior)eligibility={...(eligibility||{}),eligible:false,sameDayBlocked:true,sameDayPitches};
        else if(firstGameOver30)eligibility={...(eligibility||{}),eligible:false,sameDayThresholdReview:true,sameDayPitches};
        else eligibility={...(eligibility||{}),sameDayPitches,secondGameReview:juniorSenior};
      }
    }
    const combinedToday=pitches+sameDayPitches,remaining=Math.max(0,daily-combinedToday);
    return {age,daily,rest,remaining,combinedToday,sameDayPitches,eligibility,source:'https://www.littleleague.org/playing-rules/pitch-count/'};
  }
  function renderGameDay(){
    const events=[...state.events].sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    const activeId=state.activeGameEventId;
    const g=gameSession(activeId);const e=gameEvent(activeId);
    if(!g||!e){
      return `<div class="page-head"><div><div class="eyebrow">${esc(sportDef().name)} · Field mode</div><h1>Game Day</h1><p>Choose an event. Team APP makes an event-specific copy of your lineup so field changes do not overwrite your master plan.</p></div></div>
        <section class="card game-day-launch"><div class="card-title-row"><div><h3>Start or resume a session</h3><div class="card-sub">Practices can be opened here too for attendance and field testing.</div></div></div>
          <div class="game-event-list">${events.length?events.map(ev=>`<button class="game-event-choice" data-open-game="${ev.id}"><div><strong>${esc(ev.title)}</strong><span>${esc(ev.type)} · ${prettyDate(ev.date)} · ${prettyTime(ev.start)}</span><span>${esc(ev.venue||'Venue not set')}</span></div><b>${state.gameSessions[ev.id]?'Resume':'Open'} ›</b></button>`).join(''):`<div class="empty-state"><strong>No events yet</strong>Create a practice or game in Schedule first.<div style="margin-top:12px"><button class="primary-btn" data-go="schedule">Open schedule</button></div></div>`}</div>
        </section>`;
    }
    const pitcher=currentGamePitcher(g);const pitches=pitcher?Number(g.pitchCounts?.[pitcher.id]||0):0;
    const periodPitches=pitcher?Number(g.pitchesByPeriod?.[g.currentPeriod]?.[pitcher.id]||0):0;const llGuide=pitcher?littleLeaguePitchGuide(pitcher,pitches,g.eventId||state.activeGameEventId):null;
    const pitchingRows=sportCapability('pitchTracking')?Object.entries(g.pitchCounts||{}).filter(([,count])=>Number(count)>0).map(([id,count])=>{const p=player(id);const periods=Object.keys(g.pitchesByPeriod||{}).filter(n=>Number(g.pitchesByPeriod?.[n]?.[id]||0)>0);return p?{p,count:Number(count),periods}:null;}).filter(Boolean):[];
    const order=sportCapability('sequenceOrder')?(g.sequenceOrder||[]).map(player).filter(Boolean):[];const sequenceIndex=order.length?((g.sequenceIndex||0)%order.length):0;
    const sequencePreview=[0,1,2].map(i=>order.length?order[(sequenceIndex+i)%order.length]:null);
    const changes=gameLineupDiff(g);const currentAssignments=gameAssignments(g)?.[g.currentPeriod]||{};const currentGameLayout=gameLayoutDef(g);const currentGameSlots=currentGameLayout?.slots||[];const sides=sportDef().sides||[];
    const gameUnits=sportUnits();const gameUnitTabs=gameUnits.length>1?`<div class="unit-tabs game-unit-tabs" aria-label="Game Day units">${gameUnits.map(u=>`<button class="unit-tab ${u.key===g.activeUnitKey?'active':''}" data-game-unit="${esc(u.key)}">${esc(u.label)}</button>`).join('')}</div>`:'';
    const sideSwitch=sides.length>1?`<button class="half-toggle" data-game-action="toggle-half">Switch to ${esc(sides[(sides.indexOf(g.half)+1)%sides.length])}</button>`:'';
    const pitchCard=sportCapability('pitchTracking')?`<section class="card game-pitch-card"><div class="card-title-row"><div><h3>Pitch count</h3><div class="card-sub">Current pitcher</div></div><span class="position-pill">P</span></div>
          ${pitcher?`<div class="pitcher-name"><div class="avatar">${esc(initials(pitcher))}</div><div><strong>#${esc(pitcher.number)} ${esc(fullName(pitcher))}</strong><span>${esc(pitcher.primary||'Pitcher')}</span></div></div><div class="pitch-count"><strong>${pitches}</strong><span>game pitches · ${esc(periodLabel(g.currentPeriod).toLowerCase())}: ${periodPitches}</span></div><div class="pitch-buttons"><button data-pitch="-1">−1</button><button data-pitch="1">+1</button><button data-pitch="5">+5</button></div>${llGuide?.missingAge?`<div class="notice compact-notice"><strong>Add League Age</strong> to this player profile to show Little League daily pitch/rest guidance.</div>`:llGuide?`<div class="pitch-rule-guide"><div><span>League age</span><strong>${llGuide.age}</strong></div><div><span>Daily max</span><strong>${llGuide.daily}</strong></div><div><span>Remaining</span><strong>${llGuide.remaining}</strong></div><div><span>Rest if done now</span><strong>${llGuide.rest} day${llGuide.rest===1?'':'s'}</strong></div></div>${llGuide.eligibility&&!llGuide.eligibility.eligible?`<div class="notice rule-alert"><strong>Pitching eligibility warning.</strong> ${llGuide.eligibility.sameDayBlocked?'This player already pitched in another game today and this division/age does not permit a second pitching appearance.':llGuide.eligibility.sameDayThresholdReview?'This player exceeded 30 recorded pitches in an earlier game today. A second appearance is not allowed unless the official threshold-at-batter exception applies.':llGuide.eligibility.threeConsecutive?'Little League does not permit pitching on three consecutive days.':`Previous appearance: ${llGuide.eligibility.last.pitches} pitches ${llGuide.eligibility.daysSince} calendar day(s) ago; that band requires ${llGuide.eligibility.needed} full day(s) rest.`}</div>`:llGuide.eligibility?.secondGameReview?`<div class="notice compact-notice"><strong>Second-game review required.</strong> Same-day Junior/Senior pitching has additional first-game pitch-count and age restrictions. Combined pitches today: ${llGuide.combinedToday}.</div>`:''}<div class="card-sub rule-source">2026 Little League guide · catcher/pitcher restrictions, threshold-at-batter exceptions, suspended games, and local rules still require coach/official review. <a href="${llGuide.source}" target="_blank" rel="noopener">Official pitching rules ↗</a></div>`:`<div class="notice compact-notice">Configure the team governing rule set and any local pitching limits before relying on pitch eligibility.</div>`}`:`<div class="empty-state"><strong>No pitcher assigned</strong>Assign P for ${esc(periodLabel(g.currentPeriod).toLowerCase())} in Lineup Studio or sync a newer lineup.</div>`}
        </section>`:'';
    const sequenceCard=sportCapability('sequenceOrder')?`<section class="card"><div class="card-title-row"><div><h3>${esc(sportDef().sequence?.label||'Order')}</h3><div class="card-sub">Event-specific sequence</div></div><button class="primary-btn small-btn" data-game-action="next-batter" ${order.length?'':'disabled'}>Next ${esc(sportDef().sequence?.verb||'player')}</button></div>
          <div class="batting-now">${sequencePreview.map((p,i)=>p?`<div class="batting-player ${i===0?'current':''}"><span>${i===0?'NOW':i===1?'NEXT':'THEN'}</span><strong>${((sequenceIndex+i)%order.length)+1}. #${esc(p.number)} ${esc(fullName(p))}</strong></div>`:'').join('')||'<div class="empty-state">No ordered lineup saved.</div>'}</div>
        </section>`:'';
    const pitchingHistory=sportCapability('pitchTracking')?`<section class="card"><div class="card-title-row"><div><h3>Pitching history</h3><div class="card-sub">Pitch totals recorded in this session</div></div></div>
          ${pitchingRows.length?`<div class="pitch-history">${pitchingRows.map(x=>`<div><div><strong>#${esc(x.p.number)} ${esc(fullName(x.p))}</strong><span>${esc(periodPlural())} ${esc(x.periods.join(', '))}</span></div><b>${x.count}</b></div>`).join('')}</div>`:`<div class="empty-state"><strong>No pitches recorded yet</strong>Pitch totals will appear here as you use the counter.</div>`}
        </section>`:'';
    return `<div class="game-day-page">
      <div class="game-day-header"><div><div class="eyebrow muted-on-dark">${esc(sportDef().emoji)} ${esc(e.type)} · ${prettyDate(e.date)}</div><h1>${esc(e.title)}</h1><div class="muted-on-dark">${esc(e.venue||'Venue not set')} · ${g.active?'Session active':'Session ready'}</div></div><button class="sun-btn" id="sunlightToggle" aria-label="Toggle sunlight mode">☀</button></div>
      ${gameUnitTabs}
      <section class="game-score-card">
        <div class="period-control"><button data-game-action="prev-period">‹</button><div><span>${esc(g.half||periodSingular())}</span><strong>${g.currentPeriod}</strong><small>${esc(periodSingular().toUpperCase())}</small></div><button data-game-action="next-period">›</button></div>
        <div class="score-team"><span>${esc(team().name)}</span><div><button data-game-action="score-for-down">−</button><strong>${displayedScore(g,'for')}</strong><button data-game-action="score-for-up">＋</button></div>${renderExtraScoreActions('for')}</div>
        <div class="score-team"><span>Opponent</span><div><button data-game-action="score-against-down">−</button><strong>${displayedScore(g,'against')}</strong><button data-game-action="score-against-up">＋</button></div>${renderExtraScoreActions('against')}</div>
        ${sideSwitch}
      </section>
      ${renderPeriodScoreStrip(g)}
      <div class="game-day-actions">
        ${g.active?`<button class="danger-btn" data-game-action="end">End session</button>`:`<button class="primary-btn" data-game-action="start">Start session</button>`}
        <button class="secondary-btn" data-game-action="undo" ${g.undo?.length?'':'disabled'}>↶ Undo${g.undo?.length?` · ${esc(g.undo[g.undo.length-1].label)}`:''}</button>
        <button class="secondary-btn" data-game-action="sync-lineup">Sync latest lineup</button>
        <button class="secondary-btn" data-game-action="close-game">Change event</button>
      </div>
      <div class="game-day-grid">
        ${pitchCard}${sequenceCard}
        <section class="card"><div class="card-title-row"><div><h3>${esc(unitLabel(g.activeUnitKey))} · ${esc(periodLabel(g.currentPeriod))}</h3><div class="card-sub">${esc(currentGameLayout?.label||'Layout')} · tap a slot for a quick event-only substitution.</div></div><button class="secondary-btn small-btn" data-go="lineup">Open studio</button></div>
          ${unitDef(g.activeUnitKey)?.layouts?.length>1?`<label class="compact-select-label">Layout <select data-game-layout>${unitDef(g.activeUnitKey).layouts.map(l=>`<option value="${esc(l.key)}" ${l.key===gameLayoutKey(g)?'selected':''}>${esc(l.label)}</option>`).join('')}</select></label>`:''}
          <div class="defense-list">${currentGameSlots.map(slot=>{const p=player(currentAssignments[slot.key]);return `<button class="defense-sub-btn" data-sub-position="${esc(slot.key)}"><b>${esc(slot.key)}</b><span>${p?`#${esc(p.number)} ${esc(fullName(p))}`:'Open'}</span><small>${esc(slotLabel(slot))}</small></button>`;}).join('')}</div>
        </section>
        ${pitchingHistory}
        <section class="card"><div class="card-title-row"><div><h3>Session substitutions</h3><div class="card-sub">Event-specific changes; your master lineup is untouched.</div></div></div>
          ${g.substitutions?.length?`<div class="sub-history">${g.substitutions.slice().reverse().slice(0,8).map(x=>{const fp=player(x.from),tp=player(x.to);return `<div><b>${esc((sportDef().unitMap?.[x.unitKey]?.label||'Positions'))} · ${esc(x.slotKey||x.pos)} · ${x.period}</b><span>${fp?esc(fullName(fp)):'Open'} → ${tp?esc(fullName(tp)):'Open'}</span></div>`;}).join('')}</div>`:`<div class="empty-state"><strong>No substitutions yet</strong>Tap a position to make an event-only change.</div>`}
        </section>
        <section class="card"><div class="card-title-row"><div><h3>Next ${esc(periodSingular())} changes</h3><div class="card-sub">${esc(periodLabel(g.currentPeriod+1))}</div></div></div>
          ${changes.length?`<div class="change-list">${changes.map(c=>`<div><b>${esc(c.label||c.pos)}</b><span>${esc(c.from)} → ${esc(c.to)}</span></div>`).join('')}</div>`:`<div class="empty-state"><strong>${g.currentPeriod>=state.periodCount?`No later ${esc(periodSingular())} planned`:'No position changes'}</strong>${g.currentPeriod>=state.periodCount?`Add another ${esc(periodSingular())} in Lineup Studio.`:'Everyone stays in the same assigned spots.'}</div>`}
        </section>
        <section class="card game-checkin-card"><div class="card-title-row"><div><h3>Player check-in</h3><div class="card-sub">${checkedInCount(g)} present · ${checkedInCount(g,'out')} out · ${checkedInCount(g,'pending')} pending</div></div></div>
          <div class="checkin-list">${activePlayers().map(p=>{const st=g.attendance?.[p.id]||'pending';return `<div class="checkin-row"><div class="player-main"><div class="player-name">#${esc(p.number)} ${esc(fullName(p))}</div><div class="player-meta">${esc(p.primary||'Unassigned')}</div></div><div class="checkin-buttons"><button class="${st==='present'?'active present':''}" data-checkin="${p.id}:present">✓</button><button class="${st==='pending'?'active pending':''}" data-checkin="${p.id}:pending">?</button><button class="${st==='out'?'active out':''}" data-checkin="${p.id}:out">✕</button></div></div>`;}).join('')}</div>
        </section>
      </div>
    </div>`;
  }

  function renderRoster(){
    const players=activePlayers();
    return `<div class="page-head"><div><div class="eyebrow">Team</div><h1>Active roster</h1><p>${players.length} active players · ${coachUI()?'coach-managed profiles':'team roster'}</p></div>${coachUI()?`<button class="primary-btn" id="addPlayerBtn">＋ Player</button>`:''}</div>
      <div class="grid grid-3" style="margin-bottom:14px">
        <div class="card"><div class="eyebrow">Attending</div><div style="font-size:30px;font-weight:950">${players.filter(p=>p.attendance==='yes').length}</div><div class="card-sub">Current availability</div></div>
        <div class="card"><div class="eyebrow">Unavailable</div><div style="font-size:30px;font-weight:950">${players.filter(p=>p.attendance==='no').length}</div><div class="card-sub">Excluded from lineup warnings</div></div>
        <div class="card"><div class="eyebrow">Needs response</div><div style="font-size:30px;font-weight:950">${players.filter(p=>!['yes','no','maybe'].includes(p.attendance)).length}</div><div class="card-sub">Availability not set</div></div>
      </div>
      <section class="card"><div class="card-title-row"><div><h3>Players</h3><div class="card-sub">${coachUI()?'Edit positions, availability and private coach notes.':'Team roster and primary positions.'}</div></div></div>
        <div class="roster-list">${players.length?players.map(p=>renderPlayerRow(p,false)).join(''):`<div class="empty-state"><strong>No active players</strong>Add the first player to start building this team roster.</div>`}</div>
      </section>`;
  }

  function renderLineup(){
    const a=state.assignments[currentPeriod] || {};const assigned=new Set(Object.values(a).filter(Boolean));const bench=activePlayers().filter(p=>!assigned.has(p.id));
    const sequenceTab=sportCapability('sequenceOrder')?`<button class="section-tab" data-lineup-tab="sequence">${esc(sportDef().sequence?.label||'Order')}</button>`:'';
    const units=sportUnits();const unitTabs=units.length>1?`<div class="unit-tabs" aria-label="${esc(sportDef().name)} units">${units.map(u=>`<button class="unit-tab ${u.key===currentUnitKey()?'active':''}" data-lineup-unit="${esc(u.key)}">${esc(u.label)}</button>`).join('')}</div>`:'';
    return `<div class="page-head"><div><div class="eyebrow">${esc(sportDef().name)} · Coach tools</div><h1>Lineup Studio</h1><p>Tap a player, then tap a position. The same placement engine is shared across sport surfaces and units.</p></div><button class="secondary-btn" id="lineupCardBtn">Lineup card</button></div>
      ${unitTabs}<div class="section-tabs"><button class="section-tab active" data-lineup-tab="positions">Positions</button><button class="section-tab" data-lineup-tab="rotation">Rotation</button>${sequenceTab}</div>
      <div id="lineupPanel">${renderPositionPanel(a,bench)}</div>`;
  }


  function renderSurfaceDecorations(){
    const surface=sportDef().surface;
    if(surface==='diamond')return `<div class="infield-dirt"></div><div class="base b1"></div><div class="base b2"></div><div class="base b3"></div><div class="home"></div>`;
    if(surface==='pitch')return `<div class="surface-line halfway"></div><div class="surface-circle center-circle"></div><div class="surface-box goal-box top"></div><div class="surface-box goal-box bottom"></div>`;
    if(surface==='court')return `<div class="surface-line halfway"></div><div class="surface-circle center-circle"></div><div class="surface-arc hoop top">◯</div><div class="surface-arc hoop bottom">◯</div>`;
    if(surface==='gridiron')return `<div class="yard-lines">${Array.from({length:9},(_,i)=>`<span style="top:${10+i*10}%"></span>`).join('')}</div><div class="end-zone top">END ZONE</div><div class="end-zone bottom">END ZONE</div>`;
    if(surface==='volleyball')return `<div class="volley-net"></div><div class="surface-line volley-attack top"></div><div class="surface-line volley-attack bottom"></div>`;
    return '';
  }

  function renderPositionPanel(a,bench){
    const periodWord=periodSingular();const layout=teamLayoutDef();const slots=layout?.slots||[];const layouts=unitLayouts();
    return `<section class="card" style="padding:12px">
      <div class="card-title-row" style="padding:4px 4px 0"><div><h3>${esc(sportDef().name)} · ${esc(unitLabel())}</h3><div class="card-sub">${esc(periodLabel(currentPeriod))} of ${state.periodCount} · ${esc(layout?.label||'Standard layout')}</div></div><div class="card-actions"><button class="primary-btn small-btn" id="balanceNextPeriod">Suggest next</button><button class="secondary-btn small-btn" id="presetsBtn">Presets</button><button class="secondary-btn small-btn" id="clearPeriod">Clear</button></div></div>
      <div class="lineup-context-row"><div class="lineup-toolbar" aria-label="Select ${esc(periodWord)}">${Array.from({length:state.periodCount},(_,i)=>i+1).map(i=>`<button class="period-btn ${i===currentPeriod?'active':''}" data-period="${i}" aria-label="${esc(periodLabel(i))}">${i}</button>`).join('')}<button class="period-btn" id="addPeriod" aria-label="Add ${esc(periodWord)}">＋</button></div>${layouts.length>1?`<label class="layout-picker"><span>Layout</span><select id="layoutSelect">${layouts.map(l=>`<option value="${esc(l.key)}" ${l.key===teamLayoutKey()?'selected':''}>${esc(l.label)}</option>`).join('')}</select></label>`:''}</div>
      <div class="surface-wrap surface-${esc(sportDef().surface)}">
        <div class="sport-surface">
          ${renderSurfaceDecorations()}
          ${slots.map(slot=>renderPositionSlot(slot,a[slot.key])).join('')}
        </div>
        <div class="bench"><h3>Bench / unassigned ${selectedPlayerId?'· player selected':''}</h3><div class="bench-list">${bench.length?bench.map(renderPlayerChip).join(''):`<span class="card-sub">Everyone is assigned.</span>`}</div></div>
      </div>
    </section>`;
  }

  function renderPositionSlot(slot,playerId){
    const p=player(playerId);const role=positionDef(slot.roleCode)||{};
    return `<button class="position-slot ${p?'':'empty'}" style="left:${Number(slot.x)||50}%;top:${Number(slot.y)||50}%" data-position="${esc(slot.key)}" data-role="${esc(slot.roleCode)}" data-player-id="${playerId||''}" draggable="${p?'true':'false'}">
      <div><div class="pos-label">${esc(slot.key)} · ${esc(role.name||slot.label||slot.roleCode)}</div><div class="slot-player">${p?`#${esc(p.number)} ${esc(p.first)} ${esc(p.last)}`:'Tap to assign'}</div></div>
    </button>`;
  }
  function renderPlayerChip(p){
    return `<button class="player-chip ${selectedPlayerId===p.id?'selected':''}" data-select-player="${p.id}" draggable="true"><span class="num">#${esc(p.number)}</span>${esc(p.first)} ${esc(p.last)}</button>`;
  }

  function renderRotationPanel(){
    const ps=activePlayers();
    return `<section class="card"><div class="card-title-row"><div><h3>${esc(periodSingular().replace(/^./,c=>c.toUpperCase()))} rotation</h3><div class="card-sub">Automatic view of every saved position assignment.</div></div></div><div class="layout-summary-strip">${Array.from({length:state.periodCount},(_,i)=>i+1).map(n=>`<span><b>${n}</b>${esc(teamLayoutDef(n)?.label||'Standard')}</span>`).join('')}</div>
      <div class="table-scroll"><table class="rotation-table"><thead><tr><th>Player</th>${Array.from({length:state.periodCount},(_,i)=>`<th>${i+1}</th>`).join('')}<th>Active</th><th>Bench</th></tr></thead><tbody>
      ${ps.map(p=>{const stats=playerStats(p.id);return `<tr><td><strong>#${esc(p.number)} ${esc(p.first)} ${esc(p.last)}</strong></td>${Array.from({length:state.periodCount},(_,i)=>`<td>${esc(positionForPlayer(i+1,p.id)||'Bench')}</td>`).join('')}<td><strong>${stats.field}</strong></td><td>${stats.bench}</td></tr>`}).join('')}
      </tbody></table></div>
      <div class="separator"></div>
      <div class="grid grid-3">${ps.slice(0,6).map(p=>{const st=playerStats(p.id);return `<div class="stat-card"><strong>${st.field}/${state.periodCount}</strong><span>${esc(p.first)} · ${st.groupsText||'position mix'}</span></div>`}).join('')}</div>
    </section>`;
  }

  function playerStats(playerId){
    let field=0,bench=0;const groups={};
    for(let i=1;i<=state.periodCount;i++){
      const pos=positionForPlayer(i,playerId);
      if(!pos){bench++;continue;} field++;
      const group=positionDef(pos)?.group||'other';groups[group]=(groups[group]||0)+1;
    }
    const groupsText=Object.entries(groups).map(([g,n])=>`${n} ${g}`).join(' · ');
    return {field,bench,groups,groupsText};
  }
  function slotForPlayer(period,playerId,unitKey=currentUnitKey()){const a=(teamContextFor(state)?.unitAssignments?.[unitKey]||{})[period]||{};return Object.entries(a).find(([_slot,id])=>id===playerId)?.[0]||null;}
  function positionForPlayer(period,playerId,unitKey=currentUnitKey()){const slotKey=slotForPlayer(period,playerId,unitKey);if(!slotKey)return null;const unit=unitDef(unitKey);const layout=unit?.layoutMap?.[layoutKeyFromMaps(teamContextFor(state)?.unitLayoutKeys,unitKey,period)]||unit?.layouts?.[0];return layout?.slotMap?.[slotKey]?.roleCode||slotKey;}

  function renderSequencePanel(){
    if(!sportCapability('sequenceOrder'))return `<section class="card empty-state"><strong>No ordered lineup for ${esc(sportDef().name)}</strong>This sport template uses position/rotation planning without a batting-order style sequence.</section>`;
    const order=state.sequenceOrder.map(player).filter(Boolean).filter(p=>p.status==='active');
    return `<section class="card"><div class="card-title-row"><div><h3>${esc(sportDef().sequence?.label||'Order')}</h3><div class="card-sub">Use the arrows to reorder.</div></div><button class="secondary-btn small-btn" id="resetSequence">Roster order</button></div>
      <div class="roster-list">${order.map((p,i)=>`<div class="player-row"><div class="avatar">${i+1}</div><div class="player-main"><div class="player-name">#${esc(p.number)} ${esc(fullName(p))}</div><div class="player-meta">${esc(p.primary)}${p.bats?` · Bats ${esc(p.bats)}`:''}</div></div><div style="display:flex;gap:5px"><button class="secondary-btn small-btn" data-sequence-up="${p.id}" ${i===0?'disabled':''}>↑</button><button class="secondary-btn small-btn" data-sequence-down="${p.id}" ${i===order.length-1?'disabled':''}>↓</button></div></div>`).join('')}</div>
    </section>`;
  }

  function renderPractice(){
    const drills=sportDrills();
    return `<div class="page-head"><div><div class="eyebrow">${esc(sportDef().name)} · Coach tools</div><h1>Practice planner</h1><p>${minutesTotal()} minutes · build a repeatable plan for your team.</p></div><button class="primary-btn" id="addPracticeBtn">＋ Activity</button></div>
      <div class="grid grid-2">
        <section class="card"><div class="card-title-row"><div><h3>Practice timeline</h3><div class="card-sub">Current ${esc(sportDef().name.toLowerCase())} session plan</div></div><button class="secondary-btn small-btn" id="loadPracticeTemplate">Reset template</button></div>
          <div class="timeline">${state.practices.map((a,i)=>`<div class="timeline-item"><div class="timeline-time">${a.minutes}m</div><div><div class="timeline-name">${esc(a.title)}</div><div class="timeline-meta">${esc(a.category)} · Block ${i+1}${a.sourceDrillId?' · Drill library':''}</div></div><button class="drag-handle" data-remove-practice="${a.id}" aria-label="Remove ${esc(a.title)}">×</button></div>`).join('')}</div>
        </section>
        <div class="grid">
          <section class="card"><div class="eyebrow">Session length</div><div style="font-size:38px;font-weight:950">${minutesTotal()} min</div><div class="card-sub">${Math.floor(minutesTotal()/60)} hr ${minutesTotal()%60} min</div></section>
          <section class="card"><h3>Practice standards</h3><div class="card-sub" style="margin-bottom:12px">Shared coaching principles used across every sport template.</div>
            <div class="roster-list">
              <div class="player-row"><div class="avatar">1</div><div class="player-main"><div class="player-name">Keep lines short</div><div class="player-meta">Use stations and repetitions to reduce idle time.</div></div></div>
              <div class="player-row"><div class="avatar">2</div><div class="player-main"><div class="player-name">Teach one cue at a time</div><div class="player-meta">Correct the highest-value movement first.</div></div></div>
              <div class="player-row"><div class="avatar">3</div><div class="player-main"><div class="player-name">Finish with decisions</div><div class="player-meta">Reconnect isolated skills to game situations.</div></div></div>
            </div>
          </section>
        </div>
      </div>
      <section class="card" style="margin-top:14px"><div class="card-title-row"><div><h3>${esc(sportDef().name)} drill library</h3><div class="card-sub">Sport-specific content plugs into the same practice engine.</div></div></div>
        ${drills.length?`<div class="drill-grid">${drills.map(d=>`<article class="drill-card"><div><span class="sport-pill">${esc(d.category)}</span><h4>${esc(d.title)}</h4><p>${esc(d.focus)}</p></div><div class="drill-meta"><span>${d.minutes} min</span><span>${esc(d.equipment)}</span></div><div class="drill-actions"><button class="secondary-btn small-btn" data-drill-detail="${d.id}">Details</button><button class="primary-btn small-btn" data-add-drill="${d.id}">＋ Plan</button></div></article>`).join('')}</div>`:`<div class="empty-state"><strong>${esc(sportDef().name)} drill content scaffolded</strong>The shared drill/practice engine is ready; sport-specific drill content will be added and sourced separately.</div>`}
      </section>`;
  }

  function renderSchedule(){
    const events=[...state.events].sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    return `<div class="page-head"><div><div class="eyebrow">Calendar + weather</div><h1>Schedule</h1><p>Outdoor events can load hourly National Weather Service forecasts.</p></div>${coachUI()?`<button class="primary-btn" id="addEventBtn">＋ Event</button>`:''}</div>
      <div class="grid grid-2">${events.length?events.map(e=>renderEventCard(e,false)).join(''):`<div class="card empty-state"><strong>No events yet</strong>Add a practice or game to begin scheduling.</div>`}</div>`;
  }

  function renderEventCard(e,compact){
    const cache=state.weatherCache[e.id];
    return `<section class="card event-card">
      <div class="event-top"><div><span class="sport-pill">${esc(sportDef().emoji)} ${esc(e.type)}</span><h3 style="font-size:${compact?'20':'22'}px;margin:8px 0 3px">${esc(e.title)}</h3><div class="card-sub">${prettyDate(e.date)} · ${prettyTime(e.start)}–${prettyTime(e.end)}</div></div><span class="status-pill ${e.outdoor?'good':''}">${e.outdoor?'Outdoor':'Indoor'}</span></div>
      <div class="event-meta"><div>⌖ ${esc(e.venue||'Venue not set')}</div>${e.notes?`<div>☰ ${esc(e.notes)}</div>`:''}</div>
      ${cache?.hours?.length?`<div><div class="card-title-row"><div><strong>Weather during event</strong><div class="card-sub">Updated ${esc(cache.updatedLabel||'recently')}</div></div><span class="weather-pill">${esc(cache.summary||'Forecast')}</span></div><div class="weather-strip">${cache.hours.map(h=>`<div class="weather-hour"><b>${esc(h.time)}</b><div style="font-size:20px;font-weight:900;margin:3px 0">${esc(h.temp)}°</div><span>${esc(h.precip)}% rain</span></div>`).join('')}</div></div>`:
      e.outdoor?`<div class="notice">${e.lat!=null?`Weather is ready to load for this venue.`:`Add venue coordinates or use your phone's location to enable weather.`}</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${e.outdoor?`<button class="secondary-btn small-btn" data-weather="${e.id}">${cache?'Refresh weather':'Load weather'}</button><button class="secondary-btn small-btn" data-event-location="${e.id}">Use device location</button>`:''}${team().remoteId&&window.TeamAppCloud?.session?`<button class="secondary-btn small-btn" data-event-availability="${e.id}">Availability</button>`:''}${coachUI()&&['Game','Tournament'].includes(e.type)?`<button class="primary-btn small-btn" data-open-game="${e.id}">◆ Game Day</button>`:''}${coachUI()?`<button class="secondary-btn small-btn" data-edit-event="${e.id}">Edit</button>`:''}</div>
    </section>`;
  }

  function renderLearn(){
    const lessons=sportLessons();const tracks=sportDef().learningTracks||[];const units=sportUnits();const unitTabs=units.length>1?`<div class="unit-tabs" aria-label="Learning units">${units.map(u=>`<button class="unit-tab ${u.key===currentUnitKey()?'active':''}" data-learn-unit="${esc(u.key)}">${esc(u.label)}</button>`).join('')}</div>`:'';
    return `<div class="page-head"><div><div class="eyebrow">${esc(sportDef().name)} education</div><h1>Learn the game</h1><p>Position, rule and best-practice education uses the same sport definition as the coach tools.</p></div></div>${unitTabs}
      <div class="notice" style="margin-bottom:14px"><strong>${esc(teamRuleLabel(team()))}${team().leagueName?` · ${esc(team().leagueName)}`:''}.</strong> Fundamentals are instructional. Competition rules are tied to the selected age/division and governing source.${safeHttpsUrl(team().ruleSourceUrl)?` <a href="${esc(safeHttpsUrl(team().ruleSourceUrl))}" target="_blank" rel="noopener">Official source ↗</a>`:''}${team().localRulesNote?`<br><b>Local override:</b> ${esc(team().localRulesNote)}`:''}</div>
      <section class="card" style="margin-bottom:14px"><div class="card-title-row"><div><h3>${esc(unitLabel())} positions</h3><div class="card-sub">The learning view reads the same unit-position registry as Lineup Studio.</div></div></div><div class="learn-grid">${sportPositions().map(pos=>{const l=lessons[pos];return `<button class="learn-card" ${l?`data-lesson="${esc(pos)}"`:'disabled'}><strong>${esc(pos)} · ${esc(positionName(pos))}</strong><span>${l?esc(l.where):'Position scaffold ready · lesson content pending review'}</span></button>`;}).join('')}</div></section>
      <div class="grid grid-2"><section class="card"><h3>Learning tracks</h3><div class="card-sub" style="margin-bottom:12px">Sport-specific tracks reuse the shared lesson/search/progress framework.</div><div class="roster-list">${tracks.map((x,i)=>`<div class="player-row"><div class="avatar">${i+1}</div><div class="player-main"><div class="player-name">${esc(x)}</div><div class="player-meta">${lessons&&Object.keys(lessons).length?'Content expansion':'Template ready · content pending'}</div></div></div>`).join('')}</div></section><section class="card"><h3>Interactive scenarios</h3><div class="card-sub" style="margin-bottom:12px">The scenario engine will reuse each sport's playing surface, positions, units and rule-set metadata.</div><div class="lesson-section"><h4>Standard architecture</h4><p>Scenario → place players/ball → ask a decision → evaluate against the selected sport and rule set → explain the coaching principle.</p></div>${lessons.SS?`<button class="primary-btn" style="margin-top:12px" id="openSSLesson">Open shortstop lesson</button>`:''}</section></div>`;
  }


  function renderModal(){
    if(modal.type==='player') return renderPlayerModal(modal.playerId);
    if(modal.type==='development') return renderDevelopmentModal(modal.playerId);
    if(modal.type==='balance') return renderBalanceModal();
    if(modal.type==='lineupCard') return renderLineupCardModal();
    if(modal.type==='practice') return renderPracticeModal();
    if(modal.type==='event') return renderEventModal(modal.eventId);
    if(modal.type==='lesson') return renderLessonModal(modal.pos);
    if(modal.type==='drill') return renderDrillModal(modal.drillId);
    if(modal.type==='presets') return renderPresetsModal();
    if(modal.type==='substitute') return renderSubstituteModal(modal.pos);
    if(modal.type==='team') return renderTeamModal();
    if(modal.type==='teamSetup') return renderTeamSetupModal();
    if(modal.type==='staff') return renderStaffModal(modal.staffId);
    if(modal.type==='document') return renderDocumentModal();
    if(modal.type==='createTeam') return renderCreateTeamModal();
    if(modal.type==='settings') return renderSettingsModal();
    if(modal.type==='notifications') return renderNotificationsModal();
    return '';
  }
  function modalShell(title,body,actions=''){
    return `<div class="modal-backdrop" id="modalBackdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" id="modalClose" aria-label="Close">×</button></div>${body}${actions}</div></div>`;
  }
  function renderDevelopmentModal(playerId){
    const p=player(playerId);if(!p)return '';
    const d=developmentProfile(playerId);const recs=recommendedDrillsFor(playerId);
    return modalShell(`Development · ${fullName(p)}`,`<div class="notice" style="margin-bottom:12px"><strong>Coach-only.</strong> Use this to guide instruction, not to create a public ranking of children.</div><form id="developmentForm"><div class="development-skills">${developmentSkills().map(sk=>`<div class="field"><label>${esc(sk.label)}</label><select name="skill_${sk.key}">${DEVELOPMENT_STAGES.map(st=>`<option value="${st.value}" ${d.skills?.[sk.key]===st.value?'selected':''}>${st.label}</option>`).join('')}</select></div>`).join('')}</div><div class="field" style="margin-top:12px"><label>Development goals · one per line</label><textarea name="goals" placeholder="Move feet toward throwing target&#10;Track fly balls with a drop step">${esc((d.goals||[]).join('\n'))}</textarea></div><div class="field" style="margin-top:12px"><label>Coach notes</label><textarea name="dev_notes" placeholder="Private observations and what to reinforce next practice.">${esc(d.notes||'')}</textarea></div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Save development</button></div></form>${recs.length?`<div class="separator"></div><div><h3 style="margin:0 0 4px">Suggested practice work</h3><div class="card-sub" style="margin-bottom:10px">Based on skills marked Learning or Developing.</div><div class="dev-recommendations">${recs.map(dr=>`<div class="dev-rec"><div><strong>${esc(dr.title)}</strong><span>${esc(dr.focus)}</span></div><button class="secondary-btn small-btn" data-dev-add-drill="${dr.id}">＋ Practice</button></div>`).join('')}</div></div>`:''}`);
  }
  function renderBalanceModal(){
    const pr=balanceProposal;if(!pr)return '';
    const beforeCounts=pr.poolIds.map(id=>pr.before[id]||0);const afterCounts=pr.poolIds.map(id=>pr.after[id]||0);
    const beforeMin=beforeCounts.length?Math.min(...beforeCounts):0,beforeMax=beforeCounts.length?Math.max(...beforeCounts):0;
    const afterMin=afterCounts.length?Math.min(...afterCounts):0,afterMax=afterCounts.length?Math.max(...afterCounts):0;
    return modalShell(`Suggested ${periodSingular()} ${pr.targetPeriod}`,`<div class="notice"><strong>Coach-reviewed suggestion.</strong> Nothing changes until you tap Apply. The assistant prioritizes players with fewer active periods and positions already listed on their roster profile. Sport-specific eligibility restrictions are only enforced when the selected rule-set adapter explicitly supports them.</div><div class="balance-kpis"><div><span>Before range</span><strong>${beforeMin}–${beforeMax}</strong></div><div><span>Projected range</span><strong>${afterMin}–${afterMax}</strong></div><div><span>Bench</span><strong>${pr.benchIds.length}</strong></div></div>${pr.warnings.length?`<div class="notice balance-warning"><strong>Review needed:</strong><ul>${pr.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<div class="balance-grid">${pr.slots.map(slot=>{const p=player(pr.assignments[slot.key]);const listed=p?listedPositions(p).has(slot.roleCode):false;return `<div><b>${esc(slot.key)}</b><span>${p?`#${esc(p.number)} ${esc(fullName(p))}`:'Open'}</span><small>${p?(listed?esc(slotLabel(slot)):`Outside listed ${esc(slotLabel(slot))}`):'Needs assignment'}</small></div>`;}).join('')}</div><div class="separator"></div><div><h3 style="margin:0 0 7px">Projected bench</h3><div class="bench-list">${pr.benchIds.length?pr.benchIds.map(id=>{const p=player(id);return p?`<span class="player-chip"><span class="num">#${esc(p.number)}</span>${esc(fullName(p))}</span>`:'';}).join(''):`<span class="card-sub">No bench players.</span>`}</div></div><div class="modal-actions"><button class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn" id="applyBalanceProposal">Apply to ${periodSingular()} ${pr.targetPeriod}</button></div>`);
  }

  function renderLineupCardModal(){
    const order=sportCapability('sequenceOrder')?state.sequenceOrder.map(player).filter(Boolean):[];
    const orderSection=sportCapability('sequenceOrder')?`<section><h3>${esc(sportDef().sequence?.label||'Order')}</h3><ol class="print-batting">${order.map(p=>`<li><b>#${esc(p.number)}</b> ${esc(fullName(p))} <span>${esc(p.primary||'')}</span></li>`).join('')}</ol></section>`:'';
    return modalShell('Coach lineup card',`<div class="print-sheet"><div class="print-head"><div><div class="eyebrow">Team APP · ${esc(sportDef().name)}</div><h2>${esc(team().name)}</h2><p>${esc(team().season)} · ${esc(team().ruleSet)}</p></div><div class="print-badge">${esc(sportDef().emoji)}</div></div><div class="print-columns ${sportCapability('sequenceOrder')?'':'single'}">${orderSection}<section><h3>${esc(unitLabel())} plan · ${esc(periodPlural())}</h3><div class="table-scroll print-table-wrap"><table class="rotation-table print-rotation"><thead><tr><th>Player</th>${Array.from({length:state.periodCount},(_,i)=>`<th>${i+1}</th>`).join('')}</tr></thead><tbody>${activePlayers().map(p=>`<tr><td><strong>#${esc(p.number)} ${esc(fullName(p))}</strong></td>${Array.from({length:state.periodCount},(_,i)=>`<td>${esc(positionForPlayer(i+1,p.id)||'Bench')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section></div><div class="print-footer">Generated from Team APP · Coach working copy</div></div><div class="modal-actions no-print"><button class="secondary-btn" id="cancelModal">Close</button><button class="primary-btn" id="printLineupNow">Print / Save PDF</button></div>`);
  }

  function renderPlayerModal(id){
    const p=id?player(id):{first:'',last:'',number:'',primary:'',secondary:'',throws:'R',bats:'R',status:'active',attendance:'yes',notes:''};
    const baseballFields=sportCapability('pitchTracking')?`<div class="field"><label>Throws</label><select name="throws"><option ${p.throws==='R'?'selected':''} value="R">Right</option><option ${p.throws==='L'?'selected':''} value="L">Left</option></select></div><div class="field"><label>Bats</label><select name="bats"><option ${p.bats==='R'?'selected':''} value="R">Right</option><option ${p.bats==='L'?'selected':''} value="L">Left</option><option ${p.bats==='S'?'selected':''} value="S">Switch</option></select></div><div class="field"><label>League age</label><input name="leagueAge" type="number" min="4" max="18" inputmode="numeric" value="${p.leagueAge??''}" placeholder="10"><small>Used only for age-specific pitching/rule guidance.</small></div>`:'';
    return modalShell(id?'Edit player':'Add player',`<form id="playerForm"><div class="form-grid two">
      <div class="field"><label>First name</label><input name="first" required value="${esc(p.first)}"></div>
      <div class="field"><label>Last name</label><input name="last" required value="${esc(p.last)}"></div>
      <div class="field"><label>Jersey #</label><input name="number" inputmode="numeric" value="${esc(p.number)}"></div>
      <div class="field"><label>Primary position</label><select name="primary"><option value="">Unassigned</option>${sportPositionOptions().map(x=>`<option value="${esc(x)}" ${p.primary===x?'selected':''}>${esc(x)} · ${esc(positionName(x))}</option>`).join('')}</select></div>
      <div class="field"><label>Secondary positions</label><input name="secondary" placeholder="${esc(sportPositions().slice(0,2).join(', '))}" value="${esc(p.secondary)}"></div>
      <div class="field"><label>Availability</label><select name="attendance"><option value="yes" ${p.attendance==='yes'?'selected':''}>Attending</option><option value="maybe" ${p.attendance==='maybe'?'selected':''}>Maybe</option><option value="no" ${p.attendance==='no'?'selected':''}>Unavailable</option><option value="unknown" ${!['yes','maybe','no'].includes(p.attendance)?'selected':''}>No response</option></select></div>
      ${baseballFields}
      <div class="field" style="grid-column:1/-1"><label>Coach-only notes</label><textarea name="notes" placeholder="Development focus, position considerations, etc.">${esc(p.notes)}</textarea></div>
    </div><div class="modal-actions">${id?`<button type="button" class="danger-btn" data-delete-player="${id}">Deactivate</button>`:''}<button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn" type="submit">Save player</button></div></form>`);
  }

  function renderPracticeModal(){
    const categories=[...new Set(['Warm-up','Technical','Offense','Defense','Position','Team','Game','Fun / Competition',...(sportDef().practiceTemplate||[]).map(x=>x[2])])];
    return modalShell('Add practice activity',`<form id="practiceForm"><div class="form-grid"><div class="field"><label>Activity</label><input name="title" required placeholder="Skill or team activity"></div><div class="field"><label>Minutes</label><input name="minutes" type="number" min="1" max="180" required value="10"></div><div class="field"><label>Category</label><select name="category">${categories.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Add activity</button></div></form>`);
  }

  function localDateValue(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
  function dateOffsetValue(days=0){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+Number(days||0));return localDateValue(d);}
  function renderEventModal(id){
    const home=team().homeLocation||{};const e=id?state.events.find(x=>x.id===id):{type:'Practice',title:'',date:localDateValue(),start:'18:00',end:'19:30',venue:home.name||'',outdoor:true,lat:home.lat??null,lon:home.lon??null,notes:''};
    return modalShell(id?'Edit event':'Add event',`<form id="eventForm"><div class="form-grid two">
      <div class="field"><label>Type</label><select name="type"><option ${e.type==='Practice'?'selected':''}>Practice</option><option ${e.type==='Game'?'selected':''}>Game</option><option ${e.type==='Meeting'?'selected':''}>Meeting</option><option ${e.type==='Tournament'?'selected':''}>Tournament</option></select></div>
      <div class="field"><label>Title</label><input name="title" required value="${esc(e.title)}" placeholder="Practice"></div>
      <div class="field"><label>Date</label><input type="date" name="date" required value="${esc(e.date)}"></div>
      <div class="field"><label>Venue</label><input name="venue" value="${esc(e.venue)}" placeholder="Field 2"></div>
      <div class="field"><label>Start</label><input type="time" name="start" required value="${esc(e.start)}"></div>
      <div class="field"><label>End</label><input type="time" name="end" required value="${esc(e.end)}"></div>
      <div class="field"><label>Latitude</label><input name="lat" inputmode="decimal" value="${e.lat??''}" placeholder="Optional"></div>
      <div class="field"><label>Longitude</label><input name="lon" inputmode="decimal" value="${e.lon??''}" placeholder="Optional"></div>
      <div class="field"><label>Event setting</label><select name="outdoor"><option value="true" ${e.outdoor?'selected':''}>Outdoor</option><option value="false" ${!e.outdoor?'selected':''}>Indoor</option></select></div>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${esc(e.notes)}</textarea></div>
    </div><div class="modal-actions">${id?`<button type="button" class="danger-btn" data-delete-event="${id}">Delete</button>`:''}<button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Save event</button></div></form>`);
  }
  function renderLessonModal(pos){
    const l=sportLessons()[pos];if(!l)return modalShell(`${pos} · ${positionName(pos)}`,`<div class="empty-state"><strong>Lesson content pending review</strong>The position is standardized in the sport registry, but instructional content has not been published for this sport yet.</div><div class="modal-actions"><button class="primary-btn" id="cancelModal">Done</button></div>`);
    return modalShell(`${pos} · ${l.title}`,`<div class="lesson-body"><div class="lesson-section"><h4>Where they play</h4><p>${esc(l.where)}</p></div><div class="lesson-section"><h4>Primary responsibilities</h4><ul>${l.responsibilities.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="lesson-section"><h4>Key skills</h4><ul>${l.skills.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="notice"><strong>Beginner cue:</strong> ${esc(l.tip)}</div></div><div class="modal-actions"><button class="primary-btn" id="cancelModal">Done</button></div>`);
  }
  function renderDrillModal(drillId){
    const d=sportDrills().find(x=>x.id===drillId);if(!d)return '';
    return modalShell(d.title,`<div class="lesson-body"><div class="lesson-section"><h4>Focus</h4><p>${esc(d.focus)}</p></div><div class="lesson-section"><h4>Equipment</h4><p>${esc(d.equipment)}</p></div><div class="lesson-section"><h4>How to run it</h4><ol class="drill-steps">${d.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div><div class="notice"><strong>Suggested block:</strong> ${d.minutes} minutes. Adjust for age, roster size and available coaches.</div></div><div class="modal-actions"><button class="secondary-btn" id="cancelModal">Close</button><button class="primary-btn" data-modal-add-drill="${d.id}">＋ Add to practice</button></div>`);
  }
  function renderPresetsModal(){
    const key=currentUnitKey();const presets=(state.lineupPresets||[]).filter(pr=>(pr.unitKey||defaultUnitKey())===key);
    return modalShell('Lineup presets',`<div class="eyebrow" style="margin-bottom:8px">${esc(unitLabel(key))}</div><form id="presetForm"><div class="field"><label>Save ${periodSingular()} ${currentPeriod} as a preset</label><div class="inline-form"><input name="name" required placeholder="Standard alignment"><button class="primary-btn">Save</button></div></div></form><div class="separator"></div>${presets.length?`<div class="preset-list">${presets.map(pr=>`<div class="preset-row"><div><strong>${esc(pr.name)}</strong><span>${Object.values(pr.assignments||{}).filter(Boolean).length} slots saved</span></div><div><button class="secondary-btn small-btn" data-apply-preset="${pr.id}">Apply</button><button class="danger-btn small-btn" data-delete-preset="${pr.id}">Delete</button></div></div>`).join('')}</div>`:`<div class="empty-state"><strong>No ${esc(unitLabel(key).toLowerCase())} presets yet</strong>Save an alignment you use often, then apply it to any ${periodSingular()} with one tap.</div>`}<div class="modal-actions"><button class="primary-btn" id="cancelModal">Done</button></div>`);
  }

  function renderSubstituteModal(pos){
    const g=gameSession();if(!g)return '';
    const a=gameAssignments(g)?.[g.currentPeriod]||{};const current=player(a[pos]);const assignedMap={};Object.keys(a).forEach(p=>{if(a[p])assignedMap[a[p]]=p;});
    const choices=activePlayers().filter(p=>(g.attendance?.[p.id]||'pending')!=='out'&&p.id!==current?.id);
    const activeSlot=gameLayoutDef(g)?.slotMap?.[pos];return modalShell(`Quick substitution · ${activeSlot?slotLabel(activeSlot,true):pos}`,`<div class="notice" style="margin-bottom:12px"><strong>${esc(unitLabel(g.activeUnitKey))} · ${periodLabel(g.currentPeriod)} only.</strong> This changes the event lineup, not the master Lineup Studio plan.</div><div class="sub-current"><span>Current</span><strong>${current?`#${esc(current.number)} ${esc(fullName(current))}`:'Open position'}</strong></div><div class="sub-choice-list">${choices.map(p=>{const other=assignedMap[p.id];const st=g.attendance?.[p.id]||'pending';return `<button data-game-sub="${p.id}" class="sub-choice"><div><strong>#${esc(p.number)} ${esc(fullName(p))}</strong><span>${other?`Currently ${esc(other)} · will swap`:'Bench / unassigned'} · ${st==='present'?'Present':'Pending'}</span></div><b>${esc(p.primary||'—')}</b></button>`;}).join('')||`<div class="empty-state"><strong>No available replacements</strong>Check players in or update the roster first.</div>`}</div><div class="modal-actions"><button class="secondary-btn" id="cancelModal">Cancel</button></div>`);
  }

  function renderTeamModal(){
    const teamRows=state.teams.map(x=>{const sp=sportByKey(sportKey(x));const c=state.teamContexts?.[x.id];return `<button type="button" class="team-choice ${x.id===state.currentTeamId?'active':''}" data-switch-team="${esc(x.id)}"><span class="team-choice-icon">${x.branding?.logoDataUrl?`<img src="${esc(x.branding.logoDataUrl)}" alt="">`:esc(sp.emoji)}</span><span><strong>${esc(x.name)}</strong><small>${esc(sp.name)} · ${esc(x.season)} · ${esc(x.division||x.ageGroup||'Division not set')} · ${c?.players?.filter(p=>p.status==='active').length||0} players</small></span><b>${x.id===state.currentTeamId?'Current':'Switch'}</b></button>`;}).join('');
    return modalShell('My teams',`<div class="team-choice-list">${teamRows}</div><div class="modal-actions"><button class="secondary-btn" id="cancelModal">Close</button><button class="secondary-btn" id="manageCurrentTeamBtn">Manage current</button><button class="primary-btn" id="createTeamBtn">＋ New team</button></div>`);
  }
  function renderCreateTeamModal(){
    const sports=Object.values(SPORTS);
    return modalShell('Create a team',`<form id="createTeamForm"><div class="form-grid"><div class="field"><label>Sport</label><select name="sportKey" required>${sports.map(sp=>`<option value="${esc(sp.key)}">${esc(sp.emoji)} ${esc(sp.name)}</option>`).join('')}</select></div><div class="field"><label>Team name</label><input name="name" required placeholder="Red Lightning"></div><div class="field"><label>Season</label><input name="season" required value="${new Date().getFullYear()} Season" placeholder="${new Date().getFullYear()} Season"></div></div><div class="notice" style="margin-top:12px"><strong>Next:</strong> after creating the team, Team APP opens the full Coach Setup screen for age/division, league, rule source, location, colors, icon and staff.</div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Create & continue setup</button></div></form>`);
  }
  function renderTeamSetupModal(){
    const t=team(),cfg=competitionSport(),profile=competitionProfile(t),leagues=cfg.leagues||[];
    const leagueOptions=leagues.map(l=>`<option value="${esc(l.key)}" ${t.leagueKey===l.key?'selected':''}>${esc(l.name)}</option>`).join('');
    const profileOptions=leagues.map(l=>`<optgroup label="${esc(l.name)}">${(l.profiles||[]).map(p=>`<option value="${esc(p.key)}" ${t.competitionProfileId===p.key?'selected':''}>${esc(p.label)}</option>`).join('')}</optgroup>`).join('');
    const layoutFields=sportUnits().map(u=>u.layouts?.length>1?`<div class="field"><label>Default ${esc(u.label)} layout</label><select name="layout_${esc(u.key)}">${u.layouts.map(l=>`<option value="${esc(l.key)}" ${teamDefaultLayoutKey(u.key,t)===l.key?'selected':''}>${esc(l.label)}</option>`).join('')}</select></div>`:'').join('');
    const loc=t.homeLocation||{},brand=t.branding||normalizeBranding({});
    return modalShell('Team setup',`<form id="teamSetupForm"><div class="setup-section"><div class="eyebrow">1 · Team identity</div><div class="form-grid"><div class="field"><label>Sport</label><input value="${esc(sportDef().emoji)} ${esc(sportDef().name)}" disabled></div><div class="field"><label>Team name</label><input name="name" required value="${esc(t.name)}"></div><div class="field"><label>Short name / abbreviation</label><input name="shortName" maxlength="20" value="${esc(t.shortName||'')}" placeholder="Red Lightning"></div><div class="field"><label>Season</label><input name="season" required value="${esc(t.season)}"></div></div></div>
      <div class="setup-section"><div class="eyebrow">2 · League, age & rules</div><div class="form-grid"><div class="field"><label>League type / governing program</label><select name="leagueKey">${leagueOptions}</select></div><div class="field"><label>League / organization name</label><input name="leagueName" value="${esc(t.leagueName||'')}" placeholder="Greeneville Parks & Recreation"></div><div class="field span-2"><label>Official age/division profile</label><select name="competitionProfileId"><option value="">Custom / local division</option>${profileOptions}</select><small>Select the closest official profile, then use the custom fields/local notes for your league.</small></div><div class="field"><label>Age group</label><input name="ageGroup" value="${esc(t.ageGroup||profile?.ageLabel||'')}" placeholder="8U / Ages 7–8"></div><div class="field"><label>Division</label><input name="division" value="${esc(t.division||profile?.division||'')}" placeholder="Coach Pitch / Major / Varsity"></div><div class="field span-2"><label>Official rule source URL</label><input name="ruleSourceUrl" type="url" value="${esc(t.ruleSourceUrl||profile?.sourceUrl||'')}" placeholder="https://..."></div><div class="field span-2"><label>Local rules / overrides</label><textarea name="localRulesNote" placeholder="Example: 5-run limit per inning, no stealing home, 90-minute game limit...">${esc(t.localRulesNote||'')}</textarea></div><div class="field"><label>Game format</label><input name="ruleFormat" value="${esc(t.localRuleDetails?.format||'')}" placeholder="6 innings / 7v7 / 4 quarters"></div><div class="field"><label>Time / period limit</label><input name="ruleDuration" value="${esc(t.localRuleDetails?.duration||'')}" placeholder="90 minutes / 4 × 8 min"></div><div class="field"><label>Participation / substitutions</label><input name="ruleParticipation" value="${esc(t.localRuleDetails?.participation||'')}" placeholder="Continuous batting / minimum play"></div><div class="field"><label>Scoring limits</label><input name="ruleScoring" value="${esc(t.localRuleDetails?.scoring||'')}" placeholder="5-run cap / rally scoring"></div><div class="field span-2"><label>Safety / equipment notes</label><input name="ruleSafety" value="${esc(t.localRuleDetails?.safety||'')}" placeholder="League-specific safety/equipment restriction"></div></div><div class="notice compact"><strong>Rule hierarchy:</strong> Team APP keeps the official source and your local overrides separate. Always use the league-issued rulebook/handout as the final authority for your team.</div></div>
      <div class="setup-section"><div class="eyebrow">3 · Home location & weather</div><div class="form-grid"><div class="field"><label>Facility / park</label><input name="locationName" value="${esc(loc.name||'')}" placeholder="Hardin Park"></div><div class="field"><label>Street address</label><input name="address" value="${esc(loc.address||'')}" placeholder="123 Field Rd"></div><div class="field"><label>City</label><input name="city" value="${esc(loc.city||'')}"></div><div class="field"><label>State</label><input name="stateCode" maxlength="30" value="${esc(loc.state||'')}" placeholder="TN"></div><div class="field"><label>ZIP</label><input name="zip" value="${esc(loc.zip||'')}"></div><div class="field"><label>Time zone</label><input name="timezone" value="${esc(loc.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC')}" placeholder="America/New_York"></div><div class="field"><label>Coordinates</label><div class="inline-form"><input name="lat" inputmode="decimal" value="${loc.lat??''}" placeholder="Lat"><input name="lon" inputmode="decimal" value="${loc.lon??''}" placeholder="Lon"></div></div></div></div>
      <div class="setup-section"><div class="eyebrow">4 · Branding & defaults</div><div class="form-grid"><div class="field"><label>Primary color</label><input name="primaryColor" type="color" value="${esc(brand.primaryColor)}"></div><div class="field"><label>Secondary color</label><input name="secondaryColor" type="color" value="${esc(brand.secondaryColor)}"></div>${layoutFields}</div><div class="card-sub" style="margin-top:8px">Upload or replace the team/mascot icon from Coach Center after saving.</div></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Save team setup</button></div></form>`);
  }
  function renderStaffModal(staffId){
    const x=(team().staff||[]).find(s=>s.id===staffId)||{name:'',role:'Assistant Coach',email:'',phone:''};
    return modalShell(staffId?'Edit staff member':'Add staff member',`<form id="staffForm"><div class="form-grid"><div class="field span-2"><label>Name</label><input name="name" required value="${esc(x.name)}" placeholder="Coach name"></div><div class="field"><label>Role</label><select name="role">${['Head Coach','Assistant Coach','Team Manager','Volunteer Coach','Scorekeeper'].map(r=>`<option ${x.role===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Email</label><input name="email" type="email" value="${esc(x.email||'')}"></div><div class="field"><label>Phone</label><input name="phone" type="tel" value="${esc(x.phone||'')}"></div></div><div class="modal-actions">${staffId?`<button type="button" class="danger-btn" data-delete-staff="${esc(staffId)}">Remove</button>`:''}<button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Save staff</button></div></form>`);
  }
  function renderDocumentModal(){
    return modalShell('Upload team document',`<form id="documentForm"><div class="field"><label>File</label><input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"></div><div class="form-grid"><div class="field"><label>Category</label><select name="category"><option>League Rules</option><option>Team Handbook</option><option>Schedule</option><option>Forms</option><option>Practice Resource</option><option>Medical / Safety</option><option selected>General</option></select></div><div class="field"><label>Share with</label><select name="visibility"><option value="team">Entire team</option><option value="guardians">Guardians</option><option value="coaches">Coaches only</option></select></div><div class="field span-2"><label>Description</label><textarea name="description" placeholder="What is this document for?"></textarea></div></div><div class="notice compact"><strong>Document storage:</strong> unpublished teams keep file bytes on this device. Published teams upload through the secure team document service. The current Neon staging path allows files up to 5 MB; larger media belongs in private object storage.</div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancel</button><button class="primary-btn">Upload & share</button></div></form>`);
  }


  function renderSettingsModal(){
    const shared=['roster','availability','schedule','weather','practice','development','learning','lineupSurface','rotationPlanning','gameDay','attendance','score','substitutions'];
    const sportCards=Object.values(SPORTS).map(sp=>{const enabled=shared.filter(k=>sp.capabilities?.[k]).length;return `<div class="sport-architecture-card ${sp.key===sportKey(team())?'active':''}"><div class="sport-architecture-head"><span>${esc(sp.emoji)}</span><div><strong>${esc(sp.name)}</strong><small>${esc(sp.surface)} · ${(sp.allPositions||sp.positions).length} roles · ${sp.units?.reduce((n,u)=>n+(u.layouts?.length||0),0)||0} layouts · ${sp.units?.length||1} unit${(sp.units?.length||1)===1?'':'s'} · ${sp.defaultPeriods} ${esc(sp.period.plural)}</small></div></div><div class="capability-chips"><span>${enabled}/${shared.length} shared modules</span>${sp.capabilities.sequenceOrder?'<span>ordered lineup</span>':''}${sp.capabilities.pitchTracking?'<span>pitch tracking</span>':''}${sp.capabilities.multiUnit?'<span>multi-unit adapter</span>':''}</div></div>`;}).join('');
    const modules=[['Roster','Ready'],['Lineup surface engine','Ready'],['Rotation planning','Ready'],['Practice planner','Ready'],['Schedule + weather','Ready'],['Position registry','Ready'],['Player development','Ready'],['Game Day core','Ready'],['Attendance check-in','Ready'],['Score state','Ready'],['Quick substitutions','Ready'],['Sport capability registry','Ready'],['6 sport templates','Ready'],['Multi-team isolated workspaces','Ready'],['Automated registry tests','Ready'],['Formation/layout engine','Ready'],['Shared sport runtime','Ready'],['Team default layouts','Ready'],['Layout chaos tests','Ready'],['Secure messaging','Encrypted · key recovery pending'],['Forms + documents','Ready'],['Guardian accounts','Ready'],['Cloud sync','Ready'],['Notification preferences','Ready'],['Closed-app Web Push','Pending worker'],['Age/division rules','Ready']];
    return modalShell('Coach admin',`<div class="grid"><div class="card" style="box-shadow:none"><div class="card-title-row"><div><h3>Shared Team APP modules</h3><div class="card-sub">Baseball is the first complete content adapter; shared engines are being standardized for every sport.</div></div></div><div class="roster-list">${modules.map(([x,st])=>`<div class="player-row"><div class="avatar">${st==='Ready'?'✓':'→'}</div><div class="player-main"><div class="player-name">${esc(x)}</div><div class="player-meta">${esc(st)}</div></div></div>`).join('')}</div></div><section class="card" style="box-shadow:none"><div class="card-title-row"><div><h3>Sport architecture registry</h3><div class="card-sub">One shared data contract; sport-specific positions, surface, periods and capabilities.</div></div></div><div class="sport-architecture-grid">${sportCards}</div><div class="notice" style="margin-top:12px"><strong>Important:</strong> A registered template means the shared engines understand its structure. Baseball remains the first sport with fully reviewed drills/lessons/Game Day special rules. Other sports will receive their own reviewed content adapters instead of reusing baseball content blindly.</div></section><button class="danger-btn" id="resetApp">Reset demo app data</button></div><div class="modal-actions"><button class="primary-btn" id="cancelModal">Done</button></div>`);
  }

  function renderNotificationsModal(){
    return modalShell('Notifications',`<div class="empty-state"><strong>Notification preferences are available</strong>Signed-in team members can control message, schedule, weather, document and form notification preferences. In-app notification records are supported; closed-app Web Push still requires the production push worker/VAPID deployment.</div><div class="modal-actions"><button class="primary-btn" id="cancelModal">Done</button></div>`);
  }

  function bindCommon(){
    document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
    document.querySelectorAll('[data-open-game]').forEach(b=>b.addEventListener('click',()=>{state.activeGameEventId=b.dataset.openGame;ensureGameSession(state.activeGameEventId);save();navigate('gameday');}));
    document.getElementById('teamSwitcher')?.addEventListener('click',()=>openModal({type:'team'}));
    document.getElementById('gameDayBtn')?.addEventListener('click',()=>navigate('gameday'));
    document.getElementById('settingsBtn')?.addEventListener('click',()=>navigate('coach'));
    document.getElementById('notificationsBtn')?.addEventListener('click',()=>openModal({type:'notifications'}));
    window.TeamAppCloud?.bindUI?.();
    document.querySelectorAll('[data-edit-player]').forEach(b=>b.addEventListener('click',()=>openModal({type:'player',playerId:b.dataset.editPlayer})));
    document.querySelectorAll('[data-dev-player]').forEach(b=>b.addEventListener('click',()=>openModal({type:'development',playerId:b.dataset.devPlayer})));
    document.getElementById('dismissDemo')?.addEventListener('click',()=>{state.settings.showDemoNotice=false;save();render();});
  }
  function bindView(){
    if(currentView==='coach') bindCoachCenter();
    if(currentView==='roster') bindRoster();
    if(currentView==='lineup') bindLineup();
    if(currentView==='gameday') bindGameDay();
    if(currentView==='practice') bindPractice();
    if(currentView==='schedule') bindSchedule();
    if(currentView==='learn') bindLearn();
  }
  function bindCoachCenter(){
    document.getElementById('editTeamSetupBtn')?.addEventListener('click',()=>openModal({type:'teamSetup'}));
    document.getElementById('editRulesBtn')?.addEventListener('click',()=>openModal({type:'teamSetup'}));
    document.getElementById('uploadLogoBtn')?.addEventListener('click',()=>document.getElementById('teamLogoInput')?.click());
    document.getElementById('teamLogoInput')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)processTeamLogo(file);});
    document.getElementById('addStaffBtn')?.addEventListener('click',()=>openModal({type:'staff'}));
    document.querySelectorAll('[data-edit-staff]').forEach(b=>b.addEventListener('click',()=>openModal({type:'staff',staffId:b.dataset.editStaff})));
    document.getElementById('uploadDocumentBtn')?.addEventListener('click',()=>openModal({type:'document'}));
    document.querySelectorAll('[data-download-doc]').forEach(b=>b.addEventListener('click',()=>downloadTeamDocument(b.dataset.downloadDoc)));
    document.querySelectorAll('[data-delete-doc]').forEach(b=>b.addEventListener('click',()=>deleteTeamDocument(b.dataset.deleteDoc)));
    document.getElementById('useTeamLocationBtn')?.addEventListener('click',useTeamDeviceLocation);
  }
  function bindRoster(){document.getElementById('addPlayerBtn')?.addEventListener('click',()=>openModal({type:'player'}));}
  function bindGameDay(){
    document.querySelectorAll('[data-game-action]').forEach(b=>b.addEventListener('click',()=>handleGameAction(b.dataset.gameAction)));
    document.querySelectorAll('[data-score-side]').forEach(b=>b.addEventListener('click',()=>adjustScoreQuick(b.dataset.scoreSide,Number(b.dataset.scoreValue))));
    document.querySelectorAll('[data-pitch]').forEach(b=>b.addEventListener('click',()=>adjustPitch(Number(b.dataset.pitch))));
    document.querySelectorAll('[data-checkin]').forEach(b=>b.addEventListener('click',()=>{const [id,status]=b.dataset.checkin.split(':');setCheckIn(id,status);}));
    document.querySelectorAll('[data-sub-position]').forEach(b=>b.addEventListener('click',()=>openModal({type:'substitute',pos:b.dataset.subPosition})));
    document.querySelectorAll('[data-game-unit]').forEach(b=>b.addEventListener('click',()=>{const g=gameSession();const key=b.dataset.gameUnit;if(!g||!sportUnits().some(u=>u.key===key))return;pushGameUndo(g,'switch unit');g.activeUnitKey=key;save();render();}));
    document.querySelector('[data-game-layout]')?.addEventListener('change',e=>{const g=gameSession();if(g)applyGameLayout(g,e.target.value);});
    document.getElementById('sunlightToggle')?.addEventListener('click',()=>document.body.classList.toggle('sunlight-mode'));
  }
  function handleGameAction(action){
    const g=gameSession();if(!g)return;
    if(action==='close-game'){state.activeGameEventId=null;save();render();return;}
    if(action==='start'){pushGameUndo(g,'start session');g.active=true;g.startedAt=g.startedAt||new Date().toISOString();g.endedAt=null;save();render();showToast('Game Day started');return;}
    if(action==='end'){if(!confirm('End this Game Day session? The event lineup, check-in and tracked session data stay saved.'))return;pushGameUndo(g,'end session');g.active=false;g.endedAt=new Date().toISOString();save();render();showToast('Session saved');return;}
    if(action==='undo'){const last=g.undo?.pop();if(!last){showToast('Nothing to undo');return;}Object.assign(g,last.state);save();render();showToast(`Undid ${last.label}`);return;}
    if(action==='sync-lineup'){if(g.active&&!confirm('Replace this event\'s saved lineup with the latest Lineup Studio plan? Check-in and sport-specific counters will stay.'))return;pushGameUndo(g,'sync lineup');g.unitAssignments=cloneUnitAssignments();g.unitLayoutKeys=cloneUnitLayoutKeys();g.activeUnitKey=state.activeUnitKey||defaultUnitKey();g.sequenceOrder=[...state.sequenceOrder];g.substitutions=[];save();render();showToast('Event lineup synced');return;}
    pushGameUndo(g,action.replaceAll('-',' '));
    if(action==='prev-period')g.currentPeriod=Math.max(1,g.currentPeriod-1);
    if(action==='next-period')g.currentPeriod=Math.min(Math.max(state.periodCount,1),g.currentPeriod+1);
    if(action==='toggle-half'){const sides=sportDef().sides||[];if(sides.length>1){const i=Math.max(0,sides.indexOf(g.half));g.half=sides[(i+1)%sides.length];}}
    if(action==='score-for-up')adjustGameScore(g,'for',1);
    if(action==='score-for-down')adjustGameScore(g,'for',-1);
    if(action==='score-against-up')adjustGameScore(g,'against',1);
    if(action==='score-against-down')adjustGameScore(g,'against',-1);
    if(action==='next-batter'){const n=(g.sequenceOrder||[]).length;if(n)g.sequenceIndex=(g.sequenceIndex+1)%n;}
    save();render();
  }
  function adjustScoreQuick(side,value){
    const g=gameSession();if(!g||!['for','against'].includes(side)||!Number.isFinite(value)||value<=0)return;
    pushGameUndo(g,`${sportDef().name.toLowerCase()} score +${value}`);adjustGameScore(g,side,value);save();render();
  }
  function adjustPitch(delta){
    const g=gameSession();const p=currentGamePitcher(g);if(!g||!p)return;
    pushGameUndo(g,'pitch count');
    if(!g.pitchesByPeriod[g.currentPeriod])g.pitchesByPeriod[g.currentPeriod]={};
    const before=Number(g.pitchesByPeriod[g.currentPeriod][p.id]||0);
    const after=Math.max(0,before+delta);const actual=after-before;
    g.pitchesByPeriod[g.currentPeriod][p.id]=after;
    g.pitchCounts[p.id]=Math.max(0,Number(g.pitchCounts[p.id]||0)+actual);
    save();render();
  }
  function setCheckIn(playerId,status){
    const g=gameSession();if(!g)return;pushGameUndo(g,'check-in');g.attendance[playerId]=status;save();render();
  }
  function bindLineup(){
    document.getElementById('lineupCardBtn')?.addEventListener('click',()=>openModal({type:'lineupCard'}));
    document.querySelectorAll('[data-lineup-unit]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.lineupUnit;if(!sportUnits().some(u=>u.key===key))return;state.activeUnitKey=key;selectedPlayerId=null;draggedPlayerId=null;save();render();}));
    document.querySelectorAll('[data-lineup-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-lineup-tab]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
      const panel=document.getElementById('lineupPanel');
      panel.innerHTML=btn.dataset.lineupTab==='rotation'?renderRotationPanel():btn.dataset.lineupTab==='sequence'?renderSequencePanel():renderPositionPanel(state.assignments[currentPeriod]||{},activePlayers().filter(p=>!new Set(Object.values(state.assignments[currentPeriod]||{})).has(p.id)));
      bindLineupPanel(btn.dataset.lineupTab);
    }));
    bindLineupPanel('positions');
  }
  function bindLineupPanel(tab){
    if(tab==='positions'){
      document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>{currentPeriod=Number(b.dataset.period);selectedPlayerId=null;rerenderPositions();}));
      document.getElementById('addPeriod')?.addEventListener('click',()=>{state.periodCount+=1;ensurePeriodAcrossUnits(state.periodCount);currentPeriod=state.periodCount;save();rerenderPositions();showToast(`${periodLabel(currentPeriod)} added`);});
      document.getElementById('clearPeriod')?.addEventListener('click',()=>{state.assignments[currentPeriod]={};selectedPlayerId=null;save();rerenderPositions();showToast(`${periodLabel(currentPeriod)} cleared`);});
      document.getElementById('presetsBtn')?.addEventListener('click',()=>openModal({type:'presets'}));
      document.getElementById('layoutSelect')?.addEventListener('change',e=>applyTeamLayout(e.target.value));
      document.getElementById('balanceNextPeriod')?.addEventListener('click',createBalanceProposal);
      document.querySelectorAll('[data-select-player]').forEach(b=>{
        b.addEventListener('click',()=>{selectedPlayerId=selectedPlayerId===b.dataset.selectPlayer?null:b.dataset.selectPlayer;rerenderPositions();});
        b.addEventListener('dragstart',()=>{draggedPlayerId=b.dataset.selectPlayer;});
      });
      document.querySelectorAll('[data-position]').forEach(slot=>{
        slot.addEventListener('click',()=>handlePositionTap(slot.dataset.position,slot.dataset.playerId||null));
        slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('selected-target');});
        slot.addEventListener('dragleave',()=>slot.classList.remove('selected-target'));
        slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('selected-target');const id=draggedPlayerId;draggedPlayerId=null;if(id) assignPlayer(currentPeriod,slot.dataset.position,id);});
        slot.addEventListener('dragstart',()=>{draggedPlayerId=slot.dataset.playerId||null;});
      });
    }
    if(tab==='sequence'){
      document.getElementById('resetSequence')?.addEventListener('click',()=>{state.sequenceOrder=activePlayers().map(p=>p.id);save();document.getElementById('lineupPanel').innerHTML=renderSequencePanel();bindLineupPanel('sequence');});
      document.querySelectorAll('[data-sequence-up]').forEach(b=>b.addEventListener('click',()=>moveSequence(b.dataset.sequenceUp,-1)));
      document.querySelectorAll('[data-sequence-down]').forEach(b=>b.addEventListener('click',()=>moveSequence(b.dataset.sequenceDown,1)));
    }
  }
  function rerenderPositions(){
    const a=state.assignments[currentPeriod]||{};const assigned=new Set(Object.values(a).filter(Boolean));
    const panel=document.getElementById('lineupPanel'); if(!panel)return;
    panel.innerHTML=renderPositionPanel(a,activePlayers().filter(p=>!assigned.has(p.id)));bindLineupPanel('positions');
  }
  function handlePositionTap(pos,occupantId){
    if(selectedPlayerId){assignPlayer(currentPeriod,pos,selectedPlayerId);return;}
    if(occupantId){selectedPlayerId=occupantId;rerenderPositions();showToast(`${fullName(player(occupantId))} selected`);}
    else showToast('Select a player from the bench first');
  }
  function assignPlayer(period,pos,playerId){
    if(!state.assignments[period])state.assignments[period]={};
    const a=state.assignments[period];
    const oldPos=Object.keys(a).find(p=>a[p]===playerId);
    const displaced=a[pos]||null;
    if(oldPos && oldPos!==pos){a[oldPos]=displaced && displaced!==playerId ? displaced : null;}
    a[pos]=playerId;selectedPlayerId=null;save();rerenderPositions();showToast(`${player(playerId)?.first||'Player'} → ${pos}`);
  }
  function moveSequence(id,delta){
    const arr=state.sequenceOrder;const i=arr.indexOf(id);const j=i+delta;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];save();document.getElementById('lineupPanel').innerHTML=renderSequencePanel();bindLineupPanel('sequence');
  }
  function bindPractice(){
    document.getElementById('addPracticeBtn')?.addEventListener('click',()=>openModal({type:'practice'}));
    document.getElementById('loadPracticeTemplate')?.addEventListener('click',()=>{state.practices=sportPracticeTemplate();save();render();showToast(`${sportDef().name} practice template restored`);});
    document.querySelectorAll('[data-remove-practice]').forEach(b=>b.addEventListener('click',()=>{state.practices=state.practices.filter(x=>x.id!==b.dataset.removePractice);save();render();}));
    document.querySelectorAll('[data-drill-detail]').forEach(b=>b.addEventListener('click',()=>openModal({type:'drill',drillId:b.dataset.drillDetail})));
    document.querySelectorAll('[data-add-drill]').forEach(b=>b.addEventListener('click',()=>addDrillToPractice(b.dataset.addDrill,false)));
  }
  function bindSchedule(){
    document.getElementById('addEventBtn')?.addEventListener('click',()=>openModal({type:'event'}));
    document.querySelectorAll('[data-edit-event]').forEach(b=>b.addEventListener('click',()=>openModal({type:'event',eventId:b.dataset.editEvent})));
    document.querySelectorAll('[data-event-location]').forEach(b=>b.addEventListener('click',()=>useDeviceLocation(b.dataset.eventLocation)));
    document.querySelectorAll('[data-weather]').forEach(b=>b.addEventListener('click',()=>loadWeather(b.dataset.weather)));
    document.querySelectorAll('[data-event-availability]').forEach(b=>b.addEventListener('click',()=>{const e=state.events.find(x=>x.id===b.dataset.eventAvailability);window.TeamAppCloud?.openAvailability?.(b.dataset.eventAvailability,e?.title||'Event');}));
  }
  function bindLearn(){
    document.querySelectorAll('[data-learn-unit]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.learnUnit;if(!sportUnits().some(u=>u.key===key))return;state.activeUnitKey=key;save();render();}));
    document.querySelectorAll('[data-lesson]').forEach(b=>b.addEventListener('click',()=>openModal({type:'lesson',pos:b.dataset.lesson})));
    document.getElementById('openSSLesson')?.addEventListener('click',()=>openModal({type:'lesson',pos:'SS'}));
  }
  function bindModal(){
    document.getElementById('modalClose')?.addEventListener('click',closeModal);document.getElementById('cancelModal')?.addEventListener('click',closeModal);
    document.getElementById('modalBackdrop')?.addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});
    document.getElementById('playerForm')?.addEventListener('submit',savePlayerFromForm);
    document.getElementById('developmentForm')?.addEventListener('submit',saveDevelopmentFromForm);
    document.querySelectorAll('[data-dev-add-drill]').forEach(b=>b.addEventListener('click',()=>addDrillToPractice(b.dataset.devAddDrill,false)));
    document.getElementById('applyBalanceProposal')?.addEventListener('click',applyBalanceProposal);
    document.getElementById('printLineupNow')?.addEventListener('click',()=>{document.body.classList.add('printing-lineup');window.print();setTimeout(()=>document.body.classList.remove('printing-lineup'),250);});
    document.getElementById('practiceForm')?.addEventListener('submit',savePracticeFromForm);
    document.getElementById('eventForm')?.addEventListener('submit',saveEventFromForm);
    document.getElementById('teamForm')?.addEventListener('submit',saveTeamFromForm);
    document.getElementById('teamSetupForm')?.addEventListener('submit',saveTeamSetupFromForm);
    document.getElementById('staffForm')?.addEventListener('submit',saveStaffFromForm);
    document.getElementById('documentForm')?.addEventListener('submit',saveDocumentFromForm);
    document.getElementById('createTeamForm')?.addEventListener('submit',createTeamFromForm);
    document.getElementById('createTeamBtn')?.addEventListener('click',()=>openModal({type:'createTeam'}));
    document.getElementById('manageCurrentTeamBtn')?.addEventListener('click',()=>openModal({type:'teamSetup'}));
    document.querySelectorAll('[data-switch-team]').forEach(b=>b.addEventListener('click',()=>switchTeam(b.dataset.switchTeam)));
    document.getElementById('presetForm')?.addEventListener('submit',savePresetFromForm);
    document.querySelectorAll('[data-apply-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.applyPreset)));
    document.querySelectorAll('[data-delete-preset]').forEach(b=>b.addEventListener('click',()=>deletePreset(b.dataset.deletePreset)));
    document.querySelectorAll('[data-game-sub]').forEach(b=>b.addEventListener('click',()=>assignGamePlayer(modal.pos,b.dataset.gameSub)));
    document.querySelectorAll('[data-modal-add-drill]').forEach(b=>b.addEventListener('click',()=>addDrillToPractice(b.dataset.modalAddDrill,true)));
    document.querySelector('[data-delete-player]')?.addEventListener('click',e=>deactivatePlayer(e.currentTarget.dataset.deletePlayer));
    document.querySelector('[data-delete-event]')?.addEventListener('click',e=>deleteEvent(e.currentTarget.dataset.deleteEvent));
    document.querySelector('[data-delete-staff]')?.addEventListener('click',e=>deleteStaff(e.currentTarget.dataset.deleteStaff));
    document.getElementById('resetApp')?.addEventListener('click',()=>{if(confirm('Reset all prototype data to the original demo?')){state=attachContextAccessors(defaultState());save();closeModal();render();showToast('Demo data reset');}});
  }
  function openModal(m){modal=m;render();setTimeout(()=>document.querySelector('.modal input, .modal select, .modal button')?.focus(),0);}
  function closeModal(){modal=null;render();}
  function navigate(view){currentView=view;location.hash=view;window.scrollTo({top:0,behavior:'smooth'});render();}

  function remapAssignmentsForLayout(assignments,oldLayout,newLayout){
    if(typeof CORE.remapAssignmentsForLayout==='function')return CORE.remapAssignmentsForLayout(assignments,oldLayout,newLayout);
    const source=assignments&&typeof assignments==='object'?assignments:{},result={},used=new Set(),oldSlots=oldLayout?.slots||[],newSlots=newLayout?.slots||[];newSlots.forEach(slot=>{const id=source[slot.key];if(id){result[slot.key]=id;used.add(id);}});const pools={};oldSlots.forEach(slot=>{const id=source[slot.key];if(!id||used.has(id))return;(pools[slot.roleCode]||(pools[slot.roleCode]=[])).push(id);});newSlots.forEach(slot=>{if(result[slot.key])return;const pool=pools[slot.roleCode]||[];const id=pool.find(x=>!used.has(x));if(id){result[slot.key]=id;used.add(id);}});return result;
  }

  function applyTeamLayout(layoutKey){
    const unit=unitDef();const layout=unit?.layoutMap?.[layoutKey];if(!layout)return;const c=teamContextFor(state),oldLayout=teamLayoutDef();const remapped=remapAssignmentsForLayout(state.assignments[currentPeriod]||{},oldLayout,layout);c.unitLayoutKeys[currentUnitKey()][currentPeriod]=layoutKey;state.assignments[currentPeriod]=remapped;selectedPlayerId=null;save();render();showToast(`${layout.label} selected for ${periodLabel(currentPeriod).toLowerCase()}`);
  }
  function applyGameLayout(g,layoutKey){
    const unit=unitDef(g.activeUnitKey);const layout=unit?.layoutMap?.[layoutKey];if(!g||!layout)return;pushGameUndo(g,'change layout');const oldLayout=gameLayoutDef(g),remapped=remapAssignmentsForLayout(gameAssignments(g)[g.currentPeriod]||{},oldLayout,layout);g.unitLayoutKeys[g.activeUnitKey]=g.unitLayoutKeys[g.activeUnitKey]||{};g.unitLayoutKeys[g.activeUnitKey][g.currentPeriod]=layoutKey;gameAssignments(g)[g.currentPeriod]=remapped;save();render();showToast(`${layout.label} selected`);
  }

  function savePresetFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const name=f.get('name').trim();if(!name)return;
    state.lineupPresets.push({id:uid('dp'),name,unitKey:currentUnitKey(),layoutKey:teamLayoutKey(),assignments:{...(state.assignments[currentPeriod]||{})}});
    save();modal={type:'presets'};render();showToast('Lineup preset saved');
  }
  function applyPreset(id){
    const pr=(state.lineupPresets||[]).find(x=>x.id===id);if(!pr)return;if((pr.unitKey||defaultUnitKey())!==currentUnitKey()){showToast('Switch to the preset unit first');return;}
    const c=teamContextFor(state);c.unitLayoutKeys[currentUnitKey()][currentPeriod]=unitDef()?.layoutMap?.[pr.layoutKey]?pr.layoutKey:defaultLayoutKey();state.assignments[currentPeriod]={...(pr.assignments||{})};selectedPlayerId=null;save();modal=null;render();showToast(`${pr.name} applied to ${periodLabel(currentPeriod).toLowerCase()}`);
  }
  function deletePreset(id){
    const pr=(state.lineupPresets||[]).find(x=>x.id===id);if(!pr)return;
    if(!confirm(`Delete the "${pr.name}" preset?`))return;
    state.lineupPresets=state.lineupPresets.filter(x=>x.id!==id);save();modal={type:'presets'};render();showToast('Preset deleted');
  }
  function assignGamePlayer(pos,newPlayerId){
    const g=gameSession();if(!g)return;const assignments=gameAssignments(g);const a=assignments?.[g.currentPeriod]||{};
    const displaced=a[pos]||null;const oldPos=Object.keys(a).find(p=>a[p]===newPlayerId);
    if(displaced===newPlayerId){closeModal();return;}
    pushGameUndo(g,`substitution ${pos}`);
    if(oldPos&&oldPos!==pos)a[oldPos]=displaced&&displaced!==newPlayerId?displaced:null;
    a[pos]=newPlayerId;assignments[g.currentPeriod]=a;
    const slot=gameLayoutDef(g)?.slotMap?.[pos];g.substitutions.push({id:uid('sub'),period:g.currentPeriod,unitKey:g.activeUnitKey,layoutKey:gameLayoutKey(g),slotKey:pos,roleCode:slot?.roleCode||pos,pos,from:displaced,to:newPlayerId,at:new Date().toISOString()});
    save();modal=null;render();showToast(`${player(newPlayerId)?.first||'Player'} → ${pos}`);
  }
  function addDrillToPractice(drillId,closeAfter=false){
    const d=sportDrills().find(x=>x.id===drillId);if(!d)return;
    state.practices.push({id:uid('pr'),minutes:d.minutes,title:d.title,category:d.category,sourceDrillId:d.id});
    save();if(closeAfter)modal=null;render();showToast(`${d.title} added to practice`);
  }

  function fieldCountBefore(playerId,targetPeriod){
    let field=0;for(let i=1;i<targetPeriod;i++){const a=state.assignments?.[i]||{};if(Object.values(a).includes(playerId))field++;}return field;
  }
  function createBalanceProposal(){
    const target=currentPeriod+1;const pool=activePlayers().filter(p=>p.attendance!=='no');if(!pool.length){showToast('No available players to build a suggestion');return;}
    ensurePeriodAcrossUnits(target);const slots=layoutSlots(target);const before={};pool.forEach(p=>before[p.id]=fieldCountBefore(p.id,target));const assigned={};const used=new Set();const warnings=[];const restricted=new Set(sportDef().restrictedRotationPositions||[]);
    slots.forEach(slot=>{const roleCode=slot.roleCode;const candidates=pool.filter(p=>!used.has(p.id)).map(p=>{const listed=listedPositions(p);const isListed=listed.has(roleCode);if(restricted.has(roleCode)&&!isListed)return {p,score:Infinity,isListed};const availability=p.attendance==='yes'?0:p.attendance==='maybe'?30:50;const fairness=(before[p.id]||0)*20;const repetition=positionCountBefore(p.id,roleCode,target)*5;const sameRole=positionForPlayer(currentPeriod,p.id)===roleCode?4:0;const primary=String(p.primary||'').toUpperCase()===roleCode?-3:0;const fallback=isListed?0:200;return {p,score:availability+fairness+repetition+sameRole+primary+fallback,isListed};}).filter(x=>Number.isFinite(x.score)).sort((a,b)=>a.score-b.score||String(a.p.number||'').localeCompare(String(b.p.number||''),undefined,{numeric:true}));const choice=candidates[0];if(!choice){assigned[slot.key]=null;warnings.push(`No available player has ${roleCode} (${positionName(roleCode)}) listed as an eligible position.`);return;}assigned[slot.key]=choice.p.id;used.add(choice.p.id);if(!choice.isListed)warnings.push(`${fullName(choice.p)} is proposed at ${slot.key} (${positionName(roleCode)}), outside the positions currently listed on the roster profile.`);});
    const benchIds=pool.filter(p=>!used.has(p.id)).map(p=>p.id);const after={...before};Object.values(assigned).filter(Boolean).forEach(id=>after[id]=(after[id]||0)+1);if(state.assignments?.[target]&&Object.values(state.assignments[target]).some(Boolean))warnings.unshift(`${periodLabel(target)} already has a saved alignment. Applying this suggestion will replace it.`);balanceProposal={targetPeriod:target,layoutKey:teamLayoutKey(target),slots,assignments:assigned,benchIds,poolIds:pool.map(p=>p.id),before,after,warnings};openModal({type:'balance'});
  }


  function applyBalanceProposal(){
    const pr=balanceProposal;if(!pr)return;
    while(state.periodCount<pr.targetPeriod){state.periodCount++;ensurePeriodAcrossUnits(state.periodCount);}
    const c=teamContextFor(state);c.unitLayoutKeys[currentUnitKey()][pr.targetPeriod]=unitDef()?.layoutMap?.[pr.layoutKey]?pr.layoutKey:defaultLayoutKey();state.assignments[pr.targetPeriod]={...(pr.assignments||{})};currentPeriod=pr.targetPeriod;selectedPlayerId=null;
    balanceProposal=null;save();modal=null;render();showToast(`Suggested rotation applied to ${periodLabel(currentPeriod).toLowerCase()}`);
  }
  function saveDevelopmentFromForm(e){
    e.preventDefault();const p=player(modal.playerId);if(!p)return;const f=new FormData(e.currentTarget);const d=developmentProfile(p.id);
    developmentSkills().forEach(sk=>d.skills[sk.key]=String(f.get(`skill_${sk.key}`)||''));
    d.goals=String(f.get('goals')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    d.notes=String(f.get('dev_notes')||'').trim();
    save();modal={type:'development',playerId:p.id};render();showToast('Development profile saved');
  }

  function savePlayerFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const existing=modal.playerId?player(modal.playerId):null;
    const data={id:existing?.id||uid('p'),first:String(f.get('first')||'').trim(),last:String(f.get('last')||'').trim(),number:String(f.get('number')||'').trim(),primary:String(f.get('primary')||''),secondary:String(f.get('secondary')||'').trim(),throws:String(f.get('throws')||existing?.throws||''),bats:String(f.get('bats')||existing?.bats||''),leagueAge:f.get('leagueAge')?Number(f.get('leagueAge')):(existing?.leagueAge??null),status:'active',attendance:String(f.get('attendance')||'unknown'),notes:String(f.get('notes')||'').trim()};
    if(!data.first||!data.last){showToast('First and last name are required');return;}
    const allowed=new Set(sportPositionOptions());if(data.primary&&!allowed.has(data.primary)){showToast('Choose a valid primary position for this sport');return;}
    const secondary=data.secondary.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);const invalid=secondary.filter(x=>!allowed.has(x));if(invalid.length){showToast(`Unknown position: ${invalid[0]}`);return;}
    if(data.number&&activePlayers().some(p=>p.id!==data.id&&String(p.number)===data.number)){showToast(`Jersey #${data.number} is already assigned`);return;}
    data.secondary=secondary.join(', ');
    if(existing)Object.assign(existing,data);else{state.players.push(data);state.sequenceOrder.push(data.id);}
    save();modal=null;render();showToast(existing?'Player updated':'Player added');
  }

  function deactivatePlayer(id){
    const p=player(id);if(!p)return;if(!confirm(`Deactivate ${fullName(p)}? Their historical assignments remain saved.`))return;p.status='inactive';save();modal=null;render();showToast('Player deactivated');
  }
  function savePracticeFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const minutes=Number(f.get('minutes'));const title=String(f.get('title')||'').trim();
    if(!title){showToast('Activity name is required');return;}if(!Number.isFinite(minutes)||minutes<1||minutes>180){showToast('Activity must be 1–180 minutes');return;}
    state.practices.push({id:uid('pr'),minutes,title,category:String(f.get('category')||'Team')});save();modal=null;render();showToast('Practice activity added');
  }
  function saveEventFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const existing=modal.eventId?state.events.find(x=>x.id===modal.eventId):null;
    const rawLat=String(f.get('lat')||'').trim(),rawLon=String(f.get('lon')||'').trim();
    const data={id:existing?.id||uid('e'),type:String(f.get('type')||'Practice'),title:String(f.get('title')||'').trim(),date:String(f.get('date')||''),start:String(f.get('start')||''),end:String(f.get('end')||''),venue:String(f.get('venue')||'').trim(),outdoor:f.get('outdoor')==='true',lat:rawLat===''?null:Number(rawLat),lon:rawLon===''?null:Number(rawLon),notes:String(f.get('notes')||'').trim()};
    if(!data.title||!data.date||!data.start||!data.end){showToast('Title, date, start and end are required');return;}
    if(data.end<=data.start){showToast('Event end time must be after the start time');return;}
    if(data.lat!==null&&(!Number.isFinite(data.lat)||data.lat<-90||data.lat>90)){showToast('Latitude must be between -90 and 90');return;}
    if(data.lon!==null&&(!Number.isFinite(data.lon)||data.lon<-180||data.lon>180)){showToast('Longitude must be between -180 and 180');return;}
    if(existing)Object.assign(existing,data);else state.events.push(data);delete state.weatherCache[data.id];save();modal=null;render();showToast(existing?'Event updated':'Event added');
  }

  function deleteEvent(id){if(!confirm('Delete this event?'))return;state.events=state.events.filter(x=>x.id!==id);delete state.weatherCache[id];delete state.gameSessions[id];if(state.activeGameEventId===id)state.activeGameEventId=null;save();modal=null;render();showToast('Event deleted');}
  function switchTeam(teamId){
    if(!state.teams.some(t=>t.id===teamId))return;state.currentTeamId=teamId;teamContextFor(state,teamId);currentPeriod=1;selectedPlayerId=null;draggedPlayerId=null;balanceProposal=null;modal=null;save();render();showToast(`Switched to ${team().name}`);
  }
  function createTeamFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const key=String(f.get('sportKey')||'');const sp=SPORTS[key];const name=String(f.get('name')||'').trim();const season=String(f.get('season')||'').trim();
    if(!sp){showToast('Choose a supported sport');return;}if(!name||!season){showToast('Team name and season are required');return;}
    const cfg=competitionSport(key),league=cfg.leagues?.at(-1)||cfg.leagues?.[0]||null;const id=uid('team'),defaultLayouts=Object.fromEntries(sp.units.map(u=>[u.key,u.defaultLayoutKey||u.layouts?.[0]?.key||'standard']));
    state.teams.push({id,name,shortName:'',sport:sp.name,sportKey:key,season,ageGroup:'',division:'',leagueKey:league?.key||'recreation',leagueName:league?.name||'Local Recreation League',governingBody:league?.governingBody||'Local league',competitionProfileId:'',ruleSet:'Custom / Recreation',ruleSourceUrl:league?.sourceUrl||'',ruleSourceNote:'',localRulesNote:'',localRuleDetails:normalizeRuleDetails({}),homeLocation:normalizeLocation({}),branding:normalizeBranding({}),staff:[],defaultLayouts,color:'#0f4c3a'});
    state.teamContexts[id]=buildTeamContext(key,{defaultLayouts});state.currentTeamId=id;currentPeriod=1;selectedPlayerId=null;draggedPlayerId=null;balanceProposal=null;save();modal={type:'teamSetup'};render();showToast(`${sp.name} team created — finish setup`);
  }
  function saveTeamFromForm(e){e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get('name')||'').trim(),season=String(f.get('season')||'').trim();if(!name||!season){showToast('Team name and season are required');return;}const defaults={...(team().defaultLayouts||{})};sportUnits().forEach(u=>{const key=String(f.get(`layout_${u.key}`)||defaults[u.key]||u.defaultLayoutKey||'');defaults[u.key]=u.layoutMap?.[key]?key:(u.defaultLayoutKey||u.layouts?.[0]?.key||'standard');});Object.assign(team(),{name,season,ruleSet:String(f.get('ruleSet')||'Custom / Recreation'),defaultLayouts:defaults});save();modal=null;render();showToast('Team settings saved');}

  function saveTeamSetupFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const t=team();const cfg=competitionSport();
    const name=String(f.get('name')||'').trim(),season=String(f.get('season')||'').trim();if(!name||!season){showToast('Team name and season are required');return;}
    const profileId=String(f.get('competitionProfileId')||'');const profile=cfg.profileMap?.[profileId]||null;const chosenLeagueKey=profile?.leagueKey||String(f.get('leagueKey')||t.leagueKey||'recreation');const league=cfg.leagueMap?.[chosenLeagueKey]||null;
    const rawLat=String(f.get('lat')||'').trim(),rawLon=String(f.get('lon')||'').trim();const lat=rawLat===''?null:Number(rawLat),lon=rawLon===''?null:Number(rawLon);if(lat!==null&&(!Number.isFinite(lat)||lat<-90||lat>90)){showToast('Latitude must be between -90 and 90');return;}if(lon!==null&&(!Number.isFinite(lon)||lon<-180||lon>180)){showToast('Longitude must be between -180 and 180');return;}
    const defaults={...(t.defaultLayouts||{})};sportUnits().forEach(u=>{const key=String(f.get(`layout_${u.key}`)||defaults[u.key]||u.defaultLayoutKey||'');defaults[u.key]=u.layoutMap?.[key]?key:(u.defaultLayoutKey||u.layouts?.[0]?.key||'standard');});
    const leagueName=String(f.get('leagueName')||'').trim()||league?.name||'Local league';const ageGroup=String(f.get('ageGroup')||'').trim()||profile?.ageLabel||'';const division=String(f.get('division')||'').trim()||profile?.division||'';const ruleSourceUrl=String(f.get('ruleSourceUrl')||'').trim()||profile?.sourceUrl||league?.sourceUrl||'';
    const requestedTimeZone=String(f.get('timezone')||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC').trim();if(!validTimeZone(requestedTimeZone)){showToast('Enter a valid IANA time zone such as America/New_York');return;}
    Object.assign(t,{name,shortName:String(f.get('shortName')||'').trim(),season,ageGroup,division,leagueKey:chosenLeagueKey,leagueName,governingBody:profile?.governingBody||league?.governingBody||leagueName,competitionProfileId:profileId,ruleSet:profile?.label||division||ageGroup||'Custom / Recreation',ruleSourceUrl,ruleSourceNote:profile?.sourceNote||'',localRulesNote:String(f.get('localRulesNote')||'').trim(),localRuleDetails:normalizeRuleDetails({format:f.get('ruleFormat'),duration:f.get('ruleDuration'),participation:f.get('ruleParticipation'),scoring:f.get('ruleScoring'),safety:f.get('ruleSafety')}),homeLocation:normalizeLocation({name:String(f.get('locationName')||'').trim(),address:String(f.get('address')||'').trim(),city:String(f.get('city')||'').trim(),state:String(f.get('stateCode')||'').trim(),zip:String(f.get('zip')||'').trim(),timezone:requestedTimeZone,lat,lon}),branding:normalizeBranding({...t.branding,primaryColor:String(f.get('primaryColor')||'#0f4c3a'),secondaryColor:String(f.get('secondaryColor')||'#f2c94c')}),defaultLayouts:defaults});t.color=t.branding.primaryColor;
    if(profile?.defaultLayout){const unit=unitDef(defaultUnitKey());if(unit?.layoutMap?.[profile.defaultLayout])t.defaultLayouts[defaultUnitKey()]=profile.defaultLayout;}
    save();modal=null;render();showToast('Team setup saved');
  }
  function saveStaffFromForm(e){e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get('name')||'').trim();if(!name){showToast('Staff name is required');return;}team().staff=team().staff||[];const existing=modal.staffId?team().staff.find(x=>x.id===modal.staffId):null;const data={id:existing?.id||uid('staff'),name,role:String(f.get('role')||'Assistant Coach'),email:String(f.get('email')||'').trim(),phone:String(f.get('phone')||'').trim()};if(existing)Object.assign(existing,data);else team().staff.push(data);save();modal=null;render();showToast(existing?'Staff updated':'Staff added');}
  function deleteStaff(id){const x=(team().staff||[]).find(s=>s.id===id);if(!x)return;if(!confirm(`Remove ${x.name} from coaching staff?`))return;team().staff=team().staff.filter(s=>s.id!==id);save();modal=null;render();showToast('Staff removed');}
  async function saveDocumentFromForm(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const file=f.get('file');if(!(file instanceof File)||!file.size){showToast('Choose a document to upload');return;}const cloudUpload=Boolean(team().remoteId&&window.TeamAppCloud?.session&&window.TeamAppCloud?.uploadDocument);const maxBytes=cloudUpload?5*1024*1024:25*1024*1024;if(file.size>maxBytes){showToast(`Document limit is ${cloudUpload?'5':'25'} MB${cloudUpload?' for the current secure cloud path':''}`);return;}
    const meta={category:String(f.get('category')||'General'),visibility:String(f.get('visibility')||'team'),description:String(f.get('description')||'').trim()};
    try{
      if(cloudUpload){showToast('Uploading secure team document…');const uploaded=await window.TeamAppCloud.uploadDocument(file,meta);state.documents.push(uploaded);save();modal=null;render();showToast('Document shared with team');return;}
      if(!FILE_STORE){showToast('Document storage is unavailable in this browser');return;}const id=uid('doc');showToast('Saving document on this device…');await FILE_STORE.put(team().id,id,file);state.documents.push({id,name:file.name,type:file.type||'application/octet-stream',size:file.size,...meta,uploadedAt:new Date().toISOString(),cloud:false});save();modal=null;render();showToast('Document saved on this device');
    }catch(err){console.error(err);showToast(err?.message||'Could not save this document');}
  }
  async function downloadTeamDocument(id){
    const meta=state.documents.find(d=>d.id===id);if(!meta)return;
    try{if(meta.cloud&&window.TeamAppCloud?.downloadDocument){await window.TeamAppCloud.downloadDocument(id);return;}if(!FILE_STORE){showToast('File bytes are not available on this device');return;}const stored=await FILE_STORE.get(team().id,id);if(!stored?.blob){showToast('File bytes are not available on this device');return;}const url=URL.createObjectURL(stored.blob);const a=document.createElement('a');a.href=url;a.download=stored.name||meta.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(err){console.error(err);showToast(err?.message||'Could not open document');}
  }
  async function deleteTeamDocument(id){
    const meta=state.documents.find(d=>d.id===id);if(!meta)return;if(!confirm(`Delete ${meta.name}?`))return;
    try{if(meta.cloud&&window.TeamAppCloud?.deleteDocument)await window.TeamAppCloud.deleteDocument(id);else if(FILE_STORE)await FILE_STORE.remove(team().id,id);}catch(err){console.error(err);showToast(err?.message||'Could not delete document');return;}state.documents=state.documents.filter(d=>d.id!==id);save();render();showToast('Document deleted');
  }
  async function processTeamLogo(file){if(!file.type.startsWith('image/')){showToast('Choose an image file');return;}if(file.size>10*1024*1024){showToast('Image must be under 10 MB');return;}try{const dataUrl=await resizeImageFile(file,256,256);team().branding=normalizeBranding({...team().branding,logoDataUrl:dataUrl});save();render();showToast('Team icon updated');}catch(err){console.error(err);showToast('Could not process team icon');}}
  function resizeImageFile(file,maxW,maxH){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Invalid image'));img.onload=()=>{let w=img.width,h=img.height;const scale=Math.min(1,maxW/w,maxH/h);w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/webp',0.84));};img.src=reader.result;};reader.readAsDataURL(file);});}
  function useTeamDeviceLocation(){if(!navigator.geolocation){showToast('Location is not supported on this device');return;}showToast('Requesting device location…');navigator.geolocation.getCurrentPosition(pos=>{team().homeLocation=normalizeLocation({...team().homeLocation,lat:Number(pos.coords.latitude.toFixed(5)),lon:Number(pos.coords.longitude.toFixed(5))});save();render();showToast('Team location updated');},()=>showToast('Location permission was not granted'),{enableHighAccuracy:false,timeout:10000});}

  function useDeviceLocation(eventId){
    const e=state.events.find(x=>x.id===eventId);if(!e)return;
    if(!navigator.geolocation){showToast('Location is not supported on this device');return;}
    showToast('Requesting device location…');
    navigator.geolocation.getCurrentPosition(pos=>{e.lat=Number(pos.coords.latitude.toFixed(5));e.lon=Number(pos.coords.longitude.toFixed(5));save();render();showToast('Event weather location updated');},()=>showToast('Location permission was not granted'),{enableHighAccuracy:false,timeout:10000});
  }

  async function loadWeather(eventId){
    const e=state.events.find(x=>x.id===eventId);if(!e)return;
    if(e.lat==null||e.lon==null){showToast('Set a venue location first');return;}
    showToast('Loading NWS forecast…');
    try{
      const pointRes=await fetch(`https://api.weather.gov/points/${e.lat},${e.lon}`,{headers:{Accept:'application/geo+json'}});
      if(!pointRes.ok)throw new Error('Location forecast unavailable');
      const point=await pointRes.json();const hourlyUrl=point?.properties?.forecastHourly;if(!hourlyUrl)throw new Error('Hourly forecast unavailable');
      const hourlyRes=await fetch(hourlyUrl,{headers:{Accept:'application/geo+json'}});if(!hourlyRes.ok)throw new Error('Hourly forecast unavailable');
      const hourly=await hourlyRes.json();
      const start=new Date(`${e.date}T${e.start}:00`),end=new Date(`${e.date}T${e.end}:00`);
      let periods=(hourly?.properties?.periods||[]).filter(p=>{const d=new Date(p.startTime);return d>=new Date(start.getTime()-60*60*1000)&&d<=end;}).slice(0,6);
      if(!periods.length) periods=(hourly?.properties?.periods||[]).slice(0,4);
      const hours=periods.map(p=>({time:new Intl.DateTimeFormat(undefined,{hour:'numeric'}).format(new Date(p.startTime)),temp:p.temperature,precip:p.probabilityOfPrecipitation?.value??0,forecast:p.shortForecast||''}));
      const maxRain=hours.reduce((m,h)=>Math.max(m,Number(h.precip)||0),0);const minTemp=hours.reduce((m,h)=>Math.min(m,Number(h.temp)),Infinity);const maxTemp=hours.reduce((m,h)=>Math.max(m,Number(h.temp)),-Infinity);
      state.weatherCache[eventId]={hours,summary:`${Number.isFinite(minTemp)?minTemp:'—'}–${Number.isFinite(maxTemp)?maxTemp:'—'}° · rain up to ${maxRain}%`,updatedLabel:new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date())};save();render();showToast('Forecast updated');
    }catch(err){console.error(err);showToast('Could not load NWS weather for this location');}
  }

  const cloudRuntime={
    getActiveCloudPayload(){return {teamRecord:JSON.parse(JSON.stringify(team())),context:JSON.parse(JSON.stringify(teamContextFor(state)||{}))};},
    assignRemoteId(localId,remoteId){const t=state.teams.find(x=>x.id===localId);if(t){t.remoteId=remoteId;save();render();}},
    replaceCloudTeams(details){
      if(!Array.isArray(details)||!details.length)return;const localByRemote=new Map(state.teams.filter(t=>t.remoteId).map(t=>[t.remoteId,t]));
      for(const d of details){const mapped=window.TeamAppCloud?.cloudTeamToLocal?.(d)||null;if(!mapped)continue;const existing=localByRemote.get(d.id);if(existing){const oldId=existing.id;Object.assign(existing,mapped,{id:oldId,remoteId:d.id});state.teamContexts[oldId]=normalizeTeamContext(d.state||{},existing);}else{state.teams.push(mapped);state.teamContexts[mapped.id]=normalizeTeamContext(d.state||{},mapped);}}
      const remoteIds=new Set(details.map(d=>d.id));const preferred=state.teams.find(t=>t.remoteId&&remoteIds.has(t.remoteId));if(preferred)state.currentTeamId=preferred.id;save();render();
    },
    replaceOneCloudTeam(d){if(!d?.id)return;const existing=state.teams.find(t=>t.remoteId===d.id);const mapped=window.TeamAppCloud?.cloudTeamToLocal?.(d);if(!mapped)return;if(existing){const id=existing.id;Object.assign(existing,mapped,{id,remoteId:d.id});state.teamContexts[id]=normalizeTeamContext(d.state||{},existing);}else{state.teams.push(mapped);state.teamContexts[mapped.id]=normalizeTeamContext(d.state||{},mapped);}save();render();},
    refresh(){render();},toast:showToast
  };
  window.TeamAppRuntime=cloudRuntime;
  function startCloudModule(){if(window.TeamAppCloud?.start&&!window.__TEAM_APP_CLOUD_STARTED__){window.__TEAM_APP_CLOUD_STARTED__=true;window.TeamAppCloud.start(cloudRuntime).catch(err=>console.error('[Team APP cloud]',err));}}
  window.addEventListener('teamapp:cloud-module-ready',startCloudModule,{once:true});

  if(window.__TEAM_APP_ENABLE_TEST_HOOKS__){
    window.__TEAM_APP_TEST__={
      previewSport(key){
        const sp=SPORTS[key];if(!sp)throw new Error(`Unknown sport ${key}`);
        const defaultLayouts=Object.fromEntries(sp.units.map(u=>[u.key,u.defaultLayoutKey||u.layouts?.[0]?.key||'standard']));Object.assign(team(),{sport:sp.name,sportKey:key,ruleSet:sp.ruleSets?.[0]||'Custom / Recreation',defaultLayouts});
        const fresh=buildTeamContext(key,{defaultLayouts});fresh.events=[{id:'preview-e1',type:'Game',title:`${sp.name} Preview`,date:'2026-09-20',start:'18:00',end:'19:30',venue:'Preview Venue',outdoor:true,lat:null,lon:null,notes:''}];state.teamContexts[state.currentTeamId]=fresh;
        currentPeriod=1;selectedPlayerId=null;balanceProposal=null;save();render();
        return {key,positions:sp.unitMap?.[sp.defaultUnitKey]?.layoutMap?.[sp.unitMap?.[sp.defaultUnitKey]?.defaultLayoutKey]?.slots?.length||sp.unitMap?.[sp.defaultUnitKey]?.positions?.length||sp.positions.length,allPositions:sp.allPositions?.length||sp.positions.length,units:sp.units?.length||1,layouts:sp.units?.reduce((n,u)=>n+(u.layouts?.length||0),0)||0,periods:state.periodCount,pitchTracking:!!sp.capabilities.pitchTracking,sequenceOrder:!!sp.capabilities.sequenceOrder};
      },
      stressData({players=80,periods=24,events=30,activities=40}={}){
        const positions=sportPositions();state.players=Array.from({length:players},(_,i)=>({id:`stress-p${i+1}`,first:`Player${String(i+1).padStart(3,'0')}LongName`,last:`TestFamily${String(i+1).padStart(3,'0')}`,number:String(i+1),primary:positions[i%positions.length]||'',secondary:positions[(i+1)%positions.length]||'',throws:'R',bats:'R',status:'active',attendance:i%11===0?'maybe':'yes',notes:''}));
        state.sequenceOrder=state.players.map(p=>p.id);state.periodCount=Math.max(1,Math.min(40,periods));state.assignments={};const c=teamContextFor(state);c.unitLayoutKeys[currentUnitKey()]={};
        for(let n=1;n<=state.periodCount;n++){c.unitLayoutKeys[currentUnitKey()][n]=defaultLayoutKey();state.assignments[n]={};const slots=layoutSlots(n);slots.forEach((slot,j)=>state.assignments[n][slot.key]=state.players[(j+n-1)%state.players.length]?.id||null);}
        state.practices=Array.from({length:activities},(_,i)=>({id:`stress-pr${i+1}`,minutes:5+(i%4)*5,title:`Practice activity ${i+1} with a descriptive coaching title`,category:i%2?'Technical':'Team'}));
        state.events=Array.from({length:events},(_,i)=>({id:`stress-e${i+1}`,type:i%3===0?'Game':'Practice',title:`Event ${i+1} Long Schedule Title`,date:`2026-09-${String((i%28)+1).padStart(2,'0')}`,start:'18:00',end:'19:30',venue:`Field Complex Area ${i+1}`,outdoor:true,lat:null,lon:null,notes:'Stress-test event note'}));
        state.weatherCache={};state.gameSessions={};state.activeGameEventId=null;state.playerDevelopment={};state.lineupPresets=[];currentPeriod=1;selectedPlayerId=null;balanceProposal=null;save();render();
        return {players:state.players.length,periods:state.periodCount,events:state.events.length,activities:state.practices.length};
      },
      snapshot(){return JSON.parse(JSON.stringify(state));},
      migrateState(candidate){return normalizeState(JSON.parse(JSON.stringify(candidate)));},
      registry(){return Object.fromEntries(Object.entries(SPORTS).map(([k,v])=>[k,{positions:v.unitMap?.[v.defaultUnitKey]?.layoutMap?.[v.unitMap?.[v.defaultUnitKey]?.defaultLayoutKey]?.slots?.length||v.positions.length,periods:v.defaultPeriods,layouts:v.units.reduce((n,u)=>n+(u.layouts?.length||0),0),pitchTracking:!!v.capabilities.pitchTracking,sequenceOrder:!!v.capabilities.sequenceOrder}]))}
    };
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){e.preventDefault();closeModal();}});
  window.addEventListener('hashchange',()=>{currentView=(location.hash||'#home').slice(1);selectedPlayerId=null;render();});
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
  render();
  startCloudModule();
})();
