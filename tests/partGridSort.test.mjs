import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedPartStatus, sortPartEntries } from '../partGridUI.js';

const parts = [
    { id: 'b', slot: 'combat', condition: .92, value: 700 },
    { id: 'a', slot: 'mobility', condition: .41, value: 1500 },
    { id: 'c', slot: 'power', condition: 0, value: 300, status: 'disabled' },
];

test('salvage grid sorts independently by value condition and physical type', () => {
    assert.deepEqual(sortPartEntries(parts, 'value').map(part => part.id), ['a','b','c']);
    assert.deepEqual(sortPartEntries(parts, 'condition').map(part => part.id), ['b','a','c']);
    assert.deepEqual(sortPartEntries(parts, 'type').map(part => part.id), ['a','c','b']);
});

test('visual state distinguishes disabled intact hardware from destroyed scrap', () => {
    assert.equal(normalizedPartStatus({ condition: 0, destroyed: false }), 'disabled');
    assert.equal(normalizedPartStatus({ condition: .8, destroyed: true }), 'destroyed');
    assert.equal(normalizedPartStatus({ condition: .3 }), 'critical');
});
