import {positionHitsCover} from '../backlotCompoundGeometry.js';
/** k.3u.3: bounded tactical evaluators. Advice only; never move rigs,
 * invent enemy positions, mutate hardware or override weapon/score authority. */
const dist=(a,b)=>Math.hypot((a.x??0)-(b.x??0),(a.z??0)-(b.z??0));
const other=team=>team==='friendly'?'hostile':'friendly';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function zoneOpportunity(zone,team,teamOwnsMajority=false){
  const rival=other(team),ours=zone[team]??0,theirs=zone[rival]??0;
  const owned=zone.owner===team,enemyOwned=zone.owner===rival;
  const pressure=zone.contested ? .24+Math.max(0,theirs-ours)*.13 : 0;
  const progress=clamp(Math.abs(zone.influence??0));
  // An uncontested scoring point is worth more than an unwinnable duel.
  const score=owned&&!zone.contested ? (teamOwnsMajority?1.10:.95) :
    enemyOwned ? 1.02-progress*.09 : .95+(1-progress)*.12;
  return score-pressure-(theirs>1?.16:0)+(ours>0?.06:0);
}
export function observedZoneThreat(target,snapshot,team,assignedZoneId=null){
  if(snapshot?.kind!=='domination')return 0;
  const zones=snapshot.zones??[];
  let best=0;
  for(const zone of zones){
    const d=dist(target.rig??target.position??target,zone.point);
    if(d>(snapshot.zoneRadius??4.7)+3)continue;
    const importance=zone.id===assignedZoneId?.35:0;
    const ours=zone.owner===team&&!zone.contested;
    const urgent=ours?.23:zone.contested?.34:.08;
    best=Math.max(best,importance+urgent+(d<(snapshot.zoneRadius??4.7)?.24:0));
  }
  return best;
}
/** Candidate array must already be limited to observed contacts. */
export function prioritizeVisibleTarget(actor,candidates,snapshot,order=null,currentId=null,threatId=null){
  if(!candidates?.length)return null;
  const role=order?.role??'';
  const scored=candidates.map(candidate=>{
    const d=dist(actor.rig,candidate.rig);
    const relevance=observedZoneThreat(candidate,snapshot,actor.team,order?.objectiveId);
    const service= candidate.fieldService?.held?.12:0; // visible servicing, no component health
    const targetBonus=candidate.id===currentId?.24:0;
    // Prefer actual firing opportunities without chasing an unseen shooter.
    const dx=candidate.rig.x-actor.rig.x,dz=candidate.rig.z-actor.rig.z;
    const bearing=Math.atan2(dx,-dz);
    const facing=Number.isFinite(actor.rig.yaw)?Math.abs(Math.atan2(
      Math.sin(bearing-actor.rig.yaw),Math.cos(bearing-actor.rig.yaw))):Math.PI;
    const fireLane=facing<.95?.21:facing<1.8?.06:0;
    // A legitimate observed assailant outranks a distant routine target.
    // Threat identity alone never makes an unseen contact eligible.
    const flankAngle=facing>1.65?1.2:facing>1?.7:0;
    const retaliate=candidate.id===threatId?(d<16?1.0+flankAngle:.58):0;
    const interception=role==='INTERCEPT'?relevance*.14:0;
    // Anchors may shoot enemies in sight, but shouldn't turn every remote
    // skirmish into a reason to abandon their productive scoring footprint.
    const anchorDistance=order?.anchor&&order?.point?
      dist(candidate.rig,order.point):0;
    const anchorBias=order?.anchor?(anchorDistance<14?.32:-.32):0;
    const designated=order?.targetActorId===candidate.id?
        (order?.role==='COUNTER_FLANK'?1.10:.42):0;
    return {candidate,score:relevance+service+targetBonus+retaliate+fireLane+
      interception+anchorBias+designated-Math.min(.9,d*.024)};
  });
  scored.sort((a,b)=>b.score-a.score||a.candidate.id.localeCompare(b.candidate.id));
  return scored[0].candidate;
}
/** Do not alter aim precision, accuracy or damage. Only choose meaningful targets.
 * Same physical emitted-shot transaction still happens in main.js. */
