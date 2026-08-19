import pg from 'pg';
import {config} from './config.js';
const {Pool}=pg;

let pool;
export function db(){
  if(!pool){
    if(!config.databaseUrl)throw new Error('DATABASE_URL is not configured');
    pool=new Pool({connectionString:config.databaseUrl,max:10,idleTimeoutMillis:30_000,connectionTimeoutMillis:10_000,application_name:'team-app-service'});
    pool.on('error',err=>console.error('[db] idle client error',err));
  }
  return pool;
}
export async function query(text,params=[]){return db().query(text,params);}
export async function tx(fn){const c=await db().connect();try{await c.query('begin');const result=await fn(c);await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
export async function closeDb(){if(pool){await pool.end();pool=undefined;}}
