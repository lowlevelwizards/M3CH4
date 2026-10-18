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

test('campaign board exposes the three rivals plus recovery work and a final', () => {
    assert.deepEqual(CONTRACTS.map(contract => contract.id), ['yard-dog', 'recovery-run', 'cutter', 'domination', 'mule', 'circuit-final']);
    assert.deepEqual(CONTRACTS.map(contract => contract.payout), [850, 450, 950, 1050, 1450]);
    assert.equal(contractById('recovery-run').risk, 'LOW');
    assert.equal(contractById('circuit-final').risk, 'SEVERE');
});

test('every campaign job builds a fieldable physical opponent from its declared loadout', () => {
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

test('the three signature rivals still route first salvage toward signature hardware', () => {
    const player = makeStarterAssembly();
    const expected = {
        'yard-dog': 'gun-short',
        cutter: 'legs-compact',
        mule: 'legs-hauler',
    };
    for (const [id, definitionId] of Object.entries(expected)) {
        const target = makeRangeTarget(id);
        const offer = salvageOffer(player, target, createTargetCondition(target));
        assert.equal(offer?.definitionId, definitionId, id);
    }
});

test('contract selection remains session-scoped when no browser campaign gate is present', () => {
    const storage = fakeStorage();
    assert.equal(selectedContract(storage).id, 'yard-dog');
    assert.equal(selectContract('cutter', storage).ok, true);
    assert.equal(selectedContract(storage).id, 'cutter');
    assert.equal(selectContract('circuit-final', storage).ok, true);
    assert.equal(selectedContract(storage).id, 'circuit-final');
    const rejected = selectContract('not-real', storage);
    assert.equal(rejected.ok, false);
    assert.equal(selectedContract(storage).id, 'circuit-final');
    assert.equal(contractById('not-real').id, 'yard-dog');
});

test('victory settlement accepts every authored job payout without changing defeat recovery', () => {
    for (const contract of CONTRACTS) {
        const victory = settleSortie({ credits: 100, victory: true, roundsFired: 10, victoryPayout: contract.payout });
        assert.equal(victory.grossPayout, contract.payout);
        assert.equal(victory.creditsAfter, 100 + contract.payout - 10);
    }
    const defeat = settleSortie({ credits: 100, victory: false, roundsFired: 10, victoryPayout: 9999 });
    assert.equal(defeat.grossPayout, 350);
});
