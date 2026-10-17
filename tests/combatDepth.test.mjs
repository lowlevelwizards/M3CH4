import test from 'node:test';
import assert from 'node:assert/strict';
import { contractById } from '../contracts.js';
import { WEAPONS } from '../combat.js';
import { damagePosture } from '../damageBehavior.js';
import { squadIntent, squadRole } from '../squadCoordination.js';
import { advanceSortieObjective, createSortieObjective, OBJECTIVE_TYPES } from '../sortieObjectives.js';
const part = ratio => ({ integrity: ratio * 100, maxIntegrity: 100, destroyed: false });
const condition = ({ structure=1, mobility=1, power=1, command=1, combat=1 } = {}) => ({ parts: { structure: part(structure), mobility: part(mobility), power: part(power), command: part(command), combat: part(combat) } });
const actor = (id, team, behavior, x, z) => ({ id, team, behavior, rig: { x, z }, active: true });
test('campaign contracts exercise elimination, recovery, control and breakthrough rules', () => {
  assert.equal(contractById('yard-dog').objective.type, OBJECTIVE_TYPES.ELIMINATION);
  assert.equal(contractById('recovery-run').objective.type, OBJECTIVE_TYPES.RECOVERY);
  assert.equal(contractById('cutter').objective.type, OBJECTIVE_TYPES.CONTROL);
  assert.equal(contractById('mule').objective.type, OBJECTIVE_TYPES.BREAKTHROUGH);
});
test('control objective advances only for an uncontested team', () => {
  const state = createSortieObjective({ objective: { type: 'control', point: { x: 0, z: 0 }, radius: 3, holdSeconds: 2 } });
  const friendly = actor('f', 'friendly', null, 0, 0), hostile = actor('h', 'hostile', null, 9, 9);
  assert.equal(advanceSortieObjective(state, [friendly, hostile], 1), null); assert.equal(state.friendlyProgress, 1);
  hostile.rig.x = 1; hostile.rig.z = 0; advanceSortieObjective(state, [friendly, hostile], .5); assert.equal(state.friendlyProgress, 1); assert.equal(state.contested, true);
  hostile.rig.x = 9; hostile.rig.z = 9; assert.equal(advanceSortieObjective(state, [friendly, hostile], 1)?.victory, true);
});
test('damage posture turns critical machines into withdrawal and crippled machines into holds', () => {
  assert.equal(damagePosture(condition({ structure: .12 }), { id: 'skirmisher' }).preferredMode, 'WITHDRAW');
  assert.equal(damagePosture(condition({ mobility: .15 }), { id: 'pressure' }).preferredMode, 'HOLD');
  assert.equal(damagePosture(condition({ combat: 0, structure: .8 }), { id: 'bruiser' }).preferredMode, 'ANCHOR');
});
test('squad intent separates roles and regroups isolated actors', () => {
  const pressure = { id: 'pressure', preferredRangeM: 6 }, flank = { id: 'skirmisher', preferredRangeM: 8 }, anchor = { id: 'bruiser', preferredRangeM: 5 };
  assert.equal(squadRole({ behavior: flank }), 'FLANKER'); assert.equal(squadRole({ behavior: anchor }), 'ANCHOR');
  const target = actor('enemy', 'hostile', pressure, 0, -8), isolated = actor('isolated', 'friendly', flank, 14, 12), allyA = actor('ally-a', 'friendly', pressure, 0, 10), allyB = actor('ally-b', 'friendly', anchor, 1, 9);
  assert.equal(squadIntent(isolated, [isolated, allyA, allyB], target).mode, 'REGROUP');
});
test('starting weapons gain strongly different handling signatures without changing their damage values', () => {
  assert.ok(WEAPONS['gun-short'].visualRecoil > WEAPONS['gun-cannon'].visualRecoil);
  assert.ok(WEAPONS['gun-cannon'].visualRecoil > WEAPONS['gun-light'].visualRecoil);
  assert.ok(WEAPONS['gun-short'].visualRecovery < WEAPONS['gun-light'].visualRecovery);
  assert.match(WEAPONS['gun-short'].handling, /HEAVY KICK/);
});
