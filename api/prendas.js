import { canEdit } from '../lib/edit-auth.mjs';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { CLIENT, crearAcceso, leerAcceso, idValido, tipoImagen, cambiarEstado, fallo, puedeBorrar, BORRADO_PROPIO_MS } from '../lib/prendas-core.mjs';

// Compressed responses carry a weak ETag (W/...), which cannot satisfy If-Match.
// Read the original representation so the body and strong ETag stay atomic.
const opciones = { access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } };
async function cargar(path) {
  const archivo = await get(path, opciones);
  if (!archivo) return { state: { garments: [] }, etag: null };
  return { state: await new Response(archivo.stream).json(), etag: archivo.blob.etag };
}
async function verificarGuion(client, slug) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GH_REPO || 'Dantemvp/teleprompter-dv'}/contents/clientes/${client}/${slug}.md`, {
    headers: { ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}), Accept: 'application/vnd.github+json', 'User-Agent': 'teleprompter-prendas' },
  });
  if (r.ok) return;
  if (r.status !== 404) throw fallo('No se pudo verificar el guion. Inténtalo de nuevo.', 503);
  const index = await fetch(`https://raw.githubusercontent.com/${process.env.GH_REPO || 'Dantemvp/teleprompter-dv'}/main/clientes/${client}/index.json`);
  if (!index.ok) throw fallo('No se encontró la grabación original.', 404);
  const data = await index.json();
  if (!data.grabaciones?.some(rec=>rec.guiones?.some(it=>it.slug===slug || it.versiones?.some(v=>v.g===slug)))) throw fallo('No se encontró el guion o referencia original.', 404);
}
function respuesta(state, role, ownerHash, slug) {
  return { garments: state.garments.map(g=>({...g,images:g.images.filter(i=>!i.deletedAt || role==='admin').map(i=>{
    const {ownerHash:privateOwner,...publicImage}=i;
    return {...publicImage,canDelete:puedeBorrar(i,role,ownerHash),deleteUntil:ownerHash && ownerHash===privateOwner && !i.deletedAt ? new Date(Date.parse(i.createdAt)+BORRADO_PROPIO_MS).toISOString():null};
  })})), role, serverNow:Date.now(), viewAccess:crearAcceso(CLIENT,'editor',process.env.PRENDAS_SECRET,Date.now(),slug) };
}
async function verificarActivo(client, slug) {
  const r=await fetch(`https://raw.githubusercontent.com/${process.env.GH_REPO || 'Dantemvp/teleprompter-dv'}/main/clientes/${client}/index.json`);
  if(!r.ok)throw fallo('No se pudo verificar la grabación. Inténtalo de nuevo.',503);
  const data=await r.json();
  const active=data.grabaciones?.some(rec=>rec.guiones?.some(it=>it.slug===slug || it.versiones?.some(v=>v.g===slug)));
  if(!active)throw fallo('Este guion no está en las grabaciones activas.',404);
}
export default async function handler(req, res) {
  const allowed = new Set(['https://dantemvp.github.io', 'https://teleprompter-dv.vercel.app', process.env.ALLOW_ORIGIN]);
  if (process.env.NODE_ENV !== 'production') { allowed.add('http://localhost:4173'); allowed.add('http://127.0.0.1:4173'); }
  if (req.headers.origin && !allowed.has(req.headers.origin)) return res.status(403).json({ error: 'Origen no permitido.' });
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Edit-Password, X-Prendas-Owner');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método no permitido.' });
  try {
    let data;
    try { data = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : req.query; }
    catch { throw fallo('La solicitud no contiene JSON válido.'); }
    if (!data || typeof data!=='object' || Array.isArray(data)) throw fallo('Solicitud inválida.');
    const { client, slug } = data;
    if (client !== CLIENT) throw fallo('Referencias no habilitadas para ese cliente.', 404);
    if (!process.env.PRENDAS_SECRET) throw fallo('Falta configurar el acceso a referencias.', 503);
    const password = req.headers['x-edit-password'];
    const admin = canEdit(password)
      || (process.env.PRENDAS_SECRET && req.headers['x-prendas-admin'] === process.env.PRENDAS_SECRET);
    const provided=String(req.headers.authorization || '').replace(/^Bearer /, '') || data.access;
    let role = admin ? 'admin' : leerAcceso(provided, client, process.env.PRENDAS_SECRET,Date.now(),slug);
    let guestAccess=null;
    if(!role && !provided && !password && req.method==='GET' && !data.image && !data.action){
      if(!/^[a-z0-9_-]{1,100}$/i.test(slug || ''))throw fallo('Guion inválido.');
      await verificarActivo(client,slug);
      role='tienda';guestAccess=crearAcceso(client,role,process.env.PRENDAS_SECRET,Date.now(),slug);
    }
    if (!role) throw fallo('No se pudo validar el acceso. Recarga el guion para continuar.', 401);
    const owner = req.headers['x-prendas-owner'];
    const ownerHash = typeof owner === 'string' && /^[a-f0-9]{64}$/.test(owner) ? createHash('sha256').update(owner).digest('hex') : null;
    if (!process.env.PRENDAS_SECRET) throw fallo('Falta configurar el acceso a referencias.', 503);
    if (data.action === 'share') {
      if (role !== 'admin') throw fallo('Sólo Dante puede generar accesos.', 403);
      return res.json({ access: crearAcceso(client, data.role, process.env.PRENDAS_SECRET) });
    }
    if (!/^[a-z0-9_-]{1,100}$/i.test(slug || '')) throw fallo('Guion inválido.');
    const espacio = process.env.NODE_ENV !== 'production' && process.env.PRENDAS_TEST_PREFIX === 'prendas-qa' ? 'prendas-qa' : 'prendas';
    const prefix = `${espacio}/${client}/${slug}`;
    const path = `${prefix}/manifest.json`;
    const actual = await cargar(path);
    if (req.method === 'GET') {
      if (data.image) {
        if (!idValido(data.image) || !actual.state.garments.some(g => g.images.some(i => i.id === data.image && (!i.deletedAt || role==='admin')))) throw fallo('Imagen no encontrada.', 404);
        const image = await get(`${prefix}/images/${data.image}`, { access: 'private' });
        if (!image) throw fallo('Imagen no encontrada.', 404);
        res.setHeader('Content-Type', image.blob.contentType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return Readable.fromWeb(image.stream).pipe(res);
      }
      return res.json({...respuesta(actual.state,role,ownerHash,slug),...(guestAccess?{guestAccess}:{})});
    }
    // Validamos antes de guardar archivos, incluso si la petición repite un ID.
    cambiarEstado(actual.state, data, role, undefined, ownerHash);
    if (data.action === 'add-garment') await verificarGuion(client, slug);
    if (data.action === 'add-image') {
      if (typeof data.image !== 'string' || data.image.length > 1500000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.image)) throw fallo('Imagen demasiado grande o inválida.');
      const bytes = Buffer.from(data.image, 'base64');
      const contentType = tipoImagen(bytes);
      if (!contentType || bytes.length > 1000000) throw fallo('Usa una imagen JPG, PNG o WebP de hasta 1 MB.');
      if (!actual.state.garments.some(g => g.images.some(i => i.id === data.id))) {
        try { await put(`${prefix}/images/${data.id}`, bytes, { access: 'private', addRandomSuffix: false, contentType }); }
        catch (error) { if (!/already exists/i.test(error.message)) throw error; }
      }
    }
    for (let intento = 0; intento < 4; intento++) {
      const { state, etag } = intento === 0 ? actual : await cargar(path);
      const next = cambiarEstado(state, data, role, undefined, ownerHash);
      try {
        await put(path, JSON.stringify(next), { access: 'private', addRandomSuffix: false, contentType: 'application/json', allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}), cacheControlMaxAge: 60 });
        return res.json(respuesta(next,role,ownerHash,slug));
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError) && !/already exists/i.test(error.message)) throw error;
        await new Promise(resolve=>setTimeout(resolve,75*(intento+1)+Math.random()*100));
      }
    }
    throw fallo('No se pudo completar el guardado. Pulsa Reintentar fotos pendientes sin cerrar esta ventana.', 409);
  } catch (error) {
    console.error('prendas:', error.status || error.name);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar. Inténtalo de nuevo.' });
  }
}
