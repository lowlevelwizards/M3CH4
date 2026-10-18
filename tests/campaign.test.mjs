import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableCampaignNodes,
  campaignFromLegacyProgression,
  campaignSummary,
  createCampaignState,
  isCampaignNodeAvailable,
  recordCampaignSalvage,
  recordCampaignSortie,
} from '../campaign.js';

const win = (state, nodeId, creditsEarned = 0) => recordCampaignSortie(state, { nodeId, victory: true, creditsEarned }).state;

test('fresh campaign exposes only the opening bout', () => {
  const campaign = createCampaignState();
  assert.deepEqual(availableCampaignNodes(campaign), ['yard-dog']);
  assert.equal(isCampaignNodeAvailable(campaign, 'cutter'), false);
});

test('Yard Dog opens the recovery/Cutter fork and Cutter advances to Mule', () => {
  let campaign = win(createCampaignState(), 'yard-dog', 850);
  assert.deepEqual(availableCampaignNodes(campaign), ['yard-dog', 'recovery-run', 'cutter', 'domination']);
  campaign = win(campaign, 'recovery-run', 450);
  assert.equal(isCampaignNodeAvailable(campaign, 'mule'), false, 'optional recovery does not bypass Cutter');
  campaign = win(campaign, 'cutter', 950);
  assert.equal(isCampaignNodeAvailable(campaign, 'mule'), true);
});

test('a defeat exposes recovery work without erasing the failed job', () => {
  const result = recordCampaignSortie(createCampaignState(), { nodeId: 'yard-dog', victory: false, creditsEarned: 350 });
  assert.equal(result.state.defeats, 1);
  assert.equal(result.state.clearedNodes.includes('yard-dog'), false);
  assert.equal(isCampaignNodeAvailable(result.state, 'recovery-run'), true);
  assert.equal(isCampaignNodeAvailable(result.state, 'yard-dog'), true);
});

test('Mule unlocks the mixed final and clearing it completes the run', () => {
  let campaign = createCampaignState();
  campaign = win(campaign, 'yard-dog');
  campaign = win(campaign, 'cutter');
  campaign = win(campaign, 'mule');
  assert.equal(isCampaignNodeAvailable(campaign, 'circuit-final'), true);
  const finale = recordCampaignSortie(campaign, { nodeId: 'circuit-final', victory: true, creditsEarned: 1450 });
  assert.equal(finale.becameComplete, true);
  const summary = campaignSummary(finale.state);
  assert.equal(summary.complete, true);
  assert.equal(summary.clearedRequired, 4);
  assert.equal(summary.requiredTotal, 4);
  assert.equal(summary.sorties, 4);
  assert.equal(summary.creditsEarned, 1450);
});

test('legacy contract clears seed campaign location but not invented statistics', () => {
  const campaign = campaignFromLegacyProgression({ clearedContracts: ['yard-dog', 'cutter'] });
  assert.deepEqual(campaign.clearedNodes, ['yard-dog', 'cutter']);
  assert.equal(isCampaignNodeAvailable(campaign, 'mule'), true);
  assert.equal(campaign.sorties, 0);
});

test('salvage summary counts physical claims without owning inventory state', () => {
  const campaign = recordCampaignSalvage(createCampaignState(), 2);
  assert.equal(campaign.salvageRecovered, 2);
  assert.equal('inventory' in campaign, false);
  assert.equal('credits' in campaign, false);
});
