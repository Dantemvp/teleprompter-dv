import { canEdit } from '../lib/edit-auth.mjs';
import { loadSkinVault } from '../lib/skinclub-store.mjs';
import { SKIN_CLIENT } from '../lib/skinclub-policy.mjs';

export function makeHandler({ authorize=canEdit, load=loadSkinVault }={}) {
  return async function handler(req,res) {
    const allowed=new Set(['https://dantemvp.github.io','https://teleprompter-dv.vercel.app',process.env.ALLOW_ORIGIN]);
    if(process.env.NODE_ENV!=='production'){allowed.add('http://127.0.0.1:4173');allowed.add('http://localhost:4173');}
    const origin=req.headers?.origin;
    if(origin && !allowed.has(origin))return res.status(403).json({error:'Origen no permitido.'});
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Edit-Password');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Vary','Origin');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    if(req.method==='OPTIONS')return res.status(204).end();
    if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
    // Check the server's editing keys before reading or exposing any private data.
    if(!authorize(req.headers?.['x-edit-password']))return res.status(401).json({error:'Se requiere acceso de edición.'});
    let data;
    try {data=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Solicitud inválida.'});}
    if(!data || data.client!==SKIN_CLIENT)return res.status(404).json({error:'Referencias no encontradas.'});
    if(!['index','script','document'].includes(data.action))return res.status(400).json({error:'Solicitud inválida.'});
    try {
      const {vault}=await load();
      if(!vault)return res.status(503).json({error:'Referencias temporalmente no disponibles.'});
      if(data.action==='index'){
        const thumbnails={};
        for(const entry of Object.values(vault.entries)){
          const path=entry.fields?.thumb,asset=vault.assets[path];
          if(asset && /^image\//.test(asset.type))thumbnails[path]=`data:${asset.type};base64,${asset.base64}`;
        }
        return res.json({entries:vault.entries,thumbnails});
      }
      if(data.action==='script'){
        if(typeof data.slug!=='string'||!Object.hasOwn(vault.scripts,data.slug))return res.status(404).json({error:'Referencia no encontrada.'});
        return res.json({notes:vault.scripts[data.slug]});
      }
      if(typeof data.document!=='string'||!Object.hasOwn(vault.documents,data.document))return res.status(404).json({error:'Documento no encontrado.'});
      const assets={};
      for(const [path,asset] of Object.entries(vault.assets))if(/^image\//.test(asset.type))assets[path]=`data:${asset.type};base64,${asset.base64}`;
      return res.json({html:vault.documents[data.document],assets});
    }catch{return res.status(503).json({error:'No se pudieron cargar las referencias. Intenta de nuevo.'});}
  };
}

export default makeHandler();
