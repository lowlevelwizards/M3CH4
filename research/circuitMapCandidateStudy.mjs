/** Find objective sites that reduce starting-side advantage without changing
 * cover, physical movement, AI personalities or simulation victory rules.
 * Every trial is paired: same RNG seed, swapped physical sides, same hardware.
 * This is a scout, NOT a promise of competitive balance from 6 bouts.
 */
import {MAPS} from '../maps/mapRegistry.js';
import {pointClear} from '../maps/mapValidation.js';
import {runBout} from './headlessDominationStudy.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';

const points=(a,b,c)=>[{id:'A',x:a[0],z:a[1]},
 {id:'B',x:b[0],z:b[1]},{id:'C',x:c[0],z:c[1]}];
const candidates={
 'backlot-dustbowl':[
  ['north-a',points([-20,-4],[0,-11],[20,0])],
  ['split',points([-20,-2],[0,12],[20,2])],
  ['north-flanks',points([-20,-4],[0,12],[20,-4])],
 ],
 grainhouse:[
  ['middle-alpha',points([-10,-13],[24.5,-7],[11,16])],
  ['middle-beta',points([-10,-12],[24.5,-8],[11,15])],
  ['middle-gamma',points([-10,-14],[24.5,-8],[11,18])],
 ],
};
const pairs=Math.max(1,Math.min(8,Number(process.argv[2]||3)));
const results=[];
for(const map of MAPS.filter(m=>candidates[m.id])){
 for(const [variant,sites] of candidates[map.id]){
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
      score:bout.points,firstContactAt:bout.firstContactAt,
      captures:bout.captureEvents,routeErrors:bout.actors.reduce((s,a)=>s+(a.routeErrors||0),0)});
   }
  }
  const north=rows.filter(r=>r.winner==='friendly'&&r.swapSpawns||
     r.winner==='hostile'&&!r.swapSpawns).length;
  const south=rows.filter(r=>r.winner==='friendly'&&!r.swapSpawns||
     r.winner==='hostile'&&r.swapSpawns).length;
  const draws=rows.length-north-south;
  const summary={map:map.id,variant,sites,matchedPairs:pairs,
    northWins:north,southWins:south,draws,
    meanRouteErrors:rows.reduce((s,r)=>s+r.routeErrors,0)/rows.length,
    meanCaptures:rows.reduce((s,r)=>s+r.captures,0)/rows.length,
    results:rows};
  results.push(summary);
  console.log('MAP_CANDIDATE '+JSON.stringify({...summary,results:undefined}));
 }
}
mkdirSync('study-results',{recursive:true});
writeFileSync('study-results/map-candidate-study.json',JSON.stringify(results,null,2));
