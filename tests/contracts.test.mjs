import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRangeTarget, createTargetCondition, weaponFor } from '../combat.js';
import { inspectAssembly, installedPart, SLOTS } from '../components.js';
import { makeStarterAssembly, salvageOffer } from '../acquisition.js';
import { CONTRACTS, contractById, selectContract, selectedContract } from '../contracts.js';
import { settleSortie } from '../economy.js';

const definitionIds = assembly => Object.fromEntries(SLOTS.map(slot => [slot, installedPart(assembly, slot)?.definition.id ?? null]));

function fakeStorage() {
    const values = new Map();
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
    };
}

test('first contract board exposes three authored opponent roles', () => {
    assert.deepEqual(CONTRACTS.map(contract => contract.id), ['yard-dog', 'cutter', 'mule']);
    assert.deepEqual(CONTRACTS.map(contract => contract.loadout.mobility), ['legs-yard', 'legs-compact', 'legs-hauler']);
    assert.deepEqual(CONTRACTS.map(contract => contract.payout), [850, 950, 1050]);
});

test('every contract builds a fieldable physical opponent from its declared loadout', () => {
    for (const contract of CONTRACTS) {
        const target = makeRangeTarget(contract.id);
        assert.equal(target.contractId, contract.id);
        assert.equal(target.serial, contract.opponentSerial);
        assert.deepEqual(definitionIds(target), contract.loadout, contract.id);
        assert.equal(inspectAssembly(target).ready, true, contract.id);
        assert.ok(weaponFor(target), contract.id);
        assert.equal(new Set(target.owned.map(part => part.serial)).size, target.owned.length, `${contract.id} serials`);
    }
});

test('contract choice routes first salvage toward signature hardware', () => {
    const player = makeStarterAssembly();
    const expected = {
        'yard-dog': 'gun-short',
        cutter: 'legs-compact',
        mule: 'legs-hauler',
    };
    for (const contract of CONTRACTS) {
        const target = makeRangeTarget(contract.id);
        const offer = salvageOffer(player, target, createTargetCondition(target));
        assert.equal(offer?.definitionId, expected[contract.id], contract.id);
    }
});

test('contract selection is session-scoped and rejects unknown IDs', () => {
    const storage = fakeStorage();
    assert.equal(selectedContract(storage).id, 'yard-dog');
    assert.equal(selectContract('cutter', storage).ok, true);
    assert.equal(selectedContract(storage).id, 'cutter');
    const rejected = selectContract('not-real', storage);
    assert.equal(rejected.ok, false);
    assert.equal(selectedContract(storage).id, 'cutter');
    assert.equal(contractById('not-real').id, 'yard-dog');
});

test('victory settlement accepts the authored contract payout without changing defeat recovery', () => {
    for (const contract of CONTRACTS) {
        const victory = settleSortie({ credits: 100, victory: true, roundsFired: 10, victoryPayout: contract.payout });
        assert.equal(victory.grossPayout, contract.payout);
        assert.equal(victory.creditsAfter, 100 + contract.payout - 10);
    }
    const defeat = settleSortie({ credits: 100, victory: false, roundsFired: 10, victoryPayout: 9999 });
    assert.equal(defeat.grossPayout, 350);
});
