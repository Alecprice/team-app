export const PUSH_SEND_OPTIONS=Object.freeze({TTL:120,timeout:8000});

export function isExpiredPushError(error){
  return error?.statusCode===404||error?.statusCode===410;
}

export async function cleanupExpiredPush(error,cleanup){
  if(!isExpiredPushError(error))return false;
  try{await cleanup();return true;}catch{return false;}
}

export function summarizePushDeliveries(results=[]){
  const delivered=new Set();let sent=0,failed=0;
  for(const result of Array.isArray(results)?results:[]){
    if(result?.ok===true){sent+=1;if(result.userId)delivered.add(String(result.userId));}
    else if(result?.ok===false)failed+=1;
  }
  return {sent,failed,deliveredUserIds:[...delivered]};
}
