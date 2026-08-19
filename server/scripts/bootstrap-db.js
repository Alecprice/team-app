import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {config} from '../src/config.js';
const {Pool}=pg;
if(!config.databaseUrl)throw new Error('DATABASE_URL is required');
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const sql=await fs.readFile(path.join(root,'schema.sql'),'utf8');
const pool=new Pool({connectionString:config.databaseUrl,max:1,application_name:'team-app-bootstrap'});
try{
  await pool.query(sql);
  await pool.query('create schema if not exists auth');
  const result=await pool.query("select count(*)::int as sports from sports");
  console.log(`Team APP public schema ready (${result.rows[0].sports} sports).`);
  console.log('Next: npm run auth:migrate');
} finally { await pool.end(); }
