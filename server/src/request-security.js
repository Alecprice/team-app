import {config} from './config.js';

const SAFE_METHODS=new Set(['GET','HEAD','OPTIONS']);
function normalizedOrigin(value){
  if(!value)return '';
  try{return new URL(value).origin;}catch{return '';}
}
const TRUSTED=new Set(config.trustedOrigins.map(normalizedOrigin).filter(Boolean));
TRUSTED.add(normalizedOrigin(config.authUrl));

export function protectBrowserMutation(req,res,next){
  if(SAFE_METHODS.has(req.method)||req.path.startsWith('/auth/'))return next();
  const fetchSite=String(req.get('sec-fetch-site')||'').toLowerCase();
  if(fetchSite==='cross-site')return res.status(403).json({error:'cross_site_request_blocked'});
  const origin=normalizedOrigin(req.get('origin'));
  if(origin&&!TRUSTED.has(origin))return res.status(403).json({error:'origin_not_allowed'});
  next();
}
