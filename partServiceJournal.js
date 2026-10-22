/** M3CH4 serialized physical impact journal.
 * Data is independent of the v8 machine save, visual renderer, and combat authority.
 * IndexedDB stores exact observed impact facts; no textures are serialized.
 */
export const SURFACE_JOURNAL_SCHEMA=1;
export const SURFACE_JOURNAL_DB='m3ch4-surface-history-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const vec=(value)=>Array.isArray(value)&&value.length===3&&
  value.every(n=>finite(n)&&Math.abs(n)<100)?
  value.map(n=>Math.round(n*10000)/10000):null;
export function normalizeSurfaceEvent(event){
  if(!event||!text(event.eventId,140)||!text(event.serial,80))return null;
  const timestamp=finite(event.timestamp)?
    Math.floor(clamp(event.timestamp,0,Number.MAX_SAFE_INTEGER)):null;
  if(event.event==='service'){
    if(!['workshop-repair','workshop-rebuild','pit-triage'].includes(event.mode))
      return null;
    const coveredEventId=event.coveredEventId||null;
    const surfaceId=event.surfaceId||null;
    const localPoint=vec(event.localPoint),localNormal=vec(event.localNormal);
    // No physical evidence, no guessed location: location is all-or-nothing.
    if(coveredEventId && (!text(coveredEventId,140)||!text(surfaceId,220)||
        !localPoint||!localNormal||!localNormal.some(n=>Math.abs(n)>.001)))
      return null;
    if(!coveredEventId && (surfaceId||event.localPoint||event.localNormal))return null;
    return Object.freeze({
      schema:SURFACE_JOURNAL_SCHEMA,event:'service',
      eventId:event.eventId,serial:event.serial,
      mode:event.mode,coveredEventId,surfaceId,
      surfaceVersion:1,localPoint,localNormal,timestamp,
    });
  }
  if(!text(event.surfaceId,220)||!text(event.sortieId,100))return null;
  const localPoint=vec(event.localPoint),localNormal=vec(event.localNormal);
  if(!localPoint||!localNormal||!localNormal.some(n=>Math.abs(n)>.001))return null;
  if(!finite(event.armorAbsorbed)||!finite(event.internalDamage)||
     event.armorAbsorbed<0||event.internalDamage<0)return null;
  return Object.freeze({
    schema:SURFACE_JOURNAL_SCHEMA,
    eventId:event.eventId,serial:event.serial,sortieId:event.sortieId,
    surfaceId:event.surfaceId,surfaceVersion:1,
    event:'impact',localPoint,localNormal,
    kind:event.internalDamage>0?'penetration':'armor-strike',
    armorAbsorbed:Math.round(event.armorAbsorbed*100)/100,
    internalDamage:Math.round(event.internalDamage*100)/100,
    destroyed:!!event.destroyed,disabled:!!event.disabled,
    timestamp,
  });
}
export function summarizeSurfaceEvents(events,serial){
  const out={serial,hits:0,services:0,armorStrikes:0,penetrations:0,lastImpactAt:null,scars:[]};
  const seen=new Set();
  for(const raw of events||[]){
    const e=normalizeSurfaceEvent(raw);
    if(!e||e.serial!==serial||seen.has(e.eventId))continue;
    seen.add(e.eventId);
    if(e.event==='service') {
      out.services++;
      if(e.coveredEventId)out.scars.push(e);
      continue;
    }
    out.hits++;
    if(e.kind==='penetration')out.penetrations++;else out.armorStrikes++;
    if(e.timestamp!=null)out.lastImpactAt=Math.max(out.lastImpactAt||0,e.timestamp);
    out.scars.push(e);
  }
  // Rendering may select a bounded subset, but the journal retains every hit.
  return out;
}
export function openSurfaceJournal(indexedDBFactory=globalThis.indexedDB){
  if(!indexedDBFactory)return Promise.reject(new Error('Surface archive unavailable'));
  return new Promise((resolve,reject)=>{
    const request=indexedDBFactory.open(SURFACE_JOURNAL_DB,SURFACE_JOURNAL_SCHEMA);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('events')){
        const store=db.createObjectStore('events',{keyPath:'eventId'});
        store.createIndex('serial','serial',{unique:false});
      }
    };
    request.onerror=()=>reject(request.error||new Error('History storage failure'));
    request.onsuccess=()=>resolve(request.result);
  });
}
export async function storeSurfaceEvents(events,indexedDBFactory=globalThis.indexedDB){
  const normalized=Array.from(new Map((events||[]).map(normalizeSurfaceEvent)
    .filter(Boolean).map(e=>[e.eventId,e])).values());
  if(!normalized.length)return {ok:true,count:0};
  const db=await openSurfaceJournal(indexedDBFactory);
  try{
    return await new Promise((resolve,reject)=>{
      const transaction=db.transaction('events','readwrite');
      const store=transaction.objectStore('events');
      for(const e of normalized)store.put(e);
      transaction.oncomplete=()=>resolve({ok:true,count:normalized.length});
      transaction.onerror=()=>reject(transaction.error||new Error('Journal write failed'));
      transaction.onabort=()=>reject(transaction.error||new Error('Journal write aborted'));
    });
  }finally{db.close();}
}
export async function readSurfaceEvents(serial,indexedDBFactory=globalThis.indexedDB){
  if(!text(serial,80))return [];
  const db=await openSurfaceJournal(indexedDBFactory);
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('events','readonly');
      const query=tx.objectStore('events').index('serial').getAll(serial);
      query.onsuccess=()=>resolve((query.result||[]).map(normalizeSurfaceEvent).filter(Boolean)
        .sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)||a.eventId.localeCompare(b.eventId)));
      query.onerror=()=>reject(query.error||new Error('Journal read failed'));
    });
  }finally{db.close();}
}
