const NEON_AUTH_URL='https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
const MIN_PASSWORD_LENGTH=10;
const RESET_MARKER='teamapp-reset';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function authErrorMessage(body,fallback){
  return body?.error?.message||body?.message||(typeof body?.error==='string'?body.error:null)||fallback;
}

async function authPost(path,body,fallback){
  const response=await fetch(`${NEON_AUTH_URL}${path}`,{
    method:'POST',
    credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.error)throw new Error(authErrorMessage(payload,fallback));
  return payload;
}

function recoveryRedirectUrl(){
  const url=new URL(`${location.origin}${location.pathname}`);
  url.searchParams.set(RESET_MARKER,'1');
  return url.toString();
}

async function requestPasswordReset(email){
  const normalized=String(email||'').trim();
  if(!normalized)throw new Error('Enter your email address.');
  return authPost('/request-password-reset',{email:normalized,redirectTo:recoveryRedirectUrl()},'Could not request a password reset.');
}

async function resetPassword(token,newPassword){
  return authPost('/reset-password',{token:String(token||''),newPassword},'Could not reset the password. Request a new recovery link and try again.');
}

async function changePassword(currentPassword,newPassword){
  return authPost('/change-password',{currentPassword,newPassword,revokeOtherSessions:true},'Could not change the password.');
}

function validateNewPassword(password,confirmation){
  if(String(password).length<MIN_PASSWORD_LENGTH)throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if(password!==confirmation)throw new Error('New passwords do not match.');
}

function closeOverlay(){window.TeamAppCloud?.closeOverlay?.();document.getElementById('cloudOverlay')?.remove();}
function recoveryOverlay(html,label='Team APP account recovery'){
  closeOverlay();
  const el=document.createElement('div');
  el.className='cloud-overlay';
  el.id='cloudOverlay';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.setAttribute('aria-label',label);
  el.innerHTML=`<div class="cloud-sheet">${html}</div>`;
  document.body.appendChild(el);
  return el;
}
function busy(btn,on,label='Working…'){if(!btn)return;if(on){btn.dataset.oldText=btn.textContent;btn.textContent=label;btn.disabled=true;}else{btn.disabled=false;if(btn.dataset.oldText){btn.textContent=btn.dataset.oldText;delete btn.dataset.oldText;}}}

function cleanRecoveryUrl(){
  const url=new URL(location.href);
  for(const key of [RESET_MARKER,'token','error','error_description'])url.searchParams.delete(key);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}

function showRecoveryRequest(prefill=''){
  const el=recoveryOverlay(`<div class="cloud-auth"><div class="cloud-logo">TA</div><div class="eyebrow">Account recovery</div><h1>Reset your password</h1><p>Enter the email address on your adult Team APP account. We will send a short-lived recovery link.</p><form id="teamAppRecoveryRequestForm"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required value="${esc(prefill)}"></div><button class="primary-btn cloud-wide" type="submit">Send reset link</button></form><div id="teamAppRecoveryStatus" class="cloud-small" role="status" aria-live="polite"></div><button class="secondary-btn cloud-wide" type="button" id="teamAppRecoveryBackBtn">Back to sign in</button></div>`);
  const form=el.querySelector('#teamAppRecoveryRequestForm'),status=el.querySelector('#teamAppRecoveryStatus');
  form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('button[type="submit"]'),email=new FormData(form).get('email');try{busy(btn,true,'Sending…');await requestPasswordReset(email);status.textContent='If an account exists for that email, a password reset link has been sent. Recovery links expire quickly, so use the newest email.';}catch(error){status.textContent=error.message;}finally{busy(btn,false);}};
  el.querySelector('#teamAppRecoveryBackBtn').onclick=()=>{cleanRecoveryUrl();location.reload();};
}

