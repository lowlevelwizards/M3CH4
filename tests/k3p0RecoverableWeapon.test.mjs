import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTargetHit, createTargetCondition, makeRangeTarget } from '../combat.js';
import {
  FIELD_SERVICE_RECOVERY_RATIO, FIELD_SERVICE_SECONDS, advanceFieldService, arrestFirstWeaponFailure,
  beginFieldService, canFieldService, createFieldServiceState,
} from '../fieldService.js';
import { aiWeaponMissionKillReason, aiWeaponRecoveryDirective, aiWeaponRecoveryPosture } from '../aiFieldService.js';
import { damagePosture } from '../damageBehavior.js';

function actorWithFault(condition, service, overrides = {}) {
  return {
    condition, fieldService: service, behavior: { id: 'pressure' },
    rig: { x: 0, z: 0, vx: 0, vz: 0, yawRate: 0 },
    motion: { awareness: { lineOfSight: false, underFireSeconds: 1 } },
    ...overrides,
  };
}

test('first AI weapon disable is a recoverable fault rather than a mission kill', () => {
  const condition = createTargetCondition(makeRangeTarget('yard-dog'));
  const service = createFieldServiceState();
  const weapon = condition.parts.combat;
  const before = weapon.integrity;
  applyTargetHit(condition, 'combat', weapon.armor + weapon.integrity + 1);
  assert.equal(arrestFirstWeaponFailure(condition, service, before), true);
  assert.equal(canFieldService(condition, service), true);
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), null);
});

test('faulted AI withdraws while exposed and services only when reasonably safe', () => {
  const condition = createTargetCondition(makeRangeTarget('yard-dog'));
  const service = createFieldServiceState();
  const weapon = condition.parts.combat;
  const before = weapon.integrity;
  applyTargetHit(condition, 'combat', weapon.armor + weapon.integrity + 1);
  arrestFirstWeaponFailure(condition, service, before);
  const actor = actorWithFault(condition, service, { motion: { awareness: { lineOfSight: true, underFireSeconds: 2 } } });
  const target = { rig: { x: 5, z: 0 } };
  assert.equal(aiWeaponRecoveryDirective(actor, target).mode, 'WITHDRAW');
  actor.motion.awareness.lineOfSight = false;
  const safe = aiWeaponRecoveryDirective(actor, target);
  assert.equal(safe.mode, 'SERVICE');
  assert.equal(safe.begin, true);
  const posture = aiWeaponRecoveryPosture(damagePosture(condition, actor.behavior), safe);
  assert.equal(posture.preferredMode, 'HOLD');
});

test('AI stationary field service returns the gun at twenty percent and spends the bypass', () => {
  const condition = createTargetCondition(makeRangeTarget('yard-dog'));
  const service = createFieldServiceState();
  const weapon = condition.parts.combat;
  const before = weapon.integrity;
  applyTargetHit(condition, 'combat', weapon.armor + weapon.integrity + 1);
  arrestFirstWeaponFailure(condition, service, before);
  const rig = { vx: 0, vz: 0, yawRate: 0 };
  assert.equal(beginFieldService(condition, service, rig), true);
  const result = advanceFieldService(condition, service, rig, FIELD_SERVICE_SECONDS);
  assert.equal(result.event, 'completed');
  assert.equal(service.used, true);
  assert.equal(condition.parts.combat.integrity / condition.parts.combat.maxIntegrity, FIELD_SERVICE_RECOVERY_RATIO);
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), null);
});

test('continued fire must actually destroy a latched fault before field service is denied', () => {
  const condition = createTargetCondition(makeRangeTarget('yard-dog'));
  const service = createFieldServiceState();
  const weapon = condition.parts.combat;
  const before = weapon.integrity;
  applyTargetHit(condition, 'combat', weapon.armor + weapon.integrity + 1);
  arrestFirstWeaponFailure(condition, service, before);
  applyTargetHit(condition, 'combat', 38);
  assert.equal(condition.parts.combat.integrity, 0);
  assert.equal(condition.parts.combat.destroyed, false);
  assert.equal(canFieldService(condition, service), true);
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), null);
  applyTargetHit(condition, 'combat', 38);
  assert.equal(condition.parts.combat.destroyed, true);
  assert.equal(canFieldService(condition, service), false);
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), 'WEAPON DESTROYED');
});

test('a post-bypass weapon disable is a real mission kill', () => {
  const condition = createTargetCondition(makeRangeTarget('yard-dog'));
  const service = createFieldServiceState();
  const weapon = condition.parts.combat;
  const before = weapon.integrity;
  applyTargetHit(condition, 'combat', weapon.armor + weapon.integrity + 1);
  arrestFirstWeaponFailure(condition, service, before);
  const rig = { vx: 0, vz: 0, yawRate: 0 };
  beginFieldService(condition, service, rig);
  advanceFieldService(condition, service, rig, FIELD_SERVICE_SECONDS);
  condition.parts.combat.integrity = condition.parts.combat.maxIntegrity * .08;
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), 'WEAPON DISABLED');
});

test('live integration gives every AI actor service state and visibly sags a faulted mount', async () => {
  const main = await import('node:fs/promises').then(fs => fs.readFile(new URL('../main.js', import.meta.url), 'utf8'));
  const scene = await import('node:fs/promises').then(fs => fs.readFile(new URL('../scene.js', import.meta.url), 'utf8'));
  assert.match(main, /fieldService: createFieldServiceState\(\)/);
  assert.match(main, /aiWeaponRecoveryDirective\(actor, target\)/);
  assert.match(main, /advanceFieldService\(actor\.condition, actor\.fieldService, actor\.rig, FIXED_DT\)/);
  assert.match(main, /weaponFault: recovery\.active/);
  assert.match(scene, /const weaponFault = !!visual\?\.weaponFault/);
  assert.match(scene, /serviceSag/);
});
