import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cloud=fs.readFileSync(path.join(root,'dist/cloud-client.js'),'utf8');
const proxyPath=path.join(root,'functions/api/auth/[[path]].js');
const upstream='ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth';
const failures=[];
const pass=message=>console.log(`PASS: ${message}`);
const fail=message=>{failures.push(message);console.error(`FAIL: ${message}`);};

if(cloud.includes('/api/auth'))pass('production bundle contains the same-origin auth route');else fail('production bundle is missing /api/auth');
if(cloud.includes(upstream))fail('production bundle still contains the cross-origin Neon Auth endpoint');else pass('production bundle does not call Neon Auth cross-origin');
if(fs.existsSync(proxyPath))pass('Pages auth proxy source exists');else fail('Pages auth proxy source is missing');

if(failures.length){console.error(`\nAuth transport verification FAILED with ${failures.length} issue(s).`);process.exit(1);}
console.log('\nAuth transport verification PASSED. Browser auth is first-party while Neon remains the upstream identity provider.');
