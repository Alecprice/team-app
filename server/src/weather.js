const UA='TeamAPP/1.10 team-operations weather monitor';
async function nwsJson(url){const r=await fetch(url,{headers:{'User-Agent':UA,Accept:'application/geo+json, application/json'}});if(!r.ok)throw new Error(`NWS ${r.status}`);return r.json();}
export async function forecastFor(lat,lon,startIso,endIso){
  const point=await nwsJson(`https://api.weather.gov/points/${lat},${lon}`);const hourlyUrl=point?.properties?.forecastHourly;if(!hourlyUrl)throw new Error('No NWS hourly forecast URL');
  const hourly=await nwsJson(hourlyUrl);const start=new Date(startIso),end=new Date(endIso||start.getTime()+2*3600000);
  const periods=(hourly?.properties?.periods||[]).filter(p=>new Date(p.startTime)<=end&&new Date(p.endTime)>=start);
  const alerts=await nwsJson(`https://api.weather.gov/alerts/active?point=${lat},${lon}`);
  const temps=periods.map(p=>Number(p.temperature)).filter(Number.isFinite),rain=periods.map(p=>Number(p.probabilityOfPrecipitation?.value||0)).filter(Number.isFinite);
  return {periods:periods.slice(0,12),alerts:(alerts?.features||[]).map(f=>({id:f.id,event:f.properties?.event,severity:f.properties?.severity,headline:f.properties?.headline,expires:f.properties?.expires})),summary:{minTemp:temps.length?Math.min(...temps):null,maxTemp:temps.length?Math.max(...temps):null,maxRain:rain.length?Math.max(...rain):0}};
}
export function weatherMeaningfullyChanged(before={},after={}){
  if(!before||!Object.keys(before).length)return false;
  const rainDelta=Math.abs(Number(after?.summary?.maxRain||0)-Number(before?.summary?.maxRain||0));
  const alertBefore=new Set((before.alerts||[]).map(a=>a.id));const newAlerts=(after.alerts||[]).filter(a=>!alertBefore.has(a.id));
  return rainDelta>=25||newAlerts.length>0;
}
