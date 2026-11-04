import { get, put } from '@vercel/blob';

export const SKIN_VAULT = 'skinclub-references/v1/vault.json';

export async function loadSkinVault() {
  const result = await get(SKIN_VAULT, { access:'private', useCache:false, headers:{'Accept-Encoding':'identity'} });
  if (!result) return { vault:null, etag:null };
  return { vault:await new Response(result.stream).json(), etag:result.blob.etag };
}

export async function writeSkinVault(vault, etag) {
  return put(SKIN_VAULT, JSON.stringify(vault), {
    access:'private', addRandomSuffix:false, contentType:'application/json',
    allowOverwrite:Boolean(etag), ...(etag ? {ifMatch:etag} : {}), cacheControlMaxAge:60,
  });
}

export async function saveSkinPrivateParts(slug, split) {
  if (!split.privateContent && !split.reference) return;
  for (let attempt=0; attempt<4; attempt++) {
    const {vault,etag}=await loadSkinVault();
    if (!vault) throw new Error('Referencias privadas no disponibles. No se publicó el guion.');
    const previous=vault.scripts[slug] || '';
    const referenceOnly=split.privateContent && split.privateContent.split('\n').every(line=>!line.trim() || /^\s*>?\s*referencias?(?:\s+visual)?\s*:/.test(line.toLowerCase()));
    vault.scripts[slug] = referenceOnly
      ? [previous.replace(/^\s*>?\s*referencias?(?:\s+visual)?\s*:.*$/gmi,''),split.privateContent].filter(Boolean).join('\n')
      : (split.privateContent || previous);
    if (split.reference) {
      vault.entries[slug] ||= {fields:{},referenceOnly:false};
      Object.assign(vault.entries[slug].fields,{ref:split.reference,link:split.reference});
    }
    try { await writeSkinVault(vault,etag); return; }
    catch(error) {
      if (attempt===3 || !/precondition|already exists|etag|conflict/i.test(error.name+' '+error.message)) throw error;
    }
  }
}
