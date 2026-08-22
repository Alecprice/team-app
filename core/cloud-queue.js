(function(root){
  'use strict';
  const DB_NAME='team-app-cloud-v1',DB_VERSION=1,STORE='syncQueue',LEGACY_KEY='team-app-cloud-sync-queue-v1';
  const MAX_ENTRIES=100,MAX_ITEM_BYTES=4718592;
  const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
  function notify(){try{if(typeof root.dispatchEvent==='function'&&typeof root.Event==='function')root.dispatchEvent(new root.Event('teamapp:queue-change'));}catch{}}
  function legacyGet(){try{const v=JSON.parse(root.localStorage?.getItem(LEGACY_KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
  function legacySet(v){try{root.localStorage?.setItem(LEGACY_KEY,JSON.stringify(v));return true;}catch{return false;}}
  function openDb(){return new Promise((resolve,reject)=>{if(!('indexedDB' in root)){reject(new Error('IndexedDB unavailable'));return;}const r=root.indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'teamId'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Cloud queue unavailable'));});}
  async function existingIds(){return (await entries()).map(([id])=>id);}
  async function put(teamId,payload){
    if(!teamId||bytes(payload)>MAX_ITEM_BYTES)return false;
    const ids=await existingIds();if(!ids.includes(teamId)&&ids.length>=MAX_ENTRIES)return false;
    try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({teamId,payload,queuedAt:new Date().toISOString()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();notify();return true;}catch{const q=legacyGet();q[teamId]={...payload,queuedAt:new Date().toISOString()};const ok=legacySet(q);if(ok)notify();return ok;}
  }
  async function remove(teamId){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(teamId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch{const q=legacyGet();delete q[teamId];legacySet(q);}const q=legacyGet();if(q[teamId]){delete q[teamId];legacySet(q);}notify();return true;}
  async function entries(){let rows=[];try{const db=await openDb();rows=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});db.close();}catch{}const merged=new Map(rows.map(r=>[r.teamId,r.payload]));for(const [teamId,p] of Object.entries(legacyGet()))if(!merged.has(teamId))merged.set(teamId,p);return [...merged.entries()];}
  async function clear(){for(const [id] of await entries())await remove(id);}
  root.TEAM_APP_CLOUD_QUEUE={put,remove,entries,clear,limits:{maxEntries:MAX_ENTRIES,maxItemBytes:MAX_ITEM_BYTES}};
})(typeof globalThis!=='undefined'?globalThis:this);
