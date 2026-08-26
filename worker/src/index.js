const SERVICE='team-app-jobs';
const VERSION='1.10.0';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==='/health'){
      if(request.method!=='GET'&&request.method!=='HEAD')return json({ok:false,error:'method_not_allowed'},405);
      const body={
        ok:true,
        service:SERVICE,
        version:VERSION,
        mode:'scaffold',
        deliveryEnabled:false,
        appOrigin:env.APP_ORIGIN||null,
        time:new Date().toISOString()
      };
      if(request.method==='HEAD')return new Response(null,{status:200,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosn'}});
      return json(body);
    }
    return json({ok:false,error:'not_found'},404);
  },

  async scheduled(controller, env, ctx) {
    // V1.10 scaffold: weather/push/email jobs are intentionally not enabled
    // until the production origin, secrets, and delivery providers are verified.
    console.log(JSON.stringify({
      level:'info',
      event:'scheduled_heartbeat',
      service:SERVICE,
      version:VERSION,
      cron:controller.cron,
      deliveryEnabled:false,
      appOrigin:env.APP_ORIGIN||null,
      time:new Date().toISOString()
    }));
  }
};
