// Vercel serverless function — guarda un guion editado commiteándolo al repo de GitHub.
// El token de GitHub y la contraseña viven como variables de entorno en Vercel (nunca en el navegador).
// Env vars requeridas: GH_TOKEN, GH_REPO (ej. "Dantemvp/teleprompter-dv"), EDIT_PASSWORD
// Opcional: ALLOW_ORIGIN (default: https://dantemvp.github.io)

export default async function handler(req, res){
  const origin = process.env.ALLOW_ORIGIN || 'https://dantemvp.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { password, client, slug, content } = body || {};

  if (!process.env.EDIT_PASSWORD || password !== process.env.EDIT_PASSWORD)
    return res.status(401).send('Contraseña incorrecta');
  if (!/^[a-z0-9\-_]+$/i.test(client || '') || !/^[a-z0-9\-_]+$/i.test(slug || ''))
    return res.status(400).send('Cliente o guion inválido');
  if (typeof content !== 'string' || content.length > 100000)
    return res.status(400).send('Contenido inválido');

  const repo = process.env.GH_REPO;
  const path = `clientes/${client}/${slug}.md`;
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const ghHeaders = {
    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'dv-teleprompter',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    let sha;
    const cur = await fetch(api, { headers: ghHeaders });
    if (cur.status === 200) sha = (await cur.json()).sha;
    else if (cur.status !== 404) return res.status(502).send('No se pudo leer el archivo actual');

    const put = await fetch(api, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Editar ${client}/${slug} desde el editor web`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha
      })
    });
    if (!put.ok) return res.status(502).send('GitHub rechazó el guardado: ' + (await put.text()));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send('Error: ' + (e && e.message || e));
  }
}
