import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {toNodeHandler} from 'better-auth/node';
import {auth} from './auth.js';
import {config,assertProductionConfig} from './config.js';
import {query} from './db.js';
import teamsRouter from './routes-teams.js';
import invitesRouter from './routes-invites.js';
import documentsRouter from './routes-documents.js';
import formsRouter from './routes-forms.js';
import messagingRouter from './routes-messaging.js';
import pushRouter from './routes-push.js';
import cronRouter from './routes-cron.js';
import availabilityRouter from './routes-availability.js';
import {protectBrowserMutation} from './request-security.js';

assertProductionConfig();
const app=express();const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'../..');
app.disable('x-powered-by');app.set('trust proxy',1);
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','geolocation=(self), camera=(self), microphone=(self), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' https://api.weather.gov; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');next();
});

// Better Auth must receive the raw request body before express.json().
app.all('/api/auth/*',toNodeHandler(auth));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:false,limit:'256kb'}));
app.use('/api',protectBrowserMutation);

// Lightweight per-instance abuse guard for custom API routes. Auth has its own limiter.
const hits=new Map();app.use('/api',(req,res,next)=>{if(req.path.startsWith('/auth/'))return next();const now=Date.now(),key=`${req.ip}:${Math.floor(now/60000)}`,count=(hits.get(key)||0)+1;hits.set(key,count);if(hits.size>5000)for(const [k] of hits)if(!k.endsWith(String(Math.floor(now/60000))))hits.delete(k);if(count>300)return res.status(429).json({error:'rate_limit'});next();});

app.get('/api/health',async(req,res)=>{try{await query('select 1');res.json({ok:true,service:'team-app',version:'1.9.0'});}catch(err){res.status(503).json({ok:false,error:'database_unavailable'});}});
app.use('/api',teamsRouter,invitesRouter,documentsRouter,formsRouter,messagingRouter,pushRouter,availabilityRouter,cronRouter);

app.use(express.static(root,{etag:true,lastModified:true,setHeaders(res,file){if(/\.(?:js|css|png|svg|webmanifest)$/.test(file))res.setHeader('Cache-Control','public,max-age=300,must-revalidate');}}));
app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(root,'index.html'));});
app.use((req,res)=>res.status(404).json({error:'not_found'}));
app.use((err,req,res,next)=>{console.error('[server]',err);if(res.headersSent)return next(err);const status=err?.name==='ZodError'?400:500;res.status(status).json({error:status===400?'invalid_request':'internal_error',details:config.nodeEnv==='production'?undefined:err?.message});});

app.listen(config.port,()=>console.log(`Team APP V1.9 listening on ${config.authUrl}`));
