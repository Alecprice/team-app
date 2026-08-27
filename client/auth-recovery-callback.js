const RESET_MARKER='teamapp-reset';
const MIN_PASSWORD_LENGTH=10;

function readRecoveryState(){
  const params=new URLSearchParams(location.search);
  let token=params.get('token')||'';
  const error=params.get('error')||'';
  const raw=location.search;
  if(!token){
    const legacy=raw.match(/[?&]teamapp-reset=1\?token=([^&]+)/);
    if(legacy?.[1])token=decodeURIComponent(legacy[1]);
  }
  const active=Boolean(token||error==='INVALID_TOKEN'||params.has(RESET_MARKER)||raw.includes('teamapp-reset=1?token='));
  return {active,token,error};
}

const recoveryState=readRecoveryState();

function cleanRecoveryLocation(){
  if(!recoveryState.active)return;
  history.replaceState(null,'',location.pathname+location.hash);
}

function installResetRequestCompatibility(){
  if(window.__TEAM_APP_RESET_FETCH_PATCHED__)return;
  window.__TEAM_APP_RESET_FETCH_PATCHED__=true;
  const originalFetch=window.fetch.bind(window);
  window.fetch=async (input,init={})=>{
    const requestUrl=typeof input==='string'?input:(input?.url||'');
    if(requestUrl.includes('/request-password-reset')&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        if(body?.redirectTo){
          const redirect=new URL(body.redirectTo,location.origin);
          redirect.searchParams.delete(RESET_MARKER);
          init={...init,body:JSON.stringify({...body,redirectTo:redirect.toString()})};
        }
      }catch{}
    }
    return originalFetch(input,init);
  };
}

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function busy(btn,on,label='Working…'){if(!btn)return;if(on){btn.dataset.oldText=btn.textContent;btn.textContent=label;btn.disabled=true;}else{btn.disabled=false;if(btn.dataset.oldText){btn.textContent=btn.dataset.oldText;delete btn.dataset.oldText;}}}
function replaceOverlay(html){
  window.TeamAppCloud?.closeOverlay?.();
  document.getElementById('cloudOverlay')?.remove();
  const el=document.createElement('div');
  el.className='cloud-overlay';
  el.id='cloudOverlay';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.setAttribute('aria-label','Team APP password reset');
  el.innerHTML=`<div class="cloud-sheet">${html}</div>`;
  document.body.appendChild(el);
  return el;
}

function renderInvalidReset(message){
  const el=replaceOverlay(`<div class="cloud-auth"><div class="cloud-logo">TA</div><div class="eyebrow">Account recovery</div><h1>Reset link unavailable</h1><div class="cloud-error">${esc(message)}</div><button class="primary-btn cloud-wide" id="requestFreshResetBtn">Request a new reset link</button><button class="secondary-btn cloud-wide" id="resetBackToSignInBtn">Back to sign in</button></div>`);
  el.querySelector('#requestFreshResetBtn').onclick=()=>window.TeamAppAuthRecovery?.showRecoveryRequest?.();
  el.querySelector('#resetBackToSignInBtn').onclick=()=>location.reload();
}

function renderResetForm(){
  if(!recoveryState.active)return;
  if(document.querySelector('#teamAppSafariResetPasswordForm,#requestFreshResetBtn'))return;
  if(recoveryState.error==='INVALID_TOKEN'||!recoveryState.token){
    renderInvalidReset(recoveryState.error==='INVALID_TOKEN'?'That reset link is invalid or expired. Request a fresh reset link.':'That reset link did not include a usable reset token. Request a fresh reset link.');
    return;
  }
  const el=replaceOverlay(`<div class="cloud-auth"><div class="cloud-logo">TA</div><div class="eyebrow">Account recovery</div><h1>Choose a new password</h1><p>Use at least ${MIN_PASSWORD_LENGTH} characters.</p><form id="teamAppSafariResetPasswordForm"><div class="field"><label>New password</label><input name="newPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></div><div class="field"><label>Confirm new password</label><input name="confirmPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></div><button class="primary-btn cloud-wide" type="submit">Update password</button></form><div id="teamAppSafariResetStatus" class="cloud-small" role="status" aria-live="polite"></div></div>`);
  const form=el.querySelector('#teamAppSafariResetPasswordForm'),status=el.querySelector('#teamAppSafariResetStatus');
  form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form),password=String(fd.get('newPassword')||''),confirmation=String(fd.get('confirmPassword')||''),btn=form.querySelector('button[type="submit"]');
    try{
      if(password.length<MIN_PASSWORD_LENGTH)throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      if(password!==confirmation)throw new Error('New passwords do not match.');
      if(!window.TeamAppAuthRecovery?.resetPassword)throw new Error('Password recovery service is still loading. Try again.');
      busy(btn,true,'Updating…');
      await window.TeamAppAuthRecovery.resetPassword(recoveryState.token,password);
      alert('Password updated. Team APP will reload now.');
      location.reload();
    }catch(error){status.textContent=error.message;}finally{busy(btn,false);}
  };
}

installResetRequestCompatibility();
if(recoveryState.active)cleanRecoveryLocation();

const observer=new MutationObserver(()=>renderResetForm());
function start(){observer.observe(document.body,{childList:true,subtree:true});renderResetForm();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.TeamAppAuthRecoveryCallback={recoveryState,renderResetForm};
