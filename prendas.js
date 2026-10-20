/* Referencias por prenda. Vive aparte del texto: nunca modifica el guion ni el
 * contenido que aparece al leer en modo teleprompter. */
(() => {
  const CLIENT = 'bianca-ald-7q2vd';
  const ENDPOINT = ['localhost','127.0.0.1'].includes(location.hostname) ? location.origin + '/api/prendas' : 'https://teleprompter-dv.vercel.app/api/prendas';
  const esc = texto => String(texto ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entrada = new URL(location.href);
  if (entrada.searchParams.get('c') === CLIENT && entrada.searchParams.get('prendas')) sessionStorage.setItem('prendas:' + CLIENT, entrada.searchParams.get('prendas'));
  let current;
  const ownerStorage = 'prendas-owner:' + CLIENT;
  let ownerKey = localStorage.getItem(ownerStorage);
  if (!/^[a-f0-9]{64}$/.test(ownerKey || '')) {
    ownerKey = [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(ownerStorage,ownerKey);
  }

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
    current?.abort.abort(); current?.dialog?.close(); current?.dialog?.remove();
    document.body.classList.remove('prendas-dialog-open');
    const root = document.getElementById('prendas-root');
    if (!root || opts.client !== CLIENT || !opts.slug) return;
    decorateLinks(opts.client);
    const access = new URL(location.href).searchParams.has('prendas') ? sessionStorage.getItem('prendas:' + CLIENT) : null;
    const ctx = current = { ...opts, root, access, password: localStorage.getItem('dvpw'), abort: new AbortController(), state: { garments: [] }, role: '', dialog: null, busy: false };
    ctx.originals = [...document.querySelectorAll('#v-conv .bubble, #v-conv .beat, #v-conv .nota, #v-conv [data-prendas-text]')].map(node => ({node, html:node.innerHTML, text:node.textContent}));
    ctx.detected = (window.PrendasDetect?.identificar(ctx.originals.map(x => x.text).join('\n')) || []).map(name => ({id:window.PrendasDetect.idPara(opts.client,opts.slug,name),name,kind:'estilo',images:[],suggested:true}));
    root.innerHTML = '<details class="prendas-panel"><summary class="prendas-heading"><div><span class="prendas-eyebrow">FOTOS PARA LA EDICIÓN</span><h2>Prendas y referencias</h2><p>Toca una prenda marcada en el guion o abre este resumen.</p></div><span class="prendas-total" data-count>…</span></summary><div class="prendas-body"><div data-content>Cargando referencias…</div></div></details><p class="prendas-error" data-error role="status"></p>';
    ctx.error = mensaje => { if (ctx === current) root.querySelector('[data-error]').textContent = mensaje; };
    ctx.api = async (data = null) => {
      const headers = { 'X-Prendas-Owner':ownerKey }; if (ctx.password && opts.admin) headers['X-Edit-Password'] = ctx.password; else if (access || ctx.guestAccess) headers.Authorization = 'Bearer ' + (access || ctx.guestAccess);
      let url = ENDPOINT, init = { headers, signal: ctx.abort.signal };
      const payload = { client: opts.client, slug: opts.slug, ...data };
      if (data) { headers['Content-Type'] = 'application/json'; init.method = 'POST'; init.body = JSON.stringify(payload); }
      else url += '?' + new URLSearchParams(payload);
      let r = await fetch(url, init);
      if (r.status === 401 && headers['X-Edit-Password']) { delete headers['X-Edit-Password']; if(access) headers.Authorization = 'Bearer ' + access;ctx.password = null; r = await fetch(url, init); }
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'No se pudo guardar.');
      if(result.guestAccess)ctx.guestAccess=result.guestAccess;
      if(result.serverNow) ctx.clockOffset=result.serverNow-Date.now();
      return result;
    };
    ctx.save = data => {
      const task = (ctx.write || Promise.resolve()).catch(()=>{}).then(async()=>{
        ctx.error(''); ctx.state=await ctx.api(data);ctx.role=ctx.state.role;render(ctx);
      });
      ctx.write=task;return task;
    };
    ctx.refresh = async () => { if(ctx.busy) return; try { const next=await ctx.api(); const changed=JSON.stringify(next.garments)!==JSON.stringify(ctx.state.garments)||ctx.role!==next.role;ctx.state=next;ctx.role=next.role;if(changed)render(ctx); } catch(error) { if(error.name !== 'AbortError') ctx.error(error.message); } };
    window.addEventListener('focus', () => { if (!ctx.dialog?.open) ctx.refresh(); }, { signal:ctx.abort.signal });
    const refreshVisible=()=>{if(document.visibilityState==='visible' && !ctx.dialog?.open)ctx.refresh();};
    document.addEventListener('visibilitychange',refreshVisible,{signal:ctx.abort.signal});
    const refreshTimer=setInterval(refreshVisible,30000);
    ctx.abort.signal.addEventListener('abort',()=>clearInterval(refreshTimer),{once:true});
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.garment) return openGarment(ctx, b.dataset.garment);
        if (b.dataset.action === 'activate') {
          const password = await opts.askPassword(); if (!password) return;
          ctx.password = password; const state = await ctx.api();
          if(state.role!=='admin')throw new Error('La contraseña de administrador no es correcta.');
          ctx.state=state;localStorage.setItem('dvpw', password); ctx.role = ctx.state.role; render(ctx);
        }
        if (b.dataset.action === 'new') return newGarment(ctx);
        if (b.dataset.action === 'refresh') { b.disabled = true; try{await ctx.refresh();}finally{b.disabled=false;} return; }
        if (b.dataset.filter) { ctx.filter = b.dataset.filter; render(ctx); return; }
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
    try { ctx.state = await ctx.api(); ctx.role = ctx.state.role; if (current === ctx) render(ctx); }
    catch (error) { if (error.name !== 'AbortError') { ctx.error(error.message); root.querySelector('[data-content]').innerHTML = opts.admin ? '<button data-action="activate">Abrir con contraseña de edición</button>' : ''; } }
  }

  function allGarments(ctx) {
    const stored = ctx.state.garments.map(g=>({...g,images:g.images.filter(i=>!i.deletedAt),deletedImages:g.images.filter(i=>i.deletedAt)}));
    const normal = window.PrendasDetect.normal;
    return [...stored, ...ctx.detected.filter(g => !stored.some(s => normal(s.name) === normal(g.name)))].slice(0,40);
  }
  function imageUrl(ctx, image) {
    return ENDPOINT + '?' + new URLSearchParams({client:ctx.client,slug:ctx.slug,image:image.id,access:ctx.state.viewAccess});
  }
  function render(ctx) {
    if (current !== ctx) return;
    ctx.filter ??= ctx.role === 'editor' ? 'selected' : 'all';
    const garments = allGarments(ctx);
    const ready = garments.filter(g => g.images.some(i => i.selected)).length;
    const photos = garments.reduce((n,g) => n + g.images.length, 0);
    ctx.root.querySelector('[data-count]').textContent = photos + (photos===1?' foto · ':' fotos · ') + ready + (ready===1?' prenda lista':' prendas listas');
    const visible = garments.filter(g => ctx.filter !== 'selected' || g.images.some(i => i.selected));
    const editor = ctx.role === 'editor';
    ctx.root.querySelector('[data-content]').innerHTML =
      '<div class="prendas-toolbar"><div class="prendas-filters"><button data-filter="all" aria-pressed="' + (ctx.filter!=='selected') + '">Todas las prendas</button><button data-filter="selected" aria-pressed="' + (ctx.filter==='selected') + '">✓ Para editar (' + ready + ')</button></div><button data-action="refresh" aria-label="Actualizar referencias">↻ Actualizar</button></div>' +
      '<div class="prendas-list">' + visible.map(g => {
        const photo = g.images.find(i=>i.selected) || g.images[0];
        const status = g.images.some(i=>i.selected) ? '✓ Lista para edición' : g.images.length ? 'Fotos recibidas · falta elegir' : 'Sin foto todavía';
        return '<button type="button" class="prenda-card ' + (g.images.length?'foto-cargada':'foto-pendiente') + (g.images.some(i=>i.selected)?' lista':'') + '" data-garment="' + g.id + '">' +
          (photo ? '<img class="prenda-thumb" alt="" loading="lazy" src="' + esc(imageUrl(ctx,photo)) + '">' : '<span class="prenda-placeholder" aria-hidden="true">＋ 📷</span>') +
          '<span class="prenda-card-text"><strong>' + esc(g.name) + '</strong><span>' + status + '</span><small>' + g.images.length + (g.images.length===1?' foto':' fotos') + (g.suggested?' · Detectada en el guion':'') + '</small></span><span aria-hidden="true">↗</span></button>';
      }).join('') + '</div>' +
      (!visible.length ? '<p class="prendas-empty">' + (ctx.filter==='selected' ? 'Todavía no hay fotos elegidas para edición. Las propuestas no son una autorización.' : 'Agrega una prenda o referencia que necesite este guion.') + '</p>' : '') +
      (!editor ? '<button class="prendas-add" data-action="new">＋ Otra prenda o referencia</button>' : '') +
      '<p class="prendas-help">Rojo: falta foto. Verde: foto cargada (no significa aprobada). ' + (editor ? 'Usa las fotos seleccionadas. Si una prenda no tiene selección, consulta antes de elegir por tu cuenta.' : 'Las prendas detectadas son sugerencias del texto, no decisiones de moda. Puedes agregar otras. Bianca o Dante eligen cuáles usar.') + '</p>' +
      (ctx.admin && ctx.role!=='admin'?'<button data-action="activate">Abrir controles de administrador</button>':'')+
      (ctx.role==='admin' ? '<details class="prendas-share"><summary>Compartir con Bianca, tienda o editor</summary><div class="prendas-tools"><button data-share="bianca">Bianca · elegir fotos</button><button data-share="tienda">Tienda · aportar fotos</button><button data-share="editor">Editor · consultar</button></div></details>' : '');
    // Conservar las indicaciones y el marcado original del guion.
    ctx.originals.forEach(({node, html}) => {
      if (!node.isConnected) return;
      node.innerHTML = html;
      const terms = [...garments].sort((a,b)=>b.name.length-a.name.length);
      if (!terms.length) return;
      const escapeRx = s => [...s].map(c => '\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c).join('');
      const rx = new RegExp('(?<![\\p{L}])(?:' + terms.map(g=>escapeRx(g.name)).join('|') + ')(?![\\p{L}])', 'giu');
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(textNode => {
        if(textNode.parentElement.closest('button,a')) return;
        const text = textNode.textContent; const matches=[...text.matchAll(rx)];
        if(!matches.length) return;
        const fragment=document.createDocumentFragment(); let last=0;
        for(const match of matches) {
          fragment.append(document.createTextNode(text.slice(last,match.index)));
          const g=terms.find(g=>window.PrendasDetect.normal(g.name)===window.PrendasDetect.normal(match[0]));
          if(!g) continue;
          const button=document.createElement('button'); button.type='button'; button.className='prenda-inline';
          button.dataset.prendaInline=g.id; button.textContent=match[0]; button.setAttribute('aria-label','Referencias de '+g.name);
          button.classList.add(g.images.length?'foto-cargada':'foto-pendiente');
          button.title=g.images.length?'Foto cargada; toca para verla':'Falta foto; toca para subirla';
          if(g.images.length) {button.dataset.photos=String(g.images.length);button.classList.add('con-fotos');}
          if(g.images.some(i=>i.selected)) button.classList.add('elegida');
          fragment.append(button);last=match.index+match[0].length;
        }
        fragment.append(document.createTextNode(text.slice(last)));textNode.replaceWith(fragment);
      });
    });
  }

  function showDialog(ctx, title, html) {
    ctx.dialog?.close(); ctx.dialog?.remove();
    const dialog = ctx.dialog = document.createElement('dialog'); dialog.className = 'prendas-modal';
    dialog.innerHTML = `<header class="prendas-modal-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Cerrar referencias">Cerrar</button></header><div class="prendas-modal-body">${html}<p class="prendas-error" role="status" data-dialog-error></p></div>`;
    dialog.setAttribute('aria-label', title);
    dialog.addEventListener('cancel', e => { if(ctx.busy) e.preventDefault(); });
    document.body.append(dialog); dialog.querySelector('[data-close]').onclick = () => { if(!ctx.busy) dialog.close(); }; dialog.addEventListener('click', e => { if (e.target === dialog && !ctx.busy) dialog.close(); }); dialog.showModal();
    document.body.classList.add('prendas-dialog-open');
    dialog.addEventListener('close',()=>{if(!document.querySelector('dialog.prendas-modal[open]'))document.body.classList.remove('prendas-dialog-open');});
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
    const g = allGarments(ctx).find(g => g.id === id); if (!g) return;
    const canUpload=ctx.role!=='editor', canChoose=['admin','bianca'].includes(ctx.role);
    const selected=g.images.filter(i=>i.selected), proposals=g.images.filter(i=>!i.selected);
    const card = i => '<article class="prendas-photo '+(i.selected?'selected':'')+'">' +
      '<a href="'+esc(imageUrl(ctx,i))+'" target="_blank" rel="noopener" aria-label="Abrir foto completa de '+esc(g.name)+'"><img src="'+esc(imageUrl(ctx,i))+'" alt="Referencia de '+esc(g.name)+'" loading="lazy"></a>' +
      '<div class="prendas-caption">'+(i.selected?'<span class="prendas-badge">✓ Elegida por '+esc(i.selectedBy)+'</span>':'<span class="prendas-proposal">Propuesta · no seleccionada</span>')+
      '<small>Compartió: '+esc(i.author)+'</small>'+
      (canChoose?'<label>Indicación para el editor<textarea data-image-note="'+i.id+'" maxlength="500" placeholder="Ej. usar esta prenda en blanco">'+esc(i.note)+'</textarea></label><span class="prendas-note-status" data-note-status="'+i.id+'" role="status"></span>':'<p>'+esc(i.note)+'</p>')+
      (canChoose?'<button class="'+(i.selected?'':'primary')+'" data-select="'+i.id+'" data-selected="'+(!i.selected)+'">'+(i.selected?'Quitar de elegidas':'✓ Usar esta foto')+'</button>':'')+
      (i.canDelete?'<button class="prendas-delete" data-delete="'+i.id+'" '+(ctx.role!=='admin'?'data-until="'+esc(i.deleteUntil)+'"':'')+'>'+ (ctx.role==='admin'?'Borrar foto':'Borrar mi foto · 5:00')+'</button>':'<small>Solo el administrador puede borrar esta foto.</small>')+'</div></article>';
    const uploader = canUpload ?
      '<section class="prendas-upload"><div class="prendas-tools prendas-capture"><button class="primary" data-camera>📷 Tomar foto</button><button data-gallery>＋ Fotos / capturas</button></div>'+
      '<p class="prendas-help">Se guardan automáticamente. Tienes 5 minutos para borrar tus fotos desde este navegador; después, solo el administrador.</p>'+
      '<details class="prendas-upload-options"><summary>Añadir tu nombre o una indicación (opcional)</summary><label>Tu nombre<input data-author maxlength="60" value="'+esc(localStorage.getItem('prendas-author')||(ctx.role==='bianca'?'Bianca':''))+'" placeholder="Ej. Rubí"></label><label>Qué debe saber el editor<textarea data-note maxlength="500" placeholder="Ej. esta prenda la tenemos en blanco"></textarea></label></details>'+
      '<input hidden data-camera-file type="file" accept="image/*" capture="environment"><input hidden data-gallery-file type="file" accept="image/*" multiple>'+
      '<p data-upload-status class="prendas-notice" role="status" aria-live="polite"></p><button hidden data-retry>Reintentar fotos pendientes</button></section>' : '';
    const d=showDialog(ctx,g.name,
      '<div class="prendas-context">'+(g.kind==='exacta'?'Prenda exacta: usar la foto elegida, sin sustituirla.':selected.length?'Usa las referencias elegidas y respeta las indicaciones.':'Las propuestas todavía no están autorizadas para edición.')+'</div>'+
      uploader+
      '<section class="prendas-selected-group"><h3>✓ Para usar en edición <span>'+selected.length+'</span></h3>'+
      (selected.length?'<div class="prendas-grid">'+selected.map(card).join('')+'</div>':'<p class="prendas-empty">Todavía no hay una foto elegida. '+(canChoose?'Cuando veas la correcta, toca «Usar esta foto».':'No elegir una prenda por cuenta propia.')+'</p>')+'</section>'+
      '<section class="prendas-proposals-group"><h3>Fotos propuestas <span>'+proposals.length+'</span></h3>'+
      (proposals.length?'<div class="prendas-grid">'+proposals.map(card).join('')+'</div>':'<p class="prendas-empty">'+(canUpload?'Puedes aportar varias fotos de la tienda o capturas de Pinterest y redes. No se reemplazan las anteriores.':'No hay más fotos propuestas para esta prenda.')+'</p>')+'</section>'+
      (ctx.role==='admin' && g.deletedImages?.length?'<details class="prendas-trash"><summary>Fotos retiradas ('+g.deletedImages.length+')</summary>'+g.deletedImages.map(i=>'<p>'+esc(i.author)+' · '+esc(i.note||'Sin indicación')+' <button data-restore="'+i.id+'">Recuperar foto</button></p>').join('')+'</details>':''));
    d.querySelectorAll('[data-delete],[data-restore]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try{await ctx.save({action:b.dataset.restore?'restore-image':'delete-image',garmentId:id,imageId:b.dataset.restore||b.dataset.delete});openGarment(ctx,id);}
      catch(error){d.querySelector('[data-dialog-error]').textContent=error.message;b.disabled=false;}
    });
    const tick=()=>d.querySelectorAll('[data-until]').forEach(b=>{
      const remaining=Math.max(0,Math.ceil((Date.parse(b.dataset.until)-Date.now()-(ctx.clockOffset||0))/1000));
      b.textContent=remaining?'Borrar mi foto · '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0'):'Tiempo terminado · solo administrador';
      if(!remaining)b.disabled=true;
    });
    tick();const countdown=setInterval(tick,1000);
    d.addEventListener('close',()=>clearInterval(countdown),{once:true});
    ctx.abort.signal.addEventListener('abort',()=>clearInterval(countdown),{once:true});
    d.querySelectorAll('[data-select]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try {await ctx.save({action:'select',garmentId:id,imageId:b.dataset.select,selected:b.dataset.selected==='true'});openGarment(ctx,id);}
      catch(error){d.querySelector('[data-dialog-error]').textContent=error.message;b.disabled=false;}
    });
    d.querySelectorAll('[data-image-note]').forEach(field=>{
      let last=field.value, pending=Promise.resolve();
      field.onchange=()=>{
        const value=field.value; if(value===last)return;
        const status=d.querySelector('[data-note-status="'+field.dataset.imageNote+'"]');status.textContent='Guardando…';
        pending=pending.catch(()=>{}).then(async()=>{
          try{await ctx.save({action:'edit-note',garmentId:id,imageId:field.dataset.imageNote,note:value});last=value;status.textContent='✓ Indicación guardada';}
          catch(error){status.textContent='No se guardó: '+error.message;field.focus();}
        });
      };
    });
    if(!canUpload)return;
    const beforeLeave=e=>{if(ctx.busy){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeLeave,{signal:ctx.abort.signal});
    d.addEventListener('close',()=>window.removeEventListener('beforeunload',beforeLeave),{once:true});
    d.querySelector('[data-camera]').onclick=()=>d.querySelector('[data-camera-file]').click();
    d.querySelector('[data-gallery]').onclick=()=>d.querySelector('[data-gallery-file]').click();
    let queue=[];
    const upload=async()=>{
      if(ctx.busy)return;
      ctx.busy=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);d.querySelector('[data-retry]').hidden=true;
      const author=d.querySelector('[data-author]').value.trim()||(ctx.role==='bianca'?'Bianca':'Equipo tienda');
      const note=d.querySelector('[data-note]').value.trim();localStorage.setItem('prendas-author',author);
      let saved=0;const total=queue.length;
      try{
        if(!ctx.state.garments.some(x=>x.id===id))await ctx.save({action:'add-garment',id,name:g.name,kind:g.kind});
        while(queue.length){
          d.querySelector('[data-upload-status]').textContent='Guardando foto '+(saved+1)+' de '+total+'… No cierres esta ventana.';
          const item=queue[0];item.image ||= await imagenComprimida(item.file);
          await ctx.save({action:'add-image',garmentId:id,id:item.id,image:item.image,author,note});queue.shift();saved++;
        }
        ctx.busy=false;openGarment(ctx,id);ctx.dialog.querySelector('[data-upload-status]').textContent='✓ '+saved+' '+(saved===1?'foto guardada':'fotos guardadas')+'. Ya puedes salir; no hay que volver a guardar.';
      }catch(error){
        d.querySelector('[data-upload-status]').textContent=queue.length+' foto(s) pendientes de guardar. Puedes reintentar aquí.';
        d.querySelector('[data-dialog-error]').textContent=(saved?saved+' fotos se guardaron. ':'')+error.message;
        d.querySelector('[data-retry]').hidden=!queue.length;
      }finally{ctx.busy=false;d.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
    const choose=e=>{
      const files=[...e.target.files];e.target.value='';if(!files.length)return;
      if(queue.length){d.querySelector('[data-dialog-error]').textContent='Primero reintenta las fotos pendientes para no perderlas.';return;}
      const count=ctx.state.garments.find(x=>x.id===id)?.images.filter(i=>!i.deletedAt).length||0;
      if(files.length+count>12){d.querySelector('[data-dialog-error]').textContent='Máximo 12 fotos por prenda. Puedes elegir '+(12-count)+' más.';return;}
      queue=files.map(file=>({file,id:crypto.randomUUID()}));upload();
    };
    d.querySelector('[data-camera-file]').onchange=choose;
    d.querySelector('[data-gallery-file]').onchange=choose;
    d.querySelector('[data-retry]').onclick=upload;
  }
  function url(value, client) {
    if(!new URL(location.href).searchParams.has('prendas'))return value;
    const access=sessionStorage.getItem('prendas:'+CLIENT);
    if(client!==CLIENT || !access)return value;
    const u=new URL(value,location.href);
    if(u.origin===location.origin && u.searchParams.get('c')===CLIENT)u.searchParams.set('prendas',access);
    return u.href;
  }
  function decorateLinks(client) {
    if(client!==CLIENT)return;
    document.querySelectorAll('a[href]').forEach(a=>a.href=url(a.href,client));
  }
  window.Prendas = { mount, url, decorateLinks };
})();
