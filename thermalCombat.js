/** Sparse localized heat: only genuinely contacted serialized modules accumulate
 * temporary heat. No generic burn status, unseen target damage or global heat HP.
 */
export function createThermalCombat(){return new Map();}
export function coolThermalCombat(state,dt) {
 if(!state||!Number.isFinite(dt)||dt<=0)return;
 for(const [serial,heat]of state){const next=Math.max(0,heat-dt*.36);if(next<=.0001)state.delete(serial);else state.set(serial,next);}
}
export function cutContact(state,key,dt,nominal=5) {
 if(!state||!key||!Number.isFinite(dt)||dt<=0)return {heat:0,damage:0};
 const old=state.get(key)??0;
 const heat=Math.min(1.5,old+dt*.72);
 state.set(key,heat);
 return {heat,damage:Math.round((nominal*(1+heat*1.18))*100)/100};
}

/** The heat belongs to physical hardware, not a reusable station identifier.
 * Prefix actor ID so independently assembled machines with inherited/imported
 * serial labels never share temporary heat through an arena slot.
 */
export function moduleHeatKey(actorId,slot,condition) {
 const serial=condition?.parts?.[slot]?.serial;
 return typeof actorId==='string'&&actorId.length>0&&
   typeof serial==='string'&&serial.length>0 ? actorId+'/'+serial : null;
}
