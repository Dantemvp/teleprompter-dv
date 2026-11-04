import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {makeHandler} from '../api/skinclub-refs.js';
import {canEdit} from '../lib/edit-auth.mjs';
import {splitSkinSource,publicSkinIndex,decorateSkinIndex,SKIN_CLIENT} from '../lib/skinclub-policy.mjs';
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(data){this.data=data;return this;},end(){return this;}});
const creds={EDIT_PASSWORD:'team',EDIT_PASSWORD_SECONDARY:'second',FEDRA_R14_EDIT_PASSWORD:'restricted'};
const vault={entries:{'r8-01':{fields:{ref:'https://example.org/private',thumb:'private.jpg'}}},scripts:{'r8-01':'private notes'},assets:{'private.jpg':{type:'image/jpeg',base64:'cHJpdmF0ZQ=='}},documents:{'r8-fuentes':'<h1>private</h1>'}};

test('anonymous, UI PIN and unrelated client key cannot read the vault',async()=>{
  let reads=0;
  const handler=makeHandler({authorize:p=>canEdit(p,creds),load:async()=>{reads++;return{vault};}});
  for(const pw of [undefined,'','wrong','restricted','dvadmin']){
    const res=response();await handler({method:'POST',headers:{'x-edit-password':pw},body:{client:SKIN_CLIENT,action:'index'}},res);
    assert.equal(res.code,401);assert(!JSON.stringify(res.data).includes('private notes'));
    assert.equal(res.headers['Cache-Control'],'private, no-store');
  }
  assert.equal(reads,0);
});
test('team keys retrieve references; unrelated origins and arbitrary paths cannot',async()=>{
  const handler=makeHandler({authorize:p=>canEdit(p,creds),load:async()=>({vault})});
  for(const key of ['team','second'])for(const action of ['index','script','document']){
    const res=response();await handler({method:'POST',headers:{'x-edit-password':key},body:{client:SKIN_CLIENT,action,slug:'r8-01',document:'r8-fuentes'}},res);
    assert.equal(res.code,200);assert(res.data);
  }
  for(const document of ['../../.env','__proto__','constructor']){
    const res=response();await handler({method:'POST',headers:{'x-edit-password':'team'},body:{client:SKIN_CLIENT,action:'document',document}},res);assert.equal(res.code,404);
  }
  const res=response();await handler({method:'POST',headers:{origin:'https://evil.example','x-edit-password':'team'},body:{client:SKIN_CLIENT,action:'index'}},res);assert.equal(res.code,403);
});
test('source splitting preserves dialogue and scientific citations',()=>{
  const src='# Guion\n> Referencia: https://vt.tiktok.com/private\nVOZ: ¿Sientes tirantez?\n// DATO: Estudio || LINK: https://pubmed.ncbi.nlm.nih.gov/123/\n// ✱ Nota interna\n## Referencia desglosada\nTIP: Hook original\n## Cierre\nVOZ: Revisa tu rutina.\n';
  const split=splitSkinSource(src);
  assert(split.publicContent.includes('VOZ: ¿Sientes tirantez?'));
  assert(split.publicContent.includes('pubmed.ncbi.nlm.nih.gov'));
  assert(split.publicContent.includes('VOZ: Revisa tu rutina.'));
  assert(!/private|Nota interna|Hook original|Referencia desglosada/.test(split.publicContent));
  assert(split.privateContent.includes('Hook original'));
  assert.equal(splitSkinSource(split.publicContent).publicContent,split.publicContent);
});
test('private card decoration never mutates public data',()=>{
  const original={grabaciones:[{rec:'R8',guiones:[{slug:'r8-01',ref:'secret',thumb:'private.jpg',locutor:null,grabado:true},{slug:'ref',tipo:'ref',link:'secret'}]}]};
  const publicData=publicSkinIndex(original);
  assert.equal(publicData.grabaciones[0].guiones.length,1);
  const decorated=decorateSkinIndex(publicData,vault.entries,{'private.jpg':'data:image/jpeg;base64,abc'});
  assert(decorated.grabaciones[0].guiones[0].ref);
  assert(!publicData.grabaciones[0].guiones[0].ref);
  assert.equal(publicData.grabaciones[0].guiones[0].grabado,true);
});
test('static Skin files expose no inspiration URLs, previews or private notes',async()=>{
  const root=`clientes/${SKIN_CLIENT}`;
  const files=(await readdir(root)).filter(n=>n.endsWith('.md'));
  for(const name of [...files,'index.json','refs/r8-fuentes.html','refs/r8-revision.html']){
    const content=await readFile(`${root}/${name}`,'utf8');
    assert(!/https?:\/\/(?:[\w-]+\.)*(?:instagram\.com|tiktok\.com|youtu\.be|youtube\.com)\//i.test(content),name);
    assert(!/^\s*\/\/\s*✱/m.test(content),name);
  }
  const ix=JSON.parse(await readFile(`${root}/index.json`,'utf8'));
  for(const rec of ix.grabaciones)for(const g of rec.guiones){assert(!g.ref&&!g.link&&!g.thumb);assert.notEqual(g.tipo,'ref');}
  for(const dir of ['refs','thumbs']){
    const names=await readdir(`${root}/${dir}`).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
    assert(!names.some(n=>/\.(jpg|png|webp)$/i.test(n)));
  }
  const r8=ix.grabaciones.find(r=>r.guiones.some(g=>g.slug==='r8-01'));
  assert.deepEqual(r8.guiones.map(g=>g.slug),['r8-01','r8-02','r8-03','r8-05','r8-06','r8-07']);
});
