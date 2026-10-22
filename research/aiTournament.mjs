#!/usr/bin/env node
/**
 * M3CH4 AI TOURNAMENT -- research only, no production AI mutation.
 *
 * Examples:
 *   node research/aiTournament.mjs --quick
 *   node research/aiTournament.mjs --pairs=8 --seconds=180
 *   node research/aiTournament.mjs --entrants=baseline@rookie,baseline@club,baseline@pro,baseline@elite
 *   node research/aiTournament.mjs --accuracy=0,.45,.7 --roster=light --pairs=6
 *
 * One paired trial uses exactly the same seed with competitors' spawn sides
 * swapped. Full statistical claims require many pairs AND new holdout seeds.
 */
import fs from 'node:fs';
import path from 'node:path';
import {runBout} from './headlessDominationStudy.mjs';
import {getAiResearchProfile,getAiResearchDifficulty,
  listAiResearchProfiles,AI_RESEARCH_DIFFICULTIES} from '../ai/researchProfiles.js';
import {parseEntrant,gradeTeam,summarizeTournament,GRADE_WEIGHTS} from './aiTournamentCore.mjs';

const roster={
  balanced:['yard','kestrel','hauler'],
  yard:['yard','yard','yard'],
  light:['kestrel','kestrel','kestrel'],
  heavy:['hauler','hauler','hauler']
};
function parseArgs(argv){
  const flags={};
  for(const entry of argv){
    if(entry==='--quick'||entry==='--help'){flags[entry.slice(2)]=true;continue;}
    const match=/^--([\w-]+)=(.+)$/.exec(entry);
    if(!match)throw new Error('Invalid option '+entry+'; use --help');
    flags[match[1]]=match[2];
  }
  const quick=!!flags.quick;
  const candidates=flags.entrants?.split(',')??
    (quick?['baseline','blitz','fortress']:
      listAiResearchProfiles().map(p=>p.id))
      .map(name=>name+'@'+(flags.difficulty??'pro'));
  const entries=candidates.map(name=>parseEntrant(name,
    getAiResearchProfile,getAiResearchDifficulty));
  if(new Set(entries.map(e=>e.id)).size!==entries.length||entries.length<2||
      entries.length>12)
    throw new Error('Supply 2-12 unique entrants');
  const positive=(name,value,minimum,maximum)=>{
    const n=Number(value);
    if(!Number.isFinite(n)||n<minimum||n>maximum)
      throw new RangeError('Invalid '+name+': '+value);
    return n;
  };
  const pairs=positive('pairs',flags.pairs??(quick?1:2),1,1000);
  if(!Number.isInteger(pairs))throw new Error('pairs must be an integer');
  const seconds=positive('seconds',flags.seconds??(quick?20:150),2,600);
  const baseSeed=positive('seed',flags.seed??45811,0,4294967295);
  const rosterName=flags.roster??'balanced';
  if(!Object.hasOwn(roster,rosterName))throw new Error('Invalid roster '+rosterName);
  const capture=flags.capture??'strict';
  if(!['strict','superiority','pressure'].includes(capture))
    throw new Error('Invalid capture policy '+capture);
  const accuracy=(flags.accuracy??(quick?'.7':'.45,.7,.9')).split(',')
    .map(x=>positive('accuracy',x,0,1));
  const wear=positive('wear',flags.wear??0,0,.5);
  const output=flags.out??'study-results/ai-tournament';
  return {entries,pairs,seconds,baseSeed,rosterName,capture,accuracy,wear,output,quick};
}
export function buildSchedule(config){
  const rows=[];let matchup=0;
  for(let i=0;i<config.entries.length;i++)
    for(let j=i+1;j<config.entries.length;j++){
      const a=config.entries[i],b=config.entries[j];
      for(const accuracy of config.accuracy)
        for(let trial=0;trial<config.pairs;trial++){
          const seed=(config.baseSeed+matchup*390001+trial*37621)>>>0;
          rows.push({a,b,accuracy,trial,seed,swap:false,matchup});
          rows.push({a,b,accuracy,trial,seed,swap:true,matchup});
        }
      matchup++;
    }
  return rows;
}
export function tournament(config,{onProgress=null}={}){
  const schedule=buildSchedule(config),results=[],bouts=[];
  for(let i=0;i<schedule.length;i++){
    const task=schedule[i],friendly=task.swap?task.b:task.a;
    const hostile=task.swap?task.a:task.b;
    const settings={
      name:'ai-tournament',policy:config.capture,
      policyFriendly:friendly.strategy,policyHostile:hostile.strategy,
      difficultyFriendly:friendly.difficulty,difficultyHostile:hostile.difficulty,
      accuracy:task.accuracy,maxSeconds:config.seconds,
      backgroundWear:config.wear,
      rosters:{friendly:roster[config.rosterName],hostile:roster[config.rosterName]}
    };
    const bout=runBout(task.seed,settings);
    if(!['friendly','hostile','draw'].includes(bout.win))
      throw new Error('Unresolved bout result');
    const winner=bout.win==='draw'?'draw':bout.win==='friendly'?friendly.id:hostile.id;
    const record={seed:task.seed,matchup:task.matchup,trial:task.trial,
      accuracy:task.accuracy,swap:task.swap,
      a:task.a.id,b:task.b.id,
      sides:{friendly:friendly.id,hostile:hostile.id},winner,
      outcome:bout.winReason,time:bout.time,points:bout.points,
      grades:{friendly:gradeTeam(bout,'friendly'),hostile:gradeTeam(bout,'hostile')}};
    results.push(record);
    bouts.push(bout);
    onProgress?.(i+1,schedule.length,record);
  }
  const scores=summarizeTournament(config.entries,results);
  const decisiveBouts=results.filter(r=>r.winner!=='draw').length;
  return {meta:{createdAt:new Date().toISOString(),
    version:'k4v-policy-laboratory-1',commit:process.env.GITHUB_SHA??null,
    node:process.version,entries:config.entries,pairsPerMatchup:config.pairs,
    pairCount:results.length/2,boutCount:results.length,
    decisiveBouts,comparisonInconclusive:decisiveBouts===0,seed:config.baseSeed,
    maxSeconds:config.seconds,accuracies:config.accuracy,
    roster:config.rosterName,wear:config.wear,capturePolicy:config.capture,
    gradeWeights:GRADE_WEIGHTS,
    cautions:['No exact Three.js hitbox raycasts: exposed-target hits are approximated.',
      'Historical headless validation is approximate, not a complete browser runtime.',
      'Win intervals are approximate, not paired-bootstrap confidence intervals.',
      'Tournament scores are exploratory; never auto-promote a champion to live opponents.']},
    ...scores,results,bouts};
}
const round=(n,d=2)=>Number(n.toFixed(d));
function asCsv(report){
  const header=['seed','matchup','trial','accuracy','swap','friendly','hostile',
    'winner','reason','seconds','score_friendly','score_hostile',
    'grade_friendly','grade_hostile','stalls_friendly','stalls_hostile',
    'collisions_friendly','collisions_hostile','route_errors_friendly','route_errors_hostile'];
  const data=report.results.map(r=>[
    r.seed,r.matchup,r.trial,r.accuracy,r.swap,r.sides.friendly,r.sides.hostile,
    r.winner,r.outcome,round(r.time),r.points.friendly,r.points.hostile,
    r.grades.friendly.grade,r.grades.hostile.grade,
    round(r.grades.friendly.stats.stallSeconds),round(r.grades.hostile.stats.stallSeconds),
    r.grades.friendly.stats.collisions,r.grades.hostile.stats.collisions,
    r.grades.friendly.stats.routeErrors,r.grades.hostile.stats.routeErrors
  ].join(','));
  return [header.join(','),...data].join('\n')+'\n';
}
export function toMarkdown(report){
  const m=report.meta;
  const lines=['# M3CH4 AI Tournament', '',
    'Simulation version: '+m.version+'; '+m.boutCount+' bouts ('+m.pairCount+' mirrored seed pairs).',
    'Decisive bouts: '+(m.decisiveBouts??'not counted')+'.',
    'Capture: '+m.capturePolicy+'; roster: '+m.roster+'; '+m.maxSeconds+
      's maximum; hit sensitivity: '+m.accuracies.join(', ')+'.','',
    '## Experimental rankings','',
    '| Rank | Entrant | Wins / Draws / Losses | Win-equivalent | Approx. 95% | Quality / 100 | Mean stalls (s) | Route errors |',
    '|---:|---|---:|---:|---:|---:|---:|---:|'];
  if(m.comparisonInconclusive)lines.push('','**INCONCLUSIVE: all matches drew. Rankings below reflect only exploratory quality scores, not demonstrated competitive superiority.**','');
  report.ranking.forEach((r,i)=>lines.push(
    '| '+(i+1)+' | '+r.id+' | '+r.wins+' / '+r.draws+' / '+r.losses+
    ' | '+(100*r.winEquivalent).toFixed(1)+'% | '+
    (100*r.approximateWin95[0]).toFixed(1)+'–'+
    (100*r.approximateWin95[1]).toFixed(1)+'% | '+r.grade+
    ' | '+r.meanStallSeconds+' | '+r.meanRouteErrors+' |'));
  lines.push('','## Head-to-head','');
  for(const [name,p]of Object.entries(report.headToHead)){
    const left=p.entrants[0],right=p.entrants[1];
    lines.push('- '+name+': '+(p.wins[left]??0)+'–'+(p.wins[right]??0)+
      ' (draws '+p.draws+', '+p.bouts+' bouts)');
  }
  lines.push('','## Interpretation safeguards','',
    ...m.cautions.map(c=>'- '+c),'',
    '**Next gate:** verify finalists against holdout seeds, multiple accuracy cohorts, different rosters, and actual player-versus-AI matches.',
    '');
  return lines.join('\n');
}
function writeResults(report,out){
  fs.mkdirSync(out,{recursive:true});
  const reduced={...report,bouts:undefined};
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(reduced,null,2)+'\n');
  fs.writeFileSync(path.join(out,'bouts.json'),JSON.stringify(report.bouts)+'\n');
  fs.writeFileSync(path.join(out,'bouts.csv'),asCsv(report));
  fs.writeFileSync(path.join(out,'report.md'),toMarkdown(report));
}
function help(){
  console.log('Usage: node research/aiTournament.mjs [--quick] [--pairs=N] [--seconds=N]'+
    ' [--entrants=blitz@club,fortress@pro] [--difficulty=pro]'+
    ' [--accuracy=.45,.7,.9] [--roster=balanced|yard|light|heavy]'+
    ' [--wear=0] [--capture=strict|superiority|pressure]'+
    ' [--seed=N] [--out=study-results/ai-tournament]');
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
  try{
    if(process.argv.includes('--help'))help();
    else{
      const config=parseArgs(process.argv.slice(2));
      const schedule=buildSchedule(config);
      console.log('AI_TOURNAMENT_START '+JSON.stringify({bouts:schedule.length,
        entries:config.entries.map(e=>e.id),seconds:config.seconds,
        accuracies:config.accuracy}));
      const result=tournament(config,{onProgress:(done,total,record)=>{
        if(done%Math.max(1,Math.ceil(total/20))===0||done===1||done===total)
          console.log('PROGRESS '+done+'/'+total+' '+record.a+' vs '+record.b);
      }});
      writeResults(result,config.output);
      console.log('AI_TOURNAMENT_RANKING '+JSON.stringify(result.ranking));
      console.log('Report: '+path.join(config.output,'report.md'));
    }
  }catch(error){
    console.error(error?.stack??error);
    process.exitCode=1;
  }
}
