/** Find objective sites that reduce starting-side advantage without changing
 * cover, physical movement, AI personalities or simulation victory rules.
 * Every trial is paired: same RNG seed, swapped physical sides, same hardware.
 * This is a scout, NOT a promise of competitive balance from 6 bouts.
 */
import {MAPS} from '../maps/mapRegistry.js';
import {pointClear} from '../maps/mapValidation.js';
import {runBout} from './headlessDominationStudy.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';

const spawnDistance=(map,sites)=>Math.min(...['friendly','hostile'].flatMap(team=>
 map.spawns[team].flatMap(p=>sites.map(site=>Math.hypot(site.x-p.x,site.z-p.z)))));
const points=(a,b,c)=>[{id:'A',x:a[0],z:a[1]},
 {id:'B',x:b[0],z:b[1]},{id:'C',x:c[0],z:c[1]}];
const candidates={
 'backlot-dustbowl':[
  ['previous-live',points([-20,4],[0,-11],[20,4])],
  ['north-balanced',points([-20,-5],[0,-11],[20,-2])],
  ['north-a',points([-20,-4],[0,-11],[20,0])],
  ['split',points([-20,-2],[0,12],[20,2])],
  ['north-flanks',points([-20,-4],[0,12],[20,-4])],
 ],
 grainhouse:[
  // Probe the newly rebuilt north/south silo approaches, not just a small
  // offset within the old north-owned objective. Same geometry for each bout.
  ['court-live',points([-10,-13],[19,-1],[11,19])],
  ['court-north',points([-10,-13],[19,-3],[11,19])],
  ['court-south',points([-10,-13],[19,1],[11,19])],
  ['court-east',points([-10,-13],[23,0],[11,19])],
  ['court-west',points([-10,-13],[16,-1],[11,19])],
  ['court-c-south',points([-10,-13],[19,-1],[11,17])],
  ['court-a-south',points([-10,-11.5],[19,-1],[11,19])],
  ['court-diagonal',points([-10,-13],[18,-1],[11,18])],
  ['old-north-b',points([-10,-13],[24.5,-8],[11,19])],
 ],
};
const pairs=Math.max(1,Math.min(16,Number(process.argv[2]||8)));
const results=[];
for(const map of MAPS){
 // Always measure the actually shipped site layout in the same paired cohort.
 // Culvert is the known near-balanced control map and is not tuned here.
 for(const [variant,sites] of [['live-baseline',map.sites.domination],...(candidates[map.id]||[])]){
  if(!sites.every(p=>pointClear(map,p,1.55)))throw Error('Blocked site '+map.id+' '+variant);
  const rows=[];
  for(let i=0;i<pairs;i++){
   for(const swapSpawns of [false,true]){
    const bout=runBout(51072+i*70139,{
      mapId:map.id,objectivePoints:sites,swapSpawns,
      contractId:'domination',accuracy:.65,policy:'strict',
      variantTeam:'none',maxSeconds:145,
      policyFriendly:'baseline',policyHostile:'baseline',
      name:variant,
    });
    rows.push({seed:i,swapSpawns,winner:bout.win,reason:bout.winReason,
      score:bout.points,time:bout.time,firstContactAt:bout.firstContactAt,
      captures:bout.captureEvents,routeErrors:bout.actors.reduce((s,a)=>s+(a.routeErrors||0),0)});
   }
  }
  const north=rows.filter(r=>r.winner==='friendly'&&r.swapSpawns||
     r.winner==='hostile'&&!r.swapSpawns).length;
  const south=rows.filter(r=>r.winner==='friendly'&&!r.swapSpawns||
     r.winner==='hostile'&&r.swapSpawns).length;
  const draws=rows.length-north-south;
  const nearestSpawnMeters=spawnDistance(map,sites);
  const summary={map:map.id,variant,sites,matchedPairs:pairs,
    nearestSpawnMeters,spawnSafe:nearestSpawnMeters>=6.25,
    northWins:north,southWins:south,draws,
    meanRouteErrors:rows.reduce((s,r)=>s+r.routeErrors,0)/rows.length,
    meanCaptures:rows.reduce((s,r)=>s+r.captures,0)/rows.length,
    meanFirstContact:rows.reduce((s,r)=>s+(r.firstContactAt??r.time),0)/rows.length,
    meanDuration:rows.reduce((s,r)=>s+r.time,0)/rows.length,
    meanNorthScore:rows.reduce((s,r)=>s+(r.swapSpawns?r.score.friendly:r.score.hostile),0)/rows.length,
    meanSouthScore:rows.reduce((s,r)=>s+(r.swapSpawns?r.score.hostile:r.score.friendly),0)/rows.length,
    results:rows};
  results.push(summary);
  console.log('MAP_CANDIDATE '+JSON.stringify({...summary,results:undefined}));
 }
}
mkdirSync('study-results',{recursive:true});
writeFileSync('study-results/map-candidate-study.json',JSON.stringify(results,null,2));
