/** Owner/crew identity comes from the ACTUAL serialized machine record.
 * Do not manufacture historical faction, sponsor, rank, or race achievements.
 * The number is a stable painted unit code derived from the chassis serial.
 */
const safe=v=>typeof v==='string'?v.toUpperCase()
  .replace(/[^A-Z0-9 -]/g,'').trim().slice(0,19):'';
export function rigCrewGraphic(assembly){
  if(!assembly||typeof assembly!=='object')return null;
  const structureSerial=assembly.installed?.structure||'';
  const serial=assembly.serial||structureSerial;
  if(typeof serial!=='string'||!serial.trim())return null;
  let hash=2166136261;
  for(const ch of serial){hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;}
  return Object.freeze({
    crewName:safe(assembly.name)||'UNNAMED RIG',
    unitCode:String(hash%100).padStart(2,'0'),
    sourceSerial:serial,
    origin:'actual rig name / stable unit code',
  });
}