function showResetPassword(token,errorCode=''){
  if(errorCode||!token){
    const message=errorCode==='INVALID_TOKEN'?'That reset link is invalid or expired.':'This reset link is missing its secure token.';
    const el=recoveryOverlay(`<div class="cloud-auth"><div class="cloud-logo">TA</div><div class="eyebrow">Account recovery</div><h1>Reset link unavailable</h1><div class="cloud-error">${esc(message)}</div><button class="primary-btn cloud-wide" id="teamAppRequestAnotherReset">Request a new link</button><button class="secondary-btn cloud-wide" id="teamAppResetBackBtn">Back to sign in</button></div>`);
    el.querySelector('#teamAppRequestAnotherReset').onclick=()=>{cleanRecoveryUrl();showRecoveryRequest();};
    el.querySelector('#teamAppResetBackBtn').onclick=()=>{cleanRecoveryUrl();location.reload();};
    return;
  }
  const el=recoveryOverlay(`<div class="cloud-auth"><div class="cloud-logo">TA</div><div class="eyebrow">Account recovery</div><h1>Choose a new password</h1><p>Use at least ${MIN_PASSWORD_LENGTH} characters. After reset, sign in again if Team APP does not resume automatically.</p><form id="teamAppResetPasswordForm"><div class="field"><label>New password</label><input name="newPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></div><div class="field"><label>Confirm new password</label><input name="confirmPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></div><button class="primary-btn cloud-wide" type="submit">Update password</button></form><div id="teamAppResetStatus" class="cloud-small" role="status" aria-live="polite"></div></div>`);
  const form=el.querySelector('#teamAppResetPasswordForm'),status=el.querySelector('#teamAppResetStatus');
  form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),password=String(fd.get('newPassword')||''),confirmation=String(fd.get('confirmPassword')||''),btn=form.querySelector('button[type="submit"]');try{validateNewPassword(password,confirmation);busy(btn,true,'Updating…');await resetPassword(token,password);cleanRecoveryUrl();alert('Password updated. Team APP will reload now.');location.reload();}catch(error){status.textContent=error.message;}finally{busy(btn,false);}};
}

function showChangePassword(){
  const el=recoveryOverlay(`<div class="cloud-auth"><div class="cloud-logo">TA</div><div class="eyebrow">Account security</div><h1>Change password</h1><p>Changing your password signs out your other Team APP sessions.</p><form id="teamAppChangePasswordForm"><div class="field"><label>Current password</label><input name="currentPassword" type="password" autocomplete="current-password" required></div><div class="field"><label>New password</label><input name="newPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></div><div class="field"><label>Confirm new password</label><input name="confirmPassword" type="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></div><button class="primary-btn cloud-wide" type="submit">Change password</button></form><div id="teamAppChangePasswordStatus" class="cloud-small" role="status" aria-live="polite"></div><button class="secondary-btn cloud-wide" type="button" id="teamAppChangePasswordBackBtn">Back to account</button></div>`);
  const form=el.querySelector('#teamAppChangePasswordForm'),status=el.querySelector('#teamAppChangePasswordStatus');
  form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),currentPassword=String(fd.get('currentPassword')||''),newPassword=String(fd.get('newPassword')||''),confirmation=String(fd.get('confirmPassword')||''),btn=form.querySelector('button[type="submit"]');try{validateNewPassword(newPassword,confirmation);busy(btn,true,'Changing…');await changePassword(currentPassword,newPassword);alert('Password changed. Other Team APP sessions were signed out.');location.reload();}catch(error){status.textContent=error.message;}finally{busy(btn,false);}};
  el.querySelector('#teamAppChangePasswordBackBtn').onclick=()=>window.TeamAppCloud?.openAccount?.();
}

function enhanceLogin(){
  const original=document.querySelector('#cloudOverlay #forgotPasswordBtn');
  if(!original||original.dataset.completeRecovery==='1')return;
  const btn=original.cloneNode(true);btn.dataset.completeRecovery='1';original.replaceWith(btn);
  btn.addEventListener('click',()=>{const email=document.querySelector('#cloudOverlay #cloudAuthForm [name="email"]')?.value?.trim()||'';showRecoveryRequest(email);});
}

function enhanceAccount(){
  const sheet=document.querySelector('#cloudOverlay .cloud-sheet'),signOut=sheet?.querySelector('#signOutBtn');
  if(!sheet||!signOut||sheet.querySelector('#changePasswordBtn'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='secondary-btn';btn.id='changePasswordBtn';btn.textContent='Change password';signOut.insertAdjacentElement('beforebegin',btn);btn.addEventListener('click',showChangePassword);
}

function handleRecoveryCallback(){
  const params=new URLSearchParams(location.search);
  if(params.get(RESET_MARKER)!=='1')return false;
  if(document.querySelector('#teamAppResetPasswordForm,#teamAppRequestAnotherReset'))return true;
  showResetPassword(params.get('token')||'',params.get('error')||'');
  return true;
}

function enhance(){if(handleRecoveryCallback())return;enhanceLogin();enhanceAccount();}
const observer=new MutationObserver(enhance);
function start(){observer.observe(document.body,{childList:true,subtree:true});enhance();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.TeamAppAuthRecovery={requestPasswordReset,resetPassword,changePassword,showRecoveryRequest,showChangePassword};
