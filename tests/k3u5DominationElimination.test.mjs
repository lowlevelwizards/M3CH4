import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { squadOutcome } from '../squadBattle.js';
import { contractById } from '../contracts.js';
import { createSortieObjective } from '../sortieObjectives.js';
const active=(id,team,enabled)=>({id,team,active:enabled});
const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const battleHandler=source.slice(source.indexOf('function checkSquadOutcome()'),
  source.indexOf('function missionKillAiActor('));
test('Domination all-enemies-disabled returns immediate friendly victory with score below 60',()=>{
  const state=createSortieObjective(contractById('domination'));
  assert.equal(state.friendlyProgress,0);
  const actors=[active('ally-1','friendly',true),active('ally-2','friendly',true),
    active('enemy-0','hostile',false),active('enemy-1','hostile',false),
    active('enemy-2','hostile',false)];
  const outcome=squadOutcome(true,actors);
  assert.equal(outcome.victory,true);
  assert.equal(outcome.reason,'HOSTILE TEAM COMBAT INEFFECTIVE');
  assert.match(battleHandler,/if \(outcome && !testEnded\)\s*finishSortie\(outcome.victory, outcome.reason\)/);
  assert.doesNotMatch(battleHandler,/type!=='domination'/);
});
test('Domination continues while even one enemy mech remains active',()=>{
 const actors=[active('ally-1','friendly',true),
   active('enemy-0','hostile',false),active('enemy-1','hostile',true),
   active('enemy-2','hostile',false)];
 assert.equal(squadOutcome(true,actors),null);
});
test('Domination continues to end on friendly-team defeat, including player disabled',()=>{
 const actors=[active('ally-1','friendly',false),active('ally-2','friendly',false),
   active('enemy-0','hostile',true)];
 const outcome=squadOutcome(false,actors);
 assert.equal(outcome.victory,false);
 assert.equal(outcome.reason,'FRIENDLY TEAM COMBAT INEFFECTIVE');
});
test('Domination score still independently resolves before last enemy dies',()=>{
 const state=createSortieObjective(contractById('domination'));
 assert.equal(state.type,'domination');
 assert.equal(state.complete,false);
 assert.ok(state.domination.scoreToWin>=60);
 assert.match(source,/const objectiveOutcome = advanceSortieObjective\(sortieObjective, battleParticipants\(\), FIXED_DT\)/);
 assert.match(source,/if \(objectiveOutcome\) finishSortie\(objectiveOutcome.victory, objectiveOutcome.reason\)/);
});

test('k3u7 Pages entrypoint loads the new squad-elimination gameplay script',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('main.js?v=k3z'));
 assert.ok(html.includes('RIG DIAGNOSTICS <span id="dev-version"></span>'));
 assert.match(html,/Frame Anatomy Rewrite/);
});
