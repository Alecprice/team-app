export function zoneOffsetMs(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).reduce((o,p)=>(o[p.type]=p.value,o),{});
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second))-date.getTime();
}
export function isValidTimeZone(timeZone){try{new Intl.DateTimeFormat('en-US',{timeZone}).format(new Date());return true;}catch{return false;}}
export function localEventDate(date,time,timeZone='UTC'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||!/^\d{2}:\d{2}$/.test(String(time))||!isValidTimeZone(timeZone))throw new Error('invalid_event_time');
  const base=new Date(`${date}T${time}:00Z`);let result=new Date(base.getTime()-zoneOffsetMs(base,timeZone));result=new Date(base.getTime()-zoneOffsetMs(result,timeZone));
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(result).reduce((o,p)=>(o[p.type]=p.value,o),{});
  const roundTrip=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  if(roundTrip!==`${date} ${time}`)throw new Error('nonexistent_local_time');
  return result;
}
