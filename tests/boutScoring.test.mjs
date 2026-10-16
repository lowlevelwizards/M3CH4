import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoutLedger, recordBoutHit, recordMissionKill, scoreBout } from '../boutScoring.js';

const roster = [
    { id: 'player', team: 'friendly', label: 'YOU' },
    { id: 'ally-1', team: 'friendly', label: 'ALLY KESTREL' },
    { id: 'ally-2', team: 'friendly', label: 'ALLY HAULER' },
    { id: 'enemy-0', team: 'hostile', label: 'YARD DOG' },
];

function hit(ledger, attackerId, victimId, { armor = 0, internal = 0, beforeIntegrity = 100, afterIntegrity = 100, disabled = false } = {}) {
    const before = { armor: armor > 0 ? armor : 0, maxArmor: 100, integrity: beforeIntegrity, maxIntegrity: 100, destroyed: false };
    const after = { armor: 0, maxArmor: 100, integrity: afterIntegrity, maxIntegrity: 100, destroyed: false };
    recordBoutHit(ledger, {
        attackerId, victimId, slot: 'command', before, after,
        hit: { armorAbsorbed: armor, internalDamage: internal, disabled },
    });
}

test('the pilot who does the real work can outrank the finishing blow', () => {
    const ledger = createBoutLedger(roster);
    hit(ledger, 'player', 'enemy-0', { armor: 100, internal: 90, beforeIntegrity: 100, afterIntegrity: 10 });
    hit(ledger, 'ally-1', 'enemy-0', { internal: 10, beforeIntegrity: 10, afterIntegrity: 0, disabled: true });
    recordMissionKill(ledger, { attackerId: 'ally-1', victimId: 'enemy-0', reason: 'COMMAND COMPARTMENT DISABLED' });
    const result = scoreBout(ledger, {
        winningTeam: 'friendly',
        survivors: { player: true, 'ally-1': true, 'ally-2': true, 'enemy-0': false },
    });
    const player = result.standings.find(row => row.id === 'player');
    const finisher = result.standings.find(row => row.id === 'ally-1');
    assert.ok(player.combatScore > finisher.combatScore);
    assert.equal(player.assists, 1);
    assert.equal(finisher.missionKills, 1);
    assert.equal(result.draftOrder[0], 'player');
});

test('survival cannot rescue a pilot who hid while teammates won the bout', () => {
    const ledger = createBoutLedger(roster);
    hit(ledger, 'ally-1', 'enemy-0', { armor: 100, internal: 100, beforeIntegrity: 100, afterIntegrity: 0, disabled: true });
    recordMissionKill(ledger, { attackerId: 'ally-1', victimId: 'enemy-0' });
    const result = scoreBout(ledger, {
        winningTeam: 'friendly',
        survivors: { player: true, 'ally-1': true, 'ally-2': true, 'enemy-0': false },
    });
    const player = result.standings.find(row => row.id === 'player');
    assert.equal(player.lowParticipation, true);
    assert.equal(result.draftOrder.at(-1), 'player');
});

test('MVP is combat contribution only and can belong to the losing side', () => {
    const ledger = createBoutLedger(roster);
    hit(ledger, 'enemy-0', 'ally-1', { armor: 100, internal: 100, beforeIntegrity: 100, afterIntegrity: 0, disabled: true });
    recordMissionKill(ledger, { attackerId: 'enemy-0', victimId: 'ally-1' });
    hit(ledger, 'player', 'enemy-0', { internal: 10, beforeIntegrity: 100, afterIntegrity: 90 });
    const result = scoreBout(ledger, {
        winningTeam: 'friendly',
        survivors: { player: true, 'ally-1': false, 'ally-2': true, 'enemy-0': false },
    });
    assert.equal(result.mvp.id, 'enemy-0');
    assert.equal(result.winningTeam, 'friendly');
});
