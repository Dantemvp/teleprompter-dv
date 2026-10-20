import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { CLIENT, crearAcceso, leerAcceso, cambiarEstado, tipoImagen, puedeBorrar, BORRADO_PROPIO_MS } from '../lib/prendas-core.mjs';

const secret = 'sólo-para-pruebas-locales';
const id = '12345678-1234-1234-1234-123456789012';
const foto = '12345678-1234-1234-1234-123456789013';
test('un enlace sólo funciona para su cliente, rol y vigencia', () => {
  const token = crearAcceso(CLIENT, 'tienda', secret, 1000);
  assert.equal(leerAcceso(token, CLIENT, secret, 2000), 'tienda');
  assert.equal(leerAcceso(token, 'otro-cliente', secret, 2000), null);
  assert.equal(leerAcceso(token + 'x', CLIENT, secret, 2000), null);
  assert.equal(leerAcceso(token, CLIENT, secret, 200 * 86400000), null);
});
test('los accesos de un enlace normal no permiten escribir en otro guion',()=>{
  const token=crearAcceso(CLIENT,'tienda',secret,1000,'g-138');
  assert.equal(leerAcceso(token,CLIENT,secret,2000,'g-138'),'tienda');
  assert.equal(leerAcceso(token,CLIENT,secret,2000,'g-141'),null);
  assert.equal(leerAcceso(token,CLIENT,secret,2000),null);
  assert.throws(()=>crearAcceso(CLIENT,'tienda',secret,1000,'../otro'));
});
test('el editor sólo consulta y la tienda no puede aprobar referencias', () => {
  assert.throws(() => cambiarEstado({ garments: [] }, { action:'add-garment', id, name:'Top' }, 'editor'), { status:403 });
  const state = { garments:[{ id, images:[{id:foto,selected:false}] }] };
  assert.throws(() => cambiarEstado(state, { action:'select', garmentId:id, imageId:foto, selected:true }, 'tienda'), { status:403 });
});
test('Bianca puede elegir varias fotos sin sobrescribir las propuestas', () => {
  const original = { garments:[{ id, images:[{id:foto,selected:false},{id:'otra',selected:false}] }] };
  let next = cambiarEstado(original, { action:'select', garmentId:id, imageId:foto, selected:true }, 'bianca');
  next = cambiarEstado(next, { action:'select', garmentId:id, imageId:'otra', selected:true }, 'bianca');
  assert.equal(next.garments[0].images.filter(i=>i.selected).length, 2);
  assert.equal(original.garments[0].images[0].selected, false);
});
test('reintentar la misma carga no duplica prendas ni imágenes', () => {
  const add = { action:'add-garment', id, name:'Top con encaje', kind:'exacta' };
  let state = cambiarEstado({garments:[]},add,'tienda');
  state = cambiarEstado(state,add,'tienda');
  assert.equal(state.garments.length,1);
  const image = { action:'add-image', garmentId:id, id:foto, note:'Usar blanco', author:'Rubí' };
  state = cambiarEstado(state,image,'tienda');state = cambiarEstado(state,image,'tienda');
  assert.equal(state.garments[0].images.length,1);assert.equal(state.garments[0].images[0].selected,false);
});
test('no acepta SVG o HTML como imágenes', () => {
  assert.equal(tipoImagen(Buffer.from('<svg onload=alert(1)>')),null);
  assert.equal(tipoImagen(Buffer.from('<html>')),null);
  assert.equal(tipoImagen(Buffer.from('89504e470d0a1a0a','hex')),'image/png');
});

test('detecta prendas en cualquier guion y conserva materiales sin inventar productos', () => {
  const browser = {};
  runInNewContext(readFileSync(new URL('../prendas-detect.js', import.meta.url), 'utf8'), browser);
  const detect = browser.PrendasDetect;
  const names = [...detect.identificar('Un top de encaje forrado, chamarra de gamuza y bota coñac. Otra chamarra de gamuza. Clóset, autoestima y tendencia.')];
  assert.deepEqual(names, ['top de encaje forrado','chamarra de gamuza','bota coñac']);
  assert.equal(detect.identificar('Tenemos tops y faldas, no autopistas ni atascos.').length, 2);
  assert.deepEqual([...detect.identificar('top rojo y blusa azul con pantalón verde')],['top rojo','blusa azul','pantalón verde']);
  assert.equal(detect.idPara(CLIENT,'g-151','Top de encaje'),detect.idPara(CLIENT,'g-151','TOP DE ENCAJE'));
  assert.notEqual(detect.idPara(CLIENT,'g-151','Top'),detect.idPara(CLIENT,'g-152','Top'));
});

test('solo quien subió la foto puede retirarla antes de cinco minutos, nunca después',()=>{
  const created='2026-10-19T12:00:00.000Z',time=Date.parse(created),owner='a'.repeat(64);
  const image={id:foto,ownerHash:owner,createdAt:created,selected:true};
  assert.equal(puedeBorrar(image,'tienda',owner,time+BORRADO_PROPIO_MS-1),true);
  assert.equal(puedeBorrar(image,'tienda',owner,time+BORRADO_PROPIO_MS),false);
  assert.equal(puedeBorrar(image,'bianca','b'.repeat(64),time+1),false);
  assert.equal(puedeBorrar(image,'editor',owner,time+1),false);
  assert.equal(puedeBorrar(image,'tienda',owner,time-1),false);
  assert.equal(puedeBorrar({...image,ownerHash:null},'tienda',owner,time+1),false);
  assert.equal(puedeBorrar(image,'admin',null,time+86400000),true);
  const state={garments:[{id,images:[image]}]},data={action:'delete-image',garmentId:id,imageId:foto};
  assert.throws(()=>cambiarEstado(state,data,'tienda',new Date(time+BORRADO_PROPIO_MS).toISOString(),owner),{status:403});
  assert.throws(()=>cambiarEstado(state,data,'bianca',created,'b'.repeat(64)),{status:403});
  const removed=cambiarEstado(state,data,'tienda',new Date(time+1000).toISOString(),owner);
  assert.equal(removed.garments[0].images[0].selected,false);
  assert.ok(removed.garments[0].images[0].deletedAt);
  assert.equal(state.garments[0].images[0].deletedAt,undefined);
  const restore={action:'restore-image',garmentId:id,imageId:foto};
  assert.throws(()=>cambiarEstado(removed,restore,'bianca'),{status:403});
  assert.equal(cambiarEstado(removed,restore,'admin').garments[0].images[0].deletedAt,undefined);
});

test('guardar una indicación no cambia la selección ni elimina fotos', () => {
  const original = {garments:[{id,images:[{id:foto,selected:true,note:'Antes'}]}]};
  const data={action:'edit-note',garmentId:id,imageId:foto,note:' Usar el blanco '};
  const next=cambiarEstado(original,data,'bianca');
  assert.equal(next.garments[0].images[0].note,'Usar el blanco');
  assert.equal(next.garments[0].images[0].selected,true);
  assert.equal(original.garments[0].images[0].note,'Antes');
  assert.throws(()=>cambiarEstado(original,data,'tienda'),{status:403});
  assert.throws(()=>cambiarEstado(original,data,'editor'),{status:403});
});
