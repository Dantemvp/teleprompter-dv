const CLIENT='fedra-ald-t84qz';
const endpoint='https://teleprompter-dv.vercel.app/api/fedra-notes';
let dispose;

export function mount({g,opts,onHook}) {
  dispose?.();
  if (opts.client!==CLIENT || !opts.slug) return;
  const paragraphs=[...document.querySelectorAll('#v-conv .bubble[data-li]')];
  const dialog=document.createElement('dialog');dialog.className='dra-notes-dialog';dialog.setAttribute('aria-labelledby','dra-notes-title');
  dialog.innerHTML=`<div class="dra-notes-header"><h2 id="dra-notes-title">Notas Dra</h2><button type="button" aria-label="Cerrar notas">×</button></div>
    <div class="dra-notes-body"><blockquote class="dra-notes-quote" hidden></blockquote>
    <form class="dra-notes-auth" hidden><label for="dra-password">Tu contraseña de Fedra</label><input id="dra-password" type="password" autocomplete="current-password" required><div class="dra-notes-actions"><button class="dra-action primary">Abrir notas</button></div></form>
    <div class="dra-notes-compose" hidden><label for="dra-text">Tu nota sobre este párrafo</label><textarea id="dra-text" maxlength="10000"></textarea><div class="dra-notes-actions"><button type="button" class="dra-action primary" data-action="text">Guardar nota</button><button type="button" class="dra-action" data-action="record">Grabar audio</button><button type="button" class="dra-action" data-action="attach">Adjuntar audio</button><input type="file" accept="audio/*" hidden></div>
    <div class="dra-notes-attachment" hidden><audio controls></audio><div class="dra-notes-actions"><button class="dra-action primary" data-action="send-audio">Guardar audio</button><button class="dra-action" data-action="discard-audio">Descartar audio</button></div></div></div>
    <p class="dra-notes-status" role="status" aria-live="polite"></p><div class="dra-notes-list"></div></div>`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s);
  const auth=$('.dra-notes-auth'),compose=$('.dra-notes-compose'),quote=$('.dra-notes-quote'),text=$('#dra-text'),status=$('.dra-notes-status'),list=$('.dra-notes-list');
  const passwordKey='dvnotes:'+CLIENT;
  let password=sessionStorage.getItem(passwordKey)||localStorage.getItem('dvscriptpw:'+CLIENT)||localStorage.getItem('dvpw')||'';
  let selected=null,notes=[],busy=false,recorder=null,stream=null,pending=new Map(),urls=new Set(),generation=0,alive=true;
  const targets=[];
  const draftKey=id=>'dradraft:'+opts.slug+':'+id;
  function message(value,error=false){status.textContent=value;status.classList.toggle('error',error);}
  async function request(data,binary=false){
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Edit-Password':password},body:JSON.stringify({client:CLIENT,slug:opts.slug,...data})});
    if(!r.ok){let e;try{e=await r.json();}catch{e={};}const err=new Error(e.error||'No se pudo conectar. Intenta de nuevo.');err.status=r.status;throw err;}
    return binary?r.blob():r.json();
  }
  function url(blob){const u=URL.createObjectURL(blob);urls.add(u);return u;}
  function controls(){
    compose.querySelectorAll('button').forEach(b=>b.disabled=busy || (!!recorder && b.dataset.action!=='record'));
    text.disabled=busy || !!recorder;
  }
  function attachment(){
    const p=selected&&pending.get(selected.id);$('.dra-notes-attachment').hidden=!p;
    const audio=$('.dra-notes-attachment audio');audio.pause();
    if(p){audio.src=p.url;}else{audio.removeAttribute('src');audio.load();}
  }
  function counts(){for(const t of targets){const count=notes.filter(n=>n.paragraphId===t.id).length;t.button.textContent=count?'Notas '+count:'Notas';t.button.classList.toggle('has-notes',!!count);}}
  function render(){
    list.replaceChildren();counts();
    const entries=selected?notes.filter(n=>n.paragraphId===selected.id):notes;
    if(!entries.length){const empty=document.createElement('p');empty.textContent='Todavía no hay notas.';empty.className='dra-notes-status';list.append(empty);}
    for(const n of entries){
      const article=document.createElement('article');article.className='dra-note-entry';
      const date=document.createElement('small');date.textContent=new Date(n.createdAt).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});article.append(date);
      if(!selected || n.quote!==selected.quote){const q=document.createElement('blockquote');q.textContent=n.quote;article.append(q);}
      if(n.kind==='text'){const p=document.createElement('p');p.textContent=n.text;article.append(p);}
      else{
        const play=document.createElement('button');play.className='dra-action';play.textContent='Escuchar audio';article.append(play);
        play.onclick=async()=>{play.disabled=true;try{const blob=await request({action:'audio',id:n.id},true);if(!article.isConnected)return;const audio=document.createElement('audio');audio.controls=true;audio.src=url(blob);article.insertBefore(audio,play);play.remove();audio.play().catch(()=>{});}catch(e){play.disabled=false;message(e.message,true);}};
      }
      const remove=document.createElement('button');remove.className='dra-delete';remove.textContent='Eliminar nota';article.append(remove);
      remove.onclick=async()=>{if(busy)return;busy=true;remove.disabled=true;controls();try{notes=(await request({action:'remove',id:n.id})).notes;render();message('Nota eliminada.');}catch(e){remove.disabled=false;message(e.message,true);}finally{busy=false;controls();}};
      list.append(article);
    }
  }
  async function load(){
    const current=++generation;auth.hidden=true;compose.hidden=true;message('Cargando notas…');
    if(!password){auth.hidden=false;message('');return;}
    try{
      const data=await request({action:'list'});if(!alive || current!==generation)return;
      notes=data.notes;sessionStorage.setItem(passwordKey,password);compose.hidden=!selected;render();message('');
    }catch(e){if(!alive || current!==generation)return;if(e.status===401){sessionStorage.removeItem(passwordKey);password='';auth.hidden=false;list.replaceChildren();}message(e.message,true);}
  }
  function stopRecording(){if(recorder && recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;}
  function open(target){
    if(recorder)return;
    selected=target;textId=null;quote.hidden=!target;quote.textContent=target?.quote||'';text.value=target?localStorage.getItem(draftKey(target.id))||'':'';
    attachment();if(!dialog.open)dialog.showModal();load();
  }
  dialog.querySelector('.dra-notes-header button').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{generation++;stopRecording();dialog.querySelectorAll('audio').forEach(a=>a.pause());});
  auth.onsubmit=e=>{e.preventDefault();password=$('#dra-password').value;load();};
  text.oninput=()=>{if(selected)localStorage.setItem(draftKey(selected.id),text.value);};
  async function save(data,target=selected){
    if(busy || !target)return;busy=true;controls();message('Guardando…');
    try{
      const response=await request({action:'add',paragraphId:target.id,quote:target.quote,...data});
      if(!alive)return;notes=response.notes;
      if(data.kind==='text'){localStorage.removeItem(draftKey(target.id));if(selected===target)text.value='';}
      else{const old=pending.get(target.id);if(old){URL.revokeObjectURL(old.url);urls.delete(old.url);}pending.delete(target.id);if(selected===target)attachment();}
      render();message('Guardado en tus notas.');
    }catch(e){message(e.message,true);}finally{busy=false;controls();}
  }
  let textId=null;
  text.addEventListener('input',()=>{textId=null;});
  $('[data-action=text]').onclick=()=>{if(!text.value.trim()){message('Escribe tu nota.',true);return;}textId ||= crypto.randomUUID();save({id:textId,kind:'text',text:text.value});};
  function setAudio(blob,target){
    if(blob.size>3*1024*1024){message('El audio supera 3 MB. Graba uno más corto.',true);return;}
    const previous=pending.get(target.id);if(previous){URL.revokeObjectURL(previous.url);urls.delete(previous.url);}
    pending.set(target.id,{id:crypto.randomUUID(),blob,url:url(blob)});if(selected===target)attachment();message('Audio listo para guardar.');
  }
  $('[data-action=record]').onclick=async()=>{
    if(recorder){stopRecording();return;}
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){message('Puedes usar Adjuntar audio en este navegador.',true);return;}
    const target=selected;const button=$('[data-action=record]');button.disabled=true;
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!alive || !dialog.open || selected!==target){mic.getTracks().forEach(t=>t.stop());return;}
      stream=mic;const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=new MediaRecorder(mic,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:48000});const active=recorder;const chunks=[];let bytes=0;
      active.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>2.5*1024*1024)stopRecording();}};
      active.onstop=()=>{mic.getTracks().forEach(t=>t.stop());recorder=null;stream=null;button.textContent='Grabar audio';button.classList.remove('dra-recording');controls();if(chunks.length&&alive)setAudio(new Blob(chunks,{type:active.mimeType}),target);};
      active.onerror=()=>{stopRecording();message('No se pudo grabar. Puedes adjuntar el audio.',true);};
      active.start(1000);button.textContent='Detener grabación';button.classList.add('dra-recording');message('Grabando… Pulsa Detener grabación cuando termines.');
    }catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;message(e.name==='NotAllowedError'?'El micrófono no tiene permiso. Puedes habilitarlo o adjuntar un audio.':'No se pudo abrir el micrófono. Puedes adjuntar un audio.',true);}
    finally{controls();}
  };
  const input=$('input[type=file]');$('[data-action=attach]').onclick=()=>input.click();
  input.onchange=()=>{const file=input.files[0];if(file&&selected)setAudio(file,selected);input.value='';};
  $('[data-action=discard-audio]').onclick=()=>{const old=pending.get(selected.id);if(old){URL.revokeObjectURL(old.url);urls.delete(old.url);}pending.delete(selected.id);attachment();message('');};
  $('[data-action=send-audio]').onclick=async()=>{
    const target=selected;const file=pending.get(target.id);if(!file||busy)return;
    const reader=new FileReader();reader.onload=()=>save({id:file.id,kind:'audio',base64:String(reader.result).split(',')[1]},target);reader.onerror=()=>message('No se pudo leer el audio.',true);reader.readAsDataURL(file.blob);
  };
  const globalButton=document.createElement('button');globalButton.className='mini';globalButton.textContent='Notas Dra';globalButton.onclick=()=>open(null);document.querySelector('#v-conv .toolrow').append(globalButton);
  async function addButtons(){
    const occurrences=new Map();
    for(const bubble of paragraphs){
      const value=bubble.textContent;const count=occurrences.get(value)||0;occurrences.set(value,count+1);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.trim().replace(/\s+/g,' ')));
      if(!alive)return;
      const id=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')+'-'+count;
      const button=document.createElement('button');button.type='button';button.className='dra-note-button';button.textContent='Notas';button.setAttribute('aria-label','Notas Dra sobre este párrafo');
      const target={id,quote:value,button,bubble};targets.push(target);button.onclick=()=>{target.quote=bubble.textContent;open(target);};bubble.closest('.row').classList.add('fedra-note-row');bubble.closest('.row').append(button);
    }
    counts();
  }
  addButtons();
  if(opts.hooks?.length>1){
    const section=document.createElement('details');section.className='dra-hook-options';section.innerHTML='<summary>Opciones de inicio</summary>';
    opts.hooks.forEach((hook,i)=>{const label=document.createElement('label');const radio=document.createElement('input');radio.type='radio';radio.name='dra-hook';radio.checked=g.lines.find(l=>l.text)?.text===hook;const words=document.createElement('span');words.textContent=hook;label.append(radio,words);section.append(label);radio.onchange=()=>{if(!radio.checked)return;onHook(hook);const first=targets[0];if(first)first.quote=hook;};});
    document.querySelector('#v-conv .toolrow').after(section);
  }
  const end=()=>{alive=false;stopRecording();urls.forEach(u=>URL.revokeObjectURL(u));dialog.remove();};
  window.addEventListener('pagehide',end,{once:true});
  dispose=()=>{window.removeEventListener('pagehide',end);end();};
}
