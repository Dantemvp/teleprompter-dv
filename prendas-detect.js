/* Detección orientativa, local: no interpreta moda ni decide qué prenda usar. */
(() => {
  const normal = s => s.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
  function identificar(texto) {
    const base = '(?:tops?|blusas?|camisas?|camisetas?|playeras?|pantal[oó]n(?:es)?|jeans?|vestidos?|faldas?|shorts?|sacos?|blazers?|chamarras?|chaquetas?|abrigos?|su[eé]teres?|chalecos?|cardigans?|kimonos?|bodys?|bodies|botas?|botines?|tenis|zapatos?|tac[oó]n(?:es)?|sandalias?|bolsas?|bolsos?|cintur[oó]n(?:es)?|aretes?|collares?|pa[ñn]uelos?|bufandas?)';
    const material = '(?:(?:de|con|sin)\\s+(?:encaje|gamuza|piel|mezclilla|lino|algod[oó]n|seda|sat[ií]n|mangas?|tac[oó]n))';
    const adjetivo = '(?:satinad[oa]s?|forrad[oa]s?|estructurad[oa]s?|larg[oa]s?|cort[oa]s?|rect[oa]s?|anch[oa]s?|oversize|b[aá]sic[oa]s?|blanc[oa]s?|negr[oa]s?|roj[oa]s?|azul(?:es)?|verde?s?|caf[eé]s?|beige|co[ñn]ac|midi|maxi|plisad[oa]s?|met[aá]lic[oa]s?)';
    const rx = new RegExp('(?<![\\p{L}])' + base + '(?:\\s+(?:' + material + '|' + adjetivo + ')){0,3}(?![\\p{L}])', 'giu');
    return [...new Map([...texto.matchAll(rx)].map(m => [normal(m[0]), m[0].trim()])).values()].slice(0, 40);
  }
  function idPara(client, slug, name) {
    const input = client + ':' + slug + ':' + normal(name);
    const hashes = [0,1,2,3].map(seed => {
      let h = 2166136261 ^ seed;
      for (const c of input) h = Math.imul(h ^ c.codePointAt(0), 16777619);
      return (h >>> 0).toString(16).padStart(8, '0');
    }).join('');
    return hashes.slice(0,8)+'-'+hashes.slice(8,12)+'-'+hashes.slice(12,16)+'-'+hashes.slice(16,20)+'-'+hashes.slice(20);
  }
  globalThis.PrendasDetect = { identificar, idPara, normal };
})();
