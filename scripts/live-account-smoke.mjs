import process from 'node:process';

const BASE_URL=(process.env.TEAM_APP_BASE_URL||'https://team-app-6mh.pages.dev').replace(/\/+$/,'');
const DATA_API_URL=(process.env.TEAM_APP_DATA_API_URL||'https://ep-noisy-violet-awtos8ns.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1').replace(/\/+$/,'');
const EMAIL=String(process.env.TEAM_APP_SMOKE_EMAIL||'').trim();
const PASSWORD=String(process.env.TEAM_APP_SMOKE_PASSWORD||'');
const GUARDIAN_EMAIL=String(process.env.TEAM_APP_SMOKE_GUARDIAN_EMAIL||'').trim();
const GUARDIAN_PASSWORD=String(process.env.TEAM_APP_SMOKE_GUARDIAN_PASSWORD||'');
const MUTATE=/^(?:1|true|yes)$/i.test(String(process.env.TEAM_APP_SMOKE_MUTATE||''));
const GUARDIAN=/^(?:1|true|yes)$/i.test(String(process.env.TEAM_APP_SMOKE_GUARDIAN||''));
const TIMEOUT_MS=Number(process.env.TEAM_APP_SMOKE_TIMEOUT_MS||20000);

function pass(message){console.log(`PASS: ${message}`);}
function fail(message){throw new Error(message);}
function requireCredentials(){
  if(!EMAIL||!PASSWORD)fail('Synthetic smoke credentials are required in TEAM_APP_SMOKE_EMAIL and TEAM_APP_SMOKE_PASSWORD. Do not use a real family account.');
  if(GUARDIAN&&!MUTATE)fail('Guardian role-boundary smoke requires TEAM_APP_SMOKE_MUTATE=1 because it needs a throwaway team.');
  if(GUARDIAN&&(!GUARDIAN_EMAIL||!GUARDIAN_PASSWORD))fail('Guardian smoke requires TEAM_APP_SMOKE_GUARDIAN_EMAIL and TEAM_APP_SMOKE_GUARDIAN_PASSWORD for a second synthetic adult account.');
  if(GUARDIAN&&GUARDIAN_EMAIL.toLowerCase()===EMAIL.toLowerCase())fail('Coach and guardian smoke accounts must be different synthetic adults.');
}
function setCookies(headers){
  if(typeof headers.getSetCookie!=='function')fail('This smoke requires Node 22+ Headers.getSetCookie() support.');
  return headers.getSetCookie();
}
async function parseBody(response){
  const text=await response.text();
  if(!text)return null;
  try{return JSON.parse(text);}catch{return {raw:text.slice(0,500)};}
}

