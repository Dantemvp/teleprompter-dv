// Run once with the production Blob token. Keeps a private recovery copy outside the repo.
import {readFile,writeFile,readdir,mkdir,chmod,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {SKIN_CLIENT,splitSkinSource,publicSkinIndex} from '../lib/skinclub-policy.mjs';
import {loadSkinVault,writeSkinVault} from '../lib/skinclub-store.mjs';

const root=`clientes/${SKIN_CLIENT}`;
const {vault:existing}=await loadSkinVault();
if(existing)throw new Error('Private vault already exists. Do not repeat the initial migration.');
const index=JSON.parse(await readFile(`${root}/index.json`,'utf8'));
const vault={version:1,entries:{},scripts:{},assets:{},documents:{}};
for(const rec of index.grabaciones||[])for(const [position,item] of (rec.guiones||[]).entries()){
  const fields=Object.fromEntries(['ref','link','thumb'].filter(k=>item[k]).map(k=>[k,item[k]]));
  if(Object.keys(fields).length||item.tipo==='ref')vault.entries[item.slug]={fields,rec:rec.rec,position,referenceOnly:item.tipo==='ref',...(item.tipo==='ref'?{item}:{} )};
}
const sanitized=new Map();
for(const name of await readdir(root))if(name.endsWith('.md')){
  const source=await readFile(`${root}/${name}`,'utf8'),split=splitSkinSource(source),slug=name.slice(0,-3);
  sanitized.set(name,split.publicContent);
  vault.scripts[slug]=split.privateContent;
  if(split.reference && !vault.entries[slug])vault.entries[slug]={fields:{ref:split.reference,link:split.reference},referenceOnly:false};
}
for(const dir of ['refs','thumbs'])for(const name of await readdir(`${root}/${dir}`)){
  if(!/\.(jpg|jpeg|png|webp)$/i.test(name))continue;
  const path=`${root}/${dir}/${name}`,bytes=await readFile(path);
  const ext=name.split('.').pop().toLowerCase();
  vault.assets[path]={type:`image/${ext==='jpg'?'jpeg':ext}`,base64:bytes.toString('base64')};
}
vault.documents['r8-fuentes']=await readFile(`${root}/refs/r8-fuentes.html`,'utf8');
const privateDir=`${homedir()}/.codex/private`;
await mkdir(privateDir,{recursive:true,mode:0o700});await chmod(privateDir,0o700);
await writeFile(`${privateDir}/skinclub-references-v1.json`,JSON.stringify(vault),{mode:0o600});
await writeSkinVault(vault,null);
const {vault:verified}=await loadSkinVault();
if(JSON.stringify(verified)!==JSON.stringify(vault))throw new Error('Private copy did not verify; public files unchanged.');
// Only redact the public files after the complete private copy verifies.
await writeFile(`${root}/index.json`,JSON.stringify(publicSkinIndex(index),null,2)+'\n');
for(const [name,source] of sanitized)await writeFile(`${root}/${name}`,source);
for(const path of Object.keys(vault.assets))await unlink(path);
await writeFile(`${root}/refs/r8-fuentes.html`,'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;url=../../../references.html?doc=r8-fuentes"><title>Acceso de edición</title><p>Las referencias requieren acceso de edición. <a href="../../../references.html?doc=r8-fuentes">Continuar</a></p></html>\n');
console.log(JSON.stringify({privateScripts:Object.keys(vault.scripts).length,privateEntries:Object.keys(vault.entries).length,privateAssets:Object.keys(vault.assets).length,bytes:JSON.stringify(vault).length,verified:true}));
