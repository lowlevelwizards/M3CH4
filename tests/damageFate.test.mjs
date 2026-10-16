import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DESTRUCTION_THRESHOLD_RATIO, applyDestructionOverflow, destructionThreshold,
    hydrateDamageFate, partFate, resetDamageFate,
} from '../damageFate.js';

test('zero integrity is disabled before additional overkill destroys the component', () => {
    const part = { integrity: 0, maxIntegrity: 100 };
    hydrateDamageFate(part);
    assert.equal(partFate(part), 'disabled');
    const threshold = destructionThreshold(part);
    assert.equal(threshold, 100 * DESTRUCTION_THRESHOLD_RATIO);
    const first = applyDestructionOverflow(part, threshold - 1);
    assert.equal(first.destroyed, false);
    assert.equal(partFate(part), 'disabled');
    const second = applyDestructionOverflow(part, 1);
    assert.equal(second.justDestroyed, true);
    assert.equal(partFate(part), 'destroyed');
});

test('damage overflow before disable does not count as destruction reserve', () => {
    const part = { integrity: 20, maxIntegrity: 100 };
    hydrateDamageFate(part);
    applyDestructionOverflow(part, 999);
    assert.equal(part.destruction, 0);
    assert.equal(part.destroyed, false);
});

test('destroyed fate hydrates and resets deterministically', () => {
    const part = { integrity: 0, maxIntegrity: 120 };
    hydrateDamageFate(part, { destroyed: true });
    assert.equal(part.destruction, destructionThreshold(part));
    assert.equal(partFate(part), 'destroyed');
    resetDamageFate(part);
    assert.equal(part.destroyed, false);
    assert.equal(part.destruction, 0);
});
