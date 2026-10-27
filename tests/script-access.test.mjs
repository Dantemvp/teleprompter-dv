import test from 'node:test';
import assert from 'node:assert/strict';
import save from '../api/save.js';
import status from '../api/status.js';
import organize from '../api/organize.js';
import remove from '../api/delete.js';

function response(){
  return { code:200, setHeader(){}, status(code){ this.code=code; return this; }, json(data){ this.data=data; return this; }, send(data){ this.data=data; return this; }, end(){ return this; } };
}
async function withCredentials(run){
  const before={...process.env}, oldFetch=globalThis.fetch;
  process.env.EDIT_PASSWORD='team-fixture';
  process.env.FEDRA_R14_EDIT_PASSWORD='fedra-fixture';
  process.env.GH_REPO='test/teleprompter';
  process.env.GH_TOKEN='fixture';
  try { await run(); }
  finally { globalThis.fetch=oldFetch; for(const key of Object.keys(process.env)) if(!(key in before)) delete process.env[key]; Object.assign(process.env,before); }
}

test('checking Fedra access does not read or mutate GitHub',()=>withCredentials(async()=>{
  globalThis.fetch=()=>{throw new Error('checkOnly must not call GitHub');};
  for(const slug of ['r14-01','r14-02']){
    const res=response();
    await save({method:'POST',body:{password:'fedra-fixture',client:'fedra-ald-t84qz',slug,checkOnly:true}},res);
    assert.equal(res.code,200); assert.deepEqual(res.data,{ok:true});
  }
}));

test('Fedra access cannot escape its scripts or invoke team operations',()=>withCredentials(async()=>{
  globalThis.fetch=()=>{throw new Error('denied requests must not call GitHub');};
  for(const [client,slug] of [['fedra-ald-t84qz','r15-01'],['bianca-ald-7q2vd','r14-01'],['fedra-ald-t84qz','r14-03']]){
    const res=response();
    await save({method:'POST',body:{password:'fedra-fixture',client,slug,content:'# Changed'}},res);
    assert.equal(res.code,401);
  }
  for(const handler of [status,organize,remove]){
    const res=response();
    await handler({method:'POST',body:{password:'fedra-fixture',client:'fedra-ald-t84qz',slug:'r14-01'}},res);
    assert.equal(res.code,401);
  }
}));

test('Fedra saves an authorized script through the existing versioned GitHub flow',()=>withCredentials(async()=>{
  const calls=[];
  globalThis.fetch=async(url,opts)=>{
    calls.push({url,opts});
    if(opts.method==='PUT') return {ok:true};
    return {status:200,json:async()=>({sha:'current-version'})};
  };
  const content='# Mi guion\n\nDRA: Mi texto actualizado.\n',res=response();
  await save({method:'POST',body:{password:'fedra-fixture',client:'fedra-ald-t84qz',slug:'r14-02',content}},res);
  assert.equal(res.code,200); assert.equal(calls.length,2);
  assert(calls.every(call=>call.url.endsWith('/clientes/fedra-ald-t84qz/r14-02.md')));
  const put=JSON.parse(calls[1].opts.body);
  assert.equal(put.sha,'current-version');
  assert.equal(Buffer.from(put.content,'base64').toString('utf8'),content);
}));
