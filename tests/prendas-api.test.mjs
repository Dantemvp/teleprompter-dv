import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/prendas.js';
test('la API rechaza cuerpos inválidos como 400, no como un fallo 500',async()=>{
 for(const body of ['{', 'null', '[]', 'false', null]){
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',headers:{},body},res);assert.equal(res.code,400);
 }
});
