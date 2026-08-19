(function(root,factory){
  const registry=factory();
  if(typeof module==='object'&&module.exports)module.exports=registry;
  root.TEAM_APP_COMPETITION_PROFILES=registry;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const official={
    littleLeagueRules:'https://www.littleleague.org/playing-rules/rules-regulations-policies/',
    littleLeagueAge:'https://www.littleleague.org/play-little-league/determine-league-age/',
    usSoccerPdi:'https://www.ussoccer.com/stories/2017/08/five-things-to-know-about-us-soccer-player-development-initiatives',
    usSoccerGrassroots:'https://www.ussoccer.com/stories/2018/08/five-things-to-know-about-us-soccers-7v7-9v9-and-11v11-online-grassroots-coaching-education-courses',
    usaBasketball:'https://www.usab.com/play/the-usa-basketball-coaching-guide-for-all-levels/usa-basketball-youth-development-guidebook',
    nfhsBasketball:'https://www.nfhs.org/sports/basketball/rules',
    usaFootball:'https://fdm.usafootball.com/',
    usaFootballPractice:'https://usafootball.com/coaches-organizations/practice-guidelines',
    nfhsFootball:'https://www.nfhs.org/sports/football/rules',
    nfhsSoccer:'https://www.nfhs.org/sports/soccer/rules',
    usavRules:'https://usavolleyball.org/resources-for-officials/rulebooks-and-interpretations/',
    usavAge:'https://usavolleyball.org/forms-and-information/'
  };

  const genericAgeGroups=[
    {key:'6u',label:'6U / Ages 5–6',minAge:5,maxAge:6},
    {key:'8u',label:'8U / Ages 7–8',minAge:7,maxAge:8},
    {key:'10u',label:'10U / Ages 9–10',minAge:9,maxAge:10},
    {key:'12u',label:'12U / Ages 11–12',minAge:11,maxAge:12},
    {key:'14u',label:'14U / Ages 13–14',minAge:13,maxAge:14},
    {key:'16u',label:'16U / Ages 15–16',minAge:15,maxAge:16},
    {key:'18u',label:'18U / Ages 17–18',minAge:17,maxAge:18},
    {key:'middle-school',label:'Middle School',minAge:11,maxAge:14},
    {key:'high-school',label:'High School',minAge:14,maxAge:18},
    {key:'adult',label:'Adult / Open',minAge:18,maxAge:null}
  ];

  const littleLeagueBaseball=[
    ['llb-tee','Tee Ball','League age 4–7',4,7],
    ['llb-minor','Minor League','League age 7–12',7,12],
    ['llb-major','Little League (Major)','League age 9–12',9,12],
    ['llb-intermediate','Intermediate (50/70)','League age 11–13',11,13],
    ['llb-junior','Junior League','League age 12–14',12,14],
    ['llb-senior','Senior League','League age 13–16',13,16]
  ].map(([key,division,ageLabel,minAge,maxAge])=>({
    key,label:`${division} · ${ageLabel}`,division,ageLabel,minAge,maxAge,governingBody:'Little League Baseball',seasonYear:2026,
    sourceUrl:official.littleLeagueRules,ageSourceUrl:official.littleLeagueAge,
    sourceNote:'Official Little League 2026 rules/age structure. Local leagues may use narrower cutoffs where the official division rules allow it.',
    tags:['official','youth','2026']
  }));

  const littleLeagueSoftball=[
    ['lls-tee','Tee Ball','League age 4–7',4,7],
    ['lls-minor','Minor League','League age 7–12',7,12],
    ['lls-major','Little League (Major)','League age 9–12',9,12],
    ['lls-junior','Junior League','League age 12–14',12,14],
    ['lls-senior','Senior League','League age 13–16',13,16]
  ].map(([key,division,ageLabel,minAge,maxAge])=>({
    key,label:`${division} · ${ageLabel}`,division,ageLabel,minAge,maxAge,governingBody:'Little League Softball',seasonYear:2026,
    sourceUrl:official.littleLeagueRules,ageSourceUrl:official.littleLeagueAge,
    sourceNote:'Official Little League 2026 softball rules/age structure. Local league operating rules can add or narrow requirements.',
    tags:['official','youth','2026']
  }));

  const soccerPdi=[
    ['uss-u6-u8','U6–U8 · 4v4','U6–U8','4v4','4v4'],
    ['uss-u9-u10','U9–U10 · 7v7','U9–U10','7v7','7v7'],
    ['uss-u11-u12','U11–U12 · 9v9','U11–U12','9v9','9v9'],
    ['uss-u13plus','U13+ · 11v11','U13+','11v11','11v11-433']
  ].map(([key,label,ageLabel,gameModel,defaultLayout])=>({
    key,label,division:ageLabel,ageLabel,gameModel,defaultLayout,governingBody:'U.S. Soccer Player Development Initiatives',seasonYear:2026,
    sourceUrl:official.usSoccerPdi,secondarySourceUrl:official.usSoccerGrassroots,
    sourceNote:'U.S. Soccer grassroots game model. Member organizations and local leagues may publish additional competition rules.',
    tags:['official-model','youth']
  }));

  function genericProfiles(sport,body,sourceUrl,extra={}){
    return genericAgeGroups.map(g=>({key:`${sport}-${g.key}`,label:g.label,division:g.label,ageLabel:g.label,minAge:g.minAge,maxAge:g.maxAge,governingBody:body,sourceUrl,sourceNote:'Development/competition profile. Confirm the local league or state association rulebook before treating this as the final competition rule set.',tags:['template'],...extra}));
  }

  const registry={
    baseball:{
      leagues:[
        {key:'little-league',name:'Little League Baseball',governingBody:'Little League Baseball',profiles:littleLeagueBaseball,sourceUrl:official.littleLeagueRules},
        {key:'nfhs',name:'School / NFHS-style',governingBody:'NFHS / State Association',profiles:genericProfiles('baseball-nfhs','NFHS / State Association','https://www.nfhs.org/sports/baseball/rules')},
        {key:'travel',name:'Travel / Tournament',governingBody:'Tournament / sanctioning body',profiles:genericProfiles('baseball-travel','Tournament / sanctioning body','')},
        {key:'recreation',name:'Local Recreation League',governingBody:'Local league',profiles:genericProfiles('baseball-rec','Local league','')}
      ]
    },
    softball:{
      leagues:[
        {key:'little-league',name:'Little League Softball',governingBody:'Little League Softball',profiles:littleLeagueSoftball,sourceUrl:official.littleLeagueRules},
        {key:'nfhs',name:'School / NFHS-style',governingBody:'NFHS / State Association',profiles:genericProfiles('softball-nfhs','NFHS / State Association','https://www.nfhs.org/sports/softball/rules')},
        {key:'travel',name:'Travel / Tournament',governingBody:'Tournament / sanctioning body',profiles:genericProfiles('softball-travel','Tournament / sanctioning body','')},
        {key:'recreation',name:'Local Recreation League',governingBody:'Local league',profiles:genericProfiles('softball-rec','Local league','')}
      ]
    },
    soccer:{
      leagues:[
        {key:'us-soccer',name:'U.S. Soccer Grassroots / Member League',governingBody:'U.S. Soccer / member organization',profiles:soccerPdi,sourceUrl:official.usSoccerPdi},
        {key:'nfhs',name:'School / NFHS',governingBody:'NFHS / State Association',profiles:genericProfiles('soccer-nfhs','NFHS / State Association',official.nfhsSoccer)},
        {key:'recreation',name:'Local Recreation League',governingBody:'Local league',profiles:genericProfiles('soccer-rec','Local league','')}
      ]
    },
    basketball:{
      leagues:[
        {key:'usa-basketball',name:'Youth Development / Local League',governingBody:'USA Basketball-informed local program',profiles:genericProfiles('basketball-usab','USA Basketball-informed local program',official.usaBasketball)},
        {key:'nfhs',name:'School / NFHS',governingBody:'NFHS / State Association',profiles:genericProfiles('basketball-nfhs','NFHS / State Association',official.nfhsBasketball,{seasonYear:2026})},
        {key:'recreation',name:'Local Recreation League',governingBody:'Local league',profiles:genericProfiles('basketball-rec','Local league','')}
      ]
    },
    football:{
      leagues:[
        {key:'usa-football',name:'USA Football-informed Youth Program',governingBody:'USA Football-informed local program',profiles:genericProfiles('football-usaf','USA Football-informed local program',official.usaFootball,{secondarySourceUrl:official.usaFootballPractice})},
        {key:'nfhs',name:'School / NFHS',governingBody:'NFHS / State Association',profiles:genericProfiles('football-nfhs','NFHS / State Association',official.nfhsFootball,{seasonYear:2026})},
        {key:'recreation',name:'Local Recreation League',governingBody:'Local league',profiles:genericProfiles('football-rec','Local league','')}
      ]
    },
    volleyball:{
      leagues:[
        {key:'usav',name:'USA Volleyball',governingBody:'USA Volleyball / Region',profiles:[11,12,13,14,15,16,17,18].map(age=>({key:`usav-${age}u`,label:`${age}U`,division:`${age}U`,ageLabel:`${age}U`,governingBody:'USA Volleyball / Region',seasonYear:2026,sourceUrl:official.usavRules,ageSourceUrl:official.usavAge,sourceNote:'USA Volleyball 2025–27 indoor rules with 2026–27 junior age definitions. Regional competition manuals may add requirements.',tags:['official','2026-27']}))},
        {key:'nfhs',name:'School / NFHS',governingBody:'NFHS / State Association',profiles:genericProfiles('volleyball-nfhs','NFHS / State Association','https://www.nfhs.org/sports/volleyball/rules')},
        {key:'recreation',name:'Local Recreation League',governingBody:'Local league',profiles:genericProfiles('volleyball-rec','Local league','')}
      ]
    }
  };

  Object.keys(registry).forEach(sportKey=>{
    const sport=registry[sportKey];
    sport.leagueMap=Object.fromEntries(sport.leagues.map(x=>[x.key,x]));
    sport.profileMap={};sport.leagues.forEach(l=>l.profiles.forEach(p=>sport.profileMap[p.key]={...p,leagueKey:l.key,leagueName:l.name}));
  });

  return {version:1,official,registry};
});
