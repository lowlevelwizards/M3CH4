import test from 'node:test';
import assert from 'node:assert/strict';
import { persistentFailureProfile } from '../damageVisuals.js';

test('power damage becomes the strongest persistent smoke spark and arc source', () => {
    const power = persistentFailureProfile('power', .18);
    const structure = persistentFailureProfile('structure', .18);
    assert.ok(power.sparkRate > 8);
    assert.ok(power.smokeRate > 1.5);
    assert.ok(power.arcRate > 0.4);
    assert.ok(power.sparkRate > structure.sparkRate);
    assert.ok(power.smokeRate > structure.smokeRate);
});

test('healthy machines do not emit persistent failure noise', () => {
    for (const slot of ['structure','mobility','power','command','combat']) {
        const profile = persistentFailureProfile(slot, 1);
        assert.equal(profile.sparkRate, 0, slot);
        assert.equal(profile.smokeRate, 0, slot);
        assert.equal(profile.arcRate, 0, slot);
    }
});
