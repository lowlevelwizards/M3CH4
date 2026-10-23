import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACTS} from '../contracts.js';
import {enemyRoster,friendlyRoster,runAiCampaignBalance} from '../research/campaignAiBalanceStudy.mjs';
import {runBout} from '../research/headlessDominationStudy.mjs';
import {createCampaignState} from '../campaign.js';
import {generateCounterStock,counterCanStock} from '../usedPartsCounter.js';

test('each contract enemy roster uses physically legal mounted weapon doctrines',()=>{
 const sizes={ 'recovery-run':2 };
 for(const contract of CONTRACTS){
  const roster=enemyRoster(contract.id);
  assert.equal(roster.length,sizes[contract.id]??3,contract.id);
  assert.equal(roster[0].recipe.combat,contract.loadout.combat,contract.id);
  assert.ok(roster.every(x=>x.recipe?.power&&x.recipe.combat&&x.behavior?.preferredRangeM>0));
 }
 for(const profile of ['starter-loaners','rivet-upgrade','specialist-fleet']){
  const team=friendlyRoster(profile);
  assert.equal(team.length,3);
  assert.ok(team.every(x=>x.pilot&&x.recipe?.combat));
 }
 assert.equal(friendlyRoster('starter-loaners')[2].recipe.combat,'gun-short',
   'early friendly Hauler must not borrow late Breaker equipment');
});
test('real authored non-domination objective runs without fake third hostile recovery rig',()=>{
 const battle=runBout(27071,{contractId:'recovery-run',accuracy:0,physicalEquipment:true,
  maxSeconds:2,rosters:{friendly:friendlyRoster('starter-loaners'),
   hostile:enemyRoster('recovery-run')}});
 assert.equal(battle.objectiveType,'recovery');
 assert.equal(battle.actors.length,5);
 assert.ok(battle.time<=2);
});
test('all six contract objectives and mechanically advanced rifles can run in fixed-step combat',()=>{
 for(const id of ['yard-dog','cutter','domination','mule','circuit-final']){
  const bout=runBout(18182,{contractId:id,accuracy:0,physicalEquipment:true,
    maxSeconds:2,rosters:{friendly:friendlyRoster('rivet-upgrade'),hostile:enemyRoster(id)}});
  assert.equal(bout.contractId,id);
  assert.ok(bout.actors.length>=5);
 }
});
test('small paired campaign study is repeatable and reads cleared-node vendor gating',()=>{
 const opts={pairs:1,seconds:2,accuracy:0,seed:37,economySeeds:0,
  contracts:['yard-dog','recovery-run'],profiles:['starter-loaners']};
 const first=runAiCampaignBalance(opts);
 assert.equal(first.rows.length,4);
 assert.deepEqual(first,runAiCampaignBalance(opts));
 assert.deepEqual(first.analysis.map(x=>x.contractId),['yard-dog','recovery-run']);
 const none=createCampaignState(),afterYard=createCampaignState({clearedNodes:['yard-dog']});
 assert.ok(generateCounterStock(0,none).offers.every(p=>counterCanStock(p.definitionId,none)));
 assert.ok(generateCounterStock(3,afterYard).offers.every(p=>counterCanStock(p.definitionId,afterYard)));
});
