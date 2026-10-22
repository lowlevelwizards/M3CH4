#!/usr/bin/env node
/**
 * Paired, side-swapped physical 3v3 comparison for the k4v.2 traffic policies.
 * The trial uses identical seeded rosters, shot-accuracy cohorts and rules.
 * Traffic policy may affect route/hold decisions only: no stat bonuses.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBout} from './headlessDominationStudy.mjs';
import {TRAFFIC_POLICIES} from '../ai/trafficCoordination.js';
const round=(n)=>Math.round(n*1000)/1000;
const avg=arr=>arr.length?round(arr.reduce((s,x)=>s+x,0)/arr.length):0;
const sum=(a,key)=>a.reduce((s,x)=>s+(Number(key(x))||0),0);
function options(args){
 const flags={};
 for(const arg of args){
  const match=/^--([\w-]+)=(.+)$/.exec(arg);
  if(!match)throw new Error('Invalid option '+arg);
  flags[match[1]]=match[2];
 }
 const challenger=flags.challenger??'hybrid';
 if(!TRAFFIC_POLICIES.includes(challenger)||challenger==='legacy')
  throw new RangeError('Invalid challenger '+challenger);
 const pairs=Number(flags.pairs??8);
 const seconds=Number(flags.seconds??150);
 const seed=Number(flags.seed??77001);
 if(!Number.isInteger(pairs)||pairs<1||pairs>150||
    !Number.isFinite(seconds)||seconds<2||seconds>600||
    !Number.isInteger(seed)||seed<0||seed>4294967295)
  throw new RangeError('Invalid match size / duration / seed');
 return {challenger,pairs,seconds,seed,accuracy:Number(flags.accuracy??.7),
  out:flags.out??'study-results/traffic-domination'};
}
export function runComparison(config,{onProgress=null}={}){
 const challenger=config.challenger??'hybrid';
 if(!TRAFFIC_POLICIES.includes(challenger)||challenger==='legacy')
  throw new RangeError('Invalid challenger');
 const results=[];
 for(let i=0;i<config.pairs;i++){
  const seed=(config.seed+i*93427)>>>0;
  for(const swapped of [false,true]){
   const side=swapped?'hostile':'friendly';
   const challengerSide=swapped?'friendly':'hostile';
   const bout=runBout(seed,{name:'traffic-comparison',
    policy:'strict',accuracy:config.accuracy??.7,maxSeconds:config.seconds,
    trafficFriendly:swapped?challenger:'legacy',
    trafficHostile:swapped?'legacy':challenger});
   const row={seed,pair:i,swapped,
    winner:bout.win==='draw'?'draw':bout.win===challengerSide?
      challenger:'legacy',
    winReason:bout.winReason,time:bout.time,
    points:{legacy:bout.points[side],challenger:bout.points[challengerSide]},
    stats:Object.fromEntries([['legacy',side],[challenger,challengerSide]].map(
      ([id,team])=>{
        const rigs=bout.actors.filter(a=>a.team===team);
        return [id,{
          zoneSeconds:round(sum(rigs,a=>a.zoneSeconds)),
          damage:round(sum(rigs,a=>a.damageDealt)),
          kills:sum(rigs,a=>a.kills),
          collisions:sum(rigs,a=>a.collisionImpacts),
          routeErrors:sum(rigs,a=>a.routeErrors),
          trafficYields:sum(rigs,a=>a.trafficYields),
          trafficQueueSeconds:round(sum(rigs,a=>a.trafficQueueSeconds))
        }];
      }))};
   results.push(row);onProgress?.(results.length,config.pairs*2,row);
  }
 }
 const count=results.length;
 const wins=key=>results.filter(r=>r.winner===key).length;
 const output={
  config:{...config,challenger,runCount:count,
   cautions:['Research approximate ballistics; no exact Three.js raycasts.',
    'Small-sample side-swapped results are exploratory, not proof of superiority.',
    'Do not promote a traffic policy without holding a physical Olympics margin.']},
  summary:{wins:{legacy:wins('legacy'),[challenger]:wins(challenger),
     draw:wins('draw')},
   challengerWinEquivalent:round((wins(challenger)+wins('draw')*.5)/count),
   metrics:Object.fromEntries(['legacy',challenger].map(key=>[
    key,{meanScore:avg(results.map(r=>r.points[key])),
     meanZoneSeconds:avg(results.map(r=>r.stats[key].zoneSeconds)),
     meanCollisions:avg(results.map(r=>r.stats[key].collisions)),
     meanRouteErrors:avg(results.map(r=>r.stats[key].routeErrors)),
     meanQueueSeconds:avg(results.map(r=>r.stats[key].trafficQueueSeconds))
    }]))},
  results
 };
 return output;
}
export function toMarkdown(report){
 const r=report.summary,c=report.config.challenger;
 return [
  '# Traffic-policy 3v3 Domination holdout','',
  report.config.runCount+' headless 3v3 bouts / '+
    report.config.pairs+' mirrored seed pairs. Seed '+report.config.seed+
    ', maximum '+report.config.seconds+'s.', '',
  'Win results: legacy '+r.wins.legacy+', '+c+' '+r.wins[c]+
    ', draws '+r.wins.draw+'.','',
  '| Metric | Legacy | '+c+' |','|---|---:|---:|',
  ...Object.keys(r.metrics.legacy).map(k=>
    '| '+k+' | '+r.metrics.legacy[k]+' | '+r.metrics[c][k]+' |'),
  '','## Caveats','',
  ...report.config.cautions.map(x=>'- '+x),
  '','Raw side-swapped records are in results.json.',''
 ].join('\n');
}
function main(){
 const opt=options(process.argv.slice(2));
 const result=runComparison(opt,{onProgress:(n,total,r)=>{
  if(n===1||n===total||n%Math.max(1,Math.ceil(total/8))===0)
   console.log('TRAFFIC_3V3_PROGRESS '+n+'/'+total+
    ' winner='+r.winner+' seed='+r.seed);
 }});
 fs.mkdirSync(opt.out,{recursive:true});
 fs.writeFileSync(path.join(opt.out,'results.json'),JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(opt.out,'report.md'),toMarkdown(result));
 console.log('TRAFFIC_3V3_SUMMARY '+JSON.stringify(result.summary));
 console.log('Report '+opt.out+'/report.md');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){console.error(e.stack??e);process.exitCode=1;}
}
