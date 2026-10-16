import test from 'node:test';
import assert from 'node:assert/strict';
import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from '../combatPresentation.js';

test('sortie outro leaves a readable battlefield beat before debrief', () => {
  assert.ok(SORTIE_OUTRO_SECONDS >= 2.4 && SORTIE_OUTRO_SECONDS <= 3.2);
});

test('power internals cause a strong blackout, long flicker and visible arcing', () => {
  const armor = cockpitImpactProfile('power', { internalDamage: 0 });
  const internal = cockpitImpactProfile('power', { internalDamage: 30 });
  const disabled = cockpitImpactProfile('power', { internalDamage: 30, disabled: true });
  assert.equal(armor.blackoutSeconds, 0);
  assert.equal(armor.arcCount, 0);
  assert.ok(internal.blackoutSeconds >= .18);
  assert.ok(internal.flickerSeconds > .9);
  assert.ok(internal.arcCount >= 2);
  assert.ok(internal.sparkCount > armor.sparkCount);
  assert.ok(disabled.blackoutSeconds >= .4);
  assert.ok(disabled.arcCount > internal.arcCount);
});

test('mobility hit attitude identifies the struck drive side', () => {
  const left = cockpitImpactProfile('mobility', { internalDamage: 20, driveSide: 'left' });
  const right = cockpitImpactProfile('mobility', { internalDamage: 20, driveSide: 'right' });
  assert.ok(left.roll > 0);
  assert.ok(right.roll < 0);
});

test('combat internals shake the physical weapon mount', () => {
  assert.ok(cockpitImpactProfile('combat', { internalDamage: 20 }).gunShake > 0);
});

test('armor pings remain much quieter than internal structure hits', () => {
  const armor = cockpitImpactProfile('structure', { internalDamage: 0 });
  const internal = cockpitImpactProfile('structure', { internalDamage: 35 });
  assert.ok(internal.shake > armor.shake * 1.5);
  assert.ok(internal.sparkCount > armor.sparkCount);
});
