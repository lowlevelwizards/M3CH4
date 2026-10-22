import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTRACTS,contractById} from '../contracts.js';
import {makeRangeTarget,weaponFor,createTargetCondition} from '../combat.js';
import {equip,inspectAssembly,installedPart} from '../components.js';
import {hostileSupportRecipes} from '../squadBattle.js';
import {encounterWingArms,weaponDoctrine} from '../campaignArsenal.js';
import {wreckManifest} from '../salvageDraft.js';
import {createCampaignState} from '../campaign.js';
import {makeStarterAssembly} from '../acquisition.js';
import {counterCanStock,generateCounterStock,loadCounter} from '../usedPartsCounter.js';

const expected={
 'yard-dog':['gun-short','gun-cannon','gun-short'],
 'recovery-run':['gun-cannon','gun-cannon'],
 cutter:['gun-light','gun-rivet','gun-light'],
 domination:['gun-rivet','gun-light','gun-scatter'],
 mule:['gun-breaker','gun-arc','gun-light'],
 'circuit-final':['gun-rocket','gun-rivet','gun-breaker'],
};
test('each authored enemy squad fields distinct serial combat hardware without stat copies',()=>{
 for(const contract of CONTRACTS){
  const wingFamilies=hostileSupportRecipes(contract.id);
  const arms=encounterWingArms(contract.id);
  assert.equal(arms.length,wingFamilies.length,contract.id);
  assert.deepEqual([contract.loadout.combat,...arms],expected[contract.id],contract.id);
  const rigs=[makeRangeTarget(contract.id)];
  for(let i=0;i<arms.length;i++){
   const rig=makeRangeTarget(wingFamilies[i]);
   equip(rig,'combat',arms[i]);
   rig.serial=contract.id+'-WING-'+i;
   rigs.push(rig);
  }
  rigs.forEach((rig,i)=>{
   assert.equal(inspectAssembly(rig).ready,true,contract.id+' #'+i);
   assert.equal(weaponFor(rig).id,expected[contract.id][i]);
   const condition=createTargetCondition(rig);
   const wreck=wreckManifest({id:'enemy-'+i,label:contract.id,assembly:rig,condition});
   assert.equal(wreck.parts.find(x=>x.slot==='combat').definitionId,expected[contract.id][i],
     'the actual fitted weapon is salvageable, not an independent loot table');
  });
 }
});
test('behaviors match physical engagement ranges instead of boosting weapon damage',()=>{
 const base=contractById('yard-dog').behavior;
 const arc=weaponDoctrine(base,'gun-arc');
 const breaker=weaponDoctrine(base,'gun-breaker');
 const rockets=weaponDoctrine(base,'gun-rocket');
 const rivet=weaponDoctrine(base,'gun-rivet');
 assert.ok(arc.preferredRangeM<6,'contact cutter has a real 6m limit');
 assert.ok(breaker.preferredRangeM>rivet.preferredRangeM);
 assert.ok(rockets.preferredRangeM>breaker.preferredRangeM);
 assert.equal(weaponDoctrine(base,'gun-short'),base);
 assert.equal(weaponDoctrine(base,'gun-arc').label,'ARC WELDER');
});
const state=(...clearedNodes)=>createCampaignState({clearedNodes});
test('counter hardware access follows cleared jobs, never elapsed contracts or credits',()=>{
 const first=state();
 for(const id of ['gun-rivet','gun-breaker','gun-arc','gun-rocket'])
  assert.equal(counterCanStock(id,first),false,id);
 const yard=state('yard-dog'),cutter=state('yard-dog','cutter'),mule=state('yard-dog','cutter','mule');
 assert.equal(counterCanStock('gun-rivet',yard),true);
 assert.equal(counterCanStock('gun-arc',yard),false);
 assert.equal(counterCanStock('gun-arc',cutter),true);
 assert.equal(counterCanStock('gun-breaker',cutter),true);
 assert.equal(counterCanStock('gun-rocket',cutter),false);
 assert.equal(counterCanStock('gun-rocket',mule),true);
 assert.equal(counterCanStock('gun-scatter',first),true);
 for(const campaign of [first,yard,cutter,mule]){
  for(let cycle=0;cycle<30;cycle++){
   const stock=generateCounterStock(cycle,campaign);
   assert.equal(stock.offers.length,6);
   assert.ok(stock.offers.every(x=>counterCanStock(x.definitionId,campaign)));
   assert.deepEqual(stock,generateCounterStock(cycle,campaign));
  }
 }
 for(const [id,campaign] of [['gun-rivet',yard],['gun-breaker',cutter],['gun-arc',cutter],['gun-rocket',mule]])
  assert.ok(Array.from({length:100},(_,i)=>generateCounterStock(i,campaign).offers)
   .flat().some(l=>l.definitionId===id),id+' becomes findable');
});
test('fresh campaign cannot silently buy high-grade weapons; grandfathered physical lots persist',()=>{
 const storage={
  state:new Map(),
  getItem(key){return this.state.get(key)??null;},
  setItem(key,val){this.state.set(key,String(val));},
 };
 const initial=loadCounter(storage,0);
 assert.equal(initial.persisted,true);
 assert.ok(initial.stock.offers.every(x=>counterCanStock(x.definitionId,state())));
 const old=JSON.parse(JSON.stringify(initial.stock));
 old.offers[1].definitionId='gun-rocket';
 storage.setItem('m3ch4-used-counter-v1',JSON.stringify(old));
 const kept=loadCounter(storage,0);
 assert.equal(kept.stock.offers[1].definitionId,'gun-rocket',
   'an existing serialized listing must not be erased by a new availability rule');
 assert.equal(makeStarterAssembly().owned.some(x=>x.definitionId==='gun-rocket'),false);
});
test('live encounter composition and counter cache are used by browser entrypoints',()=>{
 const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const main=src('main.js');
 assert.match(main,/encounterWingArms\(targetAssembly.contractId\)/);
 assert.match(main,/weaponDoctrine\(activeContract.behavior,hostileWeaponSpec.id\)/);
 assert.match(main,/equip\(actorAssembly,'combat',combatId\)/);
 assert.match(src('usedPartsCounter.js'),/generateCounterStock\(number,loadCampaign\(storage\)\)/);
 assert.match(src('index.html'),/main\.js\?v=k4w5/);
});
