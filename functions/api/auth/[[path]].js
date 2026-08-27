const NEON_AUTH_UPSTREAM='https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
const TEAM_APP_AUTH_PREFIX='/api/auth';

function authPath(params={}){
  const value=params.path;
  if(Array.isArray(value))return value.map(String).join('/');
  return value?String(value):'';
}

function rewriteSetCookie(cookie){
  return String(cookie||'').replace(/;\s*Domain=[^;]+/ig,'');
}

function upstreamCookies(headers){
  if(typeof headers.getSetCookie==='function')return headers.getSetCookie();
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

export async function onRequest(context){
  const incoming=new URL(context.request.url);
  const suffix=authPath(context.params);
  const upstream=new URL(`${NEON_AUTH_UPSTREAM}${suffix?`/${suffix}`:''}`);
  upstream.search=incoming.search;

  const headers=new Headers(context.request.headers);
  headers.delete('host');

  const init={method:context.request.method,headers,redirect:'manual'};
  if(context.request.method!=='GET'&&context.request.method!=='HEAD')init.body=context.request.body;

  let response;
  try{
    response=await fetch(upstream,init);
  }catch(error){
    console.error(JSON.stringify({level:'error',event:'auth_proxy_fetch_failed',message:String(error?.message||error),path:incoming.pathname,time:new Date().toISOString()}));
    return Response.json({error:'auth_service_unavailable'},{status:502,headers:{'Cache-Control':'no-store','X-Team-App-Auth-Proxy':'1','X-Content-Type-Options':'nosniff'}});
  }

  const out=new Headers(response.headers);
  out.set('Cache-Control','no-store');
  out.set('X-Team-App-Auth-Proxy','1');
  out.set('X-Content-Type-Options','nosniff');

  const cookies=upstreamCookies(response.headers);
  if(cookies.length){
    out.delete('set-cookie');
    for(const cookie of cookies)out.append('Set-Cookie',rewriteSetCookie(cookie));
  }

  const location=out.get('location');
  if(location)out.set('location',rewriteLocation(location,incoming.origin));

  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:out});
}
