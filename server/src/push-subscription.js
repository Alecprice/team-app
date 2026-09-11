const MAX_ENDPOINT_LENGTH=2048;
const MAX_KEY_LENGTH=512;
const MAX_USER_AGENT_LENGTH=512;

function boundedString(value,max){
  if(typeof value!=='string')return null;
  const normalized=value.trim();
  return normalized&&normalized.length<=max?normalized:null;
}

export function normalizePushRegistration(subscription,userAgent=''){
  if(!subscription||typeof subscription!=='object'||Array.isArray(subscription))return null;
  const endpoint=boundedString(subscription.endpoint,MAX_ENDPOINT_LENGTH);
  const p256dh=boundedString(subscription?.keys?.p256dh,MAX_KEY_LENGTH);
  const auth=boundedString(subscription?.keys?.auth,MAX_KEY_LENGTH);
  if(!endpoint||!p256dh||!auth)return null;
  try{
    const url=new URL(endpoint);
    if(url.protocol!=='https:'||url.username||url.password)return null;
  }catch{return null;}
  const normalizedUserAgent=typeof userAgent==='string'?userAgent.trim().slice(0,MAX_USER_AGENT_LENGTH):'';
  return {endpoint,p256dh,auth,userAgent:normalizedUserAgent};
}

export {MAX_ENDPOINT_LENGTH,MAX_KEY_LENGTH,MAX_USER_AGENT_LENGTH};
