import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync('study-results/domination-bouts.json','utf8'));
const groups={};for(const r of rows)(groups[r.scenario]??=[]).push(r);
const variantSide=i=>i%2?'friendly':'hostile';
const report={};
for(const name of ['worn-vs-fresh','light-vs-balanced','heavy-vs-balanced']){
 const samples=groups[name];
 let outcomes={variant:0,control:0,draw:0,variantFriendly:0,variantHostile:0};
 let pairs={bothVariantWin:0,bothControlWin:0,split:0,atLeastOneDraw:0};
 for(let i=0;i<samples.length;i++){
  const row=samples[i],side=variantSide(i);
  outcomes[row.win==='draw'?'draw':row.win===side?'variant':'control']++;
  if(row.win===side)outcomes[side==='friendly'?'variantFriendly':'variantHostile']++;
 }
 for(let i=0;i<samples.length;i+=2){
  const r=samples.slice(i,i+2);
  const scores=r.map((row,j)=>row.win==='draw'?0:row.win===variantSide(i+j)?1:-1);
  if(scores.includes(0))pairs.atLeastOneDraw++;
  else if(scores[0]===1&&scores[1]===1)pairs.bothVariantWin++;
  else if(scores[0]===-1&&scores[1]===-1)pairs.bothControlWin++;
  else pairs.split++;
 }
 report[name]={n:samples.length,pairs:samples.length/2,outcomes,pairs};
}
const mirror=groups['mirror-mid-hit'];
const teams={friendly:{wins:0,draw:0},hostile:{wins:0,draw:0}};
for(const r of mirror){if(r.win==='draw'){teams.friendly.draw++;teams.hostile.draw++;}else teams[r.win].wins++;}
const firstDeath=rows.filter(r=>r.scenario!=='territory-no-damage').map(r=>r.firstKillAt).filter(x=>x!==null).sort((a,b)=>a-b);
const arm=rows.filter(r=>r.scenario!=='territory-no-damage');
const counts={
 armedGames:arm.length,
 armedTerritoryWins:arm.filter(r=>r.winReason==='SCORE').length,
 armedDraws:arm.filter(r=>r.win==='draw').length,
 armedContestedHalf:arm.filter(r=>r.contestedSeconds>r.time/2).length,
 armedFirstKillMedian:firstDeath[Math.floor(firstDeath.length/2)],
 armedNoMajorityHalf:arm.filter(r=>r.noMajoritySeconds>r.time/2).length,
 armedRecaptureAny:arm.filter(r=>r.recaptureEvents>0).length,
 armedLeadChangeAny:arm.filter(r=>r.scoreLeadChanges>0).length,
 exactMeanKills:arm.reduce((s,r)=>s+r.kills,0)/arm.length,
 mayRunOutOfAmmo:arm.filter(r=>r.actors.some(a=>a.actualShots>50)).length,
 armedRouteFailures:arm.reduce((s,r)=>s+r.actors.reduce((n,a)=>n+a.routeErrors,0),0)/arm.length,
};
const all={comparisons:report,mirrorMid:teams,counts,
 examples:arm.filter(r=>r.recaptureEvents>=4).slice(0,3).map(x=>({
  scenario:x.scenario,seed:x.seed,win:x.win,duration:x.time,recaptures:x.recaptureEvents,score:x.points
 }))};
console.log('COMPARISON_SUMMARY '+JSON.stringify(all));
