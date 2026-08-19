import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {config} from '../src/config.js';
const {Pool}=pg;if(!config.databaseUrl)throw new Error('DATABASE_URL is required');
const here=path.dirname(fileURLToPath(import.meta.url));const sql=await fs.readFile(path.resolve(here,'../schema-service.sql'),'utf8');
const pool=new Pool({connectionString:config.databaseUrl,max:1,application_name:'team-app-service-migration'});
try{await pool.query(sql);console.log('Team APP service schema additions applied.');}finally{await pool.end();}
