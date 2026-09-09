const BASE64_PATTERN=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function decodeBase64Key(value,expectedBytes=32){
  if(typeof value!=='string'||!value||!Number.isSafeInteger(expectedBytes)||expectedBytes<=0)return null;
  if(!BASE64_PATTERN.test(value))return null;
  const decoded=Buffer.from(value,'base64');
  if(decoded.length!==expectedBytes)return null;
  if(decoded.toString('base64')!==value)return null;
  return decoded;
}
