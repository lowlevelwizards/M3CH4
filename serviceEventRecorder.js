/** Write-ahead queue for actual serialized workshop/pit service actions.
 * Gameplay commits first; queue is recorded synchronously before IndexedDB
 * work so a pit's immediate page reload cannot lose the service record.
 */
import {readSurfaceEvents,storeSurfaceEvents} from './partServiceJournal.js';
const KEY='m3ch4-service-outbox-v1';
const modes=new Set(['workshop-repair','workshop-rebuild','pit-triage']);
const safe=s=>typeof s==='string'&&s.length>0&&s.length<=80;
export function queuedServiceRecords(storage) {
  try{
    const value=JSON.parse(storage?.getItem(KEY)||'[]');
    return Array.isArray(value)?value.filter(v=>safe(v?.serial)&&
      typeof v?.eventId==='string'&&v.eventId.length<=140&&modes.has(v?.mode)).slice(-100):[];
  }catch{return [];}
}
export function queueServiceRecord(storage,{serial,mode,eventId,timestamp=Date.now()}={}) {
  if(!safe(serial)||!safe(eventId)||!modes.has(mode))return false;
  const list=queuedServiceRecords(storage);
  if(!list.some(e=>e.eventId===eventId))
    list.push({eventId,serial,mode,timestamp:Number.isFinite(timestamp)?timestamp:Date.now()});
  try{storage?.setItem(KEY,JSON.stringify(list.slice(-100)));return true;}
  catch{return false;}
}
/** Only locate a repair where actual damage to THIS serial is documented. */
export function physicalServiceEvent(pending,archive=[]){
  const observed=archive.filter(e=>e.event==='impact'&&e.serial===pending.serial &&
    e.internalDamage>0&&e.surfaceId&&Array.isArray(e.localPoint)&&Array.isArray(e.localNormal));
  const covered=new Set(archive.filter(e=>e.event==='service'&&e.coveredEventId)
    .map(e=>e.coveredEventId));
  const candidate=observed.filter(e=>!covered.has(e.eventId))
    .sort((a,b)=>(b.internalDamage-a.internalDamage)||((b.timestamp||0)-(a.timestamp||0)))[0];
  return {
    event:'service',eventId:pending.eventId,serial:pending.serial,
    mode:pending.mode,timestamp:pending.timestamp,
    coveredEventId:candidate?.eventId||null,
    surfaceId:candidate?.surfaceId||null,
    localPoint:candidate?.localPoint||null,
    localNormal:candidate?.localNormal||null,
  };
}
let running=null;
export async function flushServiceRecords(storage=globalThis.localStorage,
  onRecord=()=>{}) {
  if(running)return running;
  running=(async()=>{
    let count=0;
    while(true){
      const pending=queuedServiceRecords(storage)[0];
      if(!pending)break;
      const events=await readSurfaceEvents(pending.serial);
      // A previous interrupted flush can already have written this event.
      const existing=events.find(e=>e.eventId===pending.eventId);
      const next=existing||physicalServiceEvent(pending,events);
      if(!existing)await storeSurfaceEvents([next]);
      onRecord(next);
      const outstanding=queuedServiceRecords(storage)
        .filter(e=>e.eventId!==pending.eventId);
      storage.setItem(KEY,JSON.stringify(outstanding));
      count++;
    }
    return count;
  })();
  try{return await running;}
  finally{running=null;}
}
export const SERVICE_OUTBOX_KEY=KEY;
