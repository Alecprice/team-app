(function(root,factory){
  const registry=factory();
  if(typeof module==='object'&&module.exports)module.exports=registry;
  root.TEAM_APP_SPORTS=registry;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const sharedCapabilities={
    roster:true,availability:true,schedule:true,weather:true,practice:true,
    development:true,learning:true,lineupSurface:true,rotationPlanning:true,
    gameDay:true,attendance:true,score:true,substitutions:true,documents:true,
    messaging:true,forms:true
  };

  const baseballLessons={
    P:{title:'Pitcher',where:'In the center of the infield on the pitching mound.',responsibilities:['Deliver legal pitches to the batter.','Field balls around the mound.','Cover first base on many balls hit to the right side.','Back up throws and communicate with the catcher.'],skills:['Balance and repeatable mechanics','Throwing accuracy','Composure','Fielding position after the pitch'],tip:'Finish each pitch in an athletic position so you are ready to field the ball.'},
    C:{title:'Catcher',where:'Behind home plate.',responsibilities:['Receive pitches and block balls in the dirt.','Protect home plate and field short balls near the plate.','Communicate defensive situations.','Make throws to bases when appropriate.'],skills:['Receiving','Blocking','Throwing footwork','Communication'],tip:'Start with safety, a balanced stance, and learning how to keep the ball in front of you.'},
    '1B':{title:'First Base',where:'Near first base on the right side of the infield.',responsibilities:['Receive throws for force outs at first.','Field balls hit to the right side.','Hold or monitor runners when required by the rule set.','Communicate on popups and bunt coverage.'],skills:['Catching thrown balls','Footwork around the bag','Stretching safely','Ground balls'],tip:'Find the base with your foot first, then give the fielder a big, steady target.'},
    '2B':{title:'Second Base',where:'Between first and second base, generally shaded toward the right side.',responsibilities:['Field ground balls on the right side.','Cover second on many force and steal situations.','Turn double plays.','Serve as a relay/cutoff in many outfield plays.'],skills:['Quick feet','Transfer and throw','Ground balls','Communication'],tip:'Know before the pitch whether your next responsibility is the ball, the base, or a relay.'},
    '3B':{title:'Third Base',where:'Near third base on the left side of the infield.',responsibilities:['Field hard ground balls and bunts.','Make strong throws across the diamond.','Cover third base.','Communicate on the left side with shortstop and catcher.'],skills:['Reaction time','Ground balls','Strong accurate throws','Bunt reads'],tip:'Stay low and ready—the ball can arrive quickly at third base.'},
    SS:{title:'Shortstop',where:'Between second and third base.',responsibilities:['Field balls on the left side.','Cover second base in many situations.','Relay throws from the outfield.','Communicate with second base, third base, and outfielders.'],skills:['Quick first step','Strong accurate arm','Ground-ball footwork','Situational awareness'],tip:'Move your feet toward the target and create momentum before making the throw.'},
    LF:{title:'Left Field',where:'Outfield behind third base and shortstop.',responsibilities:['Catch fly balls and field ground balls.','Back up third base.','Throw through the correct cutoff player.','Communicate loudly on fly balls.'],skills:['Tracking fly balls','Crow hop and throw','Ground-ball approach','Communication'],tip:'Get behind the ball when possible so your momentum moves toward the infield.'},
    CF:{title:'Center Field',where:'Middle of the outfield.',responsibilities:['Cover the largest central outfield area.','Take charge on many fly balls.','Back up throws toward second base.','Help direct communication between outfielders.'],skills:['Range','Fly-ball reads','Throwing accuracy','Leadership communication'],tip:'Your first step should follow the ball read—avoid drifting before you know the direction.'},
    RF:{title:'Right Field',where:'Outfield behind first and second base.',responsibilities:['Catch fly balls and field ground balls.','Back up first base on many throws.','Throw through the appropriate cutoff.','Communicate on balls between right and center.'],skills:['Fly-ball tracking','Ground-ball approach','Strong throws','Backing up bases'],tip:'Expect to move on every ball in play, even when the ball is hit to the other side.'}
  };

  const baseballDrills=[
    {id:'dr-ground-ready',title:'Ready Position Ground Balls',minutes:12,category:'Defense',focus:'Athletic ready position, moving feet to the ball, fielding out front.',equipment:'Baseballs, cones',steps:['Set two short lines with plenty of repetitions.','Roll or lightly hit ground balls from several angles.','Cue: feet to the ball, glove out front, funnel to the middle.','Finish every rep with feet moving toward the throwing target.']},
    {id:'dr-throwing-targets',title:'Partner Throwing Targets',minutes:10,category:'Throwing',focus:'Controlled throwing progression and chest-high targets.',equipment:'Baseballs',steps:['Start close enough for accurate easy throws.','Show a clear two-hand target.','Move farther apart only when mechanics and accuracy stay controlled.','Finish with several game-speed catches and throws.']},
    {id:'dr-fly-dropstep',title:'Fly Ball Drop-Step Reads',minutes:12,category:'Defense',focus:'First-step reads, getting behind the ball and loud communication.',equipment:'Baseballs or tennis balls',steps:['Start players in an athletic outfield stance.','Point or toss to alternating sides.','Player drop-steps instead of backpedaling.','Progress to controlled fly balls and communication calls.']},
    {id:'dr-tee-contact',title:'Tee Contact & Finish',minutes:12,category:'Hitting',focus:'Balanced setup, contact point and controlled finish.',equipment:'Batting tee, balls, net',steps:['Set the tee at a comfortable contact point.','Use one simple hitting cue at a time.','Require balance through the finish.','Move the tee to different locations after consistent contact.']},
    {id:'dr-front-toss',title:'Short Front Toss',minutes:12,category:'Hitting',focus:'Timing and line-drive contact with short, repeatable swings.',equipment:'Balls, screen/net',steps:['Use a safe screen or protected toss position.','Toss from a short distance at consistent speed.','Ask hitters to track the ball all the way to contact.','Rotate quickly so waiting time stays low.']},
    {id:'dr-baserun-turns',title:'First-Base Turns',minutes:10,category:'Running',focus:'Running through first versus rounding first with control.',equipment:'Bases, cones',steps:['Demonstrate running through first on an infield play.','Demonstrate a controlled round when continuing toward second is possible.','Use a cone to teach the running path.','Finish with live coach calls: through, round or hold.']},
    {id:'dr-cutoff-relay',title:'Cutoff & Relay Communication',minutes:15,category:'Team',focus:'Loud communication, lining up throws and keeping the ball moving.',equipment:'Baseballs, bases, cones',steps:['Set an outfielder, cutoff player and target base.','Walk through where the cutoff should align.','Add a throw and require loud target communication.','Rotate every player through each role.']},
    {id:'dr-situations',title:'Coach-Called Situations',minutes:15,category:'Team',focus:'Pre-pitch thinking and making the correct first decision.',equipment:'Full field, baseballs',steps:['Place runners and announce outs before each rep.','Ask one or two fielders where their responsibility is before the pitch.','Put a controlled ball in play.','Stop briefly after the rep to reinforce the decision, then reset quickly.']}
  ];

  const baseballPositions=[
    ['P','Pitcher','infield',50,55],['C','Catcher','infield',50,82],['1B','First Base','infield',70,56],['2B','Second Base','infield',63,42],['SS','Shortstop','infield',37,42],['3B','Third Base','infield',30,56],['LF','Left Field','outfield',18,18],['CF','Center Field','outfield',50,12],['RF','Right Field','outfield',82,18]
  ].map(([code,name,group,x,y])=>({code,name,group,x,y}));

  const registry={
    baseball:{
      key:'baseball',name:'Baseball',emoji:'⚾',surface:'diamond',defaultPeriods:6,period:{singular:'inning',plural:'innings'},sides:['Top','Bottom'],scoreActions:[{label:'Run',value:1}],
      positions:baseballPositions,restrictedRotationPositions:['P','C'],positionAliases:{OF:['LF','CF','RF'],UTIL:['1B','2B','3B','SS','LF','CF','RF']},
      capabilities:{...sharedCapabilities,sequenceOrder:true,pitchTracking:true,multiUnit:false},sequence:{label:'Batting order',verb:'bat'},
      developmentSkills:[['throwing','Throwing & receiving'],['fielding','Fielding'],['hitting','Hitting'],['baserunning','Base running'],['awareness','Game awareness']],
      lessons:baseballLessons,drills:baseballDrills,skillDrillMap:{throwing:['dr-throwing-targets','dr-cutoff-relay'],fielding:['dr-ground-ready','dr-fly-dropstep'],hitting:['dr-tee-contact','dr-front-toss'],baserunning:['dr-baserun-turns'],awareness:['dr-situations','dr-cutoff-relay']},
      learningTracks:['Fielding fundamentals','Throwing mechanics','Hitting basics','Base running','Cutoffs & relays','Situational defense','Pitching & catching','Sportsmanship & safety'],ruleSets:['Custom / Recreation','Little League Baseball','NFHS','Travel / Tournament'],practiceTemplate:[['Team introduction',5,'Team'],['Dynamic warm-up',10,'Warm-up'],['Throwing progression',10,'Throwing'],['Ground-ball fundamentals',15,'Defense'],['Fly-ball fundamentals',15,'Defense'],['Hitting stations',15,'Hitting'],['Base running',10,'Running'],['Situational defense',10,'Team']]
    },
    softball:{
      key:'softball',name:'Softball',emoji:'🥎',surface:'diamond',defaultPeriods:7,period:{singular:'inning',plural:'innings'},sides:['Top','Bottom'],scoreActions:[{label:'Run',value:1}],
      positions:baseballPositions,restrictedRotationPositions:['P','C'],positionAliases:{OF:['LF','CF','RF'],UTIL:['1B','2B','3B','SS','LF','CF','RF']},
      capabilities:{...sharedCapabilities,sequenceOrder:true,pitchTracking:true,multiUnit:false},sequence:{label:'Batting order',verb:'bat'},
      developmentSkills:[['throwing','Throwing & receiving'],['fielding','Fielding'],['hitting','Hitting'],['baserunning','Base running'],['awareness','Game awareness']],
      lessons:{},drills:[],learningTracks:['Fielding fundamentals','Throwing mechanics','Hitting basics','Base running','Situational defense','Pitching & catching','Sportsmanship & safety'],ruleSets:['Custom / Recreation','Little League Softball','USA Softball','NFHS','Travel / Tournament'],practiceTemplate:[['Dynamic warm-up',10,'Warm-up'],['Throwing progression',10,'Throwing'],['Infield fundamentals',15,'Defense'],['Outfield fundamentals',15,'Defense'],['Hitting stations',20,'Hitting'],['Base running',10,'Running'],['Situational defense',10,'Team']]
    },
    soccer:{
      key:'soccer',name:'Soccer',emoji:'⚽',surface:'pitch',defaultPeriods:2,period:{singular:'half',plural:'halves'},sides:[],scoreActions:[{label:'Goal',value:1}],
      positions:[['GK','Goalkeeper','goalkeeper',50,88],['LB','Left Back','defense',19,70],['LCB','Left Center Back','defense',38,73],['RCB','Right Center Back','defense',62,73],['RB','Right Back','defense',81,70],['LM','Left Midfield','midfield',20,48],['CM','Central Midfield','midfield',50,52],['RM','Right Midfield','midfield',80,48],['LW','Left Wing','attack',22,25],['ST','Striker','attack',50,18],['RW','Right Wing','attack',78,25]].map(([code,name,group,x,y])=>({code,name,group,x,y})),
      restrictedRotationPositions:['GK'],positionAliases:{DEF:['LB','LCB','RCB','RB'],MID:['LM','CM','RM'],FWD:['LW','ST','RW'],UTIL:['LB','LCB','RCB','RB','LM','CM','RM','LW','ST','RW']},
      capabilities:{...sharedCapabilities,sequenceOrder:false,pitchTracking:false,multiUnit:false},sequence:null,
      developmentSkills:[['ball','Ball control'],['passing','Passing & receiving'],['defending','Defending'],['finishing','Finishing'],['awareness','Game awareness'],['fitness','Movement & conditioning']],
      lessons:{},drills:[],learningTracks:['Field positions','First touch','Passing','Dribbling','Defending','Finishing','Spacing & support','Sportsmanship & safety'],ruleSets:['Custom / Recreation','US Youth Soccer','US Club Soccer','AYSO'],practiceTemplate:[['Dynamic warm-up',10,'Warm-up'],['Ball mastery',12,'Technical'],['Passing & receiving',15,'Technical'],['Small-sided possession',15,'Team'],['Finishing',12,'Attacking'],['Defending principles',12,'Defense'],['Small-sided game',20,'Game']]
    },
    basketball:{
      key:'basketball',name:'Basketball',emoji:'🏀',surface:'court',defaultPeriods:4,period:{singular:'quarter',plural:'quarters'},sides:[],scoreActions:[{label:'Free throw',value:1},{label:'2PT',value:2},{label:'3PT',value:3}],
      positions:[['PG','Point Guard','guard',50,78],['SG','Shooting Guard','guard',78,61],['SF','Small Forward','wing',22,61],['PF','Power Forward','post',31,30],['C','Center','post',58,22]].map(([code,name,group,x,y])=>({code,name,group,x,y})),
      restrictedRotationPositions:[],positionAliases:{G:['PG','SG'],W:['SG','SF'],POST:['PF','C'],UTIL:['PG','SG','SF','PF','C']},
      capabilities:{...sharedCapabilities,sequenceOrder:false,pitchTracking:false,multiUnit:false},sequence:null,
      developmentSkills:[['handling','Ball handling'],['passing','Passing'],['shooting','Shooting'],['defense','Defense'],['rebounding','Rebounding'],['awareness','Game awareness']],
      lessons:{},drills:[],learningTracks:['Court positions','Ball handling','Passing','Shooting','Defense','Rebounding','Spacing','Sportsmanship & safety'],ruleSets:['Custom / Recreation','NFHS','USA Basketball'],practiceTemplate:[['Dynamic warm-up',8,'Warm-up'],['Ball handling',12,'Technical'],['Passing',10,'Technical'],['Shooting stations',15,'Offense'],['Defensive footwork',12,'Defense'],['Rebounding',10,'Defense'],['Small-sided play',15,'Game'],['Situations',8,'Team']]
    },
    football:{
      key:'football',name:'Football',emoji:'🏈',surface:'gridiron',defaultPeriods:4,period:{singular:'quarter',plural:'quarters'},sides:[],scoreActions:[{label:'PAT',value:1},{label:'2PT / Safety',value:2},{label:'Field goal',value:3},{label:'Touchdown',value:6}],
      positions:[['QB','Quarterback','backfield',50,67],['RB','Running Back','backfield',50,82],['WRL','Wide Receiver L','receiver',12,52],['WRR','Wide Receiver R','receiver',88,52],['TE','Tight End','receiver',73,55],['LT','Left Tackle','line',31,57],['LG','Left Guard','line',39,57],['C','Center','line',50,57],['RG','Right Guard','line',61,57],['RT','Right Tackle','line',69,57],['SL','Slot Receiver','receiver',20,64]].map(([code,name,group,x,y])=>({code,name,group,x,y})),
      units:[
        {key:'offense',label:'Offense',positions:[['QB','Quarterback','backfield',50,67],['RB','Running Back','backfield',50,82],['WRL','Wide Receiver L','receiver',12,52],['WRR','Wide Receiver R','receiver',88,52],['TE','Tight End','receiver',73,55],['LT','Left Tackle','line',31,57],['LG','Left Guard','line',39,57],['C','Center','line',50,57],['RG','Right Guard','line',61,57],['RT','Right Tackle','line',69,57],['SL','Slot Receiver','receiver',20,64]].map(([code,name,group,x,y])=>({code,name,group,x,y}))},
        {key:'defense',label:'Defense',positions:[['LE','Left End','line',20,42],['DT1','Defensive Tackle 1','line',39,46],['DT2','Defensive Tackle 2','line',61,46],['RE','Right End','line',80,42],['WLB','Weak-side Linebacker','linebacker',28,58],['MLB','Middle Linebacker','linebacker',50,61],['SLB','Strong-side Linebacker','linebacker',72,58],['LCB','Left Cornerback','secondary',12,67],['RCB','Right Cornerback','secondary',88,67],['FS','Free Safety','secondary',42,80],['SS','Strong Safety','secondary',64,76]].map(([code,name,group,x,y])=>({code,name,group,x,y}))},
        {key:'special',label:'Special Teams Roles',positions:[['K','Kicker','specialist',50,35],['P','Punter','specialist',50,78],['LS','Long Snapper','specialist',50,56],['H','Holder','specialist',62,68],['KR','Kick Returner','returner',42,86],['PR','Punt Returner','returner',58,86],['G1','Coverage / Block 1','special',13,53],['G2','Coverage / Block 2','special',28,53],['G3','Coverage / Block 3','special',42,53],['G4','Coverage / Block 4','special',72,53],['G5','Coverage / Block 5','special',87,53]].map(([code,name,group,x,y])=>({code,name,group,x,y}))}
      ],
      restrictedRotationPositions:[],positionAliases:{OL:['LT','LG','C','RG','RT'],WR:['WRL','WRR','SL'],DL:['LE','DT1','DT2','RE'],LB:['WLB','MLB','SLB'],DB:['LCB','RCB','FS','SS'],UTIL:['RB','WRL','WRR','TE','SL','WLB','MLB','SLB','LCB','RCB','FS','SS']},
      capabilities:{...sharedCapabilities,sequenceOrder:false,pitchTracking:false,multiUnit:true},sequence:null,
      developmentSkills:[['stance','Stance & start'],['ball','Ball skills'],['blocking','Blocking'],['tackling','Safe tackling fundamentals'],['routes','Routes & spacing'],['awareness','Game awareness']],
      lessons:{},drills:[],learningTracks:['Offensive positions','Defensive positions','Special teams','Blocking','Ball security','Routes','Coverage','Sportsmanship & safety'],ruleSets:['Custom / Recreation','USA Football','NFHS','Flag Football'],practiceTemplate:[['Dynamic warm-up',10,'Warm-up'],['Stance & starts',10,'Fundamentals'],['Ball security',10,'Offense'],['Position stations',20,'Position'],['Team offense',15,'Offense'],['Team defense',15,'Defense'],['Situations',10,'Team']]
    },
    volleyball:{
      key:'volleyball',name:'Volleyball',emoji:'🏐',surface:'volleyball',defaultPeriods:3,period:{singular:'set',plural:'sets'},sides:[],scoreModel:'period',scoreActions:[{label:'Point',value:1}],
      positions:[['S','Setter','rotation',68,72],['OH1','Outside Hitter 1','rotation',20,29],['MB1','Middle Blocker 1','rotation',50,29],['OP','Opposite','rotation',80,29],['OH2','Outside Hitter 2','rotation',20,72],['MB2','Middle Blocker 2','rotation',50,72]].map(([code,name,group,x,y])=>({code,name,group,x,y})),
      restrictedRotationPositions:[],positionAliases:{OH:['OH1','OH2'],MB:['MB1','MB2'],UTIL:['S','OH1','MB1','OP','OH2','MB2']},
      capabilities:{...sharedCapabilities,sequenceOrder:false,pitchTracking:false,multiUnit:false},sequence:null,
      developmentSkills:[['serving','Serving'],['passing','Serve receive & passing'],['setting','Setting'],['attacking','Attacking'],['blocking','Blocking'],['awareness','Rotation awareness']],
      lessons:{},drills:[],learningTracks:['Court rotations','Serving','Passing','Setting','Attacking','Blocking','Coverage','Sportsmanship & safety'],ruleSets:['Custom / Recreation','USA Volleyball','NFHS'],practiceTemplate:[['Movement warm-up',8,'Warm-up'],['Ball control',10,'Technical'],['Serving',12,'Serving'],['Serve receive',15,'Passing'],['Setting & attacking',15,'Offense'],['Blocking/coverage',12,'Defense'],['Rotational play',18,'Team']]
    }
  };

  const layoutTemplates={
    baseball:{default:[{key:'standard',label:'Standard defense'}]},
    softball:{default:[{key:'standard',label:'Standard defense'}]},
    soccer:{default:[
      {key:'11v11-433',label:'11v11 · 4-3-3'},
      {key:'11v11-442',label:'11v11 · 4-4-2',slots:[
        ['GK','GK',50,88],['LB','LB',18,72],['LCB','LCB',38,73],['RCB','RCB',62,73],['RB','RB',82,72],
        ['LM','LM',18,49],['CM1','CM',41,51],['CM2','CM',59,51],['RM','RM',82,49],['ST1','ST',40,20],['ST2','ST',60,20]
      ]},
      {key:'9v9-332',label:'9v9 · 3-3-2',slots:[
        ['GK','GK',50,88],['LB','LB',24,70],['LCB','LCB',50,73],['RB','RB',76,70],['LM','LM',24,49],['CM','CM',50,51],['RM','RM',76,49],['LW','LW',37,22],['RW','RW',63,22]
      ]},
      {key:'7v7-231',label:'7v7 · 2-3-1',slots:[
        ['GK','GK',50,88],['LB','LB',32,70],['RB','RB',68,70],['LM','LM',24,48],['CM','CM',50,50],['RM','RM',76,48],['ST','ST',50,20]
      ]},
      {key:'4v4-basic',label:'4v4 · basic shape',slots:[['GK','GK',50,87],['LB','LB',28,58],['RB','RB',72,58],['ST','ST',50,24]]}
    ]},
    basketball:{default:[
      {key:'standard',label:'Standard 5'},
      {key:'five-out',label:'5-out spacing',slots:[['PG','PG',50,80],['SG','SG',80,61],['SF','SF',20,61],['PF','PF',32,31],['C','C',68,31]]},
      {key:'four-out-one-in',label:'4-out · 1-in',slots:[['PG','PG',50,80],['SG','SG',82,58],['SF','SF',18,58],['PF','PF',25,30],['C','C',55,20]]}
    ]},
    football:{
      offense:[
        {key:'base',label:'Base offense'},
        {key:'spread',label:'Spread',slots:[['QB','QB',50,70],['RB','RB',50,84],['WRL','WRL',8,50],['WRR','WRR',92,50],['TE','TE',76,56],['LT','LT',31,58],['LG','LG',39,58],['C','C',50,58],['RG','RG',61,58],['RT','RT',69,58],['SL','SL',22,66]]},
        {key:'i-formation',label:'I formation',slots:[['QB','QB',50,67],['RB','RB',50,86],['WRL','WRL',9,51],['WRR','WRR',91,51],['TE','TE',74,55],['LT','LT',31,57],['LG','LG',39,57],['C','C',50,57],['RG','RG',61,57],['RT','RT',69,57],['SL','SL',50,77]]}
      ],
      defense:[
        {key:'base-43',label:'4-3 base'},
        {key:'press',label:'Press / compact',slots:[['LE','LE',20,43],['DT1','DT1',39,46],['DT2','DT2',61,46],['RE','RE',80,43],['WLB','WLB',31,57],['MLB','MLB',50,60],['SLB','SLB',69,57],['LCB','LCB',10,61],['RCB','RCB',90,61],['FS','FS',43,77],['SS','SS',63,73]]}
      ],
      special:[{key:'base',label:'Special teams roles'}]
    },
    volleyball:{default:[
      {key:'rotation-1',label:'Rotation 1'},
      {key:'rotation-2',label:'Rotation 2',slots:[['S','S',20,72],['OH1','OH1',68,72],['MB1','MB1',20,29],['OP','OP',50,29],['OH2','OH2',80,29],['MB2','MB2',50,72]]},
      {key:'rotation-3',label:'Rotation 3',slots:[['S','S',50,72],['OH1','OH1',20,72],['MB1','MB1',68,72],['OP','OP',20,29],['OH2','OH2',50,29],['MB2','MB2',80,29]]},
      {key:'rotation-4',label:'Rotation 4',slots:[['S','S',80,29],['OH1','OH1',50,72],['MB1','MB1',20,72],['OP','OP',68,72],['OH2','OH2',20,29],['MB2','MB2',50,29]]},
      {key:'rotation-5',label:'Rotation 5',slots:[['S','S',50,29],['OH1','OH1',80,29],['MB1','MB1',50,72],['OP','OP',20,72],['OH2','OH2',68,72],['MB2','MB2',20,29]]},
      {key:'rotation-6',label:'Rotation 6',slots:[['S','S',20,29],['OH1','OH1',50,29],['MB1','MB1',80,29],['OP','OP',50,72],['OH2','OH2',20,72],['MB2','MB2',68,72]]}
    ]}
  };

  function validateSportAdapter(sport){
    const fail=message=>{throw new Error(`Invalid sport adapter ${sport?.key||'unknown'}: ${message}`);};
    if(!sport?.key||!sport.name||!sport.surface)fail('missing key/name/surface');
    if(!Number.isInteger(sport.defaultPeriods)||sport.defaultPeriods<1)fail('defaultPeriods must be a positive integer');
    if(!sport.period?.singular||!sport.period?.plural)fail('period terminology is required');
    if(!Array.isArray(sport.units)||!sport.units.length)fail('at least one unit is required');
    const unitKeys=sport.units.map(u=>u.key);if(new Set(unitKeys).size!==unitKeys.length)fail('unit keys must be unique');
    if(!unitKeys.includes(sport.defaultUnitKey))fail('defaultUnitKey must reference a registered unit');
    const allCodes=[];
    for(const unit of sport.units){
      if(!unit.key||!unit.label||!Array.isArray(unit.positions)||!unit.positions.length)fail(`unit ${unit.key||'?'} is incomplete`);
      const codes=unit.positions.map(p=>p.code);if(new Set(codes).size!==codes.length)fail(`unit ${unit.key} contains duplicate position codes`);
      for(const p of unit.positions){if(!p.code||!p.name||!p.group)fail(`unit ${unit.key} has incomplete position metadata`);if(!Number.isFinite(p.x)||p.x<0||p.x>100||!Number.isFinite(p.y)||p.y<0||p.y>100)fail(`position ${p.code} has invalid surface coordinates`);allCodes.push(p.code);}
    }
    // Roster profiles currently store a sport-level position code, so codes must remain unambiguous across units.
    if(new Set(allCodes).size!==allCodes.length)fail('position codes must be unique across all units');
    const allSet=new Set(allCodes);for(const targets of Object.values(sport.positionAliases||{}))for(const code of targets)if(!allSet.has(code))fail(`position alias references unknown ${code}`);
    for(const code of sport.restrictedRotationPositions||[])if(!allSet.has(code))fail(`restricted position ${code} is not registered`);
    if(Boolean(sport.capabilities?.multiUnit)!==(sport.units.length>1))fail('multiUnit capability must match the unit count');
    if(sport.capabilities?.pitchTracking&&!allSet.has('P'))fail('pitchTracking requires position P');
    if(sport.capabilities?.sequenceOrder&&!sport.sequence?.label)fail('sequenceOrder requires sequence metadata');
    if(!['cumulative','period'].includes(sport.scoreModel||'cumulative'))fail('scoreModel must be cumulative or period');
    if(!Array.isArray(sport.scoreActions)||!sport.scoreActions.length)fail('scoreActions must contain at least one scoring action');
    for(const action of sport.scoreActions){if(!action?.label||!Number.isInteger(action.value)||action.value<1)fail('scoreActions require a label and positive integer value');}
    for(const unit of sport.units){
      if(!Array.isArray(unit.layouts)||!unit.layouts.length)fail(`unit ${unit.key} requires at least one layout`);
      const layoutKeys=unit.layouts.map(l=>l.key);if(new Set(layoutKeys).size!==layoutKeys.length)fail(`unit ${unit.key} contains duplicate layout keys`);
      if(!layoutKeys.includes(unit.defaultLayoutKey))fail(`unit ${unit.key} defaultLayoutKey is invalid`);
      const roleCodes=new Set(unit.positions.map(p=>p.code));
      for(const layout of unit.layouts){
        if(!layout.key||!layout.label||!Array.isArray(layout.slots)||!layout.slots.length)fail(`unit ${unit.key} has incomplete layout`);
        const slotKeys=layout.slots.map(slot=>slot.key);if(new Set(slotKeys).size!==slotKeys.length)fail(`layout ${unit.key}/${layout.key} contains duplicate slot keys`);
        for(const slot of layout.slots){if(!slot.key||!roleCodes.has(slot.roleCode))fail(`layout ${unit.key}/${layout.key} references unknown role ${slot.roleCode}`);if(!Number.isFinite(slot.x)||slot.x<0||slot.x>100||!Number.isFinite(slot.y)||slot.y<0||slot.y>100)fail(`layout ${unit.key}/${layout.key}/${slot.key} has invalid coordinates`);}
      }
    }
    return true;
  }
  function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(deepFreeze);return Object.freeze(value);}

  Object.values(registry).forEach(sport=>{
    if(!Array.isArray(sport.units)||!sport.units.length)sport.units=[{key:'default',label:'Positions',positions:sport.positions}];
    sport.units=sport.units.map(unit=>{
      const positions=unit.positions||[];const templates=layoutTemplates[sport.key]?.[unit.key]||[{key:'standard',label:'Standard'}];
      const layouts=templates.map(template=>{
        const slots=(template.slots||positions.map(p=>[p.code,p.code,p.x,p.y])).map(([key,roleCode,x,y])=>{const role=positions.find(p=>p.code===roleCode);return {key,roleCode,label:role?.name||roleCode,x:Number(x),y:Number(y)};});
        return {key:template.key,label:template.label,slots,slotMap:Object.fromEntries(slots.map(slot=>[slot.key,slot]))};
      });
      return {...unit,positions,layouts,defaultLayoutKey:layouts[0].key,positionMap:Object.fromEntries(positions.map(p=>[p.code,p])),layoutMap:Object.fromEntries(layouts.map(l=>[l.key,l]))};
    });sport.defaultUnitKey=sport.units[0].key;
    sport.unitMap=Object.fromEntries(sport.units.map(unit=>[unit.key,unit]));
    sport.allPositions=sport.units.flatMap(unit=>unit.positions.map(p=>({...p,unitKey:unit.key,unitLabel:unit.label})));
    sport.positionMap=Object.fromEntries(sport.allPositions.map(p=>[p.code,p]));sport.groups=sport.allPositions.reduce((acc,p)=>{(acc[p.group]||(acc[p.group]=[])).push(p.code);return acc;},{});sport.scoreModel=sport.scoreModel||'cumulative';sport.scoreActions=sport.scoreActions||[{label:'Point',value:1}];sport.adapterVersion=2;
    validateSportAdapter(sport);deepFreeze(sport);
  });

  return Object.freeze(registry);
});
