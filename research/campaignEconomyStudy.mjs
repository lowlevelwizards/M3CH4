/** k4v.10: forward campaign ECONOMY scenarios, not invented fight performance.
 * Actual BO3 contract payout/ammunition math, campaign unlocks, physical serial
 * inventory, authorised one-per-winning-pilot draft claims and six-lot market.
 * Hypothetical win/damage/claim rates are user-tunable inputs, NOT observations.
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createCampaignState,availableCampaignNodes,recordCampaignSortie} from '../campaign.js';
import {contractById} from '../contracts.js';
import {runRosterBalanceAudit} from './rosterBalanceAudit.mjs';
import {makeStarterAssembly,recoverSalvage} from '../acquisition.js';
import {makeRangeTarget,createTargetCondition,mirrorTargetCondition} from '../combat.js';
import {SLOTS,CATALOG} from '../components.js';
import {wreckManifest,createSalvageDraft,availableClaims,claimDraftEntry,claimToRecoveryOffer} from '../salvageDraft.js';
import {generateCounterStock} from '../usedPartsCounter.js';
import {settleSortie,STARTING_CREDITS,totalRepairQuote,repairQuote} from '../economy.js';

const round=n=>Math.round(n*100)/100;
const pct=(n,d)=>round(100*n/d);
function rngFor(seed){let n=seed>>>0;return ()=>{
  n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;
}}
const choose=(rng,p)=>rng()<p;
const average=xs=>round(xs.reduce((a,b)=>a+b,0)/Math.max(xs.length,1));
const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length?round((s[(s.length-1)>>1]+s[s.length>>1])/2):0};
export const CASES=Object.freeze({
  'hard-scrap-limited':Object.freeze({winProbability:.52,damageFraction:.36,claimEligibility:.45,repairReserve:350}),
  'hard-scrap-often':Object.freeze({winProbability:.52,damageFraction:.36,claimEligibility:.90,repairReserve:350}),
  'middle-scrap-limited':Object.freeze({winProbability:.67,damageFraction:.24,claimEligibility:.45,repairReserve:350}),
  'middle-scrap-often':Object.freeze({winProbability:.67,damageFraction:.24,claimEligibility:.90,repairReserve:350}),
  'strong-scrap-often':Object.freeze({winProbability:.82,damageFraction:.17,claimEligibility:.90,repairReserve:350}),
  'middle-no-salvage':Object.freeze({winProbability:.67,damageFraction:.24,claimEligibility:0,repairReserve:350})
});
function inventoryTallies(items){
  const counts=Object.fromEntries(SLOTS.map(x=>[x,0]));
  for(const p of items){if(p.destroyed||p.condition<=.001)continue;
    const slot=CATALOG.find(x=>x.id===p.definitionId)?.slot;
    if(slot)counts[slot]++;
  }
  return counts;
}
export function packFleet(inventory,validRecipes,{includeDisabled=false}={}){
  const stock=inventory.filter(p=>!p.destroyed&&(includeDisabled||p.condition>.001));
  const bySerial=new Map(stock.map(p=>[p.serial,p]));
  const remaining=new Set(bySerial.keys()),fleet=[];
  const ordered=[...validRecipes].sort((a,b)=>{
    const starter=['frame-sr','legs-yard','power-dynamo','cab-cyclops','gun-cannon'];
    const preferred=recipe=>SLOTS.every((s,i)=>recipe.recipe[s]===starter[i]);
    return Number(preferred(b))-Number(preferred(a))||
      a.baseYardValueCredits-b.baseYardValueCredits||a.key.localeCompare(b.key);
  });
  for(let bay=0;bay<3;bay++){
    let found=null;
    for(const recipe of ordered){
      const installed={};let ok=true;
      for(const slot of SLOTS){
        const owned=stock.find(p=>remaining.has(p.serial)&&
          p.definitionId===recipe.recipe[slot]);
        if(!owned){ok=false;break}
        installed[slot]=owned.serial;
      }
      if(ok){found={recipe:recipe.recipe,installed};break}
    }
    if(!found)break;
    for(const serial of Object.values(found.installed))remaining.delete(serial);
    fleet.push(found);
  }
  return fleet;
}
/** One sample of a deliberate owned three-mech target, not a meta prescription.
 * Keep each serialized unit distinct across bays.
 */
