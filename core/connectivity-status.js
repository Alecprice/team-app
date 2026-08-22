(function(root){
  'use strict';

  const ID='teamConnectivityStatus';
  let observer=null,timer=null,updating=false;

  async function pendingCount(){
    try{return (await root.TEAM_APP_CLOUD_QUEUE?.entries?.()||[]).length;}catch{return 0;}
  }

  function ensureChip(){
    const topbar=document.querySelector('.topbar-inner');
    if(!topbar)return null;
    let chip=document.getElementById(ID);
    if(chip&&chip.parentElement===topbar)return chip;
    chip?.remove();
    chip=document.createElement('div');
    chip.id=ID;
    chip.className='connectivity-chip';
    chip.setAttribute('role','status');
    chip.setAttribute('aria-live','polite');
    chip.innerHTML='<span class="connectivity-dot" aria-hidden="true"></span><span class="connectivity-label">Checking…</span>';
    const account=topbar.querySelector('#cloudAccountBtn');
    if(account)topbar.insertBefore(chip,account);else topbar.appendChild(chip);
    return chip;
  }

  function updateCoachPanel(online,pending){
    const sub=document.querySelector('.cloud-coach-card .card-sub');
    if(!sub)return;
    const match=sub.textContent.match(/^(?:Synced|Sync pending|Offline changes saved) · (.+)$/);
    if(!match)return;
    const role=match[1],prefix=!online&&pending?'Offline changes saved':pending?'Sync pending':'Synced';
    const next=`${prefix} · ${role}`;
    if(sub.textContent!==next)sub.textContent=next;
  }

  async function update(){
    if(updating)return;
    updating=true;
    try{
      const chip=ensureChip();if(!chip)return;
      const pending=await pendingCount(),online=navigator.onLine!==false;
      updateCoachPanel(online,pending);
      let mode='online',label='Online',detail='Online and no offline changes are waiting to sync.';
      if(!online){
        mode='offline';label=pending?`Offline · ${pending} saved`:'Offline';detail=pending?`${pending} team update${pending===1?' is':'s are'} saved on this device and will sync after reconnecting.`:'Offline. Team APP remains available from this device where cached.';
      }else if(pending){
        mode='pending';label=`Sync pending · ${pending}`;detail=`${pending} saved team update${pending===1?' is':'s are'} waiting for cloud synchronization.`;
      }
      const labelEl=chip.querySelector('.connectivity-label');
      const changed=chip.dataset.state!==mode||labelEl?.textContent!==label||chip.getAttribute('aria-label')!==detail;
      if(!changed)return;
      chip.dataset.state=mode;
      if(labelEl)labelEl.textContent=label;
      chip.setAttribute('aria-label',detail);
      chip.title=detail;
    }finally{
      updating=false;
      if(!document.getElementById(ID))root.setTimeout(update,0);
    }
  }

  function start(){
    if(observer)return;
    observer=new MutationObserver(()=>update());
    const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});
    root.addEventListener('online',update);
    root.addEventListener('offline',update);
    timer=root.setInterval(update,5000);
    update();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
