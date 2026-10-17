import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS } from '../combat.js';
import { SORTIE_OUTRO_SECONDS } from '../combatPresentation.js';

test('post-bout aftermath is long enough to inhabit the cleared yard', () => {
    assert.ok(SORTIE_OUTRO_SECONDS >= 3.8 && SORTIE_OUTRO_SECONDS <= 5.0);
    const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
    assert.match(source, /aftermathDriving/);
    assert.match(source, /if \(!aftermathDriving\)/);
    assert.match(source, /for \(const actor of aiActors\)/);
    assert.match(source, /controls\.setEnabled\(victory && playerCombatActive/);
});

test('starter projectile weapons have deliberate physical recoil', () => {
    assert.ok(WEAPONS['gun-short'].recoilImpulseNs >= 2400);
    assert.ok(WEAPONS['gun-cannon'].recoilImpulseNs >= 1650);
    assert.ok(WEAPONS['gun-light'].recoilImpulseNs >= 1000);
});

test('debrief communicates draft order and the current salvage turn', () => {
    const source = fs.readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
    assert.match(source, /CLAIM ORDER/);
    assert.match(source, /Higher bout score \/ participation drafts first/);
    assert.match(source, /PICK 1 RECOVERABLE PART/);
});

test('cockpit readouts stay enlarged and recoil remains visibly animated without touching world resolution', () => {
    const source = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
    assert.match(source, /systems: \{ position: \[-\.091, \.004, -\.105\], scale: \.066 \}/);
    assert.match(source, /muzzleKick \* \.19/);
    assert.match(source, /muzzleKick = Math\.max\(0, muzzleKick - dt \*/);
});
