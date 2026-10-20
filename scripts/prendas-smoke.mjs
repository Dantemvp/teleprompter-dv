// Credencial por stdin con terminal sin eco; nunca pasar secretos por argumentos.
import { crearAcceso, CLIENT } from '../lib/prendas-core.mjs';
import { createInterface } from 'node:readline';
const input = createInterface({ input: process.stdin, terminal: false });
console.log('Esperando credencial de verificación por stdin (sin eco).');
const secret = await new Promise(resolve => input.once('line', resolve)); input.close();
const endpoint = 'https://teleprompter-dv.vercel.app/api/prendas';
const base = { client: CLIENT, slug: 'g-151' };
const headers = { 'X-Prendas-Admin': secret, 'Content-Type': 'application/json' };
const r = await fetch(endpoint + '?' + new URLSearchParams(base), { headers });
const state = await r.json();
if (r.status !== 200) throw Error(JSON.stringify({ status: r.status, body: state }));
const replay = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...base, action: 'add-garment', ...state.garments[0] }) });
if (replay.status !== 200) throw Error('production write ' + replay.status);
if ((await fetch(endpoint + '?' + new URLSearchParams(base))).status !== 401) throw Error('anonymous access');
for (const role of ['bianca', 'tienda', 'editor']) {
  const access = crearAcceso(CLIENT, role, secret);
  const q = await fetch(endpoint + '?' + new URLSearchParams(base), { headers: { Authorization: 'Bearer ' + access } });
  if (q.status !== 200) throw Error(role + ' read failed');
  const d = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, action: 'select', garmentId: state.garments[0].id, imageId: crypto.randomUUID(), selected: true }) });
  if (d.status !== (role === 'bianca' ? 400 : 403)) throw Error(role + ' selection permissions ' + d.status);
  console.log(JSON.stringify({ role, url: 'https://dantemvp.github.io/teleprompter-dv/?' + new URLSearchParams({ c: CLIENT, g: 'g-151', prendas: access }) }));
}
console.log('PRODUCTION PASS: persisted garments, writes, private access and role enforcement.');
