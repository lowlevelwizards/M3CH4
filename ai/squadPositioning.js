import {positionHitsCover} from '../backlotCompoundGeometry.js';
/**
 * k4w: squad-level physical destination reservations.
 *
 * The team planner chooses WHAT to do first. This module only decides WHERE
 * teammates who received that order should approach / stand. No concealed
 * enemy information, movement impulses, player orders or capture rules.
 */
export const ARRIVAL_POLICIES=Object.freeze(['legacy','slots','lanes','coordinated']);
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const valid=(p,world,pad)=>{
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z))return false;
  if(!world)return true;
  if(p.x<world.minX+pad||p.x>world.maxX-pad||
     p.z<world.minZ+pad||p.z>world.maxZ-pad)return false;
  return !positionHitsCover(p,world.obstacles,pad,{includeDynamic:false});
};
function clear(a,b,world,pad){
  if(!world)return true;
  const steps=Math.max(2,Math.ceil(d(a,b)/.85));
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    if(!valid({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},world,pad))
      return false;
  }
  return true;
}
const rounded=p=>({x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100});
/** Pure deterministic, only active/movable actors; retain stable identity. */
export function coordinateSquadArrivals(orders,actors,zones,{
  policy='legacy',world=null,zoneRadius=4.7,
  previousOrders={},player=null,collisionRadius=1.12
}={}){
  if(!ARRIVAL_POLICIES.includes(policy))throw new RangeError('Invalid arrival policy '+policy);
  if(policy==='legacy')return orders;
  const output=Object.fromEntries(Object.entries(orders??{}).map(([id,o])=>
    [id,o?{...o}:o]));
  const active=(actors??[]).filter(a=>a.active!==false&&a.capability?.canMove!==false)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const byId=new Map(active.map(a=>[a.id,a]));
  const safeRadius=Math.max(1.4,zoneRadius-collisionRadius-.52);
  const pad=collisionRadius+.34;
  for(const zone of zones??[]){
    const ids=Object.keys(output).filter(id=>{
      const order=output[id];return byId.has(id)&&
        order?.objectiveId===zone.id&&
        ['CAPTURE','CONTEST','DEFEND','SCREEN'].includes(order.goal)&&
        !order.anchor; // Payable anchors remain independent and protected.
    }).sort();
    // Solo capturer gains nothing by having a geometrically imposed slot.
    if(ids.length<2)continue;
    const claimed=[];
    if(player?.active!==false&&player?.position&&
       d(player.position,zone.point)<zoneRadius+1.2)
      claimed.push({point:player.position,radius:collisionRadius*1.1});
    for(const anchor of active)if(output[anchor.id]?.anchor&&
       output[anchor.id]?.objectiveId===zone.id)
      claimed.push({point:anchor.position,radius:collisionRadius});
    for(const id of ids){
      const actor=byId.get(id),order=output[id];
      const previous=previousOrders?.[id];
      const old=previous?.objectiveId===zone.id?
        previous.reservationPoint??previous.arrivalPoint:null;
      // Same-zone scoring positions use a ring INSIDE the real scoring
      // footprint. A SCREEN remains just inside the outer sector.
      const ring=order.goal==='SCREEN'?safeRadius*.88:safeRadius*.79;
      const choices=[];
      if(old)choices.push({...old,retained:true});
      for(const radius of [ring,safeRadius*.64,safeRadius*.38]){
        for(let i=0;i<16;i++){
          const angle=(i+0.5)*Math.PI/8;
          choices.push({x:zone.point.x+Math.sin(angle)*radius,
            z:zone.point.z+Math.cos(angle)*radius});
        }
      }
      const ranked=choices.filter(p=>valid(p,world,pad)&&
          d(p,zone.point)<=safeRadius+.01)
        .map(p=>{
          const separation=claimed.reduce((sum,item)=>{
            const required=collisionRadius+(item.radius??collisionRadius)+.42;
            return sum+Math.max(0,required-d(p,item.point))*18;
          },0);
          const travelled=d(actor.position,p);
          const previousBonus=p.retained?-4:0;
          const priorLane=old?d(p,old)*.40:0;
          // If geometry permits, avoid a teammate's travel corridor, too.
          const crossing=claimed.reduce((sum,item)=>{
            if(!item.pathFrom)return sum;
            const a=item.pathFrom,b=item.point;
            const vx=b.x-a.x,vz=b.z-a.z,l=vx*vx+vz*vz;
            if(l<.01)return sum;
            const t=Math.max(0,Math.min(1,
              ((p.x-a.x)*vx+(p.z-a.z)*vz)/l));
            const near={x:a.x+vx*t,z:a.z+vz*t};
            return sum+Math.max(0,collisionRadius*2-d(p,near))*.9;
          },0);
          return {point:p,cost:separation+travelled*.17+
            priorLane+crossing+previousBonus};
        }).sort((a,b)=>a.cost-b.cost||
          a.point.x-b.point.x||a.point.z-b.point.z);
      const best=ranked[0]?.point;
      if(!best)continue; // Existing route fallback remains authoritative.
      const position=rounded(best);
      claimed.push({point:position,radius:collisionRadius,pathFrom:actor.position});
      if(policy!=='lanes'){
        if(order.goal==='DEFEND'||order.goal==='SCREEN')
          output[id].reservationPoint=position;
        else output[id].arrivalPoint=position;
        output[id].approachRole=order.goal==='SCREEN'?'OUTER SCREEN':'SCORING SLOT';
      }
      if(policy==='slots')continue;
      // Create staging bearings only if there are multiple approaching actors
      // and the selected slot can be reached from a safe, physically clear
      // approach point. Do not lure pilots through cover or away from the goal.
      if(d(actor.position,zone.point)<9.5)continue;
      const vx=position.x-zone.point.x,vz=position.z-zone.point.z;
      const l=Math.max(.001,Math.hypot(vx,vz));
      const direction={x:vx/l,z:vz/l};
      const outer=zoneRadius+Math.max(2.6,collisionRadius*2.4);
      const stage={x:zone.point.x+direction.x*outer,
        z:zone.point.z+direction.z*outer};
      const nearActor=d(actor.position,stage);
      if(nearActor>=d(actor.position,zone.point)+2.2)continue;
      if(!valid(stage,world,pad)||!clear(actor.position,stage,world,pad))continue;
      if(claimed.some(c=>c.point!==position&&d(c.point,stage)<collisionRadius*2))
        continue;
      if(!output[id].viaPoint)output[id].viaPoint=rounded(stage);
      output[id].approachRole='SEPARATED LANE';
    }
  }
  return output;
}
