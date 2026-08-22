import {createClient} from '@neondatabase/neon-js';

const NEON_AUTH_URL='https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
const NEON_DATA_API_URL='https://ep-noisy-violet-awtos8ns.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1';
const neon=createClient({auth:{url:NEON_AUTH_URL},dataApi:{url:NEON_DATA_API_URL}});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function rpc(action,payload={}){
  const {data,error}=await neon.rpc('app_api',{p_action:action,p_payload:payload});
  if(error)throw new Error(error.message||error.details||'Cloud access request failed');
  if(data&&typeof data==='object'&&!Array.isArray(data)&&data.error)throw new Error(data.error);
  return data;
}
function teamId(){return window.TeamAppRuntime?.getActiveCloudPayload?.()?.teamRecord?.remoteId||null;}
function role(){return window.TeamAppCloud?.roleForActiveTeam?.()||null;}
function currentUser(){return window.TeamAppCloud?.me?.user?.id||window.TeamAppCloud?.session?.user?.id||null;}

async function members(){const id=teamId();if(!id)return [];return rpc('team.members',{teamId:id});}
async function invitations(){const id=teamId();if(!id)return [];return rpc('invitation.list',{teamId:id});}
async function updateRole(userId,nextRole){const id=teamId();if(!id)throw new Error('No cloud team selected.');return rpc('member.role.update',{teamId:id,userId,role:nextRole});}
async function removeMember(userId){const id=teamId();if(!id)throw new Error('No cloud team selected.');return rpc('member.remove',{teamId:id,userId});}
async function transferOwner(userId){const id=teamId();if(!id)throw new Error('No cloud team selected.');return rpc('team.owner.transfer',{teamId:id,userId});}
async function revokeInvitation(invitationId){const id=teamId();if(!id)throw new Error('No cloud team selected.');return rpc('invitation.revoke',{teamId:id,invitationId});}

function busy(btn,on,label='Working…'){if(!btn)return;if(on){btn.dataset.oldText=btn.textContent;btn.textContent=label;btn.disabled=true;}else{btn.disabled=false;if(btn.dataset.oldText){btn.textContent=btn.dataset.oldText;delete btn.dataset.oldText;}}}
function accessSheet(){const sheet=document.querySelector('#cloudOverlay .cloud-sheet');if(!sheet)return null;const title=sheet.querySelector('h2')?.textContent||'';return /Invite coaches\s*&\s*guardians/i.test(title)?sheet:null;}

async function renderManager(container){
  const [list,invites]=await Promise.all([members(),invitations()]);
  const actorRole=role(),me=currentUser(),canAdmin=['owner','admin'].includes(actorRole);
  const roleOptions=['admin','coach','assistant_coach','manager','guardian','member','readonly'];
  container.innerHTML=`<div class="separator"></div><div class="card-title-row"><div><h3>Current access</h3><div class="card-sub">Remove access immediately or change a member role.</div></div><button class="secondary-btn small-btn" id="refreshAccessHardening">Refresh</button></div><div class="cloud-access-member-list">${list.length?list.map(m=>`<div class="cloud-access-member"><div><strong>${esc(m.display_name||m.email||'Team member')}</strong><span>${esc(m.role)}${Array.isArray(m.athletes)&&m.athletes.length?` · ${esc(m.athletes.map(a=>a.name).join(', '))}`:''}</span></div>${m.role==='owner'?'<span class="cloud-ok">Owner</span>':canAdmin?`<div class="cloud-access-actions"><select data-hardening-role="${esc(m.id)}" aria-label="Role for ${esc(m.display_name||m.email||'team member')}">${roleOptions.map(r=>`<option value="${r}" ${r===m.role?'selected':''}>${esc(r.replaceAll('_',' '))}</option>`).join('')}</select>${actorRole==='owner'&&m.id!==me?`<button class="secondary-btn small-btn" data-hardening-owner="${esc(m.id)}">Make owner</button>`:''}<button class="danger-btn small-btn" data-hardening-remove="${esc(m.id)}">Remove</button></div>`:''}</div>`).join(''):'<div class="empty-state">No members found.</div>'}</div><div class="separator"></div><h3>Pending invitations</h3><div class="cloud-access-invite-list">${invites.filter(i=>!i.accepted_at&&!i.revoked_at).length?invites.filter(i=>!i.accepted_at&&!i.revoked_at).map(i=>`<div class="cloud-access-member"><div><strong>${esc(i.email)}</strong><span>${esc(i.role)} · expires ${new Date(i.expires_at).toLocaleString()}</span></div>${canAdmin?`<button class="danger-btn small-btn" data-hardening-revoke-invite="${esc(i.id)}">Revoke</button>`:''}</div>`).join(''):'<div class="empty-state">No pending invitations.</div>'}</div>`;
  container.querySelector('#refreshAccessHardening')?.addEventListener('click',()=>renderManager(container));
  container.querySelectorAll('[data-hardening-role]').forEach(sel=>sel.addEventListener('change',async()=>{const before=list.find(m=>String(m.id)===String(sel.dataset.hardeningRole))?.role;if(!confirm(`Change this member from ${before} to ${sel.value}?`)){sel.value=before;return;}sel.disabled=true;try{await updateRole(sel.dataset.hardeningRole,sel.value);await renderManager(container);}catch(e){alert(e.message);sel.value=before;}finally{sel.disabled=false;}}));
  container.querySelectorAll('[data-hardening-remove]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Remove this adult from the team? Their team and conversation access will be revoked immediately.'))return;try{busy(btn,true,'Removing…');await removeMember(btn.dataset.hardeningRemove);await renderManager(container);}catch(e){alert(e.message);}finally{busy(btn,false);}}));
  container.querySelectorAll('[data-hardening-owner]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Transfer team ownership to this adult? You will become an admin.'))return;try{busy(btn,true,'Transferring…');await transferOwner(btn.dataset.hardeningOwner);location.reload();}catch(e){alert(e.message);busy(btn,false);}}));
  container.querySelectorAll('[data-hardening-revoke-invite]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Revoke this invitation?'))return;try{busy(btn,true,'Revoking…');await revokeInvitation(btn.dataset.hardeningRevokeInvite);await renderManager(container);}catch(e){alert(e.message);}finally{busy(btn,false);}}));
}

function enhance(){const sheet=accessSheet();if(!sheet||sheet.querySelector('#teamAppAccessHardening'))return;const box=document.createElement('section');box.id='teamAppAccessHardening';box.className='teamapp-access-hardening';box.innerHTML='<div class="separator"></div><button class="secondary-btn cloud-wide" id="manageAccessHardeningBtn">Manage current members & invitations</button><div id="accessHardeningBody"></div>';sheet.appendChild(box);box.querySelector('#manageAccessHardeningBtn').addEventListener('click',async e=>{const btn=e.currentTarget,body=box.querySelector('#accessHardeningBody');try{busy(btn,true,'Loading access…');await renderManager(body);btn.hidden=true;}catch(err){body.innerHTML=`<div class="cloud-error">${esc(err.message)}</div>`;}finally{busy(btn,false);}});}

const observer=new MutationObserver(enhance);
function start(){observer.observe(document.body,{childList:true,subtree:true});enhance();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.TeamAppCloudAdmin={members,invitations,updateRole,removeMember,transferOwner,revokeInvitation};
