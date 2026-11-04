export const SKIN_CLIENT = 'skin-club-e67ff4';

// Shared by the browser, the save API and the migration. Scientific citations stay public.
export function splitSkinSource(source) {
  const visible = [], hidden = [];
  let reference = null, privateSection = false;
  for (const line of source.split('\n')) {
    if (/^## /.test(line)) privateSection = /^## Referencia(?:s|\b)/i.test(line);
    const header = line.match(/^\s*>?\s*referencias?(?:\s+visual)?\s*:\s*(.*)$/i);
    const inspiration = /https?:\/\/(?:[a-z0-9-]+\.)*(?:instagram\.com|tiktok\.com|youtu\.be|youtube\.com)\//i.test(line);
    const privateNote = /^\s*\/\/\s*✱/.test(line);
    const internalDocument = /(?:refs\/)?r8-fuentes\.html/.test(line);
    const internalAnalysis = /^(?:\/\/|TIP:).*(?:referencia original|recurso visual de la referencia)/i.test(line);
    if (header || inspiration || privateNote || internalDocument || privateSection || internalAnalysis) {
      hidden.push(line);
      if (header) reference = header[1].match(/https?:\/\/\S+/)?.[0] || reference;
    } else visible.push(line);
  }
  // Do not leave empty headings named "Referencias" in the client script.
  const publicContent = visible.join('\n').replace(/^## .*\n(?=(?:\s*\n)*(?:## |$))/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  return { publicContent, privateContent: hidden.join('\n'), reference };
}

export function publicSkinIndex(index) {
  const data = structuredClone(index);
  for (const rec of data.grabaciones || []) {
    rec.guiones = (rec.guiones || []).filter(g => g.tipo !== 'ref');
    for (const g of rec.guiones) {
      for (const key of ['ref', 'link', 'thumb', 'thumb_alt']) delete g[key];
      if(g.info)g.info=g.info.replace(/\s*·?\s*molde del reel (?:de poros|ganador)/gi,'').trim();
    }
  }
  return data;
}

export function decorateSkinIndex(index, entries, thumbnails) {
  const data = structuredClone(index);
  for (const rec of data.grabaciones || []) {
    for (const item of rec.guiones || []) {
      const saved = entries[item.slug];
      if (saved) Object.assign(item, saved.fields);
      if (item.thumb) item.thumb = thumbnails[item.thumb] || null;
    }
    for (const [slug, saved] of Object.entries(entries)) {
      if (!saved.referenceOnly || saved.rec !== rec.rec || rec.guiones.some(g => g.slug === slug)) continue;
      const item = structuredClone(saved.item);
      if (item.thumb) item.thumb = thumbnails[item.thumb] || null;
      rec.guiones.splice(Math.min(saved.position, rec.guiones.length), 0, item);
    }
  }
  return data;
}