export const DESIRED_THREE_RIGS=Object.freeze([
 ['frame-sr','legs-yard','power-dynamo','cab-cyclops','gun-cannon'],
 ['frame-utility','legs-compact','power-air','cab-utility','gun-light'],
 ['frame-wedge','legs-hauler','power-dynamo','cab-cyclops','gun-short']
]);
export function chosenTriadCount(inventory){
 const remaining=new Map();
 for(const p of inventory){
   if(p.destroyed||p.condition<=.001)continue;
   remaining.set(p.definitionId,(remaining.get(p.definitionId)??0)+1);
 }
 let complete=0;
 for(const recipe of DESIRED_THREE_RIGS){
   if(!recipe.every(id=>(remaining.get(id)??0)>=(recipe.filter(x=>x===id).length)))continue;
   complete++;
   for(const id of recipe)remaining.set(id,remaining.get(id)-1);
 }
 return complete;
}
function preferredContract(campaign){
  const available=availableCampaignNodes(campaign);
  const next=['yard-dog','cutter','mule','circuit-final'].find(
    n=>available.includes(n)&&!campaign.clearedNodes.includes(n));
  if(next)return next;
  return available.includes('domination')?'domination':'yard-dog';
}
function candidateClaims(playerAssembly,contract,rng){
  const manifests=[];
  for(let i=0;i<3;i++){
    const assembly=makeRangeTarget(contract.id);
    const target=createTargetCondition(assembly);
    for(const p of Object.values(target.parts)){
      // Defeated enemy remaining condition is an EXPLICIT hypothetical cohort.
      const integrity=.30+rng()*.60,armor=.08+rng()*.66;
      p.integrity*=integrity;p.armor*=armor;
    }
    manifests.push(wreckManifest({id:'enemy-'+i,assembly,condition:target,active:false}));
  }
  const draft=createSalvageDraft({draftOrder:['player'],manifests});
  const counts=inventoryTallies(playerAssembly.owned);
  const candidates=availableClaims(draft);
  candidates.sort((a,b)=>{
    const score=e=>100*(2-counts[e.slot])+e.condition*25+
      (playerAssembly.owned.some(p=>p.definitionId===e.definitionId)?0:10);
    return score(b)-score(a)||a.id.localeCompare(b.id);
  });
  if(!candidates.length)return null;
  const decision=claimDraftEntry(draft,'player',candidates[0].id);
  if(!decision.ok)throw Error(decision.reason);
  return claimToRecoveryOffer(decision.entry);
}
function assembledForRig(inventory,rig){
  return {serial:'SIM',owned:inventory,installed:rig.installed};
}
function damageRig(inventory,rig,fraction,rng,armorBySerial){
  const assembly=assembledForRig(inventory,rig);
  const state=createTargetCondition(assembly,true);
  for(const p of Object.values(state.parts)){
    p.armor=armorBySerial.get(p.serial)??p.armor;
    const loss=fraction*(.55+rng()*.90);
    p.armor=Math.max(0,p.armor-p.maxArmor*loss);
    p.integrity=Math.max(0,p.integrity-p.maxIntegrity*loss*.60);
    armorBySerial.set(p.serial,p.armor);
  }
  mirrorTargetCondition(assembly,state);
  return {assembly,state};
}
function serviceInventory(inventory,rigs,credits,armorBySerial){
  // Same real per-serial quote as the garage, not an all-or-nothing fictional
  // fleet restoration. Service the most damaged essential hardware first.
  const tasks=[],seen=new Set();
  for(const rig of rigs){
    const assembly=assembledForRig(inventory,rig),condition=createTargetCondition(assembly,true);
    for(const p of Object.values(condition.parts)){
      if(seen.has(p.serial))continue;
      seen.add(p.serial);
      p.armor=armorBySerial.get(p.serial)??p.armor;
      const quote=repairQuote(p);
      if(quote>0)tasks.push({part:p,quote,
        health:p.integrity/Math.max(1,p.maxIntegrity)});
    }
  }
  tasks.sort((a,b)=>a.health-b.health||a.quote-b.quote);
  let spent=0,deferred=0,repaired=0;
  for(const {part,quote} of tasks){
    if(quote<=credits-spent){
      spent+=quote;repaired++;
      const owned=inventory.find(x=>x.serial===part.serial);
      if(owned)owned.condition=1;
      armorBySerial.set(part.serial,part.maxArmor);
    }else deferred+=quote;
  }
  return {credits:credits-spent,spent,deferred,repaired};
}
function buyForFleet(inventory,cycle,credits,reserve,rng,validRecipes,campaign){
  const fleet=packFleet(inventory,validRecipes);
  if(fleet.length===3)return {credits,bought:0};
  const counts=inventoryTallies(inventory);
  const lots=generateCounterStock(cycle,campaign).offers.filter(l=>l.price<=credits-reserve);
  lots.sort((a,b)=>{
    const sa=CATALOG.find(x=>x.id===a.definitionId)?.slot;
    const sb=CATALOG.find(x=>x.id===b.definitionId)?.slot;
    return counts[sa]-counts[sb]||a.price-b.price;
  });
  for(const lot of lots){
    const before=fleet.length;
    const part={serial:lot.serial,definitionId:lot.definitionId,
      condition:lot.condition,wear:lot.wear,repairs:lot.repairs,destroyed:false};
    if(inventory.some(x=>x.serial===lot.serial))continue;
    inventory.push(part);
    // Buy for the next slot needed; unfinished spare modules remain owned.
    const slot=CATALOG.find(x=>x.id===lot.definitionId)?.slot;
    if(counts[slot]<3){
      return {credits:credits-lot.price,bought:1,price:lot.price,
        definitionId:lot.definitionId,immediatelyFieldable:packFleet(inventory,validRecipes).length>before};
    }
    inventory.pop();
  }
  return {credits,bought:0};
}
/** A contract is one best-of-three series. Winning rounds may produce a single
 * player salvage claim; only a terminal series settles credits.
 * Round wins, battle damage, and player claim eligibility are assumptions.
 * Opponents use the authored LEAD recipe repeated for salvage opportunity,
 * so supporting rigs and per-round draft ranking are outside this proxy.
 */
