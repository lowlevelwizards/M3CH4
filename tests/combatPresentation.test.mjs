import test from 'node:test';
import assert from 'node:assert/strict';
import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from '../combatPresentation.js';

test('sortie outro leaves a readable battlefield beat before debrief', () => {
  assert.ok(SORTIE_OUTRO_SECONDS >= 2.4 && SORTIE_OUTRO_SECONDS <= 3.2);
});

test('power internals cause blackout/flicker while armor pings stay restrained', () => {
  const armor = cockpitImpactProfile('power', { internalDamage: 0 });
  const internal = cockpitImpactProfile('power', { internalDamage: 30 });
  assert.equal(armor.blackoutSeconds, 0);
  assert.ok(internal.blackoutSeconds > 0);
  assert.ok(internal.flickerSeconds > armor.flickerSeconds);
  assert.ok(internal.sparkCount > armor.sparkCount);
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
