/** Real production-headless 3v3 cross-map fairness baseline.
 * NOT pixel-perfect Three.js raycasts or human skill; see headlessDominationStudy.
 * Uses the exact map worlds, physical movement, AI, capture, weapons and damage.
 */
import {runBout} from './headlessDominationStudy.mjs';
import {MAPS} from '../maps/mapRegistry.js';
import {certifyArena} from '../maps/mapValidation.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const seeds=Math.max(1,Math.min(20,Number(process.argv[2]||2)));
const results=[];
for(const map of MAPS){
 const geometry=certifyArena(map);
 if(!geometry.ok)throw Error(map.id+': '+geometry.errors.join('; '));
 const rows=[];
 for(let seed=0;seed<seeds;seed++){
  const result=runBout(51072+seed*70139,{
   mapId:map.id,contractId:'domination',accuracy:.65,policy:'strict',
   variantTeam:'none',maxSeconds:145,
   policyFriendly:'baseline',policyHostile:'baseline',
   name:map.id,
  });
  const round={
   seed,arenaId:map.id,time:result.time,reason:result.winReason,
   winner:result.win,progress:result.points,firstContactAt:result.firstContactAt,
   firstMajorityAt:result.firstMajorityAt,
   captureEvents:result.captureEvents,contestedSeconds:result.contestedSeconds,
   routeErrors:result.actors.reduce((sum,a)=>sum+(a.routeErrors||0),0),
   kills:result.kills,
  };
  if(!Number.isFinite(round.time)||!Number.isFinite(round.routeErrors)||
    !Number.isFinite(round.contestedSeconds))
   throw Error('Non-finite map simulation '+JSON.stringify(round));
  rows.push(round);
 }
 const summary={
  id:map.id,samples:seeds,coverCount:geometry.coverCount,
  avgFirstContactSeconds:rows.reduce((s,r)=>s+(r.firstContactAt??r.time),0)/seeds,
  avgRouteErrors:rows.reduce((s,r)=>s+r.routeErrors,0)/seeds,
  avgCaptures:rows.reduce((s,r)=>s+r.captureEvents,0)/seeds,
  avgContestedSeconds:rows.reduce((s,r)=>s+r.contestedSeconds,0)/seeds,
  winners:rows.map(r=>r.winner),
 };
 results.push({summary,rows});
 console.log('CIRCUIT-BALANCE '+JSON.stringify(summary));
}
mkdirSync('study-results',{recursive:true});
writeFileSync('study-results/circuit-map-baseline.json',
  JSON.stringify({limitations:'approximate combat rays; no player; not a guarantee of competitive balance',results},null,2));
