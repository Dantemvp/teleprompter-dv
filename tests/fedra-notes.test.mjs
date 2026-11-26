import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStore,canAnnotate,FEDRA } from '../lib/fedra-notes.mjs';
import { makeHandler } from '../api/fedra-notes.js';

function memoryStore(){
  const files=new Map();let version=0;
  const read=async path=>{const value=files.get(path);return value?{stream:new Blob([value.bytes]).stream(),blob:{etag:value.etag}}:null;};
  const write=async(path,body,opts)=>{
    const before=files.get(path);
    if(before && !opts.allowOverwrite || opts.ifMatch && before?.etag!==opts.ifMatch)throw new Error('precondition failed');
    files.set(path,{bytes:Buffer.from(body),etag:String(++version)});return {pathname:path};
  };
  return {store:makeStore({read,write}),files};
}
const paragraphId='a'.repeat(64)+'-0';
const note=(id,text='Comentario')=>({id,paragraphId,quote:'Párrafo de la doctora',kind:'text',text});
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';

test('Fedra credentials annotate her scripts without granting access to another client',()=>{
 const env={EDIT_PASSWORD:'team',FEDRA_R14_EDIT_PASSWORD:'doctor'};
 assert.equal(canAnnotate('doctor',FEDRA,env),true);assert.equal(canAnnotate('team',FEDRA,env),true);
 assert.equal(canAnnotate('doctor','other',env),false);assert.equal(canAnnotate('',FEDRA,{}),false);assert.equal(canAnnotate('wrong',FEDRA,env),false);
});
test('concurrent comments and retries preserve both notes exactly once',async()=>{
 const {store}=memoryStore();await Promise.all([store.add('r16-ref-03',note(one)),store.add('r16-ref-03',note(two))]);
 await store.add('r16-ref-03',note(one));const state=await store.load('r16-ref-03');assert.equal(state.notes.length,2);
 await assert.rejects(store.add('r16-ref-03',note(one,'Otro contenido')),e=>e.status===409);
 await store.remove('r16-ref-03',one);assert.deepEqual((await store.load('r16-ref-03')).notes.map(n=>n.id),[two]);
});
test('audio stays private and belongs to its script and paragraph',async()=>{
 const {store,files}=memoryStore();const bytes=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVE'),Buffer.alloc(100)]);
 await store.add('r16-ref-03',{...note(one),kind:'audio',base64:bytes.toString('base64')});
 const n=(await store.load('r16-ref-03')).notes[0];assert.equal(n.paragraphId,paragraphId);assert.match(n.audioPath,/^fedra-notes\/v1\/r16-ref-03\/audio\//);
 assert.deepEqual((await store.audio('r16-ref-03',one)).bytes,bytes);await assert.rejects(store.audio('r16-ref-02',one),e=>e.status===404);
 await assert.rejects(store.add('r16-ref-03',{...note(two),kind:'audio',base64:Buffer.from('<html>').toString('base64')}));assert.equal(files.size,2);
});
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.data=v;return this;},send(v){this.data=v;return this;},end(){return this;}};}
test('API checks origin, credentials and registered scripts before returning notes',async()=>{
 let reads=0;const handler=makeHandler({authorize:(pw,client)=>pw==='test'&&client===FEDRA,verify:async(c,s)=>{if(s!=='r16-ref-03')throw Object.assign(new Error('Guion no encontrado'),{status:404});},store:{load:async()=>{reads++;return {notes:[{...note(one),audioPath:'private',createdAt:'2026-11-26'}]};}}});
 const req={method:'POST',headers:{'x-edit-password':'test'},body:{client:FEDRA,slug:'r16-ref-03',action:'list'}};
 let res=response();await handler({...req,headers:{origin:'https://other.example','x-edit-password':'test'}},res);assert.equal(res.code,403);
 res=response();await handler({...req,headers:{}},res);assert.equal(res.code,401);assert.equal(reads,0);
 res=response();await handler({...req,body:{...req.body,slug:'../other'}},res);assert.equal(res.code,404);assert.equal(reads,0);
 res=response();await handler({...req,body:{...req.body,slug:'unregistered'}},res);assert.equal(res.code,404);assert.equal(reads,0);
 res=response();await handler(req,res);assert.equal(res.code,200);assert.equal(res.data.notes[0].audioPath,undefined);assert.equal(res.headers['Cache-Control'],'private, no-store');
});
