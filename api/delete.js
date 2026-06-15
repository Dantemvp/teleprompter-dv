// Vercel serverless function — elimina un guion: lo quita del index.json del cliente y borra su .md del repo.
// Mismas env vars: GH_TOKEN, GH_REPO, EDIT_PASSWORD, (opcional) ALLOW_ORIGIN

export default async function handler(req, res){
  const origin = process.env.ALLOW_ORIGIN || 'https://dantemvp.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password, client, slug } = body || {};

  if (!process.env.EDIT_PASSWORD || password !== process.env.EDIT_PASSWORD)
    return res.status(401).send('Contraseña incorrecta');
  if (!/^[a-z0-9\-_]+$/i.test(client || '') || !/^[a-z0-9\-_]+$/i.test(slug || ''))
    return res.status(400).send('Parámetros inválidos');

  const repo = process.env.GH_REPO;
  const h = {
    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'dv-teleprompter',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    // 1. Quitar el guion del index.json
    const idxApi = `https://api.github.com/repos/${repo}/contents/clientes/${client}/index.json`;
    const cur = await fetch(idxApi, { headers: h });
    if (cur.status !== 200) return res.status(502).send('No se pudo leer index.json');
    const meta = await cur.json();
    const data = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'));

    let removed = false;
    (data.grabaciones || []).forEach(rec => {
      const before = (rec.guiones || []).length;
      rec.guiones = (rec.guiones || []).filter(g => g.slug !== slug);
      if (rec.guiones.length < before) removed = true;
    });
    if (!removed) return res.status(404).send('Guion no encontrado en el índice');

    const putIdx = await fetch(idxApi, {
      method: 'PUT',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Eliminar ${client}/${slug} del índice`,
        content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64'),
        sha: meta.sha
      })
    });
    if (!putIdx.ok) return res.status(502).send('GitHub (índice): ' + (await putIdx.text()));

    // 2. Borrar el archivo .md (si existe)
    const mdApi = `https://api.github.com/repos/${repo}/contents/clientes/${client}/${slug}.md`;
    const mdCur = await fetch(mdApi, { headers: h });
    if (mdCur.status === 200) {
      const mdMeta = await mdCur.json();
      const del = await fetch(mdApi, {
        method: 'DELETE',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Eliminar ${client}/${slug}.md`, sha: mdMeta.sha })
      });
      if (!del.ok) return res.status(502).send('GitHub (archivo): ' + (await del.text()));
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send('Error: ' + (e && e.message || e));
  }
}
