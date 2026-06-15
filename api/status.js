// Vercel serverless function — marca un guion como grabado (o lo desmarca) en el index.json del cliente.
// Mismas env vars que save.js: GH_TOKEN, GH_REPO, EDIT_PASSWORD, (opcional) ALLOW_ORIGIN

export default async function handler(req, res){
  const origin = process.env.ALLOW_ORIGIN || 'https://dantemvp.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password, client, slug, grabado, locutor } = body || {};

  if (!process.env.EDIT_PASSWORD || password !== process.env.EDIT_PASSWORD)
    return res.status(401).send('Contraseña incorrecta');
  if (!/^[a-z0-9\-_]+$/i.test(client || '') || !/^[a-z0-9\-_]+$/i.test(slug || ''))
    return res.status(400).send('Parámetros inválidos');

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
    const cur = await fetch(api, { headers: h });
    if (cur.status !== 200) return res.status(502).send('No se pudo leer index.json');
    const meta = await cur.json();
    const data = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'));

    let found = false;
    (data.grabaciones || []).forEach(rec => (rec.guiones || []).forEach(g => {
      if (g.slug === slug) {
        if ('grabado' in body) g.grabado = !!grabado;
        if ('locutor' in body) g.locutor = locutor ? String(locutor).slice(0, 40) : null;
        found = true;
      }
    }));
    if (!found) return res.status(404).send('Guion no encontrado en el índice');

    const msg = ('locutor' in body)
      ? `Locutor ${client}/${slug}=${locutor || '(ninguno)'}`
      : `Marcar ${client}/${slug} grabado=${!!grabado}`;
    const newContent = JSON.stringify(data, null, 2) + '\n';
    const put = await fetch(api, {
      method: 'PUT',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        content: Buffer.from(newContent, 'utf8').toString('base64'),
        sha: meta.sha
      })
    });
    if (!put.ok) return res.status(502).send('GitHub: ' + (await put.text()));
    return res.status(200).json({ ok: true, grabado: !!grabado });
  } catch (e) {
    return res.status(500).send('Error: ' + (e && e.message || e));
  }
}
