import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTargetHit, createTargetCondition, makeRangeTarget } from '../combat.js';
import { destructionThreshold } from '../damageFate.js';

test('ordinary mission damage disables first and later fire destroys', () => {
    const target = makeRangeTarget('yard-dog');
    const condition = createTargetCondition(target);
    const part = condition.parts.combat;
    part.armor = 0;
    const first = applyTargetHit(condition, 'combat', part.integrity);
    assert.equal(first.disabled, true);
    assert.equal(first.destroyed, false);
    assert.equal(part.integrity, 0);
    const threshold = destructionThreshold(part);
    const second = applyTargetHit(condition, 'combat', threshold - 1);
    assert.equal(second.destroyed, false);
    const third = applyTargetHit(condition, 'combat', 1);
    assert.equal(third.justDestroyed, true);
    assert.equal(part.destroyed, true);
});

test('a sufficiently huge final blow carries real overkill into destruction reserve', () => {
    const target = makeRangeTarget('yard-dog');
    const condition = createTargetCondition(target);
    const part = condition.parts.power;
    part.armor = 0;
    const hit = applyTargetHit(condition, 'power', part.integrity + destructionThreshold(part));
    assert.equal(hit.disabled, true);
    assert.equal(hit.justDestroyed, true);
    assert.equal(part.destroyed, true);
});
