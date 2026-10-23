/** Paired physical 3v3 arena comparison. Symmetric machine recipes and
 * matched seeded trials start from BOTH sides of the same unchanged map.
 * Opposite starting sides separate spawn/layout advantage from biases in AI.
 * Uses production collision, A*, intent, damage, physical combat and scoring;
 * Three.js per-poly hit confirmation and humans remain approximated.
 */
import {runBout} from './headlessDominationStudy.mjs';
import {MAPS} from '../maps/mapRegistry.js';
import {certifyArena} from '../maps/mapValidation.js';
import {writeFileSync,mkdirSync} from 'node:fs';

const pairs=Math.max(1,Math.min(20,Number(process.argv[2]||2)));
const safeMean=(rows,read)=>rows.reduce((sum,r)=>sum+(read(r)||0),0)/Math.max(1,rows.length);
const results=[];
for(const map of MAPS){
 const geometry=certifyArena(map);
 if(!geometry.ok)throw Error(map.id+': '+geometry.errors.join('; '));
 const rows=[];
 for(let seed=0;seed<pairs;seed++){
  for(const swapSpawns of [false,true]){
   const result=runBout(51072+seed*70139,{
    mapId:map.id,swapSpawns,
    contractId:'domination',accuracy:.65,policy:'strict',
    variantTeam:'none',maxSeconds:145,
    policyFriendly:'baseline',policyHostile:'baseline',name:map.id,
   });
   const round={
    seed,swapSpawns,arenaId:map.id,time:result.time,
    reason:result.winReason,winner:result.win,progress:result.points,
    firstContactAt:result.firstContactAt,
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
 }
 const teamWins={friendly:0,hostile:0,draw:0};
 const sideWins={north:0,south:0,draw:0};
 const finishReasons={};
 for(const round of rows){
  teamWins[round.winner]??=0;
  teamWins[round.winner]++;
  if(round.winner==='friendly')
   sideWins[round.swapSpawns?'north':'south']++;
  else if(round.winner==='hostile')
   sideWins[round.swapSpawns?'south':'north']++;
  else sideWins.draw++;
  const reason=round.reason||'NO RESULT';
  finishReasons[reason]=(finishReasons[reason]||0)+1;
 }
 const summary={
  id:map.id,samples:rows.length,matchedSeedPairs:pairs,coverCount:geometry.coverCount,
  avgFirstContactSeconds:safeMean(rows,r=>r.firstContactAt??r.time),
  avgRouteErrors:safeMean(rows,r=>r.routeErrors),
  avgCaptures:safeMean(rows,r=>r.captureEvents),
  avgContestedSeconds:safeMean(rows,r=>r.contestedSeconds),
  avgKills:safeMean(rows,r=>r.kills),
  avgFriendlyScore:safeMean(rows,r=>r.progress.friendly),
  avgHostileScore:safeMean(rows,r=>r.progress.hostile),
  teamWins,sideWins,finishReasons,
 };
 results.push({summary,rows});
 console.log('CIRCUIT-BALANCE '+JSON.stringify(summary));
}
mkdirSync('study-results',{recursive:true});
writeFileSync('study-results/circuit-map-baseline.json',JSON.stringify({
 limitations:'Approximate combat rays, no player; win rates across a few fixed seeds are preliminary, not competitive balance proof',
 results
},null,2));
