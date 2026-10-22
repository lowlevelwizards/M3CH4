/** k4v.9 read-only balance/economy laboratory.
 * Live catalogue/assembly constraints, real repair/market math, and mirrored
 * tactical headless proxy. No changes to actual rules or owned machinery.
 * node research/loadoutEconomyStudy.mjs --pairs=4 --seconds=110
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runRosterBalanceAudit,recipeKey} from './rosterBalanceAudit.mjs';
import {runBout} from './headlessDominationStudy.mjs';
import {CATALOG,SLOTS,makeTestAssembly,equip} from '../components.js';
import {basePartValue,partCreditValue} from '../partEconomy.js';
import {generateCounterStock} from '../usedPartsCounter.js';
import {createTargetCondition,TARGET_RESILIENCE,WEAPONS} from '../combat.js';
import {totalRepairQuote,repairQuote,STARTING_CREDITS,RECOVERY_PAYOUT,AMMO_COST_PER_ROUND} from '../economy.js';
import {CONTRACTS} from '../contracts.js';

const round=(n,d=2)=>Math.round(n*10**d)/10**d;
const avg=arr=>arr.length?round(arr.reduce((s,x)=>s+x,0)/arr.length):null;
const median=arr=>{if(!arr.length)return null;const a=[...arr].sort((x,y)=>x-y);return round((a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2)};
const names={workhorse:['frame-sr','legs-yard','power-dynamo','cab-cyclops','gun-cannon'],
  precision:['frame-utility','legs-compact','power-air','cab-utility','gun-light'],
  raider:['frame-utility','legs-compact','power-air','cab-utility','gun-scatter'],
  anchor:['frame-wedge','legs-hauler','power-dynamo','cab-cyclops','gun-short'],
  protected:['frame-sr','legs-hauler','power-dynamo','cab-armored','gun-short'],
  kestrelDynamo:['frame-utility','legs-compact','power-dynamo','cab-utility','gun-light'],
  kestrelForge:['frame-utility','legs-compact','power-forge','cab-utility','gun-light'],
  kestrelStump:['frame-utility','legs-compact','power-dynamo','cab-utility','gun-short'],
  kestrelS6:['frame-utility','legs-compact','power-dynamo','cab-utility','gun-scatter'],
  haulerBruiser:['frame-sr','legs-hauler','power-dynamo','cab-cyclops','gun-short'],
  haulerForge:['frame-wedge','legs-hauler','power-forge','cab-cyclops','gun-short']};
export const MATCHUPS=Object.freeze({
  'light-vs-workhorse':{a:['precision','raider','precision'],b:['workhorse','workhorse','workhorse']},
  'heavy-vs-light':{a:['anchor','protected','anchor'],b:['precision','raider','precision']},
  'mixed-vs-workhorse':{a:['workhorse','precision','anchor'],b:['workhorse','workhorse','workhorse']},
  'forge-vs-dynamo-kestrel':{a:Array(3).fill('kestrelForge'),b:Array(3).fill('kestrelDynamo')},
  'scatter-vs-stump-kestrel':{a:Array(3).fill('kestrelS6'),b:Array(3).fill('kestrelStump')},
  'wedge-vs-bruiser-hauler':{a:Array(3).fill('anchor'),b:Array(3).fill('haulerBruiser')},
  'forge-vs-dynamo-hauler':{a:Array(3).fill('haulerForge'),b:Array(3).fill('anchor')}
});
function fullRecipe(ids){return Object.fromEntries(SLOTS.map((slot,i)=>[slot,ids[i]]))}
function testRecipes(audit){
  const byKey=new Map(audit.combinations.map(r=>[r.key,r]));
  return Object.fromEntries(Object.entries(names).map(([name,ids])=>{
    const recipe=fullRecipe(ids),found=byKey.get(recipeKey(recipe));
    if(!found?.ready)throw Error('Illegal declared '+name+': '+JSON.stringify(found?.reasons));
    return [name,{recipe,massKg:found.massKg,headroomKw:found.nominalPowerHeadroomKw,
      yardValue:found.baseYardValueCredits}];
  }));
}
function groupMin(arr,key,reverse=false){
  const sorted=[...arr].sort((a,b)=>((a[key]??0)-(b[key]??0))*(reverse?-1:1)
    || a.key.localeCompare(b.key));
  return sorted[0]??null;
}
export function evaluateCatalogue(audit=runRosterBalanceAudit()){
  const rows=audit.combinations.filter(r=>r.ready);
  const byMobility={};
  for(const id of ['legs-compact','legs-yard','legs-hauler']){
    const subset=rows.filter(r=>r.recipe.mobility===id);
    byMobility[id]={legal:subset.length,
      cheapest:select(groupMin(subset,'baseYardValueCredits')),
      lightest:select(groupMin(subset,'massKg')),
      greatestElectricalHeadroom:select(groupMin(subset,'nominalPowerHeadroomKw',true))};
  }
  const byWeapon={};
  for(const gun of Object.keys(WEAPONS)){
    const subset=rows.filter(r=>r.recipe.combat===gun);
    const spec=WEAPONS[gun];
    byWeapon[gun]={legal:subset.length,cheapest:select(groupMin(subset,'baseYardValueCredits')),
      lightest:select(groupMin(subset,'massKg')),
      theoreticalMaxUnarmoredDamagePerSecond:round(spec.damage*(spec.pellets??1)*spec.roundsPerSecond),
      magazine:spec.magazine,spareRounds:spec.spareRounds};
  }
  return {definitions:audit.summary.definitions,candidates:audit.summary.total,
    legal:rows.length,rejected:audit.summary.rejected,byMobility,byWeapon,
    cheapest:select(groupMin(rows,'baseYardValueCredits')),
    lightest:select(groupMin(rows,'massKg')),
    highestHeadroom:select(groupMin(rows,'nominalPowerHeadroomKw',true)),
    legalByGenerator:Object.fromEntries(['power-air','power-dynamo','power-forge'].map(id=>
      [id,rows.filter(r=>r.recipe.power===id).length])),
    interpretation:'Engineering/category minima only; do not treat cheapest, theoretical DPS, or headroom as combat wins.'};
}
function select(row){return row?{name:row.key,recipe:row.recipe,massKg:row.massKg,
  yardValue:row.baseYardValueCredits,headroomKw:row.nominalPowerHeadroomKw}:null}
function restoredQuote(slot,condition){
  const [integrity,armor]=TARGET_RESILIENCE[slot];
  return repairQuote({slot,integrity:integrity*condition,maxIntegrity:integrity,
    armor,maxArmor:armor});
}
export function evaluateMarket(cycles=512){
  if(!Number.isInteger(cycles)||cycles<2||cycles>10000)throw Error('bad market sample');
  const all=[],byId={};let coverage=0;
  for(let cycle=0;cycle<cycles;cycle++){
    const stock=generateCounterStock(cycle);
    if(stock.offers.length!==6)throw Error('Market not six slots');
    if(stock.offers.some(o=>o.definitionId==='gun-scatter'))coverage++;
    for(const lot of stock.offers){
      const definition=CATALOG.find(p=>p.id===lot.definitionId);
      const yard=partCreditValue(definition,lot.condition,{wear:lot.wear});
      const restore=restoredQuote(definition.slot,lot.condition);
      const effective=lot.price+restore;
      const r={price:lot.price,restore,effective,condition:lot.condition,wear:lot.wear,
        baseValue:basePartValue(definition),yardValue:yard,markup:lot.price/yard};
      all.push(r);
      (byId[lot.definitionId]??=[]).push(r);
    }
  }
  function stats(rows){return {n:rows.length,medianPrice:median(rows.map(r=>r.price)),
    medianRestore:median(rows.map(r=>r.restore)),
    medianAcquisitionPlusRestore:median(rows.map(r=>r.effective)),
    minPrice:Math.min(...rows.map(r=>r.price)),
    pctWithinStartingCredits:round(rows.filter(r=>r.price<=STARTING_CREDITS).length/rows.length*100,1),
    pctWithinOneYardWin:round(rows.filter(r=>r.price<=STARTING_CREDITS+850).length/rows.length*100,1),
    meanCondition:avg(rows.map(r=>r.condition)),
    meanWear:avg(rows.map(r=>r.wear)),
    medianMarkupOverAsIsYard:median(rows.map(r=>r.markup))}}
  return {cycles,offers:all.length,stockContainingScatter:coverage,
    stockWithScatterPct:round(coverage/cycles*100,2),overall:stats(all),
    byDefinition:Object.fromEntries(Object.entries(byId).map(([id,rows])=>[id,stats(rows)])),
    introScatter:generateCounterStock(0).offers.find(o=>o.definitionId==='gun-scatter'),
    interpretation:'Deterministic seller rotations, not empirical random rarity. Restore quote includes immediate missing integrity only; wear is permanent and not restored.'};
}
export function evaluateEconomy(){
  const rig=makeTestAssembly();
  const repairs={};
  for(const loss of [.1,.3,.6,1]){
    const target=createTargetCondition(rig);
    for(const slot of SLOTS){
      target.parts[slot].integrity*=1-loss;
      target.parts[slot].armor*=1-loss;
    }
    repairs[Math.round(loss*100)+'pctBothHousingAndInternals']=totalRepairQuote(target);
  }
  const shots=[0,20,60];
  const contractMargins=CONTRACTS.map(c=>({
    id:c.id,payout:c.payout,
    winningNetAfter20ShotsBeforeRepair:c.payout-20*AMMO_COST_PER_ROUND,
    postManual30pctRepair:c.payout-20*AMMO_COST_PER_ROUND-repairs['30pctBothHousingAndInternals'],
    zeroAmmoBreakEvenDamagePercent:Object.entries(repairs).filter(([k,q])=>q<=c.payout).map(([k])=>k)}));
  return {startingCredits:STARTING_CREDITS,lossGrossPayout:RECOVERY_PAYOUT,
    repairQuotesCredits:repairs,winningContracts:contractMargins,
    scenarios:Object.fromEntries(shots.map(n=>[n,{
      yardWinGross:850,yardWinAfterAmmo:850-n*AMMO_COST_PER_ROUND,
      yardWinAfterManual30pctRepair:850-n*AMMO_COST_PER_ROUND-repairs['30pctBothHousingAndInternals'],
      lossGross:RECOVERY_PAYOUT,lossAfterAmmo:RECOVERY_PAYOUT-n*AMMO_COST_PER_ROUND,
      lossAfterManual30pctRepair:RECOVERY_PAYOUT-n*AMMO_COST_PER_ROUND-repairs['30pctBothHousingAndInternals']
    }])),
    caveats:'Repair estimate is NOT deducted by settleSortie; player must pay to repair. Uniform damage scenarios are stress tests, not measured combat frequencies. A shot is one trigger, including one S-6 six-pellet shell.'};
}
function pilotFor(name){const m=names[name][1];return m==='legs-compact'?'kestrel':m==='legs-hauler'?'hauler':'yard'}
function actor(name){return {name,pilot:pilotFor(name),recipe:fullRecipe(names[name])}}
function aTeamStats(bout,team){
  const actors=bout.actors.filter(a=>a.team===team);
  const sum=key=>actors.reduce((n,a)=>n+(a[key]??0),0);
  return {score:bout.points[team],damage:sum('damageDealt'),armorDamage:sum('armorDamage'),
    internalDamage:sum('internalDamage'),kills:sum('kills'),captures:sum('captures'),
    travel:sum('travel'),routeErrors:sum('routeErrors'),
    shots:sum('shotTriggers'),survivors:actors.filter(a=>a.alive).length};
}
export function evaluateBattles({pairs=4,seconds=110,accuracy=.7,seed=20261022,progress}={}){
  if(!Number.isInteger(pairs)||pairs<1||pairs>80)throw Error('pairs outside 1–80');
  if(!(seconds>=2&&seconds<=300)||!(accuracy>=0&&accuracy<=1))throw Error('bad tactical option');
  const results=[];
  let ix=0;
  for(const [name,m] of Object.entries(MATCHUPS)){
    const bouts=[];
    for(let p=0;p<pairs;p++){
      const pairSeed=(seed+ix*100003+p*7907)>>>0;
      for(const reversed of [false,true]){
        const left=(reversed?m.b:m.a).map(actor),right=(reversed?m.a:m.b).map(actor);
        const bout=runBout(pairSeed,{name,accuracy,maxSeconds:seconds,policy:'strict',
          rosters:{friendly:left,hostile:right}});
        const aSide=reversed?'hostile':'friendly',bSide=reversed?'friendly':'hostile';
        const a=aTeamStats(bout,aSide),b=aTeamStats(bout,bSide);
        bouts.push({seed:pairSeed,reversed,winner:bout.win==='draw'?'draw':
          bout.win===aSide?'a':'b',reason:bout.winReason,time:round(bout.time),
          a,b});
      }
    }
    const wins=bouts.filter(x=>x.winner==='a').length,losses=bouts.filter(x=>x.winner==='b').length;
    const draws=bouts.length-wins-losses;
    const meanDiff=key=>avg(bouts.map(x=>x.a[key]-x.b[key]));
    results.push({name,a:m.a,b:m.b,bouts:bouts.length,wins,losses,draws,
      winEquivalent:round((wins+draws*.5)/bouts.length,3),
      meanPointDifferential:meanDiff('score'),
      meanDamageDifferential:meanDiff('damage'),
      meanInternalDifferential:meanDiff('internalDamage'),
      meanKillsDifferential:meanDiff('kills'),
      meanCapturesDifferential:meanDiff('captures'),
      meanTravelDifferential:meanDiff('travel'),
      meanShotsDifferential:meanDiff('shots'),
      meanRouteErrorDifferential:meanDiff('routeErrors'),
      meanSurvivorDifferential:meanDiff('survivors'),
      meanTime:avg(bouts.map(x=>x.time)),boutRecords:bouts});
    progress?.(name,results.at(-1));
    ix++;
  }
  return {settings:{pairs,seconds,accuracy,seed,bouts:results.reduce((n,x)=>n+x.bouts,0)},
    modelLimitations:'Live AI objectives, damage and locomotion; probabilistic first-hit contacts and electrical response, no rendered Three.js raycasts, no real economic settlement or human player.',
    results};
}
export function runLoadoutEconomyStudy(options={}){
  const audit=runRosterBalanceAudit(),references=testRecipes(audit);
  const market=evaluateMarket(options.cycles??512),economy=evaluateEconomy();
  const catalogue=evaluateCatalogue(audit);
  const tactical=evaluateBattles(options);
  return {schemaVersion:1,source:'actual merged main branch checkout; pure read-only study',
    references,catalogue,market,economy,tactical};
}
export function reportMarkdown(r){
  const lines=['# M3CH4 k4v.9 — balanced-loadout and economy findings','',
    'Pure inspection: '+r.catalogue.legal+'/'+r.catalogue.candidates+' legal; 16 modules.',
    'Mirrored tactical proxy: '+JSON.stringify(r.tactical.settings)+'.',
    '**Limits:** '+r.tactical.modelLimitations,'',
    '## Matched combat comparisons','',
    '| Matchup (left vs right) | W-L-D | A-equivalent | A score diff | A damage diff | A internal diff | A kills diff | A captures diff |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...r.tactical.results.map(c=>'| '+[c.name,c.wins+'-'+c.losses+'-'+c.draws,
      c.winEquivalent,c.meanPointDifferential,c.meanDamageDifferential,
      c.meanInternalDifferential,c.meanKillsDifferential,c.meanCapturesDifferential].join(' | ')+' |'),
    '', 'All rows use equal paired seeds and reversed spawn sides. Score and damage differentials are descriptive, not proof of causal win rates.',
    '', '## Catalogue minima by mobility', '',
    '| Legs | Legal | Lowest yard value | Lightest kg | Highest kW headroom |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(r.catalogue.byMobility).map(([id,c])=>'| '+[
      id,c.legal,c.cheapest.yardValue,c.lightest.massKg,
      c.greatestElectricalHeadroom.headroomKw].join(' | ')+' |'),
    '', 'Generator coverage: '+JSON.stringify(r.catalogue.legalByGenerator)+'.',
    'Cheapest legal set: '+r.catalogue.cheapest.name+' ('+r.catalogue.cheapest.yardValue+' value, not shop price).',
    'Lightest legal set: '+r.catalogue.lightest.name+' ('+r.catalogue.lightest.massKg+' kg).',
    '', '## Real money rules', '',
    'Start '+r.economy.startingCredits+' credits; loss payout '+r.economy.lossGrossPayout+
      '; ammo '+AMMO_COST_PER_ROUND+' per trigger. Repair estimates require a separate player purchase.',
    'Repair quotations for equal integrity and armor damage: '+JSON.stringify(r.economy.repairQuotesCredits)+'.',
    '| Contract | Gross victory | 20-shot net before repair | Net after 30% overall damage restored |',
    '| --- | ---: | ---: | ---: |',
    ...r.economy.winningContracts.map(c=>'| '+[c.id,c.payout,c.winningNetAfter20ShotsBeforeRepair,
      c.postManual30pctRepair].join(' | ')+' |'),
    '', '## Used hardware market: '+r.market.cycles+' actual deterministic cycles / '+
      r.market.offers+' offers','','Median as-is price '+r.market.overall.medianPrice+
      '; median repair '+r.market.overall.medianRestore+
      '; median acquisition-plus-repair '+r.market.overall.medianAcquisitionPlusRestore+'.',
    'Share of listings within starting 600 credits: '+r.market.overall.pctWithinStartingCredits+
      '%; within 1 Yard Dog victory plus start: '+r.market.overall.pctWithinOneYardWin+'%.',
    'Intro S-6: '+JSON.stringify(r.market.introScatter)+'.',
    '', '| Part | Offers | Median price | Median price + repair | 600-credit accessible % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(r.market.byDefinition).map(([id,v])=>'| '+
      [id,v.n,v.medianPrice,v.medianAcquisitionPlusRestore,v.pctWithinStartingCredits].join(' | ')+' |'),
    '', '**Cautions:** '+r.economy.caveats+' '+r.market.interpretation,
    'No equipment statistics, monetary rules, or AI behavior changed by this study.'];
  return lines.join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const v=(key,fallback)=>Number(process.argv.find(s=>s.startsWith('--'+key+'='))?.split('=')[1]??fallback);
  const out=process.argv.find(s=>s.startsWith('--out='))?.slice(6)??'study-results/loadout-economy';
  const study=runLoadoutEconomyStudy({pairs:v('pairs',4),seconds:v('seconds',110),
    accuracy:v('accuracy',.7),seed:v('seed',20261022),cycles:v('cycles',512),
    progress:(name,result)=>console.log('COHORT '+name+' '+
      JSON.stringify({bouts:result.bouts,wins:result.wins,losses:result.losses,draws:result.draws,
        scoreDelta:result.meanPointDifferential,damageDelta:result.meanDamageDifferential}))});
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(out+'/report.md',reportMarkdown(study));
  fs.writeFileSync(out+'/results.json',JSON.stringify(study,null,2)+'\n');
  console.log(reportMarkdown(study));
}
