#!/usr/bin/env node
/**
 * Side-swapped holdout: does the squad-level lane arrangement improve actual
 * Domination, or only a deliberately difficult obstacle course?
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBout} from './headlessDominationStudy.mjs';
import {ARRIVAL_POLICIES} from '../ai/squadPositioning.js';
const round=n=>Math.round(n*1000)/1000;
const avg=arr=>arr.length?round(arr.reduce((s,v)=>s+v,0)/arr.length):0;
const sum=(a,key)=>a.reduce((s,x)=>s+(Number(key(x))||0),0);
export function pairedDestinationStudy({
 policy='lanes',pairs=16,seed=88127,maxSeconds=150,accuracy=.7,
 roster=['yard','kestrel','hauler']
}={},progress=()=>{}){
 if(!ARRIVAL_POLICIES.includes(policy)||policy==='legacy')
  throw new RangeError('Invalid challenger '+policy);
 if(!Number.isInteger(pairs)||pairs<1||pairs>200||
    !Number.isInteger(seed)||seed<0||seed>4294967295)
  throw new RangeError('Bad seed/pair configuration');
 const results=[];
 for(let i=0;i<pairs;i++){
  const trialSeed=(seed+i*91427)>>>0;
  for(const swap of [false,true]){
   const preferredSide=swap?'hostile':'friendly';
   const legacySide=swap?'friendly':'hostile';
   const bout=runBout(trialSeed,{name:'squad-arrival-holdout',policy:'strict',
    arrivalFriendly:swap?'legacy':policy,
    arrivalHostile:swap?policy:'legacy',accuracy,maxSeconds,
    rosters:{friendly:roster,hostile:roster}});
   const result={seed:trialSeed,pair:i,swap,win:
    bout.win==='draw'?'draw':bout.win===preferredSide?policy:'legacy',
    reason:bout.winReason,seconds:bout.time,
    points:{legacy:bout.points[legacySide],[policy]:bout.points[preferredSide]},
    measures:Object.fromEntries([
      ['legacy',legacySide],[policy,preferredSide]].map(([name,side])=>{
       const a=bout.actors.filter(p=>p.team===side);
       return [name,{
        kills:sum(a,x=>x.kills),damage:round(sum(a,x=>x.damageDealt)),
        scoringTime:round(sum(a,x=>x.zoneSeconds)),
        collisions:sum(a,x=>x.collisionImpacts),
        stalls:round(sum(a,x=>x.stallSeconds)),
        routeErrors:sum(a,x=>x.routeErrors),
        trafficYields:sum(a,x=>x.trafficYields)
       }];
      }))};
   results.push(result);
   progress(results.length,pairs*2,result);
  }
 }
 const count=k=>results.filter(r=>r.win===k).length;
 const summ={bouts:results.length,seed,pairs,policy,wins:{
  legacy:count('legacy'),[policy]:count(policy),draw:count('draw')
 },winEquivalent:round((count(policy)+count('draw')*.5)/results.length),
  metrics:Object.fromEntries(['legacy',policy].map(key=>[
   key,Object.fromEntries(['points','scoringTime','collisions','stalls',
    'routeErrors','trafficYields'].map(metric=>[metric,avg(results.map(r=>
    metric==='points'?r.points[key]:r.measures[key][metric]))]))
  ]))};
 return {summary:summ,results,caveats:[
  'This is a physical headless battle with approximate weapon hits, not a browser-raycast replay.',
  'Win outcomes include objective scoring and elimination; keep both underlying results.',
  'Side-swapped paired samples reduce spawn bias, but small intervals remain inconclusive.',
  'No policies are promoted into live opponents by this research runner.']};
}
export function reportMarkdown(data){
 const s=data.summary,n=s.policy;
 const header=['# M3CH4 Squad Arrival — 3v3 Holdout','',
  s.bouts+' mirrored headless 3v3 matches, seed '+s.seed+'.',
  'Wins: original '+s.wins.legacy+', '+n+' '+s.wins[n]+
    ', draws '+s.wins.draw+'.','',
  '| Metric | Legacy | '+n+' |','|---|---:|---:|'];
 for(const key of Object.keys(s.metrics.legacy))
  header.push('| '+key+' | '+s.metrics.legacy[key]+' | '+s.metrics[n][key]+' |');
 return [...header,'','## Interpretation limits','',
  ...data.caveats.map(x=>'- '+x),''].join('\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const flags=Object.fromEntries(process.argv.slice(2).map(x=>{
   const m=/^--([\w-]+)=(.+)$/.exec(x);
   if(!m)throw new Error('Bad option '+x);
   return [m[1],m[2]];
  }));
  const res=pairedDestinationStudy({
   policy:flags.policy??'lanes',
   pairs:Number(flags.pairs??16),
   seed:Number(flags.seed??88127),
   maxSeconds:Number(flags.seconds??150),
   accuracy:Number(flags.accuracy??.7)
  },(done,total)=>{
   if(done===1||done===total||done%Math.max(1,Math.ceil(total/10))===0)
    console.log('SQUAD_3V3_PROGRESS '+done+'/'+total);
  });
  const out=flags.out??'study-results/squad-arrival-3v3';
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(res,null,2)+'\n');
  fs.writeFileSync(path.join(out,'report.md'),reportMarkdown(res));
  console.log('SQUAD_3V3_SUMMARY '+JSON.stringify(res.summary));
 }catch(e){console.error(e.stack??e);process.exitCode=1;}
}
