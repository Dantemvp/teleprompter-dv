/* Referencias por prenda. Vive aparte del texto: nunca modifica el guion ni el
 * contenido que aparece al leer en modo teleprompter. */
(() => {
  const CLIENT = 'bianca-ald-7q2vd';
  const ENDPOINT = location.hostname === 'localhost' ? location.origin + '/api/prendas' : 'https://teleprompter-dv.vercel.app/api/prendas';
  const esc = texto => String(texto ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entrada = new URL(location.href);
  if (entrada.searchParams.get('c') === CLIENT && entrada.searchParams.get('prendas')) sessionStorage.setItem('prendas:' + CLIENT, entrada.searchParams.get('prendas'));
  let current;

  async function imagenComprimida(file) {
    if (file.size > 25 * 1024 * 1024) throw new Error('La imagen supera 25 MB. Elige una foto o captura más pequeña.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = .84, resultado;
      do { resultado = canvas.toDataURL('image/jpeg', quality).split(',')[1]; quality -= .12; } while (resultado.length > 1250000 && quality > .25);
      if (resultado.length > 1250000) throw new Error('No pudimos reducir la imagen. Prueba con una captura.');
      return resultado;
    } finally { URL.revokeObjectURL(url); }
  }

  async function mount(opts) {
    current?.abort.abort(); current?.dialog?.remove();
    const root = document.getElementById('prendas-root');
    if (!root || opts.client !== CLIENT || !opts.slug) return;
    const access = sessionStorage.getItem('prendas:' + CLIENT);
    if (!opts.admin && !access) return;
    const ctx = current = { ...opts, root, access, password: localStorage.getItem('dvpw'), abort: new AbortController(), state: { garments: [] }, role: '', dialog: null, busy: false };
    root.innerHTML = '<details class="prendas-panel"><summary>Prendas y referencias <span data-count>…</span></summary><div class="prendas-body"><p class="prendas-help">Cada prenda tiene sus fotos. Bianca selecciona cuáles usar en edición.</p><div data-content>Cargando referencias…</div><p class="prendas-error" data-error role="status"></p></div></details>';
    ctx.error = mensaje => { if (ctx === current) root.querySelector('[data-error]').textContent = mensaje; };
    ctx.api = async (data = null) => {
      const headers = {}; if (ctx.password && opts.admin) headers['X-Edit-Password'] = ctx.password; else if (access) headers.Authorization = 'Bearer ' + access;
      let url = ENDPOINT, init = { headers, signal: ctx.abort.signal };
      const payload = { client: opts.client, slug: opts.slug, ...data };
      if (data) { headers['Content-Type'] = 'application/json'; init.method = 'POST'; init.body = JSON.stringify(payload); }
      else url += '?' + new URLSearchParams(payload);
      const r = await fetch(url, init); const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'No se pudo guardar.');
      return result;
    };
    ctx.save = async data => { ctx.error(''); ctx.state = await ctx.api(data); ctx.role = ctx.state.role; render(ctx); };
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.garment) return openGarment(ctx, b.dataset.garment);
        if (b.dataset.action === 'activate') {
          const password = await opts.askPassword(); if (!password) return;
          ctx.password = password; ctx.state = await ctx.api(); localStorage.setItem('dvpw', password); ctx.role = ctx.state.role; render(ctx);
        }
        if (b.dataset.action === 'new') return newGarment(ctx);
        if (b.dataset.share) {
          b.disabled = true;
          try {
            const result = await ctx.api({ action: 'share', role: b.dataset.share });
            const u = new URL(location.href); u.hash = ''; u.searchParams.set('c', opts.client); u.searchParams.set('g', opts.slug); u.searchParams.set('prendas', result.access);
            // El enlace se muestra también cuando el navegador bloquea el portapapeles.
            showDialog(ctx, 'Compartir referencias', `<p class="prendas-help">${b.dataset.share === 'bianca' ? 'Bianca puede subir fotos y seleccionar las que se usarán.' : b.dataset.share === 'tienda' ? 'La tienda puede agregar fotos. La selección final la hace Bianca.' : 'El editor puede consultar las fotos y cuáles están seleccionadas.'}</p><label>Enlace<input data-share-url readonly value="${esc(u.href)}"></label><button type="button" class="primary" data-copy-url>Copiar enlace</button>`);
            ctx.dialog.querySelector('[data-copy-url]').onclick = async () => { const input = ctx.dialog.querySelector('[data-share-url]'); input.select(); try { await navigator.clipboard.writeText(input.value); ctx.dialog.querySelector('[data-copy-url]').textContent = 'Enlace copiado'; } catch { ctx.dialog.querySelector('[data-copy-url]').textContent = 'Mantén pulsado el enlace para copiar'; } };
          } finally { b.disabled = false; }
        }
      } catch (error) { if (error.name !== 'AbortError') ctx.error(error.message); }
    }, { signal: ctx.abort.signal });
    document.getElementById('v-conv')?.addEventListener('click', e => {
      const b = e.target.closest('[data-prenda-inline]'); if (b) openGarment(ctx, b.dataset.prendaInline);
    }, { signal: ctx.abort.signal });
    if (opts.admin && !ctx.password && !access) { root.querySelector('[data-content]').innerHTML = '<button data-action="activate">Abrir referencias</button>'; return; }
    try { ctx.state = await ctx.api(); ctx.role = ctx.state.role; if (current === ctx) render(ctx); }
    catch (error) { if (error.name !== 'AbortError') { ctx.error(error.message); root.querySelector('[data-content]').innerHTML = opts.admin ? '<button data-action="activate">Abrir con contraseña de edición</button>' : ''; } }
  }

  function render(ctx) {
    if (current !== ctx) return;
    const garments = ctx.state.garments, ready = garments.filter(g => g.images.some(i => i.selected)).length;
    ctx.root.querySelector('[data-count]').textContent = `${ready}/${garments.length} listas`;
    ctx.root.querySelector('[data-content]').innerHTML = `<div class="prendas-tools">${ctx.role !== 'editor' ? '<button type="button" class="primary" data-action="new">+ Agregar prenda</button>' : ''}</div><div class="prendas-list">${garments.map(g => `<button type="button" class="prenda-card ${g.images.some(i => i.selected) ? 'lista' : ''}" data-garment="${esc(g.id)}"><div><strong>${esc(g.name)}</strong><span>${g.kind === 'exacta' ? 'Prenda exacta' : 'Referencia de estilo'} · ${g.images.length} fotos</span></div><span>${g.images.some(i => i.selected) ? '✓ Seleccionada' : 'Por seleccionar'} →</span></button>`).join('') || '<p class="prendas-empty">Agrega el nombre de una prenda del guion. Después toca su nombre para subir fotos.</p>'}</div>${ctx.role === 'admin' ? '<div class="prendas-tools"><button data-share="bianca">Enlace para Bianca</button><button data-share="tienda">Enlace para empleadas</button><button data-share="editor">Enlace para editor</button></div>' : ''}`;
    // Sólo se marca la conversación: texto plano y lectura permanecen intactos.
    document.querySelectorAll('#v-conv .bubble, #v-conv .beat').forEach(bubble => {
      const texto = bubble.textContent; bubble.replaceChildren();
      const terms = [...garments].sort((a,b) => b.name.length - a.name.length);
      if (!terms.length) { bubble.textContent = texto; return; }
      const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(terms.map(g => escapeRx(g.name)).join('|'), 'giu'); let last = 0;
      for (const match of texto.matchAll(rx)) {
        bubble.append(document.createTextNode(texto.slice(last, match.index)));
        const g = terms.find(g => g.name.toLocaleLowerCase('es') === match[0].toLocaleLowerCase('es'));
        const button = document.createElement('button'); button.type = 'button'; button.className = 'prenda-inline'; button.dataset.prendaInline = g.id; button.textContent = match[0]; button.setAttribute('aria-label', `Ver fotos de ${g.name}`); bubble.append(button); last = match.index + match[0].length;
      }
      bubble.append(document.createTextNode(texto.slice(last)));
    });
  }

  function showDialog(ctx, title, html) {
    ctx.dialog?.remove();
    const dialog = ctx.dialog = document.createElement('dialog'); dialog.className = 'prendas-modal';
    dialog.innerHTML = `<header class="prendas-modal-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Cerrar referencias">Cerrar</button></header><div class="prendas-modal-body">${html}<p class="prendas-error" role="status" data-dialog-error></p></div>`;
    document.body.append(dialog); dialog.querySelector('[data-close]').onclick = () => dialog.close(); dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); dialog.showModal();
    return dialog;
  }
  function newGarment(ctx) {
    const seleccion = getSelection()?.toString().trim().slice(0,100) || '';
    const d = showDialog(ctx, 'Agregar prenda', `<form data-new><label>Nombre tal como aparece en el guion<input name="name" required maxlength="100" value="${esc(seleccion)}" placeholder="Ej. top con encaje"></label><label>Qué debe usar el editor<select name="kind"><option value="exacta">Prenda exacta · usar esta foto</option><option value="estilo">Referencia de estilo · como orientación</option></select></label><button type="submit" class="primary">Agregar prenda</button></form>`);
    const id = crypto.randomUUID();
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const b = d.querySelector('button[type=submit]'); b.disabled = true;
      try { const fd = new FormData(e.target); await ctx.save({ action:'add-garment', id, name:fd.get('name'), kind:fd.get('kind') }); openGarment(ctx, id); }
      catch (error) { d.querySelector('[data-dialog-error]').textContent = error.message; b.disabled = false; }
    };
  }
  function openGarment(ctx, id) {
    const g = ctx.state.garments.find(g => g.id === id); if (!g) return;
    const puedeSubir = ctx.role !== 'editor', puedeElegir = ['admin','bianca'].includes(ctx.role);
    const d = showDialog(ctx, g.name, `<p class="prendas-subtitle">${g.kind === 'exacta' ? 'Prenda exacta: usar las fotos seleccionadas, sin sustituirla.' : 'Referencia de estilo: las fotos orientan la elección.'}</p><p class="prendas-help">${g.images.some(i => i.selected) ? 'Las imágenes marcadas son las que debe usar el editor.' : 'Falta que Bianca seleccione al menos una imagen.'}</p><div class="prendas-grid">${g.images.map(i => {
      const url = ENDPOINT + '?' + new URLSearchParams({ client:ctx.client, slug:ctx.slug, image:i.id, access:ctx.state.viewAccess });
      return `<article class="prendas-photo ${i.selected ? 'selected' : ''}"><a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Referencia de ${esc(g.name)}" loading="lazy" referrerpolicy="no-referrer"></a><div class="prendas-caption">${i.selected ? `<span class="prendas-badge">✓ Usar esta · ${esc(i.selectedBy)}</span>` : '<span>Propuesta</span>'}<p>${esc(i.note)}</p><small>Subió: ${esc(i.author)}</small>${puedeElegir ? `<button type="button" data-select="${i.id}" data-selected="${!i.selected}">${i.selected ? 'Quitar selección' : 'Usar esta'}</button>` : ''}</div></article>`;
    }).join('')}</div>${!g.images.length ? '<p class="prendas-empty">Todavía no hay fotos de esta prenda.</p>' : ''}${puedeSubir ? `<section class="prendas-upload"><label>Tu nombre (para saber quién compartió la foto)<input data-author maxlength="60" value="${esc(localStorage.getItem('prendas-author') || (ctx.role === 'bianca' ? 'Bianca' : ''))}" placeholder="Ej. Rubí"></label><label>Descripción opcional<textarea data-note maxlength="500" placeholder="Ej. tenemos este modelo en blanco; usar la foto de frente"></textarea></label><div class="prendas-tools"><button type="button" class="primary" data-camera>Tomar foto</button><button type="button" data-gallery>Subir fotos o capturas</button></div><input hidden data-camera-file type="file" accept="image/*" capture="environment"><input hidden data-gallery-file type="file" accept="image/*" multiple><p class="prendas-help">Se guardan al elegirlas. Puedes subir fotos de la tienda o capturas de Pinterest y redes.</p><p class="prendas-notice" role="status" data-upload-status></p></section>` : ''}`);
    d.querySelectorAll('[data-select]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await ctx.save({ action:'select', garmentId:id, imageId:b.dataset.select, selected:b.dataset.selected==='true' }); openGarment(ctx, id); }
      catch(error) { d.querySelector('[data-dialog-error]').textContent = error.message; b.disabled = false; }
    });
    if (!puedeSubir) return;
    d.querySelector('[data-camera]').onclick = () => d.querySelector('[data-camera-file]').click();
    d.querySelector('[data-gallery]').onclick = () => d.querySelector('[data-gallery-file]').click();
    const subir = async e => {
      const files = [...e.target.files]; if (!files.length) return;
      const author = d.querySelector('[data-author]').value.trim() || (ctx.role==='bianca'?'Bianca':'Equipo tienda'); localStorage.setItem('prendas-author', author);
      const note = d.querySelector('[data-note]').value.trim();
      d.querySelectorAll('button').forEach(b => b.disabled = true);
      let guardadas = 0;
      try {
        if (files.length + g.images.length > 12) throw new Error('Puedes guardar hasta 12 fotos por prenda.');
        for (const file of files) {
          d.querySelector('[data-upload-status]').textContent = `Guardando ${guardadas+1} de ${files.length}…`;
          await ctx.save({ action:'add-image', garmentId:id, id:crypto.randomUUID(), image:await imagenComprimida(file), author, note }); guardadas++;
        }
        openGarment(ctx, id); ctx.dialog.querySelector('[data-upload-status]').textContent = `${guardadas} ${guardadas===1?'foto guardada':'fotos guardadas'}.`;
      } catch(error) { d.querySelector('[data-dialog-error]').textContent = `${guardadas ? guardadas+' fotos ya se guardaron. ' : ''}${error.message}`; d.querySelectorAll('button').forEach(b => b.disabled = false); e.target.value = ''; }
    };
    d.querySelector('[data-camera-file]').onchange = subir; d.querySelector('[data-gallery-file]').onchange = subir;
  }
  window.Prendas = { mount };
})();
