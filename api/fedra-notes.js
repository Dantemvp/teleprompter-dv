import { canAnnotate, validateTarget, makeStore, failure } from '../lib/fedra-notes.mjs';

async function verifyScript(client, slug) {
  const repo=process.env.GH_REPO || 'Dantemvp/teleprompter-dv';
  const response=await fetch(`https://raw.githubusercontent.com/${repo}/main/clientes/${client}/index.json`,{signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw failure('No se pudo comprobar el guion. Intenta de nuevo.',503);
  const data=await response.json();
  if (!data.grabaciones?.some(r=>r.guiones?.some(g=>g.slug===slug || g.versiones?.some(v=>v.g===slug)))) throw failure('Guion no encontrado.',404);
}

const publicNotes = notes => notes.map(({audioPath,...note})=>note);
export function makeHandler({authorize=canAnnotate,verify=verifyScript,store=makeStore()} = {}) {
  return async function handler(req,res) {
    const origin=req.headers?.origin;
    const allowed=new Set(['https://teleprompter-dv.vercel.app','https://dantemvp.github.io',process.env.ALLOW_ORIGIN]);
    if (process.env.NODE_ENV!=='production') {allowed.add('http://127.0.0.1:4173');allowed.add('http://localhost:4173');}
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
    if (origin && !allowed.has(origin)) return res.status(403).json({error:'Origen no permitido.'});
    if (origin) res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Edit-Password');
    if (req.method==='OPTIONS') return res.status(204).end();
    if (req.method!=='POST') return res.status(405).json({error:'Método no permitido.'});
    let data;
    try {data=typeof req.body==='string' ? JSON.parse(req.body) : req.body;}catch{return res.status(400).json({error:'Solicitud inválida.'});}
    if (!data || !authorize(req.headers?.['x-edit-password'],data.client)) return res.status(401).json({error:'Usa tu contraseña de Fedra para abrir las notas.'});
    try {
      validateTarget(data);await verify(data.client,data.slug);
      if (data.action==='list') return res.json({notes:publicNotes((await store.load(data.slug)).notes)});
      if (data.action==='add') return res.json({notes:publicNotes(await store.add(data.slug,data))});
      if (data.action==='remove') return res.json({notes:publicNotes(await store.remove(data.slug,data.id))});
      if (data.action==='audio') {
        const audio=await store.audio(data.slug,data.id);res.setHeader('Content-Type',audio.type);return res.send(audio.bytes);
      }
      return res.status(400).json({error:'Solicitud inválida.'});
    } catch(error) {return res.status(error.status || 503).json({error:error.status ? error.message : 'No se pudieron guardar las notas. Intenta de nuevo.'});}
  };
}
export default makeHandler();
