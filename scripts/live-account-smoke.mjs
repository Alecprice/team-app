import process from 'node:process';

const BASE_URL=(process.env.TEAM_APP_BASE_URL||'https://team-app-6mh.pages.dev').replace(/\/+$/,'');
const DATA_API_URL=(process.env.TEAM_APP_DATA_API_URL||'https://ep-noisy-violet-awtos8ns.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1').replace(/\/+$/,'');
const EMAIL=String(process.env.TEAM_APP_SMOKE_EMAIL||'').trim();
const PASSWORD=String(process.env.TEAM_APP_SMOKE_PASSWORD||'');
const MUTATE=/^(?:1|true|yes)$/i.test(String(process.env.TEAM_APP_SMOKE_MUTATE||''));
const TIMEOUT_MS=Number(process.env.TEAM_APP_SMOKE_TIMEOUT_MS||20000);
const cookieJar=new Map();
let authJwt='';

function pass(message){console.log(`PASS: ${message}`);}
function fail(message){throw new Error(message);}
function requireCredentials(){
  if(!EMAIL||!PASSWORD)fail('Synthetic smoke credentials are required in TEAM_APP_SMOKE_EMAIL and TEAM_APP_SMOKE_PASSWORD. Do not use a real family account.');
}
function setCookies(headers){
  if(typeof headers.getSetCookie!=='function')fail('This smoke requires Node 22+ Headers.getSetCookie() support.');
  return headers.getSetCookie();
}
function absorbCookies(headers){
  for(const raw of setCookies(headers)){
    const pair=raw.split(';',1)[0]||'';
    const i=pair.indexOf('=');if(i<=0)continue;
    const name=pair.slice(0,i).trim(),value=pair.slice(i+1).trim();
    if(!name)continue;
    if(!value||/max-age=0/i.test(raw))cookieJar.delete(name);else cookieJar.set(name,value);
  }
}
function cookieHeader(){return [...cookieJar].map(([k,v])=>`${k}=${v}`).join('; ');}
function maybeCaptureJwt(response,data){
  const header=response.headers.get('set-auth-jwt')||'';
  const bodyToken=typeof data?.token==='string'?data.token:typeof data?.data?.token==='string'?data.data.token:'';
  if(header)authJwt=header;
  else if(bodyToken)authJwt=bodyToken;
}
async function parseBody(response){
  const text=await response.text();
  if(!text)return null;
  try{return JSON.parse(text);}catch{return {raw:text.slice(0,500)};}
}
async function authRequest(path,{method='GET',body}={}){
  const headers={'user-agent':'team-app-live-account-smoke/1.0','cache-control':'no-cache'};
  const cookies=cookieHeader();if(cookies)headers.cookie=cookies;
  if(body!==undefined)headers['content-type']='application/json';
  const response=await fetch(`${BASE_URL}/api/auth${path}`,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(TIMEOUT_MS)
  });
  absorbCookies(response.headers);
  const data=await parseBody(response);maybeCaptureJwt(response,data);
  const marker=response.headers.get('x-team-app-auth-proxy');
  if(marker!=='1')fail(`Auth proxy marker missing for ${path}.`);
  if(!/no-store/i.test(response.headers.get('cache-control')||''))fail(`Auth response ${path} is not no-store.`);
  if(!response.ok)fail(`Auth request ${path} failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
  return {response,data};
}
async function dataApi(action,payload={},jwt=authJwt){
  if(!jwt)fail(`No Neon Data API JWT is available before ${action}.`);
  const response=await fetch(`${DATA_API_URL}/rpc/app_api`,{
    method:'POST',
    headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json','user-agent':'team-app-live-account-smoke/1.0','cache-control':'no-cache'},
    body:JSON.stringify({p_action:action,p_payload:payload}),
    signal:AbortSignal.timeout(TIMEOUT_MS)
  });
  const data=await parseBody(response);
  if(!response.ok)fail(`Data API ${action} failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}
async function verifyAnonymousBlocked(){
  const response=await fetch(`${DATA_API_URL}/rpc/app_api`,{
    method:'POST',headers:{'content-type':'application/json','user-agent':'team-app-live-account-smoke/1.0'},
    body:JSON.stringify({p_action:'me',p_payload:{}}),signal:AbortSignal.timeout(TIMEOUT_MS)
  });
  if(response.ok)fail('Anonymous Data API request unexpectedly succeeded.');
  pass(`anonymous Data API request is blocked (HTTP ${response.status})`);
}
async function signIn(){
  await authRequest('/sign-in/email',{method:'POST',body:{email:EMAIL,password:PASSWORD,rememberMe:true}});
  pass('synthetic adult account sign-in succeeded through first-party auth proxy');
  const session=await authRequest('/get-session');
  if(!session.data?.user&&!session.data?.session?.user&&!session.data?.data?.user)fail('Signed-in session response did not include a user.');
  if(!authJwt)fail('Neon auth did not return a Data API JWT through the first-party proxy.');
  pass('signed-in session produced a Data API JWT');
}
async function signOut(){
  try{await authRequest('/sign-out',{method:'POST',body:{}});pass('synthetic account signed out');}
  catch(error){console.warn(`WARN: sign-out cleanup failed: ${error.message}`);}
}
function isConflict(value){return value&&typeof value==='object'&&value.error==='revision_conflict'&&Number(value.status)===409;}
async function mutateAndRace(){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const name=`TENX Smoke ${stamp}`;
  const created=await dataApi('team.create',{name,sportKey:'baseball',season:'TENX Smoke',teamRecord:{name,shortName:'TENX'},context:{}});
  const teamId=created?.team?.id;
  if(!teamId)fail(`team.create did not return a team id: ${JSON.stringify(created)}`);
  console.log(`TENX_SMOKE_TEAM_ID=${teamId}`);
  console.log('CLEANUP_REQUIRED: delete this synthetic TENX Smoke team after live-gate verification.');
  pass('synthetic throwaway team created');

  const current=await dataApi('team.state.get',{teamId});
  const revision=Number(current?.revision);
  if(!Number.isFinite(revision)||revision<1)fail(`team.state.get returned an invalid revision: ${JSON.stringify(current)}`);
  const payload={teamId,revision,teamRecord:{name,shortName:'TENX'},context:current?.state||{}};
  const [left,right]=await Promise.all([dataApi('team.state.update',payload),dataApi('team.state.update',payload)]);
  const results=[left,right];
  const conflicts=results.filter(isConflict);
  const successes=results.filter(x=>!x?.error&&Number(x?.revision)===revision+1);
  if(conflicts.length!==1||successes.length!==1)fail(`Expected one atomic update and one revision conflict; got ${JSON.stringify(results)}`);
  pass('two concurrent updates produced exactly one success and one revision_conflict');
}

requireCredentials();
console.log(`Team APP live synthetic account smoke: ${BASE_URL}`);
console.log(`Mode: ${MUTATE?'AUTH + THROWAWAY TEAM CONCURRENCY':'READ-ONLY AUTH/JWT'}`);
await verifyAnonymousBlocked();
try{
  await signIn();
  const me=await dataApi('me',{});
  if(!me?.user&&!me?.authUser)fail(`Authenticated app_api me response is missing account data: ${JSON.stringify(me)}`);
  pass('authenticated JWT reaches app_api through the public Neon Data API');
  if(MUTATE)await mutateAndRace();
  else pass('mutation gate is disabled; production team data was not changed');
}finally{
  await signOut();
}
console.log('\nLive synthetic account smoke PASSED.');
