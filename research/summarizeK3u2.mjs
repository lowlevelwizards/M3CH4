/** Compact post-hoc analysis for the versioned 3v3 benchmark.
 * Pairing uses the same seed with the experimental roster / wear swapped
 * between sides; raw friendly/hostile win totals are NOT balance metrics.
 */
import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync('study-results/domination-bouts.json','utf8'));
const groups={};
for(const row of rows)(groups[row.scenario]??=[]).push(row);
const mean=(xs,fn)=>xs.length?xs.reduce((a,b)=>a+fn(b),0)/xs.length:null;
const total=rs=>rs.reduce((sum,row)=>sum+row.actors.reduce((a,b)=>a+b.routeErrors,0),0);
const paired={};
for(const [name,rs]of Object.entries(groups)){
 const asym=/^(worn-|light-vs-balanced|heavy-vs-balanced)/.test(name);
 const out={n:rs.length,friendly:0,hostile:0,draw:0,
    meanTime:mean(rs,r=>r.time),
    meanCaptures:mean(rs,r=>r.captureEvents),
    meanRecaptures:mean(rs,r=>r.recaptureEvents),
    meanRouteFailures:total(rs)/rs.length,
    meanKills:mean(rs,r=>r.kills),
    meanScoring:mean(rs,r=>r.totalScoringSeconds),
    meanContested:mean(rs,r=>r.contestedSeconds)};
 for(const row of rs)out[row.win]++;
 if(asym){
   out.variantWins=0;out.controlWins=0;out.pairs={bothVariant:0,bothControl:0,split:0,draw:0};
   for(let i=0;i<rs.length;i++){
     const side=i%2===0?'hostile':'friendly',row=rs[i];
     if(row.win==='draw')continue;
     if(row.win===side)out.variantWins++;
     else out.controlWins++;
   }
   for(let i=0;i+1<rs.length;i+=2){
     const left=rs[i],right=rs[i+1];
     if(left.win==='draw'||right.win==='draw'){out.pairs.draw++;continue;}
     const v0=left.win==='hostile',v1=right.win==='friendly';
     if(v0&&v1)out.pairs.bothVariant++;
     else if(!v0&&!v1)out.pairs.bothControl++;
     else out.pairs.split++;
   }
 }
 paired[name]=out;
}
const report={baseline:'PR #42 vs k.3u.2 simulation, browser raycast approximated',
    matches:rows.length,paired,routeFailuresTotal:total(rows)};
fs.writeFileSync('study-results/k3u2-paired-analysis.json',JSON.stringify(report,null,2));
fs.writeFileSync('study-results/k3u2-cohort-summary.csv',[
 'cohort,n,friendlyWins,hostileWins,draws,variantWins,controlWins,meanTime,meanCaptures,meanRecaptures,meanRouteFailures,meanContested',
 ...Object.entries(paired).map(([k,p])=>[k,p.n,p.friendly,p.hostile,p.draw,p.variantWins??'',p.controlWins??'',
 p.meanTime.toFixed(2),p.meanCaptures.toFixed(2),p.meanRecaptures.toFixed(2),
 p.meanRouteFailures.toFixed(2),p.meanContested.toFixed(2)].join(','))
].join('\n'));
console.log('PAIRED_K3U2 '+JSON.stringify(report));
