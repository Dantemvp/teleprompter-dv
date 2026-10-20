import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { Readable } from 'node:stream';
import { CLIENT, crearAcceso, leerAcceso, idValido, tipoImagen, cambiarEstado, fallo } from '../lib/prendas-core.mjs';

const opciones = { access: 'private', useCache: false };
async function cargar(path) {
  const archivo = await get(path, opciones);
  if (!archivo) return { state: { garments: [] }, etag: null };
  return { state: await new Response(archivo.stream).json(), etag: archivo.blob.etag };
}
async function verificarGuion(client, slug) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GH_REPO || 'Dantemvp/teleprompter-dv'}/contents/clientes/${client}/${slug}.md`, {
    headers: { ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}), Accept: 'application/vnd.github+json', 'User-Agent': 'teleprompter-prendas' },
  });
  if (!r.ok) throw fallo('No se encontró el guion original.', 404);
}
export default async function handler(req, res) {
  const allowed = new Set(['https://dantemvp.github.io', 'https://teleprompter-dv.vercel.app', process.env.ALLOW_ORIGIN]);
  if (process.env.NODE_ENV !== 'production') allowed.add('http://localhost:4173');
  if (req.headers.origin && !allowed.has(req.headers.origin)) return res.status(403).json({ error: 'Origen no permitido.' });
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Edit-Password');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const data = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) : req.query;
    const { client, slug } = data;
    if (client !== CLIENT) throw fallo('Referencias no habilitadas para ese cliente.', 404);
    const password = req.headers['x-edit-password'];
    const admin = (process.env.EDIT_PASSWORD && password === process.env.EDIT_PASSWORD)
      || (process.env.PRENDAS_SECRET && req.headers['x-prendas-admin'] === process.env.PRENDAS_SECRET);
    const role = admin ? 'admin'
      : leerAcceso(String(req.headers.authorization || '').replace(/^Bearer /, '') || data.access, client, process.env.PRENDAS_SECRET);
    if (!role) throw fallo('Abre el enlace de referencias que te compartió Dante.', 401);
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
        if (!idValido(data.image) || !actual.state.garments.some(g => g.images.some(i => i.id === data.image))) throw fallo('Imagen no encontrada.', 404);
        const image = await get(`${prefix}/images/${data.image}`, { access: 'private' });
        if (!image) throw fallo('Imagen no encontrada.', 404);
        res.setHeader('Content-Type', image.blob.contentType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return Readable.fromWeb(image.stream).pipe(res);
      }
      return res.json({ ...actual.state, role, viewAccess: crearAcceso(client, 'editor', process.env.PRENDAS_SECRET) });
    }
    // Validamos antes de guardar archivos, incluso si la petición repite un ID.
    cambiarEstado(actual.state, data, role);
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
      const next = cambiarEstado(state, data, role);
      try {
        await put(path, JSON.stringify(next), { access: 'private', addRandomSuffix: false, contentType: 'application/json', allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}), cacheControlMaxAge: 60 });
        return res.json({ ...next, role, viewAccess: crearAcceso(client, 'editor', process.env.PRENDAS_SECRET) });
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError) && !/already exists/i.test(error.message)) throw error;
      }
    }
    throw fallo('Otra persona está guardando. Inténtalo de nuevo; tus fotos se conservan.', 409);
  } catch (error) {
    console.error('prendas:', error.status || error.name);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar. Inténtalo de nuevo.' });
  }
}
