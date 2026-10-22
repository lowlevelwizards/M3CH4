/** Decide what real damaged hardware the service crew is attending.
 * Pure, deterministic, no invented leaks or fault labels, no changes to repair.
 */
export const SERVICE_ORDER=Object.freeze(['structure','mobility','power','combat','command']);
const safe=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):1;
export function serviceCondition(part){
  if(!part)return Object.freeze({severity:0,critical:false,needsService:false});
  const integrity=part.maxIntegrity>0?safe(part.integrity/part.maxIntegrity):1;
  const armor=part.maxArmor>0?safe(part.armor/part.maxArmor):1;
  const critical=!!part.destroyed||integrity<=0;
  const severity=Math.max(1-integrity,(1-armor)*.36,critical?1:0);
  return Object.freeze({severity,critical,needsService:severity>.025});
}
export function serviceBayFocus(parts={},selectedSlot=null,pit=false) {
  const state=Object.fromEntries(SERVICE_ORDER.map(slot=>[slot,serviceCondition(parts[slot])]));
  const available=SERVICE_ORDER.filter(slot=>parts[slot]);
  const critical=available.some(slot=>state[slot].critical);
  const actual=available.filter(slot=>state[slot].needsService);
  const focus=(selectedSlot&&available.includes(selectedSlot))?selectedSlot:
    actual.sort((a,b)=>state[b].severity-state[a].severity ||
      SERVICE_ORDER.indexOf(a)-SERVICE_ORDER.indexOf(b))[0]||null;
  return Object.freeze({
    visible:!!pit||critical,focus,
    intensity:focus?state[focus].severity:0,
    critical,damagedCount:available.filter(slot=>state[slot].needsService).length,
    supports:state.mobility.critical||state.structure.critical,
    mode:!focus?'STANDBY':state[focus].critical?'DISABLED':
      state[focus].needsService?'INSPECT':'READY',
  });
}
