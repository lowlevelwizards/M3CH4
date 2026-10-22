#!/usr/bin/env node
/** Side-swapped 3v3: opt-in corridor capacity vs unchanged gameplay. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBout} from './headlessDominationStudy.mjs';
import {CORRIDOR_POLICIES} from '../ai/corridorCoordinator.js';
const mean=xs=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*1000)/1000:0;
const sum=(xs,key)=>xs.reduce((a,x)=>a+(Number(x[key])||0),0);
export function compareCorridors({
  policy='stagger',pairs=12,seed=91841,seconds=150,accuracy=.7
}={}){
  if(!CORRIDOR_POLICIES.includes(policy)||policy==='legacy')
    throw new RangeError('Invalid research corridor policy');
  if(!Number.isInteger(pairs)||pairs<1||pairs>100||!Number.isInteger(seed)||
    seed<0||seed>4294967295)throw new RangeError('Invalid seed/pairs');
  const results=[];
  for(let pair=0;pair<pairs;pair++){
    const trialSeed=(seed+76249*pair)>>>0;
    for(const flip of [false,true]){
      const candidate=flip?'hostile':'friendly',base=flip?'friendly':'hostile';
      const match=runBout(trialSeed,{name:'corridor-3v3',
        policy:'strict',accuracy,maxSeconds:seconds,
        corridorFriendly:flip?'legacy':policy,
        corridorHostile:flip?policy:'legacy'});
      const winner=match.win==='draw'?'draw':match.win===candidate?policy:'legacy';
      const stats=team=>{
        const rigs=match.actors.filter(a=>a.team===team);
        return {points:match.points[team],
          collisions:sum(rigs,'collisionImpacts'),
          routeErrors:sum(rigs,'routeErrors'),
          trafficYield:sum(rigs,'trafficYields'),
          corridorWait:sum(rigs,'corridorWaitSeconds'),
          scoreTime:sum(rigs,'zoneSeconds')};
      };
      results.push({seed:trialSeed,pair,flip,winner,winReason:match.winReason,
        seconds:match.time,legacy:stats(base),candidate:stats(candidate)});
    }
  }
  const wins=k=>results.filter(r=>r.winner===k).length;
  const fields=['points','collisions','routeErrors','trafficYield','corridorWait','scoreTime'];
  const aggregates=Object.fromEntries(['legacy','candidate'].map(k=>[
    k,Object.fromEntries(fields.map(f=>[f,mean(results.map(r=>r[k][f]))]))
  ]));
  return {meta:{policy,pairs,seed,seconds,accuracy,n:results.length,
    caveat:'Headless simulated targeting; not exact browser collision/weapon raycasts.'},
    summary:{wins:{legacy:wins('legacy'),[policy]:wins(policy),draws:wins('draw')},
      candidateWinEquivalent:(wins(policy)+wins('draw')*.5)/results.length,
      aggregates},results};
}
export function markdown(report){
  const {meta,summary}=report;
  return ['# Cross-objective corridor — 3v3 holdout','',
    meta.n+' bouts ('+meta.pairs+' mirrored pairs). Seed '+meta.seed+'.',
    'Wins: legacy '+summary.wins.legacy+', '+meta.policy+' '+
      summary.wins[meta.policy]+', draws '+summary.wins.draws+'.','',
    '| Measure | Legacy | '+meta.policy+' |',
    '|---|---:|---:|',
    ...Object.keys(summary.aggregates.legacy).map(k=>
      '| '+k+' | '+summary.aggregates.legacy[k]+' | '+
      summary.aggregates.candidate[k]+' |'),
    '','No strategy is promoted automatically. '+meta.caveat,''].join('\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=Object.fromEntries(process.argv.slice(2).map(v=>{
      const match=/^--([\w-]+)=(.+)$/.exec(v);
      if(!match)throw new Error('Bad option '+v);
      return [match[1],match[2]];
    }));
    const report=compareCorridors({policy:args.policy??'stagger',
      pairs:Number(args.pairs??12),seed:Number(args.seed??91841),
      seconds:Number(args.seconds??150)});
    const out=args.out??'study-results/corridor-3v3';
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2)+'\n');
    fs.writeFileSync(out+'/report.md',markdown(report));
    console.log('CORRIDOR_3V3_SUMMARY '+JSON.stringify(report.summary));
  }catch(e){console.error(e.stack??e);process.exitCode=1;}
}
