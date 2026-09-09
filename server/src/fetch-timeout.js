export async function fetchWithTimeout(fetchImpl,input,init={},timeoutMs=8000){
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required');
  const timeout=Number(timeoutMs);
  if(!Number.isFinite(timeout)||timeout<=0)throw new TypeError('timeoutMs must be a positive finite number');
  const controller=new AbortController();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
  timer.unref?.();
  try{
    return await fetchImpl(input,{...init,signal:controller.signal});
  }catch(error){
    if(timedOut){const timeoutError=new Error('Request timed out');timeoutError.code='request_timeout';throw timeoutError;}
    throw error;
  }finally{
    clearTimeout(timer);
  }
}
