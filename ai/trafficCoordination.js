/**
 * Experimental physical teammate traffic advice. This module never moves a rig,
 * changes collision geometry or invents positions: the existing intent executor
 * and stepRig remain the only movement/physics authorities.
 *
 * "legacy" is the exact old local sidestep behavior.
 * "zipper" adds deterministic front-of-queue yielding.
 * "lanes" tries identity-stable, validated lateral passing positions.
 * "hybrid" combines the two. None are live defaults until proven.
 */
import {trafficWaypoint} from './adaptiveTactics.js';

export const TRAFFIC_POLICIES=Object.freeze(['legacy','zipper','lanes','hybrid']);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const position=entry=>entry?.position??entry?.rig??entry;
const valid=(p,world,radius)=>
  Number.isFinite(p?.x)&&Number.isFinite(p?.z)&&
  p.x>=world.minX+radius&&p.x<=world.maxX-radius&&
  p.z>=world.minZ+radius&&p.z<=world.maxZ-radius&&
  !(world.obstacles??[]).some(o=>!o.dynamic&&
    p.x>o.minX-radius&&p.x<o.maxX+radius&&
    p.z>o.minZ-radius&&p.z<o.maxZ+radius);
function clear(from,to,world,pad){
  if(!valid(to,world,pad))return false;
  for(let k=1;k<=Math.max(2,Math.ceil(dist(from,to)/.65));k++){
    const t=k/Math.max(2,Math.ceil(dist(from,to)/.65));
    if(!valid({x:from.x+(to.x-from.x)*t,
      z:from.z+(to.z-from.z)*t},world,pad))return false;
  }
  return true;
}
function peersAlong(rig,waypoint,nearby,radius){
  const dx=waypoint.x-rig.x,dz=waypoint.z-rig.z,range=Math.hypot(dx,dz);
  if(range<1.6)return [];
  const nx=dx/range,nz=dz/range;
  return nearby.filter(p=>p.active!==false).map(p=>{
    const q=position(p);
    if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.z))return null;
    const ahead=(q.x-rig.x)*nx+(q.z-rig.z)*nz;
    const across=Math.abs((q.x-rig.x)*nz-(q.z-rig.z)*nx);
    const separation=radius+(p.radius??1)+.4;
    return {...p,q,ahead,across,separation};
  }).filter(p=>p&&p.ahead>-.4&&p.ahead<Math.min(range,7)&&
    p.across<p.separation+1.0)
    .sort((a,b)=>a.ahead-b.ahead||
      String(a.id??'').localeCompare(String(b.id??'')));
}
function stableSide(id){
  // Identity-stable, independent of who is enumerated first in the roster.
  let hash=2166136261;
  for(const c of String(id??'').split(''))hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return (hash>>>0)&1?1:-1;
}
function passingPoint(rig,waypoint,nearby,world,radius,actorId){
  const blockers=peersAlong(rig,waypoint,nearby,radius);
  if(!blockers.length)return null;
  const first=blockers[0],dx=waypoint.x-rig.x,dz=waypoint.z-rig.z;
  const length=Math.max(.001,Math.hypot(dx,dz));
  const nx=dx/length,nz=dz/length;
  // Stable side prevents frame-by-frame alternating left/right decisions.
  for(const side of [stableSide(actorId),-stableSide(actorId)]){
    for(const lateral of [first.separation+1.0,first.separation+.45]){
      const advance=Math.min(length,Math.max(2.7,first.ahead+2.8));
      const point={x:rig.x+nx*advance-nz*side*lateral,
        z:rig.z+nz*advance+nx*side*lateral};
      if(!clear(rig,point,world,radius+.28))continue;
      if(nearby.some(o=>{
        const q=position(o);return q&&dist(q,point)<
          radius+(o.radius??1)+.48;
      }))continue;
      return point;
    }
  }
  return null;
}
/** Advice value is either {kind:'PASS',point} or {kind:'WAIT'}.
 * An explicit WAIT is not a capture success or strategic HOLD, and the
 * executor caps waiting before trying its ordinary bypass fallback. */
export function trafficAdvice(rig,waypoint,nearby,world,radius=1,
    {policy='legacy',actorId=null,waitedSeconds=0}={}){
  if(!TRAFFIC_POLICIES.includes(policy))throw new RangeError('Traffic policy '+policy);
  if(!waypoint||!nearby?.length)return null;
  if(policy==='legacy'){
    const point=trafficWaypoint(rig,waypoint,nearby,world,radius);
    return point===waypoint?null:{kind:'PASS',point,reason:'LEGACY PASS'};
  }
  const blockers=peersAlong(rig,waypoint,nearby,radius);
  const nearest=blockers[0];
  if(!nearest)return null;
  // Only yield while an ally is really ahead on the same course, never for
  // an unknown opponent or a teammate behind. The front rig must be able
  // to move; after a bounded wait the follower can try an alternate path.
  const ahead=nearest.ahead;
  const corridor=nearest.across<nearest.separation*.95;
  const slowing=nearest.speed??Math.hypot(
    nearest.velocity?.x??0,nearest.velocity?.z??0);
  const shouldQueue=corridor&&ahead>.35&&ahead<5.2&&
    waitedSeconds<2.6&&
    (slowing>.2||ahead<nearest.separation+1.35);
  if((policy==='zipper'||policy==='hybrid')&&shouldQueue)
    return {kind:'WAIT',reason:'FRONT-OF-LANE YIELD',toId:nearest.id};
  if(policy==='lanes'||policy==='hybrid'){
    const point=passingPoint(rig,waypoint,nearby,world,radius,actorId);
    if(point)return {kind:'PASS',point,reason:'STABLE PASSING LANE'};
  }
  const point=trafficWaypoint(rig,waypoint,nearby,world,radius);
  return point===waypoint?null:{kind:'PASS',point,reason:'FALLBACK PASS'};
}
