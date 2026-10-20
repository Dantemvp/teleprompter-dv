/** Servidor local de verificación; nunca publica ni cambia los guiones. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import handler from '../api/prendas.js';

process.env.EDIT_PASSWORD = 'local-prendas';
process.env.PRENDAS_SECRET = 'local-prendas-test-only';
process.env.PRENDAS_TEST_PREFIX = 'prendas-qa';
const root = path.resolve(new URL('..', import.meta.url).pathname);
http.createServer(async (req,res) => {
  const u = new URL(req.url, 'http://localhost:4173');
  try {
    if (u.pathname === '/api/prendas') {
      req.query=Object.fromEntries(u.searchParams);res.status=c=>{res.statusCode=c;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2000000){res.statusCode=413;res.end();return;}}
      req.body=body?JSON.parse(body):{};return await handler(req,res);
    }
    const file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
    if (!/^(index\.html|prendas(?:-detect)?\.(css|js)|clientes\/[a-z0-9_\-/]+\.(json|md|jpg|png))$/i.test(file) || file.includes('..')) {res.statusCode=404;res.end();return;}
    const bytes=await fs.readFile(path.join(root,file));const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain','.jpg':'image/jpeg','.png':'image/png'})[ext]);res.end(bytes);
  } catch(error){res.statusCode=500;res.end(error.message);}
}).listen(4173,()=>console.log('Teleprompter: http://localhost:4173'));
