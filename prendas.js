/* Referencias por prenda. Vive aparte del texto: nunca modifica el guion ni el
 * contenido que aparece al leer en modo teleprompter. */
(() => {
  const CLIENT = 'bianca-ald-7q2vd';
  const {storage,drafts,request}=window.PrendasRuntime;
  const localGet=key=>storage.get('localStorage',key),localSet=(key,value)=>storage.set('localStorage',key,value);
  const ENDPOINT = ['localhost','127.0.0.1'].includes(location.hostname) ? location.origin + '/api/prendas' : 'https://teleprompter-dv.vercel.app/api/prendas';
  const esc = texto => String(texto ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entrada = new URL(location.href);
  if (entrada.searchParams.get('c') === CLIENT && entrada.searchParams.get('prendas')) storage.set('sessionStorage','prendas:' + CLIENT, entrada.searchParams.get('prendas'));
  let current;
  const ownerStorage = 'prendas-owner:' + CLIENT;
  let ownerKey = localGet(ownerStorage);
  if (!/^[a-f0-9]{64}$/.test(ownerKey || '')) {
    ownerKey = [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
    localSet(ownerStorage,ownerKey);
  }

  async function imagenComprimida(file) {
    if (file.size > 25 * 1024 * 1024) throw new Error('La imagen supera 25 MB. Elige una foto o captura más pequeña.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url;
      try { await img.decode(); } catch { throw new Error('No se pudo abrir «'+file.name+'». Prueba una captura JPG o PNG, o retírala de pendientes.'); }
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
    const access = new URL(location.href).searchParams.get('prendas');
    const ctx = current = { ...opts, root, access, password: localGet('dvpw'), abort: new AbortController(), state: { garments: [] }, role: '', dialog: null, busy: false, pending:new Map(),revision:0,writes:0 };
    const draftPrefix=opts.client+':'+opts.slug+':';
    ctx.originals = [...document.querySelectorAll('#v-conv .bubble, #v-conv .beat, #v-conv .nota, #v-conv [data-prendas-text]')].map(node => ({node, html:node.innerHTML, text:node.textContent}));
    ctx.detected = (window.PrendasDetect?.identificar(ctx.originals.map(x => x.text).join('\n')) || []).map(name => ({id:window.PrendasDetect.idPara(opts.client,opts.slug,name),name,kind:'estilo',images:[],suggested:true}));
    root.innerHTML = '<div data-pending></div><details class="prendas-panel"><summary class="prendas-heading"><div><span class="prendas-eyebrow">FOTOS PARA LA EDICIÓN</span><h2>Prendas y referencias</h2><p>Toca una prenda marcada en el guion o abre este resumen.</p></div><span class="prendas-total" data-count>…</span></summary><div class="prendas-body"><div data-content>Cargando referencias…</div></div></details><p class="prendas-error" data-error role="status"></p>';
    ctx.error = mensaje => { if (ctx === current) root.querySelector('[data-error]').textContent = mensaje; };
    ctx.api = async (data = null) => {
      const headers = { 'X-Prendas-Owner':ownerKey }; if (ctx.password && opts.admin) headers['X-Edit-Password'] = ctx.password; else if (access || ctx.guestAccess) headers.Authorization = 'Bearer ' + (access || ctx.guestAccess);
      let url = ENDPOINT, init = { headers, signal: ctx.abort.signal };
      const payload = { client: opts.client, slug: opts.slug, ...data };
      if (data) { headers['Content-Type'] = 'application/json'; init.method = 'POST'; init.body = JSON.stringify(payload); }
      else url += '?' + new URLSearchParams(payload);
      let result;
      try { result=await request(url,init); }
      catch(error){
        if(error.status!==401 || !headers['X-Edit-Password'])throw error;
        delete headers['X-Edit-Password'];ctx.password=null;
        if(access || ctx.guestAccess)headers.Authorization='Bearer '+(access || ctx.guestAccess);
        else if(data){const bootstrap=await request(ENDPOINT+'?'+new URLSearchParams({client:opts.client,slug:opts.slug}),{headers,signal:ctx.abort.signal});ctx.guestAccess=bootstrap.guestAccess;headers.Authorization='Bearer '+ctx.guestAccess;}
        result=await request(url,init);
      }
      if(result.guestAccess)ctx.guestAccess=result.guestAccess;
      if(result.serverNow) ctx.clockOffset=result.serverNow-Date.now();
      return result;
    };
    ctx.save = data => {
      ctx.writes++;ctx.revision++;
      const task = (ctx.write || Promise.resolve()).catch(()=>{}).then(async()=>{
        ctx.error(''); ctx.state=await ctx.api(data);ctx.role=ctx.state.role;render(ctx);
      }).finally(()=>{ctx.writes--;ctx.revision++;});
      ctx.write=task;return task;
    };
    ctx.refresh = async () => { if(ctx.busy || ctx.writes) return; const revision=ctx.revision;try { const next=await ctx.api();if(revision!==ctx.revision || ctx.writes)return; const changed=JSON.stringify(next.garments)!==JSON.stringify(ctx.state.garments)||ctx.role!==next.role;ctx.state=next;ctx.role=next.role;if(changed)render(ctx); } catch(error) { if(error.name !== 'AbortError') ctx.error(error.message); } };
    window.addEventListener('focus', () => { if (!ctx.dialog?.open) ctx.refresh(); }, { signal:ctx.abort.signal });
    const refreshVisible=()=>{if(document.visibilityState==='visible' && !ctx.dialog?.open)ctx.refresh();};
    document.addEventListener('visibilitychange',refreshVisible,{signal:ctx.abort.signal});
    const refreshTimer=setInterval(refreshVisible,30000);
    ctx.abort.signal.addEventListener('abort',()=>clearInterval(refreshTimer),{once:true});
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.resume) return openGarment(ctx,b.dataset.resume);
        if (b.dataset.garment) return openGarment(ctx, b.dataset.garment);
        if (b.dataset.action === 'activate') {
          const password = await opts.askPassword(); if (!password) return;
          ctx.password = password; const state = await ctx.api();
          if(state.role!=='admin')throw new Error('La contraseña de administrador no es correcta.');
          ctx.state=state;localSet('dvpw', password); ctx.role = ctx.state.role; render(ctx);
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
    try {
      const [state,savedDrafts]=await Promise.all([ctx.api(),drafts.list(draftPrefix)]);
      ctx.state=state;ctx.role=state.role;
      for(const item of savedDrafts){
        if(state.garments.some(g=>g.images.some(i=>i.id===item.id))){await drafts.remove(item.key);continue;}
        const queue=ctx.pending.get(item.garmentId)||[];queue.push(item);ctx.pending.set(item.garmentId,queue);
      }
      if (current === ctx) render(ctx);
    }
    catch (error) { if (error.name !== 'AbortError') { ctx.error(error.message); root.querySelector('[data-content]').innerHTML = opts.admin ? '<button data-action="activate">Abrir con contraseña de edición</button>' : ''; } }
  }

  function allGarments(ctx) {
    const stored = ctx.state.garments.map(g=>({...g,images:g.images.filter(i=>!i.deletedAt),deletedImages:g.images.filter(i=>i.deletedAt)}));
    const normal = window.PrendasDetect.normal;
    const recovered=[...ctx.pending.entries()].filter(([id,items])=>items.length && !stored.some(g=>g.id===id)).map(([id,items])=>({id,name:items[0].garmentName,kind:items[0].kind,images:[]}));
    return [...stored,...recovered,...ctx.detected.filter(g => ![...stored,...recovered].some(s => normal(s.name) === normal(g.name)))].slice(0,40);
  }
  function renderPending(ctx){
    if(current!==ctx)return;
    ctx.root.querySelector('[data-pending]').innerHTML=ctx.role==='editor'?'':[...ctx.pending.entries()].filter(([,items])=>items.length).map(([id,items])=>'<p class="prendas-notice">'+items.length+' foto(s) pendientes · '+esc(items[0].garmentName)+' <button data-resume="'+id+'">Continuar carga</button></p>').join('');
  }
  function imageUrl(ctx, image) {
    return ENDPOINT + '?' + new URLSearchParams({client:ctx.client,slug:ctx.slug,image:image.id,access:ctx.state.viewAccess});
  }
  function render(ctx) {
    if (current !== ctx) return;
    renderPending(ctx);
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
    ctx.flushNotes=null;
    const dialog = ctx.dialog = document.createElement('dialog'); dialog.className = 'prendas-modal';
    dialog.innerHTML = `<header class="prendas-modal-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Cerrar referencias">Cerrar</button></header><div class="prendas-modal-body">${html}<p class="prendas-error" role="status" data-dialog-error></p></div>`;
    dialog.setAttribute('aria-label', title);
    const close=async()=>{if(ctx.busy)return;try{await ctx.flushNotes?.();dialog.close();}catch(error){dialog.querySelector('[data-dialog-error]').textContent=error.message;}};
    dialog.addEventListener('cancel', e => { e.preventDefault();close(); });
    document.body.append(dialog); dialog.querySelector('[data-close]').onclick = close; dialog.addEventListener('click', e => { if (e.target === dialog) close(); }); dialog.showModal();
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
      (i.canReplace?'<button data-replace="'+i.id+'">Reemplazar '+(ctx.role==='admin'?'foto':'mi foto')+'</button>':'')+
      (i.canDelete?'<button class="prendas-delete" data-delete="'+i.id+'">'+ (ctx.role==='admin'?'Borrar foto':'Borrar mi foto')+'</button>':'<small>Solo quien subió esta foto desde este navegador o el administrador puede cambiarla.</small>')+'</div></article>';
    const uploader = canUpload ?
      '<section class="prendas-upload"><div class="prendas-tools prendas-capture"><button class="primary" data-camera>📷 Tomar foto</button><button data-gallery>＋ Fotos / capturas</button></div>'+
      '<p class="prendas-help">Se guardan automáticamente. Puedes borrar o reemplazar tus fotos desde este navegador, sin límite de tiempo. Los reemplazos necesitan aprobación de nuevo.</p>'+
      '<details class="prendas-upload-options"><summary>Añadir tu nombre o una indicación (opcional)</summary><label>Tu nombre<input data-author maxlength="60" value="'+esc(localGet('prendas-author')||(ctx.role==='bianca'?'Bianca':''))+'" placeholder="Ej. Rubí"></label><label>Qué debe saber el editor<textarea data-note maxlength="500" placeholder="Ej. esta prenda la tenemos en blanco"></textarea></label></details>'+
      '<input hidden data-camera-file type="file" accept="image/*" capture="environment"><input hidden data-gallery-file type="file" accept="image/*" multiple><input hidden data-replace-file type="file" accept="image/*">'+
      '<p data-upload-status class="prendas-notice" role="status" aria-live="polite"></p><button hidden data-retry>Reintentar fotos pendientes</button><div data-queue></div></section>' : '';
    const d=showDialog(ctx,g.name,
      '<div class="prendas-context">'+(g.kind==='exacta'?'Prenda exacta: usar la foto elegida, sin sustituirla.':selected.length?'Usa las referencias elegidas y respeta las indicaciones.':'Las propuestas todavía no están autorizadas para edición.')+'</div>'+
      uploader+
      '<section class="prendas-selected-group"><h3>✓ Para usar en edición <span>'+selected.length+'</span></h3>'+
      (selected.length?'<div class="prendas-grid">'+selected.map(card).join('')+'</div>':'<p class="prendas-empty">Todavía no hay una foto elegida. '+(canChoose?'Cuando veas la correcta, toca «Usar esta foto».':'No elegir una prenda por cuenta propia.')+'</p>')+'</section>'+
      '<section class="prendas-proposals-group"><h3>Fotos propuestas <span>'+proposals.length+'</span></h3>'+
      (proposals.length?'<div class="prendas-grid">'+proposals.map(card).join('')+'</div>':'<p class="prendas-empty">'+(canUpload?'Puedes aportar varias fotos de la tienda o capturas de Pinterest y redes. No se reemplazan las anteriores.':'No hay más fotos propuestas para esta prenda.')+'</p>')+'</section>'+
      (ctx.role==='admin' && g.deletedImages?.length?'<details class="prendas-trash"><summary>Fotos retiradas ('+g.deletedImages.length+')</summary>'+g.deletedImages.map(i=>'<p>'+esc(i.author)+' · '+esc(i.note||'Sin indicación')+' <button data-restore="'+i.id+'">Recuperar foto</button></p>').join('')+'</details>':''));
    d.querySelectorAll('[data-delete],[data-restore]').forEach(b=>b.onclick=async()=>{
      if(ctx.busy)return;
      if(b.dataset.delete && !confirm('¿Retirar esta foto? Dejará de estar disponible para edición.'))return;
      b.disabled=true;
      try{await ctx.flushNotes?.();await ctx.save({action:b.dataset.restore?'restore-image':'delete-image',garmentId:id,imageId:b.dataset.restore||b.dataset.delete});openGarment(ctx,id);}
      catch(error){d.querySelector('[data-dialog-error]').textContent=error.message;b.disabled=false;}
    });
    d.querySelectorAll('[data-select]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try {await ctx.flushNotes?.();await ctx.save({action:'select',garmentId:id,imageId:b.dataset.select,selected:b.dataset.selected==='true'});openGarment(ctx,id);}
      catch(error){d.querySelector('[data-dialog-error]').textContent=error.message;b.disabled=false;}
    });
    const noteSavers=[...d.querySelectorAll('[data-image-note]')].map(field=>{
      let last=field.value,scheduled=last,pending=Promise.resolve(),timer;
      const status=d.querySelector('[data-note-status="'+field.dataset.imageNote+'"]');
      const save=()=>{
        clearTimeout(timer);const value=field.value;if(value===scheduled)return pending;
        scheduled=value;status.textContent='Guardando…';
        pending=ctx.save({action:'edit-note',garmentId:id,imageId:field.dataset.imageNote,note:value}).then(()=>{last=value;status.textContent='✓ Indicación guardada';},error=>{scheduled=last;status.textContent='No se guardó: '+error.message;throw error;});return pending;
      };
      field.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),700);};
      field.onchange=()=>save().catch(()=>{});
      d.addEventListener('close',()=>clearTimeout(timer),{once:true});
      return {save,dirty:()=>field.value!==last};
    });
    ctx.flushNotes=()=>Promise.all(noteSavers.map(note=>note.save()));
    const beforeNotesLeave=e=>{if(ctx.writes || noteSavers.some(note=>note.dirty())){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeNotesLeave,{signal:ctx.abort.signal});
    d.addEventListener('close',()=>window.removeEventListener('beforeunload',beforeNotesLeave),{once:true});
    if(!canUpload)return;
    const beforeLeave=e=>{if(ctx.busy || queue.some(item=>!item.persisted)){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeLeave,{signal:ctx.abort.signal});
    d.addEventListener('close',()=>window.removeEventListener('beforeunload',beforeLeave),{once:true});
    d.querySelector('[data-camera]').onclick=()=>d.querySelector('[data-camera-file]').click();
    d.querySelector('[data-gallery]').onclick=()=>d.querySelector('[data-gallery-file]').click();
    const queue=ctx.pending.get(id)||[];ctx.pending.set(id,queue);
    const renderQueue=()=>{
      d.querySelector('[data-retry]').hidden=!queue.length;
      d.querySelector('[data-queue]').innerHTML=queue.map(item=>'<p>'+esc(item.file.name)+' <button data-discard="'+item.id+'" aria-label="Retirar pendiente '+esc(item.file.name)+'">Retirar pendiente</button></p>').join('');
      d.querySelectorAll('[data-discard]').forEach(b=>b.onclick=async()=>{
        if(ctx.busy)return;b.disabled=true;
        const index=queue.findIndex(item=>item.id===b.dataset.discard);if(index<0)return;
        await drafts.remove(queue[index].key);queue.splice(index,1);renderQueue();renderPending(ctx);
        d.querySelector('[data-upload-status]').textContent=queue.length?'Puedes reintentar las fotos restantes.':'No hay fotos pendientes. Puedes elegir otra foto.';
        d.querySelector('[data-dialog-error]').textContent='';
      });
    };
    if(queue.length){d.querySelector('[data-upload-status]').textContent='Hay '+queue.length+' foto(s) pendientes. Reintenta para completar el guardado.';renderQueue();}
    const upload=async()=>{
      if(ctx.busy)return;
      ctx.busy=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);d.querySelector('[data-retry]').hidden=true;
      const author=d.querySelector('[data-author]').value.trim()||(ctx.role==='bianca'?'Bianca':'Equipo tienda');
      const note=d.querySelector('[data-note]').value.trim();localSet('prendas-author',author);
      let saved=0;const total=queue.length;
      try{
        if(!ctx.state.garments.some(x=>x.id===id))await ctx.save({action:'add-garment',id,name:g.name,kind:g.kind});
        while(queue.length){
          d.querySelector('[data-upload-status]').textContent='Guardando foto '+(saved+1)+' de '+total+'… No cierres esta ventana.';
          const item=queue[0];item.image ||= await imagenComprimida(item.file);
          await ctx.save({action:item.replacesId?'replace-image':'add-image',...(item.replacesId?{imageId:item.replacesId}:{}),garmentId:id,id:item.id,image:item.image,author:item.author||author,note:item.note??note});await drafts.remove(item.key);queue.shift();saved++;renderPending(ctx);
        }
        ctx.busy=false;openGarment(ctx,id);ctx.dialog.querySelector('[data-upload-status]').textContent='✓ '+saved+' '+(saved===1?'foto guardada':'fotos guardadas')+'. Ya puedes salir; no hay que volver a guardar.';
      }catch(error){
        d.querySelector('[data-upload-status]').textContent=queue.length+' foto(s) pendientes de guardar. '+(queue.every(item=>item.persisted)?'Se conservan en este navegador para reintentar.':'No cierres esta página: no se pudo conservar una copia local de todas las fotos.');
        d.querySelector('[data-dialog-error]').textContent=(saved?saved+' fotos se guardaron. ':'')+error.message;
        renderQueue();
      }finally{ctx.busy=false;d.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
    const choose=async e=>{
      const files=[...e.target.files];e.target.value='';if(!files.length)return;
      if(queue.length){d.querySelector('[data-dialog-error]').textContent='Primero reintenta las fotos pendientes para no perderlas.';return;}
      const count=ctx.state.garments.find(x=>x.id===id)?.images.filter(i=>!i.deletedAt).length||0;
      const replacesId=e.target.dataset.replacesId || null;
      if(files.length+count-(replacesId?1:0)>12){d.querySelector('[data-dialog-error]').textContent='Máximo 12 fotos por prenda. Puedes elegir '+(12-count)+' más.';return;}
      if(files.some(file=>file.size>25*1024*1024)){d.querySelector('[data-dialog-error]').textContent='Una imagen supera 25 MB. Selecciona fotos más pequeñas.';return;}
      ctx.busy=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{
        await ctx.flushNotes?.();
        for(const file of files){const photoId=crypto.randomUUID();const item={file,id:photoId,key:ctx.client+':'+ctx.slug+':'+id+':'+photoId,garmentId:id,garmentName:g.name,kind:g.kind,replacesId,author:d.querySelector('[data-author]').value.trim(),note:d.querySelector('[data-note]').value.trim()};item.persisted=await drafts.put(item);queue.push(item);}
        renderPending(ctx);renderQueue();
      }catch(error){d.querySelector('[data-dialog-error]').textContent=error.message;return;
      }finally{ctx.busy=false;d.querySelectorAll('button').forEach(b=>b.disabled=false);}
      upload();
    };
    d.querySelector('[data-camera-file]').onchange=choose;
    d.querySelector('[data-gallery-file]').onchange=choose;
    d.querySelector('[data-replace-file]').onchange=choose;
    d.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>{
      if(ctx.busy)return;
      if(queue.length){d.querySelector('[data-dialog-error]').textContent='Completa o retira las fotos pendientes antes de reemplazar otra.';return;}
      // Keep the picker in the click gesture (required by mobile Safari).
      const input=d.querySelector('[data-replace-file]');input.dataset.replacesId=b.dataset.replace;input.click();
    });
    d.querySelector('[data-retry]').onclick=upload;
  }
  function url(value, client) {
    if(!new URL(location.href).searchParams.has('prendas'))return value;
    const access=new URL(location.href).searchParams.get('prendas');
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
