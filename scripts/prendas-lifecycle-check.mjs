// Prueba real de almacenamiento, aislada en prendas-qa, nunca en producción.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { get, put, del } from '@vercel/blob';
import { CLIENT } from '../lib/prendas-core.mjs';
const endpoint='http://localhost:4173/api/prendas';
const base={client:CLIENT,slug:'g-71'},id=randomUUID(),imageId=randomUUID();
const root='prendas-qa/'+CLIENT+'/g-71',manifest=root+'/manifest.json';
const owner='a'.repeat(64),other='b'.repeat(64);
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
 const saved=await get(manifest,{access:'private',useCache:false});const state=await new Response(saved.stream).json();
 state.garments[0].images[0].createdAt=new Date(Date.now()-6*60000).toISOString();
 await put(manifest,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:saved.blob.etag,contentType:'application/json'});
 assert.equal((await request(null)).body.garments[0].images[0].canDelete,false);
 assert.equal((await request(remove)).status,403,'server rejects expired owner even if client is changed');
 assert.equal((await request(remove,owner,true)).status,200,'administrator can remove after deadline');
 console.log('PASS: reference-only upload; owner privacy; wrong-owner denial; withdrawal; inaccessible media; admin recovery; expired-owner denial; unlimited admin deletion.');
}finally{
 const existing=await get(manifest,{access:'private',useCache:false});
 if(existing){const state=await new Response(existing.stream).json();assert.ok(state.garments.every(g=>g.id===id),'Unexpected QA records; refusing cleanup');await del([manifest,root+'/images/'+imageId]);}
 console.log('QA fixtures cleaned; production records unchanged.');
}
