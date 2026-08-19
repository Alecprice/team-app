import path from 'node:path';

const ALLOWED=new Map([
  ['.pdf',new Set(['application/pdf'])],
  ['.png',new Set(['image/png'])],['.jpg',new Set(['image/jpeg'])],['.jpeg',new Set(['image/jpeg'])],['.webp',new Set(['image/webp'])],
  ['.txt',new Set(['text/plain','application/octet-stream'])],['.csv',new Set(['text/csv','text/plain','application/vnd.ms-excel'])],
  ['.doc',new Set(['application/msword','application/octet-stream'])],
  ['.docx',new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/octet-stream'])],
  ['.xls',new Set(['application/vnd.ms-excel','application/octet-stream'])],
  ['.xlsx',new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream'])],
]);

export function validateTeamDocument(name,contentType='application/octet-stream'){
  const ext=path.extname(String(name||'')).toLowerCase();
  const allowed=ALLOWED.get(ext);if(!allowed)return {ok:false,error:'file_type_not_allowed'};
  const mime=String(contentType||'application/octet-stream').toLowerCase().split(';')[0].trim();
  if(!allowed.has(mime))return {ok:false,error:'content_type_mismatch'};
  return {ok:true,ext,mime};
}
