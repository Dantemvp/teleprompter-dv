/* Browser-only upload receipts. Never stores passwords or access tokens. */
(() => {
  const memory = new Map();
  const storage = {
    get(type,key) { try { return window[type].getItem(key); } catch { return null; } },
    set(type,key,value) { try { window[type].setItem(key,value); return true; } catch { return false; } }
  };
  function database() {
    return new Promise((resolve,reject)=>{
      let request,expired=false;
      const timer=setTimeout(()=>{expired=true;reject(new Error('Almacenamiento local no disponible.'));},5000);
      try { request=indexedDB.open('dv-prendas-pendientes',1); }
      catch(error){clearTimeout(timer);reject(error);return;}
      request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'key'});
      request.onerror=()=>{clearTimeout(timer);reject(request.error);};
      request.onsuccess=()=>{clearTimeout(timer);if(expired)request.result.close();else resolve(request.result);};
    });
  }
  async function transaction(mode,operation) {
    const db=await database();
    try {
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('photos',mode),request=operation(tx.objectStore('photos'));
        const timer=setTimeout(()=>{tx.abort();reject(new Error('No se pudo conservar la copia local.'));},5000);
        tx.oncomplete=()=>{clearTimeout(timer);resolve(request.result);};
        tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error||new Error('No se guardó la copia local.'));};
      });
    } finally { db.close(); }
  }
  const drafts={
    async list(prefix) {
      try { for(const item of await transaction('readonly',store=>store.getAll()))memory.set(item.key,{...item,persisted:true}); }
      catch { /* In-memory drafts still survive closing and reopening the modal. */ }
      return [...memory.values()].filter(item=>item.key.startsWith(prefix));
    },
    async put(item) {
      memory.set(item.key,{...item,persisted:false});
      try { await transaction('readwrite',store=>store.put(item));memory.get(item.key).persisted=true;return true; }
      catch { return false; }
    },
    async remove(key) {
      try { await transaction('readwrite',store=>store.delete(key)); } catch { /* A stale receipt is safe: server writes are idempotent. */ }
      memory.delete(key);
    }
  };
  async function request(url,init={},timeout=45000) {
    const controller=new AbortController(),parent=init.signal;
    let expired=false;
    const cancel=()=>controller.abort();
    if(parent?.aborted)controller.abort();else parent?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(()=>{expired=true;controller.abort();},timeout);
    try {
      const response=await fetch(url,{...init,signal:controller.signal});
      let result;
      try { result=await response.json(); }
      catch { if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');throw new Error('El servidor no respondió correctamente. Reintenta; no cierres las fotos pendientes.'); }
      if(!response.ok)throw Object.assign(new Error(result.error||'No se pudo guardar. Reintenta.'),{status:response.status});
      return result;
    } catch(error) {
      if(expired)throw new Error('La conexión tardó demasiado. Reintenta las fotos pendientes; no se duplicarán.');
      if(error instanceof TypeError)throw new Error('No hay conexión con el servidor. Conservamos las fotos pendientes para reintentar.');
      throw error;
    } finally { clearTimeout(timer);parent?.removeEventListener('abort',cancel); }
  }
  window.PrendasRuntime={storage,drafts,request};
})();
