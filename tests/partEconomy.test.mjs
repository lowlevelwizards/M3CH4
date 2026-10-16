import test from 'node:test';
import assert from 'node:assert/strict';
import { basePartValue, partCreditValue } from '../partEconomy.js';

test('part value falls with physical condition but disabled hardware retains rebuild value', () => {
    const pristine = partCreditValue('legs-hauler', 1);
    const damaged = partCreditValue('legs-hauler', .45);
    const disabled = partCreditValue('legs-hauler', 0);
    assert.equal(pristine, basePartValue('legs-hauler'));
    assert.ok(pristine > damaged);
    assert.ok(damaged > disabled);
    assert.ok(disabled > 0);
});

test('destroyed hardware is worth only scrap compared with disabled intact hardware', () => {
    const disabled = partCreditValue('gun-light', 0, { destroyed: false });
    const destroyed = partCreditValue('gun-light', 0, { destroyed: true });
    assert.ok(disabled > destroyed * 2);
});
