/** Team tactical arithmetic uses own instrumented machines, PUBLIC score
 * territory/roster counts, and coarse LAST VISUALLY OBSERVED enemy cues.
 * Never inspect a hidden opponent's current coordinates, components or route. */
import {planRoute} from './navigation.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const other=t=>t==='friendly'?'hostile':'friendly';
const valid=(p,w,pad)=>!!w&&Number.isFinite(p?.x)&&Number.isFinite(p?.z)&&
 p.x>=w.minX+pad&&p.x<=w.maxX-pad&&p.z>=w.minZ+pad&&p.z<=w.maxZ-pad&&
 !(w.obstacles??[]).some(o=>!o.dynamic&&
  p.x>o.minX-pad&&p.x<o.maxX+pad&&p.z>o.minZ-pad&&p.z<o.maxZ+pad);
export function assessTacticalAdvantage(snapshot,team){
 const allies=snapshot?.knowledge?.[team]?.allies??[];
 const contacts=snapshot?.knowledge?.[team]?.contacts??[];
 const own=allies.filter(a=>a.active!==false);
 const hostileCount=snapshot?.remaining?.[other(team)]??0;
 const able=own.filter(a=>a.capability?.canMove&&a.capability?.canFight);
 const wounded=own.filter(a=>(a.capability?.endurance??1)<.38);
 const visible=contacts.filter(c=>c.visible);
 const recent=contacts.filter(c=>!c.visible&&c.confidence>.38);
 const lastSeenWeak=contacts.filter(c=>c.confidence>.4&&c.damageCue==='CRITICAL').length;
 const held=(snapshot?.zones??[]).filter(z=>z.owner===team&&!z.contested).length;
 const opponentHeld=(snapshot?.zones??[]).filter(z=>z.owner===other(team)&&!z.contested).length;
 const forceEdge=able.length-hostileCount;
 const secure=held>=2;
 // An edge in publicly known rig count is NOT permission to charge an
 // unknown force through a blind doorway. Demand real combat readiness.
 const exploit=forceEdge>=1&&able.length>=2&&
  able.length>wounded.length&& (visible.length>0||recent.length>0||held<2);
 return {own:own.length,combatReady:able.length,hostileCount,visible:visible.length,
  recent:recent.length,forceEdge,secure,held,opponentHeld,wounded:wounded.length,
  lastSeenWeak,exploit,press:exploit&&!secure,protect:forceEdge<0||wounded.length>=2};
}
/** True local two-on-one advantage, or a PUBLIC contested zone with
 * physically present numerical superiority. No blind global HP read. */
export function localAttackWindow(snapshot,team,zone){
 const allies=snapshot?.knowledge?.[team]?.allies??[];
 const contacts=snapshot?.knowledge?.[team]?.contacts??[];
 const nearby=allies.filter(a=>a.active!==false&&a.capability?.canFight&&
  a.capability?.canMove&&dist(a.position,zone.point)<17);
 const observed=contacts.filter(c=>c.visible&&dist(c.position,zone.point)<13);
 const enemyAtZone=zone?.[other(team)]??0;
 const ownAtZone=zone?.[team]??0;
 const opposed=Math.max(observed.length,enemyAtZone);
 return {ready:nearby.length,opposed,majority:nearby.length>=2&&
  nearby.length>opposed&&(observed.length>0||enemyAtZone>0),
  unopposed:opposed===0,
  numericalEdge:nearby.length-opposed,
  occupationAdvantage:ownAtZone>enemyAtZone};
}
/** A contact's uncertainty grows while unseen. Each searching ally receives
 * an independent sector, NOT the current invisible enemy position. */
export function searchSectorPoint(contact,index,total,world,actor=null){
 const origin=contact?.position;
 if(!origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.z))
  return actor??{x:0,z:0};
 if(contact.visible||total<2)return {...origin};
 const radius=Math.min(9,Math.max(1.8,(contact.searchRadius??2)*.74));
 const heading=(index%Math.max(1,total))*Math.PI*2/Math.max(1,total);
 const candidates=[heading,heading+Math.PI/4,heading-Math.PI/4];
 for(const angle of candidates){
  const p={x:origin.x+Math.cos(angle)*radius,
   z:origin.z+Math.sin(angle)*radius};
  if(!world||valid(p,world,1.35))return p;
 }
 return {...origin};
}
/** Route candidate comes from observed enemy bearing or the public contested
 * circle, never the hidden enemy's actual current position. Choose a safe
 * side approach and keep the *real objective centre* as the final destination.
 */
export function flankApproach(world,from,objective,threat,side=1,radius=1.2){
 if(!world||!objective||!from)return null;
 const dx=objective.x-(threat?.x??from.x),
  dz=objective.z-(threat?.z??from.z);
 const n=Math.hypot(dx,dz);
 if(n<.8)return null;
 const ux=dx/n,uz=dz/n;
 for(const offset of [5.2,6.8,3.8]){
  const via={x:objective.x-ux*5-uz*offset*side,
   z:objective.z-uz*5+ux*offset*side};
  if(!valid(via,world,radius+.3)||dist(via,objective)<3.1)continue;
  if(!planRoute(world,from,via,radius).ok||
     !planRoute(world,via,objective,radius).ok)continue;
  return via;
 }
 return null;
}
