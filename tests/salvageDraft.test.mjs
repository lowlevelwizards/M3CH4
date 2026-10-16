import test from 'node:test';
import assert from 'node:assert/strict';
import { createTargetCondition, makeRangeTarget } from '../combat.js';
import {
    advanceAiDraft, claimDraftEntry, createSalvageDraft, currentDrafter,
    draftSequence, playerClaimChoices, wreckManifest,
} from '../salvageDraft.js';

test('destroyed hardware remains on the wreck manifest but cannot be claimed', () => {
    const assembly = makeRangeTarget('yard-dog');
    const condition = createTargetCondition(assembly);
    condition.parts.combat.integrity = 0;
    condition.parts.combat.destroyed = true;
    condition.parts.combat.destruction = 999;
    condition.parts.power.integrity = 0;
    const manifest = wreckManifest({ id: 'enemy-0', label: 'YARD DOG', assembly, condition, active: false });
    const gun = manifest.parts.find(part => part.slot === 'combat');
    const power = manifest.parts.find(part => part.slot === 'power');
    assert.equal(gun.status, 'destroyed');
    assert.equal(gun.destroyed, true);
    assert.equal(power.status, 'disabled');
    const draft = createSalvageDraft({ draftOrder: ['player'], manifests: [manifest] });
    assert.equal(draft.pool.some(part => part.id === gun.id), true);
    assert.equal(playerClaimChoices(draft).some(part => part.id === gun.id), false);
    assert.equal(playerClaimChoices(draft).some(part => part.id === power.id), true);
});

test('current three-pilot draft is score ordered and future rounds snake', () => {
    assert.deepEqual(draftSequence(['a','b','c'], 1), ['a','b','c']);
    assert.deepEqual(draftSequence(['a','b','c'], 2), ['a','b','c','c','b','a']);
});

test('AI turns advance until the player receives an actual choice', () => {
    const assembly = makeRangeTarget('mule');
    const condition = createTargetCondition(assembly);
    const manifest = wreckManifest({ id: 'enemy-0', label: 'MULE', assembly, condition, active: false });
    const draft = createSalvageDraft({ draftOrder: ['ally-1','player','ally-2'], manifests: [manifest] });
    const picks = advanceAiDraft(draft, 'player');
    assert.equal(picks.length, 1);
    assert.equal(picks[0].actorId, 'ally-1');
    assert.equal(currentDrafter(draft), 'player');
    const choice = playerClaimChoices(draft)[0];
    const result = claimDraftEntry(draft, 'player', choice.id);
    assert.equal(result.ok, true);
    advanceAiDraft(draft, 'player');
    assert.equal(currentDrafter(draft), null);
    assert.equal(draft.picks.length, 3);
});

test('duplicate definitions remain valid physical salvage choices', () => {
    const assembly = makeRangeTarget('yard-dog');
    const condition = createTargetCondition(assembly);
    const manifest = wreckManifest({ id: 'enemy-0', label: 'YARD DOG', assembly, condition, active: false });
    const draft = createSalvageDraft({ draftOrder: ['player'], manifests: [manifest] });
    const first = manifest.parts[0];
    const choices = playerClaimChoices(draft, new Set([first.definitionId]));
    assert.equal(choices.some(part => part.definitionId === first.definitionId), true);
});
