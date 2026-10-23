/** Deterministic authored-map gameplay inspection, not a substitute for
 * full firefights. Uses the SAME heavy-footprint A* and static LOS as real AI.
 * No random trial seeds, invented routes or alternate shadow geometry.
 */
import {planRoute} from '../ai/navigation.js';
import {tacticalLineOfSight} from '../tacticalAwareness.js';
import {pointClear} from './mapValidation.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const round=n=>Math.round(n*100)/100;
const narrow=values=>({minimum:round(Math.min(...values)),maximum:round(Math.max(...values)),
  average:round(values.reduce((a,b)=>a+b,0)/Math.max(values.length,1))});

/** Pair every member of the two actual spawn lines with the opposite squad.
 * Counting all 9 pairs exposes flanking spawn sniping hidden by center-only tests.
 */
export function measureSpawnExposure(map){
 const pairs=[];
 for(const [i,friendly] of map.spawns.friendly.entries())
  for(const [j,hostile] of map.spawns.hostile.entries()){
   const clear=tacticalLineOfSight(friendly,hostile,map.world);
   pairs.push({friendly:i,hostile:j,clear,distance:round(dist(friendly,hostile))});
  }
 return Object.freeze({total:pairs.length,exposed:pairs.filter(p=>p.clear).length,pairs});
}

/** Find immediately usable approach sectors. This measures available floor
 * and collision clearance, not an invented suggestion that AI can teleport.
 */
export function measureObjectiveApproaches(map,site,radius=1.55,zoneRadius=4.7){
 const samples=[];
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6;
  const test={x:site.x+Math.cos(angle)*(zoneRadius+1.5),
    z:site.z+Math.sin(angle)*(zoneRadius+1.5)};
  samples.push({bearing:i*30,passable:pointClear(map,test,radius)});
 }
 return {site:site.id,clearBearings:samples.filter(p=>p.passable).length,
  samples};
}
export function auditMapFlow(map,{radius=1.55,checkRoutes=true}={}){
 const sites=map.sites.domination;
 const exposure=measureSpawnExposure(map);
 const objectives=sites.map(site=>measureObjectiveApproaches(map,site,radius));
 const routes=[],teams={friendly:[],hostile:[]};
 if(checkRoutes){
  for(const team of ['friendly','hostile']){
   for(const [spawnIndex,from] of map.spawns[team].entries()){
    for(const site of sites){
     const path=planRoute(map.world,from,site,radius);
     const record={team,spawn:spawnIndex,site:site.id,ok:path.ok,
       length:path.ok?round(path.cost):null,reason:path.ok?null:path.reason,
       waypoints:path.waypoints.length};
     routes.push(record);
     if(path.ok)teams[team].push(path.cost);
    }
   }
  }
 }
 const fromNorth=teams.hostile.length?narrow(teams.hostile):null;
 const fromSouth=teams.friendly.length?narrow(teams.friendly):null;
 const routeBias=fromNorth&&fromSouth?
  round(Math.abs(fromNorth.average-fromSouth.average)/
       Math.max(1,(fromNorth.average+fromSouth.average)/2)):null;
 return {
  mapId:map.id,obstacles:map.world.obstacles.length,
  exposure,objectiveApproaches:objectives,
  routes,fromNorth,fromSouth,routeBias,
  playable:routes.length?routes.every(r=>r.ok)&&
    objectives.every(o=>o.clearBearings>=3):objectives.every(o=>o.clearBearings>=3),
 };
}