class SyntheticSession{
  constructor(label,email,password){this.label=label;this.email=email;this.password=password;this.cookies=new Map();this.jwt='';}
  absorbCookies(headers){
    for(const raw of setCookies(headers)){
      const pair=raw.split(';',1)[0]||'';const i=pair.indexOf('=');if(i<=0)continue;
      const name=pair.slice(0,i).trim(),value=pair.slice(i+1).trim();if(!name)continue;
      if(!value||/max-age=0/i.test(raw))this.cookies.delete(name);else this.cookies.set(name,value);
    }
  }
  cookieHeader(){return [...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ');}
  captureJwt(response,data){
    const header=response.headers.get('set-auth-jwt')||'';
    const bodyToken=typeof data?.token==='string'?data.token:typeof data?.data?.token==='string'?data.data.token:'';
    if(header)this.jwt=header;else if(bodyToken)this.jwt=bodyToken;
  }
  async auth(path,{method='GET',body}={}){
    const headers={'user-agent':'team-app-live-account-smoke/1.1','cache-control':'no-cache'};
    const cookies=this.cookieHeader();if(cookies)headers.cookie=cookies;
    if(body!==undefined)headers['content-type']='application/json';
    const response=await fetch(`${BASE_URL}/api/auth${path}`,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(TIMEOUT_MS)
    });
    this.absorbCookies(response.headers);const data=await parseBody(response);this.captureJwt(response,data);
    if(response.headers.get('x-team-app-auth-proxy')!=='1')fail(`Auth proxy marker missing for ${this.label} ${path}.`);
    if(!/no-store/i.test(response.headers.get('cache-control')||''))fail(`Auth response ${this.label} ${path} is not no-store.`);
    if(!response.ok)fail(`Auth request ${this.label} ${path} failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
    return {response,data};
  }
  async signIn(){
    await this.auth('/sign-in/email',{method:'POST',body:{email:this.email,password:this.password,rememberMe:true}});
    const session=await this.auth('/get-session');
    if(!session.data?.user&&!session.data?.session?.user&&!session.data?.data?.user)fail(`${this.label} session response did not include a user.`);
    if(!this.jwt)fail(`${this.label} sign-in did not produce a Neon Data API JWT.`);
    pass(`${this.label} synthetic adult signed in through the first-party auth proxy and received a Data API JWT`);
  }
  async signOut(){
    try{await this.auth('/sign-out',{method:'POST',body:{}});pass(`${this.label} synthetic account signed out`);}
    catch(error){console.warn(`WARN: ${this.label} sign-out cleanup failed: ${error.message}`);}
  }
  async rawApi(action,payload={}){
    if(!this.jwt)fail(`No ${this.label} Neon Data API JWT is available before ${action}.`);
    const response=await fetch(`${DATA_API_URL}/rpc/app_api`,{
      method:'POST',headers:{authorization:`Bearer ${this.jwt}`,'content-type':'application/json','user-agent':'team-app-live-account-smoke/1.1','cache-control':'no-cache'},
      body:JSON.stringify({p_action:action,p_payload:payload}),signal:AbortSignal.timeout(TIMEOUT_MS)
    });
    return {response,data:await parseBody(response)};
  }
  async api(action,payload={}){
    const result=await this.rawApi(action,payload);
    if(!result.response.ok)fail(`${this.label} Data API ${action} failed with HTTP ${result.response.status}: ${JSON.stringify(result.data)}`);
    return result.data;
  }
}

async function verifyAnonymousBlocked(){
  const response=await fetch(`${DATA_API_URL}/rpc/app_api`,{
    method:'POST',headers:{'content-type':'application/json','user-agent':'team-app-live-account-smoke/1.1'},
    body:JSON.stringify({p_action:'me',p_payload:{}}),signal:AbortSignal.timeout(TIMEOUT_MS)
  });
  if(response.ok)fail('Anonymous Data API request unexpectedly succeeded.');
  pass(`anonymous Data API request is blocked (HTTP ${response.status})`);
}
function isConflict(value){return value&&typeof value==='object'&&value.error==='revision_conflict'&&Number(value.status)===409;}
async function createTeamAndRace(coach){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),name=`TENX Smoke ${stamp}`;
  const created=await coach.api('team.create',{name,sportKey:'baseball',season:'TENX Smoke',teamRecord:{name,shortName:'TENX'},context:{}});
  const teamId=created?.team?.id;if(!teamId)fail(`team.create did not return a team id: ${JSON.stringify(created)}`);
  console.log(`TENX_SMOKE_TEAM_ID=${teamId}`);console.log('CLEANUP_REQUIRED: delete this synthetic TENX Smoke team after live-gate verification.');pass('synthetic throwaway team created');
  const current=await coach.api('team.state.get',{teamId});const revision=Number(current?.revision);
  if(!Number.isFinite(revision)||revision<1)fail(`team.state.get returned an invalid revision: ${JSON.stringify(current)}`);
  const payload={teamId,revision,teamRecord:{name,shortName:'TENX'},context:current?.state||{}};
  const [left,right]=await Promise.all([coach.api('team.state.update',payload),coach.api('team.state.update',payload)]);
  const results=[left,right],conflicts=results.filter(isConflict),successes=results.filter(x=>!x?.error&&Number(x?.revision)===revision+1);
  if(conflicts.length!==1||successes.length!==1)fail(`Expected one atomic update and one revision conflict; got ${JSON.stringify(results)}`);
  pass('two concurrent coach updates produced exactly one success and one revision_conflict');
  return {teamId,name};
}
async function verifyGuardianBoundary(coach,team){
  const invite=await coach.api('invitation.create',{teamId:team.teamId,email:GUARDIAN_EMAIL,role:'guardian',expiresHours:1});
  if(!invite?.token)fail(`invitation.create did not return a token: ${JSON.stringify(invite)}`);
  pass('coach created a synthetic guardian invitation');
  const guardian=new SyntheticSession('guardian',GUARDIAN_EMAIL,GUARDIAN_PASSWORD);
  try{
    await guardian.signIn();
    const accepted=await guardian.api('invitation.accept',{token:invite.token});
    if(accepted?.teamId!==team.teamId||accepted?.role!=='guardian')fail(`guardian invitation acceptance returned unexpected data: ${JSON.stringify(accepted)}`);
    pass('second synthetic adult accepted the invitation as guardian');
    const state=await guardian.api('team.state.get',{teamId:team.teamId});
    if(state?.role!=='guardian')fail(`guardian state read returned unexpected role: ${JSON.stringify(state?.role)}`);
    pass('guardian can read the authorized member projection');
    const attempt=await guardian.rawApi('team.state.update',{teamId:team.teamId,revision:Number(state.revision||0),teamRecord:{name:team.name},context:state?.state||{}});
    const message=String(attempt.data?.message||attempt.data?.error||attempt.data?.details||'');
    if(attempt.response.ok&&!/coach_role_required|permission|forbidden/i.test(message))fail(`guardian coach-only update unexpectedly succeeded: ${JSON.stringify(attempt.data)}`);
    if(!/coach_role_required|permission|forbidden/i.test(message))fail(`guardian coach-only update failed for an unexpected reason (HTTP ${attempt.response.status}): ${JSON.stringify(attempt.data)}`);
    pass(`guardian coach-only state write is rejected (HTTP ${attempt.response.status})`);
    const me=await guardian.api('me',{});
    if(!Array.isArray(me?.teams)||!me.teams.some(t=>t.id===team.teamId&&t.role==='guardian'))fail(`guardian me response is missing the invited team: ${JSON.stringify(me)}`);
    pass('guardian account discovery reports the invited team with guardian role');
  }finally{await guardian.signOut();}
}

requireCredentials();
const coach=new SyntheticSession('coach',EMAIL,PASSWORD);
console.log(`Team APP live synthetic account smoke: ${BASE_URL}`);
console.log(`Mode: ${MUTATE?(GUARDIAN?'AUTH + CONCURRENCY + GUARDIAN ROLE BOUNDARY':'AUTH + THROWAWAY TEAM CONCURRENCY'):'READ-ONLY AUTH/JWT'}`);
await verifyAnonymousBlocked();
try{
  await coach.signIn();
  const me=await coach.api('me',{});if(!me?.user&&!me?.authUser)fail(`Authenticated app_api me response is missing account data: ${JSON.stringify(me)}`);
  pass('coach JWT reaches app_api through the public Neon Data API');
  if(MUTATE){const team=await createTeamAndRace(coach);if(GUARDIAN)await verifyGuardianBoundary(coach,team);}
  else pass('mutation gate is disabled; production team data was not changed');
}finally{await coach.signOut();}
console.log('\nLive synthetic account smoke PASSED.');
