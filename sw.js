const CACHE='team-app-live-v1.9.0';
const ASSETS=['./','./index.html','./styles.css','./sports.js','./competition-profiles.js','./core/file-store.js','./core/sport-runtime.js','./core/e2ee.js','./cloud-client.js','./app.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/auth/'))return;
  event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{};}catch{data={title:'Team APP',body:event.data?.text()||'You have a team update.'};}const title=data.title||'Team APP';const options={body:data.body||'You have a team update.',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:data.tag||data.category||'team-app',data:data.payload||{},renotify:Boolean(data.renotify)};event.waitUntil(self.registration.showNotification(title,options));});
self.addEventListener('notificationclick',event=>{event.notification.close();const p=event.notification.data||{};const target=p.url|| (p.eventId?'./#schedule':'./');event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(wins=>{const w=wins.find(x=>x.url.startsWith(self.location.origin));if(w){w.focus();if(p.url)w.navigate(p.url);return;}return clients.openWindow(target);}));});
