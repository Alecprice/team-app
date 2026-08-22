(function(root){
  'use strict';

  const DEMO=new URLSearchParams(root.location?.search||'').get('demo')==='1';
  const STATE_KEYS=new Set(['team-app-service-v1.10-state','team-app-service-v1.9-state','team-app-service-v1.8-state','team-app-coach-v1.7-state','team-app-multisport-v1-state','team-app-baseball-v1-state']);
  const DEMO_PREFIX='team-app-demo:';
  const channel=('BroadcastChannel' in root)?new BroadcastChannel('team-app-v1.10'):null;
  let focusReturn=null,filterSeq=0,syncPatched=false;

  function dispatch(name,detail={}){try{root.dispatchEvent(new CustomEvent(name,{detail}));}catch{}}
  function hash(value){const text=JSON.stringify(value);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return `${text.length}:${(h>>>0).toString(16)}`;}

  // Demo is intentionally isolated from real account state without changing the mature app-state engine.
  if(DEMO&&root.Storage?.prototype){
    const proto=root.Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem;
    proto.getItem=function(key){return get.call(this,STATE_KEYS.has(String(key))?DEMO_PREFIX+key:key);};
    proto.setItem=function(key,value){return set.call(this,STATE_KEYS.has(String(key))?DEMO_PREFIX+key:key,value);};
    proto.removeItem=function(key){return remove.call(this,STATE_KEYS.has(String(key))?DEMO_PREFIX+key:key);};
  }

  // Surface browser quota/private-mode failures instead of silently relying on volatile memory.
  if(root.Storage?.prototype){
    const proto=root.Storage.prototype,set=proto.setItem;
    if(!proto.__teamAppHardenedSetItem){
      proto.setItem=function(key,value){
        try{const result=set.call(this,key,value);if(String(key).includes('team-app'))channel?.postMessage({type:'storage-write',at:Date.now()});return result;}
        catch(error){dispatch('teamapp:storage-failure',{key:String(key),message:String(error?.message||error)});throw error;}
      };
      Object.defineProperty(proto,'__teamAppHardenedSetItem',{value:true});
    }
  }

  function storageBanner(message='Changes cannot be saved permanently on this device. Keep this page open and reconnect/export before leaving.'){
    let el=document.getElementById('teamAppStorageWarning');
    if(!el){el=document.createElement('div');el.id='teamAppStorageWarning';el.className='teamapp-persistent-warning';el.setAttribute('role','alert');document.body.appendChild(el);}
    el.textContent=message;
  }
  root.addEventListener('teamapp:storage-failure',()=>storageBanner());

  function cloudPresent(){return Boolean(root.TeamAppCloud);}
  function updateAuthLock(){
    if(DEMO||!cloudPresent()){document.body.classList.remove('teamapp-auth-locked');return;}
    const signedIn=Boolean(root.TeamAppCloud.session?.user);
    document.body.classList.toggle('teamapp-auth-locked',!signedIn);
    dispatch('teamapp:cloud-state-change',{signedIn});
  }

  function repairLabels(scope=document){
    scope.querySelectorAll?.('.field').forEach(field=>{
      const label=field.querySelector(':scope > label');const control=field.querySelector(':scope > input:not([type="hidden"]),:scope > select,:scope > textarea');
      if(!label||!control||label.contains(control)||control.getAttribute('aria-label')||control.getAttribute('aria-labelledby'))return;
      if(!control.id)control.id=`teamappField${++filterSeq}`;
      if(!label.htmlFor)label.htmlFor=control.id;
    });
    scope.querySelectorAll?.('.toast').forEach(el=>{el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
  }

  function addListFilter(list,label){
    if(list.dataset.teamappFilter==='1'||list.children.length<12)return;
    list.dataset.teamappFilter='1';
    const input=document.createElement('input');input.type='search';input.className='teamapp-list-filter';input.placeholder=`Search ${label}…`;input.setAttribute('aria-label',`Search ${label}`);
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();[...list.children].forEach(row=>{row.hidden=Boolean(q&&!row.textContent.toLowerCase().includes(q));});});
    list.parentNode.insertBefore(input,list);
  }

  function hardenDynamicUi(scope=document){
    repairLabels(scope);
    if(!DEMO)scope.querySelectorAll?.('#resetApp').forEach(el=>el.remove());
    scope.querySelectorAll?.('#documentForm select[name="category"] option').forEach(o=>{if(/medical\s*\/\s*safety/i.test(o.textContent||''))o.remove();});
    scope.querySelectorAll?.('.roster-list').forEach(el=>addListFilter(el,'players'));
    scope.querySelectorAll?.('.document-list').forEach(el=>addListFilter(el,'documents'));
    scope.querySelectorAll?.('.game-event-list').forEach(el=>addListFilter(el,'events'));
    scope.querySelectorAll?.('.badge-dot').forEach(el=>{if(!el.dataset.unread)el.hidden=true;});
  }

  function focusables(container){return [...container.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&el.getClientRects().length);}
  document.addEventListener('keydown',event=>{
    const modal=document.querySelector('.modal,.cloud-sheet');
    if(event.key==='Tab'&&modal){const items=focusables(modal);if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    if((event.key==='Escape')&&document.body.classList.contains('teamapp-auth-locked')&&document.getElementById('cloudOverlay')){event.preventDefault();event.stopImmediatePropagation();}
  },true);

  document.addEventListener('click',event=>{
    const overlay=event.target.closest?.('#cloudOverlay');
    if(overlay&&event.target===overlay&&document.body.classList.contains('teamapp-auth-locked')){event.preventDefault();event.stopImmediatePropagation();return;}
    const locationButton=event.target.closest?.('#useTeamLocationBtn,[data-event-location]');
    if(locationButton&&!locationButton.dataset.locationConfirmed){
      const ok=root.confirm('Use this phone’s current location? The saved venue/location may be shared with authorized team members.');
      if(!ok){event.preventDefault();event.stopImmediatePropagation();return;}
      locationButton.dataset.locationConfirmed='1';queueMicrotask(()=>delete locationButton.dataset.locationConfirmed);
    }
  },true);

  function patchSyncScheduler(){
    if(syncPatched||!root.TeamAppCloud?.scheduleSync||!root.TeamAppRuntime?.getActiveCloudPayload)return;
    const original=root.TeamAppCloud.scheduleSync.bind(root.TeamAppCloud),lastByTeam=new Map();
    root.TeamAppCloud.scheduleSync=function(){
      const payload=root.TeamAppRuntime?.getActiveCloudPayload?.();if(!payload)return original();
      const key=payload.teamRecord?.remoteId||payload.teamRecord?.id||'active';const next=hash(payload);
      if(root.navigator?.onLine!==false&&lastByTeam.get(key)===next)return;
      lastByTeam.set(key,next);return original();
    };
    syncPatched=true;
  }

  const observer=new MutationObserver(records=>{
    for(const record of records){for(const node of record.addedNodes){if(node.nodeType!==1)continue;if(node.matches?.('.modal,.cloud-sheet')&&!focusReturn)focusReturn=document.activeElement;hardenDynamicUi(node);}}
    if(!document.querySelector('.modal,.cloud-sheet')&&focusReturn){const target=focusReturn;focusReturn=null;if(target?.isConnected)target.focus();}
    updateAuthLock();patchSyncScheduler();
  });

  function start(){
    hardenDynamicUi(document);updateAuthLock();patchSyncScheduler();observer.observe(document.body,{childList:true,subtree:true});
    root.setInterval(()=>{updateAuthLock();patchSyncScheduler();},2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  channel?.addEventListener('message',event=>{if(event.data?.type==='storage-write')dispatch('teamapp:other-tab-change',event.data);});
})(typeof window!=='undefined'?window:globalThis);
