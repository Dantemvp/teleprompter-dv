import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT, crearAcceso, leerAcceso, cambiarEstado, tipoImagen } from '../lib/prendas-core.mjs';

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
