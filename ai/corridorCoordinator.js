/**
 * k4x: team-level one-lane corridor reservations. Unlike objective-arrival
 * coordination, this groups physically overlapping *routes* even when the
 * destinations and objective IDs are different.
 *
 * Only own-unit positions, assigned public orders and STATIC obstacle boxes
 * are used. It never guesses hidden enemy positions, mutates actor velocity,
 * changes collision geometry, or orders the human pilot.
 */
import {planRoute} from './navigation.js';

export const CORRIDOR_POLICIES=Object.freeze([
  'legacy','priority','stagger','clearance'
]);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const round=p=>({x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100});
const valid=(p,world,r)=>{
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z))return false;
  if(p.x<world.minX+r||p.x>world.maxX-r||
      p.z<world.minZ+r||p.z>world.maxZ-r)return false;
  return !(world.obstacles??[]).some(o=>!o.dynamic&&
    p.x>o.minX-r&&p.x<o.maxX+r&&
    p.z>o.minZ-r&&p.z<o.maxZ+r);
};
const inside=(p,o)=>p.x>=o.minX&&p.x<=o.maxX&&
  p.z>=o.minZ&&p.z<=o.maxZ;
function corridorSides(point,dx,dz,world,radius){
  const blocks=(world.obstacles??[]).filter(o=>!o.dynamic);
  if(!blocks.length)return false;
  // A two-sided narrow crossing requires solid surfaces on BOTH
  // sides of this travel bearing at the SAME longitudinal position.
  const norm=Math.hypot(dx,dz);if(norm<.01)return false;
  const nx=dx/norm,nz=dz/norm;
  for(const gap of [Math.max(2.8,radius*2.3),Math.max(4.2,radius*3.0),6]){
    const left={x:point.x-nz*gap,z:point.z+nx*gap};
    const right={x:point.x+nz*gap,z:point.z-nx*gap};
    if(blocks.some(o=>inside(left,o))&&blocks.some(o=>inside(right,o)))
      return true;
  }
  return false;
}
function routeSampling(actor,order,world,radius){
  const goal=order?.point,from=actor?.position;
  if(!goal||!from||!world)return null;
  if(!['CAPTURE','CONTEST','DEFEND','SCREEN','SEARCH','STAGE'].includes(order.goal))
    return null;
  if(actor.capability?.canMove===false)return null;
  const route=planRoute(world,from,goal,radius);
  if(!route.ok)return null;
  const chain=[from,...route.waypoints],samples=[];
  let arclength=0;
  for(let j=1;j<chain.length;j++){
    const a=chain[j-1],b=chain[j],len=dist(a,b);
    if(len<.01)continue;
    for(let step=0;step<=Math.ceil(len/.8);step++){
      const t=Math.min(1,step/Math.ceil(len/.8));
      const p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
      if(!corridorSides(p,b.x-a.x,b.z-a.z,world,radius))continue;
      const distance=arclength+len*t;
      // Never reserve for a machine that is already well inside the gate.
      if(distance<radius*1.3)continue;
      samples.push({point:p,distance,segment:j});
    }
    arclength+=len;
  }
  return {route,samples,start:from,goal};
}
function firstOverlap(a,b,limit=3.4){
  let closest=null,score=Infinity;
  for(const x of a.samples)for(const y of b.samples){
    const delta=dist(x.point,y.point);
    if(delta>limit)continue;
    const candidate=delta+(x.distance+y.distance)*.003;
    if(candidate<score){score=candidate;closest={a:x,b:y,distance:delta};}
  }
  return closest;
}
function stageBefore(entry,actor,world,radius){
  const from=actor.position;
  const length=dist(from,entry);
  if(length<radius*2.3)return null;
  // Keep follower on their own side of the entry, not in a new parking
  // position beyond concrete or in another pilot's occupied body.
  const distance=Math.max(radius*1.65,Math.min(4.2,length*.40));
  const p={x:entry.x+(from.x-entry.x)/length*distance,
    z:entry.z+(from.z-entry.z)/length*distance};
  if(!valid(p,world,radius+.30))return null;
  const short=planRoute(world,from,p,radius);
  return short.ok?round(p):null;
}
const keyOfGroup=members=>members.map(x=>x.actor.id).sort().join('|');
const timed=(policy,index)=>{
  if(policy==='priority')return index*2.7;
  return index*5.4;
};
/** Returns {orders,groups,metrics}, never mutates passed orders or actors.
 *
 * A persistent caller-owned memory is required for stable releaseAt. Once a
 * machine's window has expired, the same assignment is not endlessly
 * extended by a planner call every .85 seconds.
 */
