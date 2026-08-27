const NEON_AUTH_UPSTREAM='https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
const TEAM_APP_AUTH_PREFIX='/api/auth';
const NEON_AUTH_COOKIE_PREFIX='__Secure-neon-auth';
const REQUEST_HEADER_ALLOWLIST=['user-agent','authorization','referer','content-type','x-neon-client-info'];
const RESPONSE_HEADER_ALLOWLIST=['content-type','content-encoding','date','set-auth-jwt','set-auth-token','x-neon-ret-request-id'];

function authPath(params={}){
  const value=Array.isArray(params.path)?params.path.join('/'):String(params.path||'');
  return value.split('/').filter(Boolean).map(segment=>encodeURIComponent(segment)).join('/');
}

function neonCookieHeader(headers){
  const raw=headers.get('cookie')||'';
  if(!raw)return '';
  return raw.split(';').map(part=>part.trim()).filter(Boolean).filter(part=>{
    const name=part.slice(0,part.indexOf('=')>=0?part.indexOf('='):part.length).trim();
    return name.startsWith(NEON_AUTH_COOKIE_PREFIX);
  }).join('; ');
}

function rewriteSetCookie(cookie){
  let value=String(cookie||'')
    .replace(/;\s*Domain=[^;]+/ig,'')
    .replace(/;\s*Partitioned\b/ig,'')
    .replace(/;\s*SameSite=(?:Strict|Lax|None)\b/ig,'');
  if(!/;\s*Secure\b/i.test(value))value+='; Secure';
  return `${value}; SameSite=Lax`;
}

function upstreamCookies(headers){
  if(typeof headers.getSetCookie==='function')return headers.getSetCookie();
  if(typeof headers.getAll==='function'){
    try{return headers.getAll('Set-Cookie');}catch{}
  }
  const one=headers.get('set-cookie');
  return one?[one]:[];
}

function rewriteLocation(value,requestOrigin){
  if(!value)return value;
  const base=new URL(NEON_AUTH_UPSTREAM);
  let target;
  try{target=new URL(value,base);}catch{return value;}
  if(target.origin!==base.origin)return value;
  if(target.pathname!==base.pathname&&!target.pathname.startsWith(`${base.pathname}/`))return value;
  const suffix=target.pathname.slice(base.pathname.length);
  return `${requestOrigin}${TEAM_APP_AUTH_PREFIX}${suffix}${target.search}${target.hash}`;
}

function upstreamRequestHeaders(request,incoming){
  const headers=new Headers();
  for(const name of REQUEST_HEADER_ALLOWLIST){
    const value=request.headers.get(name);
    if(value)headers.set(name,value);
  }
  headers.set('Origin',request.headers.get('origin')||incoming.origin);
  const cookies=neonCookieHeader(request.headers);
  if(cookies)headers.set('Cookie',cookies);
  headers.set('X-Neon-Auth-Middleware','true');
  return headers;
}

function downstreamResponseHeaders(response,incoming){
  const out=new Headers();
  for(const name of RESPONSE_HEADER_ALLOWLIST){
    const value=response.headers.get(name);
    if(value)out.set(name,value);
  }

  const cookies=upstreamCookies(response.headers);
  for(const cookie of cookies)out.append('Set-Cookie',rewriteSetCookie(cookie));

  const location=response.headers.get('location');
  if(location)out.set('Location',rewriteLocation(location,incoming.origin));

  out.set('Cache-Control','no-store');
  out.set('X-Team-App-Auth-Proxy','1');
  out.set('X-Content-Type-Options','nosniff');
  return out;
}

export async function onRequest(context){
  const incoming=new URL(context.request.url);
  const suffix=authPath(context.params);
  const upstream=new URL(`${NEON_AUTH_UPSTREAM}${suffix?`/${suffix}`:''}`);
  upstream.search=incoming.search;

  const headers=upstreamRequestHeaders(context.request,incoming);
  const init={method:context.request.method,headers,redirect:'manual'};
  if(context.request.method!=='GET'&&context.request.method!=='HEAD')init.body=context.request.body;

  let response;
  try{
    response=await fetch(upstream,init);
  }catch(error){
    console.error(JSON.stringify({level:'error',event:'auth_proxy_fetch_failed',message:String(error?.message||error),path:incoming.pathname,time:new Date().toISOString()}));
    return Response.json({error:'auth_service_unavailable'},{status:502,headers:{'Cache-Control':'no-store','X-Team-App-Auth-Proxy':'1','X-Content-Type-Options':'nosniff'}});
  }

  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers:downstreamResponseHeaders(response,incoming)
  });
}
