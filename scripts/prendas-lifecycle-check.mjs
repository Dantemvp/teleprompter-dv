// Prueba real de almacenamiento, aislada en prendas-qa, nunca en producción.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { get, put, del, BlobPreconditionFailedError } from '@vercel/blob';
import { CLIENT } from '../lib/prendas-core.mjs';
const endpoint='http://localhost:4173/api/prendas';
const base={client:CLIENT,slug:'g-71'},id=randomUUID(),imageId=randomUUID();
const root='prendas-qa/'+CLIENT+'/g-71',manifest=root+'/manifest.json';
const owner='a'.repeat(64),other='b'.repeat(64);
const extraImages=Array.from({length:3},()=>randomUUID());
const bootstrap=await fetch(endpoint+'?'+new URLSearchParams(base));
const publicState=await bootstrap.json();
assert.equal(bootstrap.status,200);assert.equal(publicState.role,'tienda');
const token=publicState.guestAccess;assert.ok(token,'normal links must allow contributions without a special URL');
const request=async(data,who=owner,admin=false)=>{
 const headers=admin?{'X-Edit-Password':'local-prendas'}:{Authorization:'Bearer '+token,'X-Prendas-Owner':who};
 const r=await fetch(endpoint+(data?'':'?'+new URLSearchParams(base)),{headers:{...headers,...(data?{'Content-Type':'application/json'}:{})},...(data?{method:'POST',body:JSON.stringify({...base,...data})}:{})});
 return {status:r.status,body:await r.json()};
};
const prior=await get(manifest,{access:'private',useCache:false});
assert.equal(prior,null,'QA reference already has data; refusing to overwrite');
try{
 assert.equal((await request({action:'add-garment',id,name:'top rojo'})).status,200,'reference-only card must accept garment');
 const upload=await request({action:'add-image',id:imageId,garmentId:id,author:'Tienda',image:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='});
 assert.equal(upload.status,200);assert.equal(upload.body.garments[0].images[0].canDelete,true);
 assert.ok(!JSON.stringify(upload.body).includes('ownerHash'),'ownership hash must not leave server');
 assert.equal((await request(null,other)).body.garments[0].images[0].canDelete,false);
 const remove={action:'delete-image',garmentId:id,imageId};
 assert.equal((await request(remove,other)).status,403,'another person cannot remove it');
 assert.equal((await request(remove)).status,200);
 assert.equal((await request(null)).body.garments[0].images.length,0);
 const media=await fetch(endpoint+'?'+new URLSearchParams({...base,image:imageId}),{headers:{Authorization:'Bearer '+token}});
 assert.equal(media.status,404,'withdrawn images cannot be read through saved URLs');
 assert.equal((await request({action:'restore-image',garmentId:id,imageId},owner,true)).status,200);
 // Realistic manifests exceed the compression threshold: tiny fixtures hid this bug.
 for(const extraId of extraImages){
  const result=await request({action:'add-image',id:extraId,garmentId:id,note:'Referencia de prenda. '.repeat(23),image:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='});
  assert.equal(result.status,200,'sequential photo must save even when manifest is compressed');
 }
 const compressed=await get(manifest,{access:'private',useCache:false});const raw=await new Response(compressed.stream).text();
 assert.ok(raw.length>1024);
 assert.match(compressed.blob.etag,/^W\//,'regression fixture must reproduce weak compressed ETag');
 await assert.rejects(put(manifest,raw,{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:compressed.blob.etag,contentType:'application/json'}),BlobPreconditionFailedError);
 const simultaneous=await Promise.all(extraImages.map(extraId=>request({action:'edit-note',garmentId:id,imageId:extraId,note:'Referencia concurrente '+extraId},owner,true)));
 assert.ok(simultaneous.every(r=>r.status===200),'concurrent updates must retry without losing another photo');
 const saved=await get(manifest,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});const state=await new Response(saved.stream).json();
 assert.ok(!saved.blob.etag.startsWith('W/'));
 assert.equal(state.garments[0].images.length,4);
 assert.ok(state.garments[0].images.slice(1).every(i=>i.note==='Referencia concurrente '+i.id));
 state.garments[0].images[0].createdAt=new Date(Date.now()-6*60000).toISOString();
 await put(manifest,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:saved.blob.etag,contentType:'application/json'});
 assert.equal((await request(null)).body.garments[0].images[0].canDelete,false);
 assert.equal((await request(remove)).status,403,'server rejects expired owner even if client is changed');
 assert.equal((await request(remove,owner,true)).status,200,'administrator can remove after deadline');
 console.log('PASS: compressed weak-ETag regression reproduced and fixed; four photos; three concurrent updates without loss; owner privacy; withdrawal; recovery; deletion permissions.');
}finally{
 const existing=await get(manifest,{access:'private',useCache:false});
 if(existing){const state=await new Response(existing.stream).json();assert.ok(state.garments.every(g=>g.id===id),'Unexpected QA records; refusing cleanup');await del([manifest,...[imageId,...extraImages].map(i=>root+'/images/'+i)]);}
 console.log('QA fixtures cleaned; production records unchanged.');
}
