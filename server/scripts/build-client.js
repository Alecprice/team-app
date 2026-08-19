import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
await build({entryPoints:[path.join(root,'client/cloud-entry.js')],bundle:true,minify:true,sourcemap:false,format:'iife',platform:'browser',target:['es2022'],outfile:path.join(root,'cloud-client.js'),define:{'process.env.NODE_ENV':JSON.stringify(process.env.NODE_ENV||'production')}});
console.log('Built cloud-client.js');
