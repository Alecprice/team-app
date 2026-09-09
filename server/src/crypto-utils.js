import crypto from 'node:crypto';

export function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}

export function timingSafeHexEqual(a,b){
  const left=String(a??''),right=String(b??'');
  const validHex=/^(?:[0-9a-fA-F]{2})+$/;
  if(!validHex.test(left)||!validHex.test(right))return false;
  try{
    const aa=Buffer.from(left,'hex'),bb=Buffer.from(right,'hex');
    return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
  }catch{return false;}
}
