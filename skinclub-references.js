import { splitSkinSource, decorateSkinIndex } from './lib/skinclub-policy.mjs';

const endpoint='https://teleprompter-dv.vercel.app/api/skinclub-refs';
let index=null,password=null,config={},notes={};
async function request(action,extra={},credential=password){
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Edit-Password':credential||''},body:JSON.stringify({client:'skin-club-e67ff4',action,...extra}),cache:'no-store'});
  if(!r.ok){const e=new Error(r.status===401?'Se requiere una clave de edición válida.':'No se pudieron cargar las referencias.');e.status=r.status;throw e;}
  return r.json();
}
function clear(){index=null;password=null;notes={};}
async function connect(credential){
  try {const data=await request('index',{},credential);password=credential;index=data;return true;}
  catch(e){clear();if(e.status===401)config.forget?.();throw e;}
}
async function auto(){
  if(index || !config.isEditorMode?.())return;
  const pw=config.remembered?.();if(!pw)return;
  try{await connect(pw);}catch{/* Keep the public view closed on any failure. */}
}
async function unlock(){
  const pw=await config.unlock?.('Contraseña de edición para ver referencias');
  if(!pw)return false;
  try{return await connect(pw);}catch(e){config.toast?.(e.message);return false;}
}
async function script(slug){
  if(!index)return '';
  if(!Object.hasOwn(notes,slug)){try{notes[slug]=(await request('script',{slug})).notes;}catch{notes[slug]='';}}
  return notes[slug];
}
window.SkinClubRefs={
  configure(options){config=options;},auto,unlock,clear,script,
  canView:()=>Boolean(index),
  publicSource:source=>splitSkinSource(source).publicContent,
  decorate:data=>index?decorateSkinIndex(data,index.entries,index.thumbnails):data,
  entry:slug=>index?.entries?.[slug]?.fields||{},
};

// A protected document is fetched with a header, never with a password in its URL.
const form=document.querySelector('#skinRefLogin');
if(form){
  const status=document.querySelector('#skinRefStatus'),frame=document.querySelector('#skinRefFrame');
  const docId=new URLSearchParams(location.search).get('doc')||'r8-fuentes';
  const load=async pw=>{
    status.textContent='Comprobando acceso…';
    try{
      const data=await request('document',{document:docId},pw);
      localStorage.setItem('dvpw',pw);
      const doc=new DOMParser().parseFromString(data.html,'text/html');
      for(const img of doc.querySelectorAll('img')){
        const path='clientes/skin-club-e67ff4/refs/'+(img.getAttribute('src')||'');
        if(data.assets[path])img.src=data.assets[path];else img.remove();
      }
      for(const a of doc.querySelectorAll('a')){a.target='_blank';a.rel='noopener noreferrer';}
      const base=doc.createElement('base');base.href=new URL('clientes/skin-club-e67ff4/refs/',location.href).href;doc.head.prepend(base);
      const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri https: http:";doc.head.prepend(csp);
      frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;frame.hidden=false;form.hidden=true;status.textContent='Referencias · acceso de edición validado';
    }catch(e){if(e.status===401)localStorage.removeItem('dvpw');status.textContent=e.message;form.hidden=false;frame.hidden=true;}
  };
  form.onsubmit=e=>{e.preventDefault();const input=document.querySelector('#skinRefPassword'),pw=input.value;input.value='';load(pw);};
  const remembered=localStorage.getItem('dvpw');if(remembered)load(remembered);
}
