(() => {
  const params=new URLSearchParams(location.search);
  if(params.get('teamapp-reset')!=='1')return;
  queueMicrotask(()=>{
    if(!document.querySelector('#teamAppResetPasswordForm,#teamAppRequestAnotherReset'))return;
    const url=new URL(location.href);
    for(const key of ['teamapp-reset','token','error','error_description'])url.searchParams.delete(key);
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  });
})();
