export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ok:true, service:'team-app-jobs', time:new Date().toISOString()});
    }
    return new Response('Not found', {status:404});
  },
  async scheduled(controller, env, ctx) {
    // V1.10 scaffold: weather/push/email jobs are intentionally not enabled
    // until the production origin, secrets, and delivery providers are verified.
    console.log('Team APP scheduled job heartbeat', controller.cron, new Date().toISOString());
  }
};
