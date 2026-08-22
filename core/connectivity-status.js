(function(root){
  'use strict';

  const ID='teamConnectivityStatus';
  let observer=null,timer=null,updating=false,rerun=false;

  async function queueState(){
    try{
      const rows=await root.TEAM_APP_CLOUD_QUEUE?.entries?.()||[];
      const activeId=root.TeamAppRuntime?.getActiveCloudPayload?.()?.teamRecord?.remoteId||null;
      return {total:rows.length,active:activeId?rows.some(([id])=>id===activeId):false};
    }catch{return {total:0,active:false};}
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

  function updateCoachPanel(online,activePending){
    const sub=document.querySelector('.cloud-coach-card .card-sub');
    if(!sub)return;
    const match=sub.textContent.match(/^(?:Synced|Sync pending|Offline changes saved) · (.+)$/);
    if(!match)return;
    const role=match[1];
    const prefix=activePending?(!online?'Offline changes saved':'Sync pending'):'Synced';
    const next=`${prefix} · ${role}`;
    if(sub.textContent!==next)sub.textContent=next;
  }

  async function update(){
    if(updating){rerun=true;return;}
    updating=true;
    try{
      const chip=ensureChip();if(!chip)return;
      const queue=await queueState(),online=navigator.onLine!==false;
      updateCoachPanel(online,queue.active);
      let mode='online',label='Online',detail='Online and no offline changes are waiting to sync.';
      if(!online){
        mode='offline';label=queue.total?`Offline · ${queue.total} saved`:'Offline';detail=queue.total?`${queue.total} team update${queue.total===1?' is':'s are'} saved on this device and will sync after reconnecting.`:'Offline. Team APP remains available from this device where cached.';
      }else if(queue.total){
        mode='pending';label=`Sync pending · ${queue.total}`;detail=`${queue.total} saved team update${queue.total===1?' is':'s are'} waiting for cloud synchronization.`;
      }
      const labelEl=chip.querySelector('.connectivity-label');
      const changed=chip.dataset.state!==mode||labelEl?.textContent!==label||chip.getAttribute('aria-label')!==detail;
      if(changed){
        chip.dataset.state=mode;
        if(labelEl)labelEl.textContent=label;
        chip.setAttribute('aria-label',detail);
        chip.title=detail;
      }
    }finally{
      updating=false;
      if(rerun){rerun=false;root.setTimeout(update,0);}
      else if(!document.getElementById(ID))root.setTimeout(update,0);
    }
  }

  function start(){
    if(observer)return;
    observer=new MutationObserver(()=>update());
    const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});
    root.addEventListener('online',update);
    root.addEventListener('offline',update);
    root.addEventListener('teamapp:queue-change',update);
    timer=root.setInterval(update,5000);
    update();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
