#!/usr/bin/env node
/**
 * M3CH4 k4w.6: actual six authored objectives against progressively armed
 * encounter rigs. 3v3 AI-vs-AI research proxy: uses game locomotion, pilot/
 * squad AI, mounted real catalogue and damage, power bus and objective rules.
 *
 * LIMITATIONS: 3D mesh first-hit/penetration and precise explosion cover are
 * approximated. This is not a browser playthrough or deterministic human win rate.
 * Mirrored side swaps expose spawn and role asymmetries; the non-swapped cohort
 * represents the real friendly player/hostile campaign objective assignments.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CONTRACTS,contractById} from '../contracts.js';
import {hostileSupportRecipes} from '../squadBattle.js';
import {encounterWingArms,fitEncounterWeapon,weaponDoctrine} from '../campaignArsenal.js';
import {makeRangeTarget} from '../combat.js';
import {makeStarterAssembly} from '../acquisition.js';
import {SLOTS,installedPart,equip,inspectAssembly} from '../components.js';
import {runBout} from './headlessDominationStudy.mjs';
import {winConfidence} from './rosterCompetitiveStudy.mjs';
import {simulateCampaign,CASES} from './campaignEconomyStudy.mjs';

const MOBILITY_PILOT=Object.freeze({'legs-yard':'yard','legs-compact':'kestrel','legs-hauler':'hauler'});
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*100)/100:0;
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2;};
const pct=(n,d)=>d?Math.round(n/d*1000)/10:0;
const sum=(a,key)=>a.reduce((n,x)=>n+(Number(key(x))||0),0);

function rigProfile(assembly,name,behavior=null){
 const inspection=inspectAssembly(assembly);
 if(!inspection.ready)throw Error('Invalid mounted rig '+name+': '+
   inspection.checks.filter(x=>!x.passes).map(x=>x.reason).join('; '));
 const recipe=Object.fromEntries(SLOTS.map(slot=>[slot,installedPart(assembly,slot).definition.id]));
 return {name,pilot:MOBILITY_PILOT[recipe.mobility],recipe,
   ...(behavior?{behavior}:{} )};
}
export function enemyRoster(contractId){
 const c=contractById(contractId);
 const families=[contractId,...hostileSupportRecipes(contractId)];
 const weapons=[c.loadout.combat,...encounterWingArms(contractId)];
 if(families.length!==weapons.length||weapons.length>3)throw Error('Bad authored enemy squad '+contractId);
 return families.map((family,i)=>{
   const a=makeRangeTarget(family);
   fitEncounterWeapon(a,weapons[i]);
   const base=i===0?c.behavior:contractById(family).behavior;
   return rigProfile(a,c.name+' '+(i===0?'LEAD':'WING '+i),
     weaponDoctrine(base,weapons[i]));
 });
}
const PLAYER_LOADOUTS=Object.freeze({
 'starter-loaners':Object.freeze(['gun-cannon','gun-light','gun-short']),
 'rivet-upgrade':Object.freeze(['gun-rivet','gun-light','gun-short']),
 'specialist-fleet':Object.freeze(['gun-rocket','gun-rivet','gun-breaker']),
});
export function friendlyRoster(profile){
 const arms=PLAYER_LOADOUTS[profile];
 if(!arms)throw Error('Unknown progression profile '+profile);
 return ['yard-dog','cutter','mule'].map((family,i)=>{
   const a=i===0&&profile==='starter-loaners'?makeStarterAssembly():makeRangeTarget(family);
   fitEncounterWeapon(a,arms[i]);
   return rigProfile(a,(i===0?'PILOT':'ALLY '+i)+' '+profile,
     weaponDoctrine(contractById(family).behavior,arms[i]));
 });
}
function friendlyStats(bout,team){
 const members=bout.actors.filter(a=>a.team===team);
 return {survivors:members.filter(a=>a.alive).length,
   damageTaken:sum(members,x=>x.damageTaken),damageDealt:sum(members,x=>x.damageDealt),
   actualShots:sum(members,x=>x.actualShots),
   projectileHits:sum(members,x=>x.projectilesHit),
   brownoutFrames:sum(members,x=>x.brownoutFrames),
   routeErrors:sum(members,x=>x.routeErrors),
   serviceCount:sum(members,x=>x.serviceCount),
   meanIntegrity:avg(members.map(x=>x.integrity)),
   meanArmor:avg(members.map(x=>x.armor))};
}
export function runAiCampaignBalance({
 pairs=3,seconds=135,accuracy=.7,seed=260622,economySeeds=24,
 contracts=CONTRACTS.map(x=>x.id),profiles=Object.keys(PLAYER_LOADOUTS),
}={},progress=()=>{}){
 if(!Number.isInteger(pairs)||pairs<1||pairs>40)throw Error('pairs 1-40');
 if(!Number.isInteger(economySeeds)||economySeeds<0||economySeeds>120)throw Error('economySeeds 0-120');
 const rows=[],analysis=[],economy=[];
 const total=contracts.length*profiles.length*pairs*2;
 for(const contractId of contracts){
  const enemies=enemyRoster(contractId);
  for(const profile of profiles){
   const friends=friendlyRoster(profile);
   const subset=[];
   for(let pair=0;pair<pairs;pair++){
    const trialSeed=seed+pair*9719+contracts.indexOf(contractId)*104729+
      profiles.indexOf(profile)*16127;
    for(const swapped of [false,true]){
     const playerSide=swapped?'hostile':'friendly';
     const bout=runBout(trialSeed,{
      contractId,name:contractId+' / '+profile,
      physicalEquipment:true,accuracy,maxSeconds:seconds,policy:'strict',
      rosters:{friendly:swapped?enemies:friends,hostile:swapped?friends:enemies},
     });
     const win=bout.win==='draw'?'draw':bout.win===playerSide?'player':'contract';
     const stats=friendlyStats(bout,playerSide);
     const row={contractId,objective:bout.objectiveType,profile,pair,swapped,
      seed:trialSeed,winner:win,reason:bout.winReason,time:bout.time,
      scorePlayer:bout.points[playerSide],
      scoreHostile:bout.points[playerSide==='friendly'?'hostile':'friendly'],
      ...stats};
     rows.push(row);subset.push(row);
     progress(rows.length,total,row);
    }
   }
   const playerWins=subset.filter(r=>r.winner==='player').length;
   const enemyWins=subset.filter(r=>r.winner==='contract').length;
   const draws=subset.length-playerWins-enemyWins;
   const actualSide=subset.filter(r=>!r.swapped);
   const clear=actualSide.filter(r=>r.winner==='player').length;
   const timeouts=subset.filter(r=>r.reason==='TIME LIMIT').length;
   analysis.push({contractId,profile,bouts:subset.length,
    playerWins,contractWins:enemyWins,draws,
    sideSwappedPlayerWins:subset.filter(r=>r.swapped&&r.winner==='player').length,
    realSideWins:clear,realSideGames:actualSide.length,
    realSideWinPct:pct(clear,actualSide.length),
    mirroredWinPct:pct(playerWins+draws*.5,subset.length),
    win95:winConfidence(playerWins,draws,subset.length),
    medianSeconds:Math.round(median(subset.map(r=>r.time))*10)/10,
    timeouts,timeoutPct:pct(timeouts,subset.length),
    meanShots:avg(subset.map(r=>r.actualShots)),
    meanDamageTaken:avg(subset.map(r=>r.damageTaken)),
    meanDamageDealt:avg(subset.map(r=>r.damageDealt)),
    meanSurvivors:avg(subset.map(r=>r.survivors)),
    meanIntegrity:avg(subset.map(r=>r.meanIntegrity)),
    meanArmor:avg(subset.map(r=>r.meanArmor)),
    meanBrownoutFrames:avg(subset.map(r=>r.brownoutFrames)),
    meanRouteErrors:avg(subset.map(r=>r.routeErrors)),
    meanService:avg(subset.map(r=>r.serviceCount)),
   });
   progress(rows.length,total,{contractId,profile,summary:analysis.at(-1)});
  }
 }
 if(economySeeds>0){
  for(const profile of profiles){
   const byId=Object.fromEntries(analysis.filter(r=>r.profile===profile).map(r=>
    // Laplace prior makes small samples uncertain, not fake 0/100 certainty.
    [r.contractId,(r.realSideWins+1)/(r.realSideGames+2)]));
   for(const [caseId,base] of Object.entries({
    'scarce-salvage':CASES['middle-scrap-limited'],
    'generous-salvage':CASES['middle-scrap-often'],
   })){
    const trials=[];
    for(let i=0;i<economySeeds;i++)
     trials.push(simulateCampaign({seed:88171+i*7331,
       contracts:24,assumptions:{...base,winProbabilityByContract:byId}}));
    economy.push({profile,caseId,simulatedSeries:trials.length,
     estimatedRoundWinRates:byId,
     pctCompletedCampaign:pct(trials.filter(t=>t.requiredClears===4).length,trials.length),
     pctAchievedTwoRigs:pct(trials.filter(t=>t.firstTwo!=null).length,trials.length),
     pctAchievedThreeRigs:pct(trials.filter(t=>t.firstThree!=null).length,trials.length),
     medianToTwo:median(trials.filter(t=>t.firstTwo!=null).map(t=>t.firstTwo)),
     medianToThree:median(trials.filter(t=>t.firstThree!=null).map(t=>t.firstThree)),
     meanCash:avg(trials.map(t=>t.credits)),meanClaims:avg(trials.map(t=>t.salvages)),
     meanPurchases:avg(trials.map(t=>t.purchases)),
     meanRepairPaid:avg(trials.map(t=>t.repairPaid)),
     pctStranded:pct(trials.filter(t=>t.fieldableFailures>0).length,trials.length)});
   }
  }
 }
 return {meta:{pairs,seconds,accuracy,seed,economySeeds,contractCount:contracts.length,
    noRenderer:true,sideMirroring:true,
    battleModel:'shared 60Hz locomotion/AI/objectives/armor/weapon cadence/power with approximate mesh contacts, charged trigger, rocket flight and thermal contact',
    economyModel:'Monte Carlo BO3, real catalogue/cost and clearance-gated counter stock; probabilistic win/damage/salvage assumptions; NOT an integrated playthrough',
    caveats:['Rocket blast uses 2D visibility rather than the exact Three.js first-mesh or cover faces.',
      'Breaker armor penetration and impact shielding need browser-backed validation.',
      'AI-only pilot profile is not human-input performance.',
      'Different objectives are asymmetric; compare unswapped results first.',
      'Small cohorts produce wide confidence intervals and uncertain prices/acquisition timelines.']},
   contracts:Object.fromEntries(contracts.map(id=>[id,{
     lead:contractById(id).loadout.combat,
     wings:encounterWingArms(id),objective:contractById(id).objective.type}])),
   analysis,economy,rows};
}
export function markdownReport(result){
 const h=['# M3CH4 k4w.6 — Campaign AI Balance Proxy','',
  'Real authored contract objectives, three physical friendly and hostile rig recipes, mirrored seeded AI fights.',
  'Contact geometry is a proxy; these are **not** verified human win rates.','',
  '| Contract | Friendly roster | Bouts | Real-side wins | Mirrored player win% | 95% CI | Median sec | Timeouts | Avg player damage |',
  '|---|---|---:|---:|---:|---|---:|---:|---:|'];
 for(const r of result.analysis)h.push('| '+[
  r.contractId,r.profile,r.bouts,r.realSideWins+'/'+r.realSideGames,
  r.mirroredWinPct,r.win95.low+'–'+r.win95.high,
  r.medianSeconds,r.timeouts,r.meanDamageTaken].join(' | ')+' |');
 h.push('','## Economy sensitivity','',
 '| Roster | Salvage | 24-contract full clear% | 2 rigs% | 3 rigs% | Mean claims | Mean cash | Mean repairs |',
 '|---|---|---:|---:|---:|---:|---:|---:|');
 for(const e of result.economy)h.push('| '+[
   e.profile,e.caseId,e.pctCompletedCampaign,e.pctAchievedTwoRigs,
   e.pctAchievedThreeRigs,e.meanClaims,e.meanCash,e.meanRepairPaid].join(' | ')+' |');
 h.push('','## Model boundaries','',...result.meta.caveats.map(s=>'- '+s),'',
  'Economy projection uses smoothed per-contract **observed AI-proxy** round win rates',
  'plus explicit claim/damage assumptions; does not pretend to replay every salvaged serial.',
  'Do not tune weapon damages from this proxy alone.','');
 return h.join('\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=(k,d)=>process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3)??d;
 const opts={pairs:Number(arg('pairs',3)),seconds:Number(arg('seconds',135)),
  accuracy:Number(arg('accuracy',.7)),economySeeds:Number(arg('economy-seeds',24)),
  seed:Number(arg('seed',260622))};
 const out=arg('out','study-results/k4w6-ai-campaign');
 const result=runAiCampaignBalance(opts,(done,total,r)=>{
   if(done>0&&(done===1||done%Math.max(1,Math.floor(total/12))===0||done===total))
    console.log('CAMPAIGN_PROGRESS '+done+'/'+total+' '+JSON.stringify({contract:r.contractId,profile:r.profile}));
 });
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'bouts.json'),JSON.stringify(result.rows)+'\n');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,rows:undefined},null,2)+'\n');
 fs.writeFileSync(path.join(out,'report.md'),markdownReport(result)+'\n');
 console.log('CAMPAIGN_SUMMARY '+JSON.stringify({meta:result.meta,analysis:result.analysis,economy:result.economy}));
}
