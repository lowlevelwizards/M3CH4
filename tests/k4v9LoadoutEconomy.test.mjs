import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCatalogue,evaluateMarket,evaluateEconomy,evaluateBattles,MATCHUPS} from '../research/loadoutEconomyStudy.mjs';

test('all loadouts are real legal catalogue recipes and cover Forge cases',()=>{
  const r=evaluateCatalogue();
  assert.equal(r.candidates,324);
  assert.equal(r.legal,237);
  assert.equal(r.byMobility['legs-hauler'].legal,49);
  assert.ok(r.legalByGenerator['power-forge']>0);
  assert.equal(Object.keys(MATCHUPS).length,7);
});
test('deterministic counter cycles and actual as-is plus restoration accounting',()=>{
  const a=evaluateMarket(32);
  assert.deepEqual(a,evaluateMarket(32));
  assert.equal(a.offers,192);
  assert.equal(a.introScatter.definitionId,'gun-scatter');
  assert.ok(a.overall.medianAcquisitionPlusRestore>=a.overall.medianPrice);
  assert.ok(a.overall.pctWithinStartingCredits>=0&&a.overall.pctWithinStartingCredits<=100);
});
test('repairs are separately charged and deep damage exceeds shallow damage',()=>{
  const e=evaluateEconomy();
  assert.equal(e.startingCredits,600);
  assert.equal(e.scenarios[20].yardWinAfterAmmo,830);
  assert.ok(e.repairQuotesCredits['60pctBothHousingAndInternals']>e.repairQuotesCredits['10pctBothHousingAndInternals']);
});
test('short paired combat research executes with current AI and same reverse seed',()=>{
  const r=evaluateBattles({pairs:1,seconds:2,accuracy:0,seed:501});
  assert.equal(r.settings.bouts,14);
  assert.equal(r.results.length,7);
  for(const matchup of r.results){
    assert.equal(matchup.bouts,2);
    assert.equal(matchup.boutRecords[0].seed,matchup.boutRecords[1].seed);
    assert.ok(matchup.wins+matchup.losses+matchup.draws===2);
  }
});
