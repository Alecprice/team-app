import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../../functions/api/auth/[[path]].js';

test('auth proxy forwards Neon JWT metadata and sanitizes Safari cookies at runtime',async()=>{
  const originalFetch=globalThis.fetch;
  let forwarded;
  globalThis.fetch=async(url,init)=>{
    forwarded={url:String(url),init};
    const headers=new Headers();
    headers.set('Content-Type','application/json');
    headers.set('Set-Auth-Jwt','jwt-for-data-api');
    headers.set('Set-Auth-Token','legacy-auth-token');
    headers.set('X-Upstream-Secret','must-not-leak');
    headers.append('Set-Cookie','__Secure-neon-auth.session_token=abc123; Path=/; Domain=.neon.tech; HttpOnly; Secure; SameSite=None; Partitioned');
    return new Response(JSON.stringify({session:{id:'session-1'},user:{id:'user-1'}}),{status:200,headers});
  };

  try{
    const request=new Request('https://team-app-6mh.pages.dev/api/auth/get-session',{
      headers:{
        Origin:'https://team-app-6mh.pages.dev',
        Cookie:'other-app-cookie=drop-me; __Secure-neon-auth.session_token=abc123',
        'X-Browser-Secret':'must-not-forward'
      }
    });
    const response=await onRequest({request,params:{path:'get-session'}});

    assert.equal(forwarded.url,'https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/get-session');
    assert.equal(forwarded.init.headers.get('x-neon-auth-middleware'),'true');
    assert.equal(forwarded.init.headers.get('origin'),'https://team-app-6mh.pages.dev');
    assert.equal(forwarded.init.headers.get('cookie'),'__Secure-neon-auth.session_token=abc123');
    assert.equal(forwarded.init.headers.get('x-browser-secret'),null);

    assert.equal(response.headers.get('set-auth-jwt'),'jwt-for-data-api');
    assert.equal(response.headers.get('set-auth-token'),'legacy-auth-token');
    assert.equal(response.headers.get('x-upstream-secret'),null);
    assert.equal(response.headers.get('x-team-app-auth-proxy'),'1');
    assert.match(response.headers.get('cache-control')||'',/no-store/i);

    const cookie=response.headers.get('set-cookie')||'';
    assert.match(cookie,/__Secure-neon-auth\.session_token=abc123/i);
    assert.match(cookie,/Path=\//i);
    assert.match(cookie,/HttpOnly/i);
    assert.match(cookie,/Secure/i);
    assert.match(cookie,/SameSite=Lax/i);
    assert.doesNotMatch(cookie,/Partitioned/i);
    assert.doesNotMatch(cookie,/Domain=/i);
  }finally{
    globalThis.fetch=originalFetch;
  }
});
