import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRIENDLY_SUPPORTS,
  HOSTILE_SUPPORT_SPAWNS,
  FRIENDLY_TEAM,
  HOSTILE_TEAM,
  chooseSquadTarget,
  hostileSupportRecipes,
  squadCounts,
  squadOutcome,
} from '../squadBattle.js';

test('formations provide two supports per side on opposite ends of the yard', () => {
  assert.equal(FRIENDLY_SUPPORTS.length, 2);
  assert.equal(HOSTILE_SUPPORT_SPAWNS.length, 2);
  assert.ok(FRIENDLY_SUPPORTS.every(spawn => spawn.z > 18 && spawn.team === FRIENDLY_TEAM));
  assert.ok(HOSTILE_SUPPORT_SPAWNS.every(spawn => spawn.z < -18 && spawn.team === HOSTILE_TEAM));
  assert.ok(Math.min(...FRIENDLY_SUPPORTS.map(spawn => Math.abs(spawn.x))) >= 8);
  assert.ok(Math.min(...HOSTILE_SUPPORT_SPAWNS.map(spawn => Math.abs(spawn.x))) >= 8);
});

test('contract squads escalate without revealing every later role in Yard Dog', () => {
  assert.deepEqual(hostileSupportRecipes('yard-dog'), ['yard-dog', 'yard-dog']);
  assert.deepEqual(hostileSupportRecipes('cutter'), ['yard-dog', 'cutter']);
  assert.deepEqual(hostileSupportRecipes('mule'), ['yard-dog', 'cutter']);
});

test('target selection prefers nearby enemies but retains a credible current target', () => {
  const actor = { id: 'enemy-0', rig: { x: 0, z: 0 } };
  const candidates = [
    { id: 'player', active: true, rig: { x: 0, z: 10 } },
    { id: 'ally-1', active: true, rig: { x: 0, z: 8 } },
    { id: 'ally-2', active: true, rig: { x: 20, z: 0 } },
  ];
  assert.equal(chooseSquadTarget(actor, candidates), 'ally-1');
  assert.equal(chooseSquadTarget(actor, candidates, 'player'), 'player');
  candidates[0].rig.z = 18;
  assert.equal(chooseSquadTarget(actor, candidates, 'player'), 'ally-1');
  candidates[1].active = false;
  assert.equal(chooseSquadTarget(actor, candidates, 'ally-1'), 'player');
});

test('battle resolves only when every active actor on a side is out', () => {
  const actors = [
    { id: 'ally-1', team: FRIENDLY_TEAM, active: true },
    { id: 'ally-2', team: FRIENDLY_TEAM, active: true },
    { id: 'enemy-0', team: HOSTILE_TEAM, active: true },
    { id: 'enemy-1', team: HOSTILE_TEAM, active: true },
    { id: 'enemy-2', team: HOSTILE_TEAM, active: true },
  ];
  assert.deepEqual(squadCounts(true, actors), { friendly: 3, hostile: 3 });
  assert.equal(squadOutcome(true, actors), null);
  actors.filter(actor => actor.team === HOSTILE_TEAM).forEach(actor => { actor.active = false; });
  assert.deepEqual(squadOutcome(true, actors), {
    victory: true,
    reason: 'HOSTILE TEAM COMBAT INEFFECTIVE',
    counts: { friendly: 3, hostile: 0 },
  });
  actors[0].active = false;
  actors[1].active = false;
  actors.filter(actor => actor.team === HOSTILE_TEAM).forEach(actor => { actor.active = true; });
  assert.deepEqual(squadOutcome(false, actors), {
    victory: false,
    reason: 'FRIENDLY TEAM COMBAT INEFFECTIVE',
    counts: { friendly: 0, hostile: 3 },
  });
});
