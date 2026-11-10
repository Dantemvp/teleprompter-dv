import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../prendas-runtime.js',import.meta.url),'utf8');
function runtime(fetch,extra={}){
 const window={localStorage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('full');}}};
 runInNewContext(source,{window,fetch,AbortController,DOMException,TypeError,setTimeout,clearTimeout,Map,...extra});return window.PrendasRuntime;
}
test('una conexión colgada tiene límite y conserva un mensaje de reintento',async()=>{
 const r=runtime((_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
 await assert.rejects(r.request('/test',{},10),/tardó demasiado/);
});
test('errores HTTP, desconexión y respuestas HTML no se presentan como guardado exitoso',async()=>{
 await assert.rejects(runtime(async()=>({ok:false,status:409,json:async()=>({error:'Conflicto de guardado'})})).request('/test'),{status:409,message:'Conflicto de guardado'});
 await assert.rejects(runtime(async()=>{throw new TypeError('failed fetch');}).request('/test'),/No hay conexión/);
 await assert.rejects(runtime(async()=>({json:async()=>{throw new Error('HTML');}})).request('/test'),/servidor no respondió/);
 assert.deepEqual(await runtime(async()=>({ok:true,json:async()=>({saved:true})})).request('/test'),{saved:true});
});
test('cancelar al salir del guion no se confunde con timeout',async()=>{
 const abort=new AbortController();
 const r=runtime((_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
 const pending=r.request('/test',{signal:abort.signal},1000);abort.abort();
 await assert.rejects(pending,{name:'AbortError'});
});
test('almacenamiento bloqueado no rompe las prendas y permite reabrir pendientes en memoria',async()=>{
 const r=runtime();assert.equal(r.storage.get('localStorage','x'),null);assert.equal(r.storage.set('localStorage','x','a'),false);
 assert.equal(await r.drafts.put({key:'client:script:photo',file:'test'}),false);
 assert.equal((await r.drafts.list('client:script:')).length,1);
 await r.drafts.remove('client:script:photo');assert.equal((await r.drafts.list('client:script:')).length,0);
});
test('retirar un pendiente durante una copia lenta no lo resucita al terminar',async()=>{
 const disk=new Map();let finishPut;
 const db={close(){},transaction(){
  const tx={objectStore:()=>({
   put(item){const request={result:item.key};finishPut=()=>{disk.set(item.key,item);tx.oncomplete();};return request;},
   delete(key){const request={};queueMicrotask(()=>{disk.delete(key);tx.oncomplete();});return request;},
   getAll(){const request={result:[...disk.values()]};queueMicrotask(()=>tx.oncomplete());return request;}
  })};return tx;
 }};
 const indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
 const r=runtime(undefined,{indexedDB});
 const saving=r.drafts.put({key:'client:script:photo',file:'test'});
 await new Promise(setImmediate);
 assert.equal(typeof finishPut,'function');
 const removing=r.drafts.remove('client:script:photo');
 assert.equal((await r.drafts.list('client:script:')).length,0,'memory is cleared before disk finishes');
 finishPut();await saving;await removing;
 assert.equal(disk.size,0,'cleanup follows the unfinished write');
 assert.equal((await r.drafts.list('client:script:')).length,0);
});
