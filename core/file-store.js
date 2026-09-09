(function(root){
  'use strict';
  const DB_NAME='team-app-files-v2';const DB_VERSION=1;const STORE='files';const ACCOUNT_MARKER='team-app-last-auth-user';
  function account(){try{return root.localStorage?.getItem(ACCOUNT_MARKER)||'unclaimed';}catch{return 'unclaimed';}}
  function storageKey(teamId,fileId){return `${account()}:${teamId}:${fileId}`;}
  function openDb(){return new Promise((resolve,reject)=>{if(!('indexedDB' in root)){reject(new Error('IndexedDB unavailable'));return;}const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open file store'));});}
  async function put(teamId,fileId,file){const db=await openDb(),accountId=account();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:`${accountId}:${teamId}:${fileId}`,accountId,teamId,fileId,name:file.name,type:file.type,size:file.size,lastModified:file.lastModified||Date.now(),blob:file});tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};});}
  async function get(teamId,fileId){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(storageKey(teamId,fileId));req.onsuccess=()=>{db.close();resolve(req.result||null);};req.onerror=()=>{db.close();reject(req.error);};});}
  async function remove(teamId,fileId){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(storageKey(teamId,fileId));tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};});}
  async function removeTeam(teamId){const db=await openDb(),accountId=account();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);const req=store.openCursor();req.onsuccess=()=>{const c=req.result;if(c){if(c.value.accountId===accountId&&c.value.teamId===teamId)c.delete();c.continue();}};tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};});}
  async function migrateUnclaimed(userId){
    const accountId=String(userId||'').trim();if(!accountId)throw new Error('Account id required for local file migration');
    const db=await openDb();return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);let moved=0;
      const req=store.openCursor();
      req.onsuccess=()=>{
        const cursor=req.result;if(!cursor)return;
        const value=cursor.value;
        if(value?.accountId!=='unclaimed'){cursor.continue();return;}
        const targetKey=`${accountId}:${value.teamId}:${value.fileId}`;
        const target=store.get(targetKey);
        target.onsuccess=()=>{
          if(!target.result){store.put({...value,key:targetKey,accountId});moved+=1;}
          cursor.delete();cursor.continue();
        };
        target.onerror=()=>tx.abort();
      };
      req.onerror=()=>tx.abort();
      tx.oncomplete=()=>{db.close();resolve(moved);};
      tx.onerror=()=>{const error=tx.error||new Error('Could not migrate local files');db.close();reject(error);};
      tx.onabort=()=>{const error=tx.error||new Error('Could not migrate local files');db.close();reject(error);};
    });
  }
  root.TEAM_APP_FILE_STORE={put,get,remove,removeTeam,migrateUnclaimed};
})(typeof globalThis!=='undefined'?globalThis:this);
