import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  let pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\0')){res.writeHead(400);return res.end('Bad request');}
  let file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden');}
  try{
    let st=fs.statSync(file);if(st.isDirectory())file=path.join(file,'index.html');
  }catch{file=path.join(root,'index.html');}
  try{const ext=path.extname(file);res.setHeader('Content-Type',types[ext]||'application/octet-stream');res.setHeader('Cache-Control',ext==='.html'?'no-store':'no-cache');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,()=>console.log(`Team APP static preview: http://localhost:${port}`));
