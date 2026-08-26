const CACHE='team-app-live-v1.10.0-hardening-1';
const ASSETS=['./','./index.html','./styles.css','./sports.js','./competition-profiles.js','./core/file-store.js','./core/cloud-queue.js','./core/sport-runtime.js','./core/e2ee.js','./core/connectivity-status.css','./core/connectivity-status.js','./core/hardening-runtime.css','./core/hardening-runtime.js','./cloud-client.js','./app.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
const SHELL_KEY='./index.html';
function sensitiveNavigation(url){return url.searchParams.has('invite')||url.searchParams.has('token')||url.searchParams.has('code');}
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/auth/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(async res=>{
      if(res.ok&&!sensitiveNavigation(url)){const copy=res.clone();const c=await caches.open(CACHE);await c.put(SHELL_KEY,copy);}
      return res;
    }).catch(async()=>await caches.match(SHELL_KEY)||await caches.match('./')||new Response('Offline app shell unavailable',{status:503,statusText:'Offline'})));
    return;
  }
  event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;}).catch(async()=>await caches.match(event.request)||new Response('Offline asset unavailable',{status:503,statusText:'Offline'})));
});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{};}catch{data={title:'Team APP',body:event.data?.text()||'You have a team update.'};}const title=data.title||'Team APP';const options={body:data.body||'You have a team update.',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:data.tag||data.category||'team-app',data:data.payload||{},renotify:Boolean(data.renotify)};event.waitUntil(self.registration.showNotification(title,options));});
self.addEventListener('notificationclick',event=>{event.notification.close();const p=event.notification.data||{};const target=p.url||(p.eventId?'./#schedule':'./');event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async wins=>{const w=wins.find(x=>x.url.startsWith(self.location.origin));if(w){await w.focus();if(target)await w.navigate(target);return;}return clients.openWindow(target);}));});
