import { createHmac, timingSafeEqual } from 'node:crypto';

export const CLIENT = 'bianca-ald-7q2vd';
export const ROLES = ['tienda', 'bianca', 'editor'];
export const BORRADO_PROPIO_MS = 5 * 60 * 1000;
export function puedeBorrar(image, role, ownerHash, now = Date.now()) {
  if (!image || image.deletedAt || role === 'editor') return false;
  if (role === 'admin') return true;
  const age = now - Date.parse(image.createdAt);
  return Boolean(ownerHash && image.ownerHash && ownerHash === image.ownerHash && Number.isFinite(age) && age >= 0 && age < BORRADO_PROPIO_MS);
}
export function fallo(message, status = 400) { return Object.assign(new Error(message), { status }); }

export function crearAcceso(client, role, secret, ahora = Date.now(), slug = null) {
  if (client !== CLIENT || !ROLES.includes(role) || !secret) throw fallo('Acceso inválido.');
  if (slug !== null && !/^[a-z0-9_-]{1,100}$/i.test(slug)) throw fallo('Guion inválido.');
  const payload = Buffer.from(JSON.stringify({ client, role, exp: ahora + 180 * 86400000, ...(slug ? {slug} : {}) })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update('prendas-v1:' + payload).digest('base64url')}`;
}
export function leerAcceso(token, client, secret, ahora = Date.now(), slug = null) {
  if (!secret || typeof token !== 'string' || token.length > 1000) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update('prendas-v1:' + payload).digest('base64url');
  const signatureBytes = Buffer.from(signature), expectedBytes = Buffer.from(expected);
  if (signatureBytes.length !== expectedBytes.length || !timingSafeEqual(signatureBytes, expectedBytes)) return null;
  try { const datos = JSON.parse(Buffer.from(payload, 'base64url')); return datos.client === client && datos.exp > ahora && ROLES.includes(datos.role) && (!datos.slug || datos.slug === slug) ? datos.role : null; } catch { return null; }
}
export function idValido(id) { return typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id); }
export function tipoImagen(bytes) {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
export function cambiarEstado(state, data, role, ahora = new Date().toISOString(), ownerHash = null) {
  if (role === 'editor') throw fallo('Este enlace es sólo para consultar.', 403);
  const siguiente = structuredClone(state);
  if (data.action === 'add-garment') {
    if (!idValido(data.id) || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100) throw fallo('Escribe el nombre de la prenda (máximo 100 caracteres).');
    if (siguiente.garments.some(g => g.id === data.id)) return siguiente;
    if (siguiente.garments.length >= 40) throw fallo('Este guion ya tiene 40 prendas.');
    siguiente.garments.push({ id: data.id, name: data.name.trim(), kind: data.kind === 'estilo' ? 'estilo' : 'exacta', images: [], createdAt: ahora });
    return siguiente;
  }
  const garment = siguiente.garments.find(g => g.id === data.garmentId);
  if (!garment) throw fallo('No se encontró esa prenda.', 404);
  if (data.action === 'delete-image' || data.action === 'restore-image') {
    const image = garment.images.find(i => i.id === data.imageId);
    if (!image) throw fallo('Imagen no encontrada.', 404);
    if (data.action === 'restore-image') {
      if (role !== 'admin') throw fallo('Sólo el administrador puede recuperar una foto.', 403);
      if (image.deletedAt && garment.images.filter(i=>!i.deletedAt).length >= 12) throw fallo('Retira otra foto antes de recuperar ésta (máximo 12 activas).');
      if (!image.deletedAt) return siguiente;
      delete image.deletedAt; delete image.deletedByRole;
      image.selected = false;
    } else {
      if (image.deletedAt) return siguiente;
      if (!puedeBorrar(image, role, ownerHash, Date.parse(ahora))) throw fallo('Sólo puedes borrar tus fotos durante los primeros 5 minutos. Después, solicita el borrado al administrador.', 403);
      image.deletedAt = ahora; image.deletedByRole = role; image.selected = false;
    }
    return siguiente;
  }
  if (data.action === 'edit-note') {
    if (!['admin', 'bianca'].includes(role)) throw fallo('Sólo Bianca o Dante pueden editar las indicaciones guardadas.', 403);
    const image = garment.images.find(i => i.id === data.imageId);
    if (!image || image.deletedAt || typeof data.note !== 'string' || data.note.length > 500) throw fallo('Descripción inválida.');
    image.note = data.note.trim();
    return siguiente;
  }
  if (data.action === 'add-image') {
    if (!idValido(data.id)) throw fallo('Imagen inválida.');
    if (siguiente.garments.some(g=>g.id!==garment.id && g.images.some(i=>i.id===data.id))) throw fallo('Esta foto pertenece a otra prenda. Vuelve a seleccionarla.',409);
    if (garment.images.some(i => i.id === data.id)) return siguiente;
    if (garment.images.filter(i=>!i.deletedAt).length >= 12) throw fallo('Puedes agregar hasta 12 imágenes por prenda.');
    garment.images.push({ id: data.id, note: String(data.note || '').slice(0, 500), author: String(data.author || 'Equipo tienda').slice(0, 60), selected: false, createdAt: ahora, ...(ownerHash ? {ownerHash} : {}) });
    return siguiente;
  }
  if (data.action === 'select') {
    if (!['admin', 'bianca'].includes(role)) throw fallo('La selección final la hace Bianca o Dante.', 403);
    const image = garment.images.find(i => i.id === data.imageId);
    if (!image || image.deletedAt || typeof data.selected !== 'boolean') throw fallo('Imagen inválida.');
    image.selected = data.selected;
    image.selectedBy = role === 'bianca' ? 'Bianca' : 'Dante';
    image.selectedAt = ahora;
    return siguiente;
  }
  throw fallo('Acción inválida.');
}