export function shouldAttemptTacticalShot(actor,target,{urgent=false}={}){
  if(!target||!actor?.weaponState||!actor?.weaponSpec)return false;
  if(actor.weaponState.loaded<=0||actor.weaponState.reloadLeft>0)return false;
  const distance=dist(actor.rig,target.rig);
  const usefulRange=actor.behavior?.preferredRangeM??7;
  if(distance>Math.max(24,usefulRange*3.3)&&!urgent)return false;
  return true;
}
export function tacticalAimSlot(defaultSlot,{targetSpeed=0,contesting=false,visibleService=false}={}){
  if(visibleService)return 'combat';
  if(contesting&&targetSpeed<.25)return 'combat';
  if(targetSpeed>2.15)return 'mobility';
  return defaultSlot;
}
export function casualtyAssignment(actor,job,zone=null){
  const cap=actor.capability??{};
  if(!cap.canMove)return job&&dist(actor.position,job.point)<3.6?0.5:-100;
  if(!cap.canFight){
    if(job?.kind==='SCREEN'||job?.kind==='CONTEST')return -.46;
    if(job?.kind==='DEFEND'||job?.kind==='CAPTURE')
      return zone?.contested?-.26:.10;
  }
  if(cap.endurance<.22){
    if(job?.kind==='CONTEST')return -.32;
    if(job?.kind==='DEFEND'&&!zone?.contested)return .12;
  }
  return 0;
}
/** Deliberate two-rig assault has a finite staging window, never indefinite waiting. */
export function assaultStagingPoint(actor,objective,ally,worldRadius=4.7){
  const dx=actor.position.x-objective.x,dz=actor.position.z-objective.z;
  const length=Math.max(.001,Math.hypot(dx,dz));
  const side=actor.id.localeCompare(ally.id)<0?1:-1;
  const range=Math.min(6,worldRadius+1);
  return {x:objective.x+dx/length*range-dz/length*side*.9,
    z:objective.z+dz/length*range+dx/length*side*.9};
}
/** Physical traffic hint: a close, slower teammate/wreck is yielded around.
 * Static A* keeps final authority. No positions of hidden enemy rigs are used. */
export function trafficWaypoint(rig,waypoint,nearby,world,collisionRadius=1){
  if(!waypoint||!nearby?.length)return waypoint;
  const dx=waypoint.x-rig.x,dz=waypoint.z-rig.z,length=Math.hypot(dx,dz);
  if(length<1.5)return waypoint;
  const nx=dx/length,nz=dz/length;
  const obstacles=nearby.filter(item=>item.active!==false||item.wreck)
    .map(item=>{
      const p=item.position??item.rig;
      if(!p)return null;
      const ahead=(p.x-rig.x)*nx+(p.z-rig.z)*nz;
      const cross=(p.x-rig.x)*nz-(p.z-rig.z)*nx;
      return {...item,p,ahead,cross,
        clearance:collisionRadius+(item.radius??1)+.45};
    })
    .filter(o=>o&&o.ahead>=-.3&&o.ahead<=Math.min(5.5,length)&&
      Math.abs(o.cross)<o.clearance)
    .sort((a,b)=>a.ahead-b.ahead||String(a.id??'').localeCompare(String(b.id??'')));
  // Yield to the nearest real block, not whichever ally the roster lists first.
  // Choose a clear side and let the executor hold that waypoint for 1.3 s.
  for(const item of obstacles){
    const preferred=item.cross>=0?-1:1;
    for(const side of [preferred,-preferred]){
      const p={x:rig.x+nx*Math.max(1.8,item.ahead+1.25)-nz*side*(item.clearance+.8),
        z:rig.z+nz*Math.max(1.8,item.ahead+1.25)+nx*side*(item.clearance+.8)};
      if(p.x<world.minX+collisionRadius||p.x>world.maxX-collisionRadius||
        p.z<world.minZ+collisionRadius||p.z>world.maxZ-collisionRadius)continue;
      if(positionHitsCover(p,world.obstacles,collisionRadius,{includeDynamic:false}))continue;
      if(nearby.some(other=>{
        const q=other.position??other.rig;
        return q&&Math.hypot(p.x-q.x,p.z-q.z)<
          collisionRadius+(other.radius??1)+.3;
      }))continue;
      return p;
    }
  }
  return waypoint;
}
