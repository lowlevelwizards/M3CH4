/** Real early-circuit objective modes on their assigned physical arenas.
 * Side-swapped symmetric hardware deliberately isolates the arena and objective
 * from campaign gear advantages. This is an AI proxy, not human difficulty QA.
 */
import {runBout} from './headlessDominationStudy.mjs';
import {CONTRACTS} from '../contracts.js';
import {mapForContract} from '../maps/mapRegistry.js';
import {mkdirSync,writeFileSync} from 'node:fs';

const pairs=Math.max(1,Math.min(10,Number(process.argv[2]||4)));
const mean=(rows,fn)=>rows.reduce((total,row)=>total+(fn(row)||0),0)/Math.max(1,rows.length);
const scenarios=[];
for(const contract of CONTRACTS){
 const arena=mapForContract(contract);
 const rows=[];
 for(let i=0;i<pairs;i++){
  for(const swapSpawns of [false,true]){
   const bout=runBout(92017+i*40321,{
    contractId:contract.id,mapId:arena.id,swapSpawns,
    policy:'strict',accuracy:.65,variantTeam:'none',
    policyFriendly:'baseline',policyHostile:'baseline',
    maxSeconds:150,name:'contract-map-'+contract.id,
   });
   const routeErrors=bout.actors.reduce((sum,a)=>sum+(a.routeErrors||0),0);
   if(!Number.isFinite(bout.time)||!Number.isFinite(routeErrors))
    throw Error('Non-finite physical contract study '+contract.id);
   rows.push({seed:i,swapSpawns,winner:bout.win,reason:bout.winReason,
    time:bout.time,firstContactAt:bout.firstContactAt,
    kills:bout.kills,routeErrors,points:bout.points});
  }
 }
 const northWins=rows.filter(r=>(r.winner==='friendly'&&r.swapSpawns)||
    (r.winner==='hostile'&&!r.swapSpawns)).length;
 const southWins=rows.filter(r=>(r.winner==='friendly'&&!r.swapSpawns)||
    (r.winner==='hostile'&&r.swapSpawns)).length;
 const summary={
  contract:contract.id,map:arena.id,objective:contract.objective.type,
  samples:rows.length,seedPairs:pairs,northWins,southWins,
  draws:rows.length-northWins-southWins,
  avgSeconds:mean(rows,r=>r.time),
  avgFirstContact:mean(rows,r=>r.firstContactAt??r.time),
  avgKills:mean(rows,r=>r.kills),
  avgRouteErrors:mean(rows,r=>r.routeErrors),
  finishReasons:rows.reduce((counts,r)=>{
   counts[r.reason]=(counts[r.reason]||0)+1;return counts;
  },{}),
 };
 scenarios.push({summary,rows});
 console.log('CIRCUIT-CONTRACT '+JSON.stringify(summary));
}
mkdirSync('study-results',{recursive:true});
writeFileSync('study-results/circuit-contract-cohort.json',JSON.stringify({
 limitations:'Side-swapped symmetric AI hardware with approximate mesh hits; this does not simulate player skill, real campaign gear differences or intermission repairs.',
 scenarios
},null,2));
