// Vercel serverless function — organiza el index.json de un cliente.
// Acciones: "add-rec", "move" y "delete-timeline" (quitar un bloque del orden de grabación).
// Mismas env vars que save.js/status.js: GH_TOKEN, GH_REPO, EDIT_PASSWORD, (opcional) ALLOW_ORIGIN

export default async function handler(req, res){
  const origin = process.env.ALLOW_ORIGIN || 'https://dantemvp.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password, client, action, rec, nombre, slug, toRec, categoria, timelineIndex, timelineTitle } = body || {};

  if (!process.env.EDIT_PASSWORD || password !== process.env.EDIT_PASSWORD)
    return res.status(401).send('Contraseña incorrecta');
  if (!/^[a-z0-9\-_]+$/i.test(client || ''))
    return res.status(400).send('Cliente inválido');

  const repo = process.env.GH_REPO;
  const path = `clientes/${client}/index.json`;
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const h = {
    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'dv-teleprompter',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    let lastErr = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await fetch(api, { headers: h, cache: 'no-store' });
      if (cur.status !== 200) { lastErr = 'No se pudo leer index.json'; continue; }
      const meta = await cur.json();
      const data = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'));
      data.grabaciones = data.grabaciones || [];

      let msg = '';
      if (action === 'add-rec') {
        if (!/^[a-z0-9\-_ ]{1,20}$/i.test(rec || '')) return res.status(400).send('Código de grabación inválido');
        if (data.grabaciones.some(g => g.rec === rec)) return res.status(409).send('Esa grabación ya existe');
        data.grabaciones.unshift({ rec, nombre: (nombre || rec).slice(0, 60), fecha: 'Por definir', locacion: '', guiones: [] });
        msg = `Nueva grabación ${client}/${rec}`;
      } else if (action === 'move') {
        if (!/^[a-z0-9\-_]+$/i.test(slug || '')) return res.status(400).send('Slug inválido');
        let item = null;
        data.grabaciones.forEach(g => {
          const i = (g.guiones || []).findIndex(x => x.slug === slug);
          if (i >= 0) item = g.guiones.splice(i, 1)[0];
        });
        if (!item) return res.status(404).send('Guion no encontrado');
        if (categoria) item.categoria = String(categoria).slice(0, 20);
        const target = data.grabaciones.find(g => g.rec === toRec);
        if (!target) return res.status(404).send('La grabación destino no existe');
        target.guiones = target.guiones || [];
        target.guiones.push(item);
        msg = `Mover ${client}/${slug} → ${toRec}${categoria ? (' [' + categoria + ']') : ''}`;
      } else if (action === 'delete-timeline') {
        const target = data.grabaciones.find(g => g.rec === rec);
        if (!target) return res.status(404).send('La grabación no existe');
        if (!Number.isInteger(timelineIndex) || timelineIndex < 0 || timelineIndex >= (target.timeline || []).length)
          return res.status(400).send('Bloque de horario inválido');
        const block = target.timeline[timelineIndex];
        if (String(block.titulo || '') !== String(timelineTitle || ''))
          return res.status(409).send('El orden de grabación cambió; recarga e inténtalo de nuevo');
        target.timeline.splice(timelineIndex, 1);
        msg = `Quitar bloque de horario ${client}/${rec}: ${String(block.titulo || '').slice(0, 80)}`;
      } else {
        return res.status(400).send('Acción inválida');
      }

      const newContent = JSON.stringify(data, null, 2) + '\n';
      const put = await fetch(api, {
        method: 'PUT',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, content: Buffer.from(newContent, 'utf8').toString('base64'), sha: meta.sha })
      });
      if (put.ok) return res.status(200).json({ ok: true });
      if (put.status === 409 || put.status === 422) { lastErr = 'conflicto de versión'; continue; }
      return res.status(502).send('GitHub: ' + (await put.text()));
    }
    return res.status(409).send('No se pudo guardar tras varios intentos: ' + lastErr);
  } catch (e) {
    return res.status(500).send('Error: ' + (e && e.message || e));
  }
}
