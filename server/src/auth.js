import pg from 'pg';
import {betterAuth} from 'better-auth';
import {magicLink} from 'better-auth/plugins';
import {passkey} from '@better-auth/passkey';
import {config,authDatabaseUrl} from './config.js';
import {sendMagicLinkEmail} from './email.js';
const {Pool}=pg;

const parsedBase=(()=>{try{return new URL(config.authUrl);}catch{return new URL('http://localhost:8080');}})();

export const authPool=new Pool({
  connectionString:authDatabaseUrl(),
  max:6,
  idleTimeoutMillis:30_000,
  connectionTimeoutMillis:10_000,
  application_name:'team-app-auth'
});

export const auth=betterAuth({
  appName:'Team APP',
  database:authPool,
  baseURL:config.authUrl,
  trustedOrigins:config.trustedOrigins,
  emailAndPassword:{enabled:true,requireEmailVerification:true,minPasswordLength:10},
  session:{expiresIn:60*60*24*30,updateAge:60*60*24},
  rateLimit:{enabled:true,window:60,max:100},
  plugins:[
    magicLink({sendMagicLink:sendMagicLinkEmail,expiresIn:10*60}),
    passkey({rpID:parsedBase.hostname,rpName:'Team APP',origin:parsedBase.origin,authenticatorSelection:{residentKey:'preferred',userVerification:'preferred'}})
  ]
});
