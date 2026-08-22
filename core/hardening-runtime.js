(function(root){
  'use strict';

  const DEMO=new URLSearchParams(root.location?.search||'').get('demo')==='1';
  const STATE_KEYS=new Set(['team-app-service-v1.10-state','team-app-service-v1.9-state','team-app-service-v1.8-state','team-app-coach-v1.7-state','team-app-multisport-v1-state','team-app-baseball-v1-state']);
  const DEMO_PREFIX='team-app-demo:';
  const ACCOUNT_MARKER='team-app-last-auth-user';
  const channel=('BroadcastChannel' in root)?new BroadcastChannel('team-app-v1.10'):null;
  const rawStorage=root.Storage?.prototype?{
    get:root.Storage.prototype.getItem,
    set:root.Storage.prototype.setItem,
    remove:root.Storage.prototype.removeItem
  }:null;
  let focusReturn=null,filterSeq=0,syncPatched=false,reloadForAccount=false;

  function dispatch(name,detail={}){try{root.dispatchEvent(new CustomEvent(name,{detail}));}catch{}}
  function hash(value){const text=JSON.stringify(value);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return `${text.length}:${(h>>>0).toString(16)}`;}
  function rawGet(key){try{return rawStorage?.get.call(root.localStorage,key)||null;}catch{return null;}}
  function rawSet(key,value){try{rawStorage?.set.call(root.localStorage,key,String(value));return true;}catch{return false;}}
  function storageNamespace(){if(DEMO)return DEMO_PREFIX;const account=rawGet(ACCOUNT_MARKER);return account?`team-app-account:${account}:`:'team-app-unclaimed:';}
  function mappedKey(key){return STATE_KEYS.has(String(key))?storageNamespace()+key:key;}

  // All app-state keys are account scoped. Demo has a fully separate namespace.
  if(rawStorage){
    const proto=root.Storage.prototype;
    proto.getItem=function(key){return rawStorage.get.call(this,mappedKey(key));};
    proto.removeItem=function(key){return rawStorage.remove.call(this,mappedKey(key));};
    proto.setItem=function(key,value){
      const mapped=mappedKey(key);
      try{const result=rawStorage.set.call(this,mapped,value);if(String(mapped).includes('team-app'))channel?.postMessage({type:'storage-write',account:rawGet(ACCOUNT_MARKER),at:Date.now()});return result;}
      catch(error){dispatch('teamapp:storage-failure',{key:String(mapped),message:String(error?.message||error)});throw error;}
    };
  }

  function storageBanner(message='Changes cannot be saved permanently on this device. Keep this page open and reconnect/export before leaving.'){
    let el=document.getElementById('teamAppStorageWarning');
    if(!el){el=document.createElement('div');el.id='teamAppStorageWarning';el.className='teamapp-persistent-warning';el.setAttribute('role','alert');document.body.appendChild(el);}
    el.textContent=message;
  }
  root.addEventListener('teamapp:storage-failure',()=>storageBanner());

  function cloudPresent(){return Boolean(root.TeamAppCloud);}
  function reconcileAccountNamespace(){
    if(DEMO||!cloudPresent())return;
    const userId=root.TeamAppCloud.session?.user?.id||null;if(!userId)return;
    const marker=rawGet(ACCOUNT_MARKER);
    if(marker===String(userId))return;
    if(!rawSet(ACCOUNT_MARKER,userId))return;
    channel?.postMessage({type:'account-change',account:String(userId),at:Date.now()});
    const key='team-app-account-reload';
    try{
      if(root.sessionStorage.getItem(key)!==String(userId)){
        root.sessionStorage.setItem(key,String(userId));reloadForAccount=true;root.location.reload();
      }
    }catch{}
  }
  function updateAuthLock(){
    if(DEMO||!cloudPresent()){document.body.classList.remove('teamapp-auth-locked');return;}
    const signedIn=Boolean(root.TeamAppCloud.session?.user);
    document.body.classList.toggle('teamapp-auth-locked',!signedIn);
    if(signedIn)reconcileAccountNamespace();
    dispatch('teamapp:cloud-state-change',{signedIn,account:root.TeamAppCloud.session?.user?.id||null});
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
    if(event.key==='Escape'&&document.body.classList.contains('teamapp-auth-locked')&&document.getElementById('cloudOverlay')){event.preventDefault();event.stopImmediatePropagation();}
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
    if(!reloadForAccount){updateAuthLock();patchSyncScheduler();}
  });

  function start(){
    hardenDynamicUi(document);updateAuthLock();patchSyncScheduler();observer.observe(document.body,{childList:true,subtree:true});
    root.setInterval(()=>{if(!reloadForAccount){updateAuthLock();patchSyncScheduler();}},1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  channel?.addEventListener('message',event=>{
    if(event.data?.type==='storage-write'&&event.data.account===rawGet(ACCOUNT_MARKER))dispatch('teamapp:other-tab-change',event.data);
    if(event.data?.type==='account-change'&&event.data.account!==rawGet(ACCOUNT_MARKER))storageBanner('Another tab changed the signed-in Team APP account. Reload this tab before editing team data.');
  });
})(typeof window!=='undefined'?window:globalThis);
