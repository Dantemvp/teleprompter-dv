import { createHash, timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { canEdit } from './edit-auth.mjs';

export const FEDRA = 'fedra-ald-t84qz';
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const privateRead = { access:'private', useCache:false, headers:{'Accept-Encoding':'identity'} };

export function canAnnotate(password, client, env = process.env) {
  if (client !== FEDRA) return false;
  if (canEdit(password, env)) return true;
  const secret = env.FEDRA_R14_EDIT_PASSWORD;
  if (typeof password !== 'string' || !password || !secret) return false;
  const a = Buffer.from(password), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function failure(message, status = 400) {
  return Object.assign(new Error(message), {status});
}

export function validateTarget(data) {
  if (data.client !== FEDRA || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(data.slug || '')) throw failure('Guion no encontrado.', 404);
}

export function audioType(bytes) {
  if (bytes.subarray(4,8).toString() === 'ftyp') return ['audio/mp4','m4a'];
  if (bytes.subarray(0,4).toString('hex') === '1a45dfa3') return ['audio/webm','webm'];
  if (bytes.subarray(0,4).toString() === 'OggS') return ['audio/ogg','ogg'];
  if (bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WAVE') return ['audio/wav','wav'];
  if (bytes.subarray(0,4).toString() === 'fLaC') return ['audio/flac','flac'];
  if (bytes.subarray(0,3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)) return ['audio/mpeg','mp3'];
  return null;
}

export function makeStore({read=get, write=put} = {}) {
  const pathFor = slug => `fedra-notes/v1/${slug}/notes.json`;
  async function load(slug) {
    const blob = await read(pathFor(slug), privateRead);
    if (!blob) return {notes:[],etag:null};
    return {notes:(await new Response(blob.stream).json()).notes,etag:blob.blob.etag};
  }
  async function change(slug, modify) {
    for (let attempt=0; attempt<5; attempt++) {
      const {notes,etag} = await load(slug);
      const next = modify(notes);
      if (next === notes) return notes;
      try {
        await write(pathFor(slug), JSON.stringify({notes:next}), {
          access:'private',contentType:'application/json',addRandomSuffix:false,
          allowOverwrite:Boolean(etag),...(etag ? {ifMatch:etag} : {}),cacheControlMaxAge:60,
        });
        return next;
      } catch(error) {
        if (attempt === 4 || !/precondition|already exists|etag|conflict/i.test(error.name+' '+error.message)) throw error;
      }
    }
  }
  return {
    load,
    async add(slug, data) {
      if (!/^[a-f0-9-]{36}$/i.test(data.id || '') || !/^[a-f0-9]{64}-\d{1,3}$/.test(data.paragraphId || '')) throw failure('Nota inválida.');
      if (typeof data.quote !== 'string' || !data.quote.trim() || data.quote.length>20000) throw failure('Párrafo inválido.');
      const note = {id:data.id,paragraphId:data.paragraphId,quote:data.quote,createdAt:new Date().toISOString()};
      if (data.kind === 'text') {
        if (typeof data.text !== 'string' || !data.text.trim() || data.text.length>10000) throw failure('Escribe una nota de hasta 10,000 caracteres.');
        note.kind='text';note.text=data.text.trim();
      } else if (data.kind === 'audio') {
        if (typeof data.base64 !== 'string' || !data.base64 || data.base64.length>MAX_AUDIO_BYTES*4/3+4 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(data.base64)) throw failure('El audio debe pesar menos de 3 MB.');
        const bytes = Buffer.from(data.base64,'base64'), type=audioType(bytes);
        if (!type || bytes.length>MAX_AUDIO_BYTES) throw failure('Archivo de audio no compatible o mayor de 3 MB.');
        const hash=createHash('sha256').update(bytes).digest('hex');
        note.kind='audio';note.type=type[0];note.audioPath=`fedra-notes/v1/${slug}/audio/${hash}.${type[1]}`;
        await write(note.audioPath,bytes,{access:'private',contentType:note.type,addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60});
      } else throw failure('Tipo de nota inválido.');
      return change(slug, notes => {
        const existing=notes.find(n=>n.id===note.id);
        if (existing) {
          if (existing.paragraphId!==note.paragraphId || existing.kind!==note.kind || existing.text!==note.text || existing.audioPath!==note.audioPath) throw failure('Esta nota ya existe con otro contenido.',409);
          return notes;
        }
        return [...notes,note];
      });
    },
    remove(slug,id) {
      if (!/^[a-f0-9-]{36}$/i.test(id || '')) throw failure('Nota inválida.');
      return change(slug, notes => notes.some(n=>n.id===id) ? notes.filter(n=>n.id!==id) : notes);
    },
    async audio(slug,id) {
      const {notes}=await load(slug);const note=notes.find(n=>n.id===id && n.kind==='audio');
      if (!note) throw failure('Audio no encontrado.',404);
      const blob=await read(note.audioPath,privateRead);
      if (!blob) throw failure('Audio no disponible.',404);
      return {bytes:Buffer.from(await new Response(blob.stream).arrayBuffer()),type:note.type};
    },
  };
}
