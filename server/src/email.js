import {config} from './config.js';

export async function sendEmail({to,subject,html,text}){
  if(!config.resendApiKey){
    if(config.nodeEnv!=='production'){
      console.log(`[email:dev] to=${to} subject=${subject}\n${text||html}`);
      return {mode:'console'};
    }
    throw new Error('RESEND_API_KEY is not configured');
  }
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${config.resendApiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:config.emailFrom,to:[to],subject,html,text})
  });
  if(!response.ok)throw new Error(`Email provider returned ${response.status}`);
  return {mode:'resend',...(await response.json())};
}

export async function sendMagicLinkEmail({email,url}){
  return sendEmail({to:email,subject:'Sign in to Team APP',text:`Use this one-time Team APP sign-in link: ${url}`,html:`<p>Use this one-time link to sign in to Team APP:</p><p><a href="${escapeHtml(url)}">Sign in to Team APP</a></p><p>If you did not request this, you can ignore this email.</p>`});
}

export async function sendTeamInvitationEmail({email,teamName,role,url,inviterName}){
  return sendEmail({to:email,subject:`Invitation to ${teamName} on Team APP`,text:`${inviterName||'A coach'} invited you to ${teamName} as ${role}. Open: ${url}`,html:`<p><strong>${escapeHtml(inviterName||'A coach')}</strong> invited you to <strong>${escapeHtml(teamName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p><p><a href="${escapeHtml(url)}">Accept invitation</a></p>`});
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
