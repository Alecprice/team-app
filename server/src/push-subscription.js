const MAX_ENDPOINT_LENGTH=2048;
const MAX_KEY_LENGTH=512;

function plainRecord(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function boundedText(value,max){if(typeof value!=='string')return null;const text=value.trim();return text&&text.length<=max?text:null}

export function normalizePushSubscription(value){
  if(!plainRecord(value)||!plainRecord(value.keys))return null;
  const endpointText=boundedText(value.endpoint,MAX_ENDPOINT_LENGTH);
  if(!endpointText)return null;
  let endpoint;
  try{
    endpoint=new URL(endpointText);
  }catch{
    return null;
  }
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)return null;
  const p256dh=boundedText(value.keys.p256dh,MAX_KEY_LENGTH);
  const auth=boundedText(value.keys.auth,MAX_KEY_LENGTH);
  if(!p256dh||!auth)return null;
  return {endpoint:endpointText,keys:{p256dh,auth}};
}