export function coordinateCorridors(orders,actors,world,{
  policy='legacy',time=0,collisionRadius=1.15,memory=null
}={}){
  if(!CORRIDOR_POLICIES.includes(policy))
    throw new RangeError('Unknown corridor policy '+policy);
  if(policy==='legacy'||!world)return {orders,groups:[],metrics:{groups:0,queued:0}};
  const output=Object.fromEntries(Object.entries(orders??{}).map(([id,o])=>
    [id,o?{...o}:o]));
  const eligible=(actors??[]).filter(a=>a.active!==false&&
    a.capability?.canMove!==false&&output[a.id]&&!output[a.id].anchor)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const entries=eligible.map(actor=>({actor,order:output[actor.id],
    path:routeSampling(actor,output[actor.id],world,collisionRadius)}))
    .filter(e=>e.path?.samples.length);
  // Connected components join every pair whose actual physical route shares
  // at least one narrow crossing. Order/objective identity is irrelevant.
  const adjacency=new Map(entries.map(e=>[e.actor.id,new Set()]));
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    // We ONLY study travel to distinct objectives here: same-zone arrival
    // already has independent k4w scoring/approach policy.
    if(entries[i].order.objectiveId&&
       entries[i].order.objectiveId===entries[j].order.objectiveId)continue;
    const overlap=firstOverlap(entries[i].path,entries[j].path);
    if(!overlap)continue;
    adjacency.get(entries[i].actor.id).add(entries[j].actor.id);
    adjacency.get(entries[j].actor.id).add(entries[i].actor.id);
  }
  const seen=new Set(),groups=[];
  for(const entry of entries){
    if(seen.has(entry.actor.id))continue;
    const members=[],stack=[entry.actor.id];seen.add(entry.actor.id);
    while(stack.length){
      const id=stack.pop();const e=entries.find(x=>x.actor.id===id);
      if(e)members.push(e);
      for(const next of adjacency.get(id)??[])if(!seen.has(next)){
        seen.add(next);stack.push(next);
      }
    }
    if(members.length<2)continue;
    members.sort((a,b)=>{
      const ap=a.path.samples[0].distance;
      const bp=b.path.samples[0].distance;
      return ap-bp||a.actor.id.localeCompare(b.actor.id);
    });
    groups.push(members);
  }
  const activeKeys=new Set();
  let queued=0;
  for(const members of groups){
    const corridorKey=keyOfGroup(members);
    activeKeys.add(corridorKey);
    let initial=memory?.[corridorKey];
    if(!initial||initial.expiresAt<time){
      initial={since:time,expiresAt:time+45};
      if(memory)memory[corridorKey]=initial;
    }
    for(let rank=1;rank<members.length;rank++){
      const follower=members[rank],sample=follower.path.samples[0];
      const stage=stageBefore(sample.point,follower.actor,world,collisionRadius);
      if(!stage)continue;
      const earliest=initial.since+timed(policy,rank);
      if(time>=earliest)continue; // Completed window: no re-queueing.
      const base=output[follower.actor.id];
      output[follower.actor.id]={...base,corridorReservation:{
        stagePoint:stage,releaseAt:earliest,
        expiresAt:Math.min(initial.expiresAt,earliest+12),
        group:corridorKey,policy,rank,
        corridorPoint:round(sample.point)
      }};
      queued++;
    }
  }
  // Bound persistent research memory: old unrelated route groups expire.
  if(memory)for(const key of Object.keys(memory))
    if((memory[key]?.expiresAt??0)<time)delete memory[key];
  return {orders:output,groups:groups.map(m=>m.map(e=>e.actor.id)),
    metrics:{groups:groups.length,queued}};
}
