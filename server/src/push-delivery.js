export const PUSH_SEND_OPTIONS=Object.freeze({TTL:120,timeout:8000});

export function isExpiredPushError(error){
  return error?.statusCode===404||error?.statusCode===410;
}

export async function cleanupExpiredPush(error,cleanup){
  if(!isExpiredPushError(error))return false;
  try{await cleanup();return true;}catch{return false;}
}