export function simulateCampaign({seed=1,contracts=30,assumptions=CASES['middle-scrap-often'],purchase=true}={}){
  if(!Number.isInteger(contracts)||contracts<1||contracts>100)throw Error('contracts 1-100');
  const rng=rngFor(seed),inventory=makeStarterAssembly().owned,
    armorBySerial=new Map();
  const legalRows=runRosterBalanceAudit().combinations.filter(r=>r.ready);
  let campaign=createCampaignState(),credits=STARTING_CREDITS;
  let wins=0,losses=0,roundWins=0,salvages=0,purchases=0,repairPaid=0,
    deferred=0,spentInShop=0,peakFleet=1,firstTwo=null,firstThree=null,
    fieldableFailures=0,unfinishedSeries=0,lowBalance=0,stalledAt=null;
  let firstChosenTwo=null,firstChosenThree=null,peakChosen=1;
  let emergencyServicePaid=0;
  const history=[];
  for(let cycle=0;cycle<contracts;cycle++){
    // Garage may service a disabled but physically assembled rig before deployment.
    if(!packFleet(inventory,legalRows).length){
      const repairable=packFleet(inventory,legalRows,{includeDisabled:true});
      const rescue=serviceInventory(inventory,repairable,credits,armorBySerial);
      credits=rescue.credits;repairPaid+=rescue.spent;emergencyServicePaid+=rescue.spent;
      if(!packFleet(inventory,legalRows).length){
        fieldableFailures++;stalledAt=cycle+1;break;
      }
    }
    const contract=contractById(preferredContract(campaign));
    let won=0,lost=0,shots=0,seriesDamage=0,claims=0;
    let seriesStalled=false;
    while(won<2&&lost<2){
      const roster=packFleet(inventory,legalRows);
      if(!roster.length){
        const repairable=packFleet(inventory,legalRows,{includeDisabled:true});
        const rescue=serviceInventory(inventory,repairable,credits,armorBySerial);
        credits=rescue.credits;repairPaid+=rescue.spent;emergencyServicePaid+=rescue.spent;
        if(!packFleet(inventory,legalRows).length){
          seriesStalled=true;fieldableFailures++;stalledAt=cycle+1;break;
        }
        continue;
      }
      const win=choose(rng,assumptions.winProbability);
      win?won++:lost++;
      if(win)roundWins++;
      shots+=Math.round(12+rng()*13);
      const chosen=roster[(won+lost-1)%roster.length];
      const damageFraction=assumptions.damageFraction*(win?.82:1.2);
      damageRig(inventory,chosen,damageFraction,rng,armorBySerial);
      seriesDamage+=damageFraction;
      if(win&&choose(rng,assumptions.claimEligibility)){
        const offer=candidateClaims({owned:inventory},contract,rng);
        if(offer){
          const salvage=recoverSalvage({owned:inventory},offer);
          if(salvage.ok){salvages++;claims++}
        }
      }
    }
    if(seriesStalled){unfinishedSeries++;break}
    const terminal=won>=2;
    if(terminal)wins++;else losses++;
    const result=settleSortie({credits,victory:terminal,roundsFired:shots,
      victoryPayout:contract.payout});
    credits=result.creditsAfter;
    const campaignEvent=recordCampaignSortie(campaign,{nodeId:contract.id,
      victory:terminal,creditsEarned:Math.max(0,result.netPayout)});
    campaign=campaignEvent.state;
    let fleet=packFleet(inventory,legalRows);
    // Repair fielded and recently damaged machines; price is a separate garage expense.
    const repairable=packFleet(inventory,legalRows,{includeDisabled:true});
    const repair=serviceInventory(inventory,repairable,credits,armorBySerial);
    credits=repair.credits;repairPaid+=repair.spent;deferred+=repair.deferred;
    if(purchase){
      const market=buyForFleet(inventory,campaign.sorties,credits,
        assumptions.repairReserve,rng,legalRows,campaign);
      credits=market.credits;purchases+=market.bought??0;
      spentInShop+=market.price??0;
    }
    fleet=packFleet(inventory,legalRows);
    if(fleet.length>=2&&firstTwo===null)firstTwo=cycle+1;
    if(fleet.length>=3&&firstThree===null)firstThree=cycle+1;
    peakFleet=Math.max(peakFleet,fleet.length);
    const chosen=chosenTriadCount(inventory);
    peakChosen=Math.max(peakChosen,chosen);
    if(chosen>=2&&firstChosenTwo===null)firstChosenTwo=cycle+1;
    if(chosen>=3&&firstChosenThree===null)firstChosenThree=cycle+1;
    if(credits<250)lowBalance++;
    history.push({contract:cycle+1,id:contract.id,win:terminal,rounds:won+lost,
      shots,claims,credits,owned:inventory.length,fleet:fleet.length,
      repaired:repair.spent,deferred:repair.deferred});
  }
  return {seed,contracts,wins,losses,roundWins,salvages,purchases,repairPaid,
    deferredRepairQuoted:deferred,spentInShop,credits,owned:inventory.length,
    uniqueDefinitions:new Set(inventory.map(x=>x.definitionId)).size,
    peakFleet,firstTwo,firstThree,peakChosen,firstChosenTwo,firstChosenThree,
    fieldableFailures,lowBalance,
    stalledAt,contractsCompleted:history.length,emergencyServicePaid,
    requiredClears:campaign.clearedNodes.filter(x=>
      ['yard-dog','cutter','mule','circuit-final'].includes(x)).length,
    history};
}
export function runCampaignScenarios({seeds=48,contracts=30}={}){
  if(!Number.isInteger(seeds)||seeds<1||seeds>300)throw Error('seeds 1-300');
  const cases=[];
  for(const [name,assumptions] of Object.entries(CASES)){
    const runs=[];
    for(let i=0;i<seeds;i++)runs.push(simulateCampaign({
      seed:900001+i*3779,contracts,assumptions,purchase:true}));
    const two=runs.filter(x=>x.firstTwo!==null),three=runs.filter(x=>x.firstThree!==null),
      chosenThree=runs.filter(x=>x.firstChosenThree!==null);
    cases.push({name,assumptions,scenarios:runs.length,
      pctTwoRigs:pct(two.length,runs.length),
      medianContractsToTwo:two.length?median(two.map(x=>x.firstTwo)):null,
      pctThreeRigs:pct(three.length,runs.length),
      pctDesiredTriad:pct(chosenThree.length,runs.length),
      medianContractsToDesiredTriad:chosenThree.length?
        median(chosenThree.map(x=>x.firstChosenThree)):null,
      medianContractsToThree:three.length?median(three.map(x=>x.firstThree)):null,
      avgCash:average(runs.map(x=>x.credits)),
      avgOwned:average(runs.map(x=>x.owned)),
      avgUniqueDefinitions:average(runs.map(x=>x.uniqueDefinitions)),
      avgClaims:average(runs.map(x=>x.salvages)),
      avgPurchases:average(runs.map(x=>x.purchases)),
      avgRepairPaid:average(runs.map(x=>x.repairPaid)),
      avgDeferredRepair:average(runs.map(x=>x.deferredRepairQuoted)),
      avgLowBalanceContracts:average(runs.map(x=>x.lowBalance)),
      avgContractsCompleted:average(runs.map(x=>x.contractsCompleted)),
      pctNoFieldableAtSomePoint:pct(runs.filter(x=>x.fieldableFailures>0).length,runs.length),
      pctFourCampaignClears:pct(runs.filter(x=>x.requiredClears===4).length,runs.length),
      sampleRuns:runs.slice(0,2)});
  }
  return {model:'k4v.10 scenario simulation, not an empirical playtest or AI win-rate model',
    seeds,contractsPerScenario:contracts,scenarioRuns:seeds*cases.length,cases,
    cautions:['The victory and damage probabilities are transparent assumptions, not real player or AI outcomes.',
    'Salvage claim eligibility is a scenario assumption; maximum one claimed surviving module per won round, using actual draft and acquisition.',
    'Opponent manifests repeat each contract lead recipe; supporting crew mixes, wreck destruction and score-order draft loss are not simulated.',
    'Repairs are paid after terminal BO3 settlement; persistent armor and integrity losses are quoted by the actual economic functions.',
    'Garage service is individually quoted per serialized part and prioritizes disabled hardware; if no fieldable rig remains and service is unaffordable, the career stops without fictional payouts.',
    'Market turns over each completed contract. One shortage-targeted purchase per contract leaves cash buffer.',
    'No human selling, advanced trading, customization preferences, actor careers or high-end money sinks.',
    'Fieldability follows the stable serial condition threshold (>0.001) but this heuristic packs three legal recipes, not the full commission/assignment UX.',
    'A 3-mech result means three simultaneously legal distinct-serial sets, NOT proof of 3 tactically strong fighters.',
    'The example desired triad is Workhorse plus Precision Kestrel plus Wedge Hauler: merely filling three bays is not the same as achieving personally preferred builds.']};
}
export function reportCampaign(r){
  return ['# k4v.10 — Scrapyard multi-bay economic campaign stress tests','',
    r.scenarioRuns+' independent deterministic hypothetical campaign scenarios; '+
    r.contractsPerScenario+' complete BO3 contracts each.',
    '**User design constraint:** early inability to buy is not a failure; low starting credits, gradual recovery and scarce full fleets are desired.','',
    '| Scenario | 2 rigs achieved | Median contracts to 2 | 3 rigs achieved | Median contracts to 3 | Avg salvage | Avg shop purchases | Avg cash | Avg repair spent |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...r.cases.map(c=>'| '+[c.name,c.pctTwoRigs+'%',c.medianContractsToTwo??'—',
      c.pctThreeRigs+'%',c.medianContractsToThree??'—',c.avgClaims,
      c.avgPurchases,c.avgCash,c.avgRepairPaid].join(' | ')+' |'),
    '', '## Additional pressure indicators','',
    '| Scenario | Example desired triad achieved | Median contracts to desired triad | Avg completed contracts | Stranded before horizon | Four required jobs cleared |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...r.cases.map(c=>'| '+[c.name,c.pctDesiredTriad+'%',
      c.medianContractsToDesiredTriad??'—',c.avgContractsCompleted,
      c.pctNoFieldableAtSomePoint+'%',c.pctFourCampaignClears+'%'].join(' | ')+' |'),
    '', ...r.cautions.map(x=>'- '+x),
    '', 'No payouts, repair prices, salvage terms, market prices, or production enemy strategies are modified.'].join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const numeric=(key,fallback)=>Number(process.argv.find(x=>x.startsWith('--'+key+'='))?.split('=')[1]??fallback);
  const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)??'study-results/campaign-economy';
  const result=runCampaignScenarios({seeds:numeric('seeds',48),contracts:numeric('contracts',30)});
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(output+'/results.json',JSON.stringify(result,null,2)+'\n');
  fs.writeFileSync(output+'/report.md',reportCampaign(result));
  console.log(reportCampaign(result));
}
