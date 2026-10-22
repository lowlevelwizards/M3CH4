/** Decide visible battle scars from the real serial lifecycle.
 * Never changes the journal: a repaired breach remains a historical event even
 * when there is no hole left on the physical component.
 */
export const REPAIR_PATCH_SIZE=Object.freeze({width:.68,height:.64});
export function hideBreachAfterService(event,{coveredIds=new Set(),
  partCondition=null,repairs=0,serviceAt=null,sessionStart=0}={}){
  if(event?.event==='service'||!(Number(event?.internalDamage)>0))return false;
  if(coveredIds.has(event.eventId))return true;
  if(!(partCondition>=.995)||!(repairs>0))return false;
  // A freshly shot rebuilt machine can show a NEW penetration until serviced.
  // Archived impacts on a currently fully restored serial must not display
  // as open holes after that physical repair, even on a legacy save.
  if(Number.isFinite(serviceAt))
    return !Number.isFinite(event.timestamp)||event.timestamp<=serviceAt;
  return !Number.isFinite(event.timestamp)||event.timestamp<sessionStart;
}
