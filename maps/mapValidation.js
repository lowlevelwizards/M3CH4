/** Reusable geometry certificate; our physical-world and AI navigation both
 * consume the exact same obstacle list. Do not use rendered meshes as proxy.
 */
import {planRoute} from '../ai/navigation.js';
import {tacticalLineOfSight} from '../tacticalAwareness.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function pointClear(map,point,padding=1.55){
 const w=map.world;
 return finite(point?.x)&&finite(point?.z)&&
  point.x>=w.minX+padding&&point.x<=w.maxX-padding&&
  point.z>=w.minZ+padding&&point.z<=w.maxZ-padding&&
  !w.obstacles.some(o=>point.x>o.minX-padding&&point.x<o.maxX+padding&&
   point.z>o.minZ-padding&&point.z<o.maxZ+padding);
}
export function certifyArena(map,{radius=1.55,checkRoutes=true}={}){
 const errors=[],world=map.world,seen=new Set();
 if(!finite(world.minX)||!finite(world.maxX)||!finite(world.minZ)||!finite(world.maxZ)||
   world.maxX-world.minX<40||world.maxZ-world.minZ<40)
   errors.push('INVALID BOUNDS');
 for(const o of world.obstacles){
  if(!o.id||seen.has(o.id))errors.push('DUPLICATE COVER ID '+o.id);
  seen.add(o.id);
  if(![o.minX,o.maxX,o.minZ,o.maxZ,o.height].every(finite)||
    o.minX>=o.maxX||o.minZ>=o.maxZ||o.height<=0)
    errors.push('INVALID COVER '+o.id);
  if(o.minX<world.minX-.01||o.maxX>world.maxX+.01||
    o.minZ<world.minZ-.01||o.maxZ>world.maxZ+.01)
    errors.push('COVER OUTSIDE BOUNDS '+o.id);
 }
 const actors=[...map.spawns.friendly.map((p,i)=>({name:'friendly-'+i,point:p})),
    ...map.spawns.hostile.map((p,i)=>({name:'hostile-'+i,point:p}))];
 for(const actor of actors)if(!pointClear(map,actor.point,radius))
  errors.push('SPAWN BLOCKED '+actor.name);
 for(const team of ['friendly','hostile']){
  const spawns=map.spawns[team];
  if(spawns.length!==3)errors.push('NEED THREE '+team+' SPAWNS');
  for(let i=0;i<spawns.length;i++)for(let j=i+1;j<spawns.length;j++)
   if(distance(spawns[i],spawns[j])<4.3)errors.push('SPAWN CROWDING '+team);
 }
 const sites=[...map.sites.domination,{...map.sites.control,id:'control'},
   {...map.sites.recovery,id:'recovery'},
   {...map.sites.breakthrough.friendlyGoal,id:'breakthrough-f'},
   {...map.sites.breakthrough.hostileGoal,id:'breakthrough-h'}];
 for(const site of sites)if(!pointClear(map,site,radius))
  errors.push('OBJECTIVE BLOCKED '+site.id);
 // Prevent an automatic capture from inside a spawn zone. The extra rig
 // radius provides a modest roll-out buffer for the heavy chassis.
 for(const team of ['friendly','hostile'])
  for(const [i,spawn] of map.spawns[team].entries())
   for(const site of map.sites.domination)
    if(distance(spawn,site)<4.7+radius)
     errors.push('SPAWN INSIDE DOMINATION APPROACH '+team+'-'+i+' '+site.id);
 if(map.sites.domination.length!==3||
   new Set(map.sites.domination.map(p=>p.id)).size!==3)
  errors.push('DOMINATION REQUIRES DISTINCT A/B/C');
 if(tacticalLineOfSight(map.spawns.friendly[0],map.spawns.hostile[0],world))
  errors.push('SPAWN TO SPAWN EXPOSED');
 const routes=[];
 if(checkRoutes&&!errors.length){
  for(const side of ['friendly','hostile'])
   for(const site of sites){
    const from=map.spawns[side][0];
    const route=planRoute(world,from,site,radius);
    if(!route.ok)errors.push('NO '+side.toUpperCase()+' ROUTE TO '+site.id+': '+route.reason);
    routes.push({side,site:site.id,ok:route.ok,distance:route.cost??null,
      waypoints:route.waypoints.length});
   }
 }
 return {ok:errors.length===0,errors,routes,coverCount:world.obstacles.length};
}
