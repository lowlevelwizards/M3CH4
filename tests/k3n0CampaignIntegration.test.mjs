import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contractUI = fs.readFileSync(new URL('../contractUI.js', import.meta.url), 'utf8');
const campaign = fs.readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../persistence.js', import.meta.url), 'utf8');

test('garage home is an operation board with a persistent machine-independent campaign state', () => {
  assert.match(contractUI, /campaign-map/);
  assert.match(contractUI, /SCRAPYARD CIRCUIT/);
  assert.match(contractUI, /RUN ANOTHER CIRCUIT · KEEP THIS RIG/);
  assert.match(campaign, /CAMPAIGN_STORAGE_KEY/);
  assert.doesNotMatch(campaign, /ownedParts|playerCondition|assembly:/);
});

test('bout result feeds campaign outcomes and salvage claims feed the run summary', () => {
  assert.match(contractUI, /recordCampaignSortie/);
  assert.match(contractUI, /latestBoutResult/);
  assert.match(contractUI, /m3ch4:inventory-changed/);
  assert.match(contractUI, /recordCampaignSalvage/);
});

test('DEV machine wipe also clears campaign state', () => {
  assert.match(persistence, /CAMPAIGN_STORAGE_KEY/);
  assert.match(persistence, /MACHINE_SAVE_KEY, CAMPAIGN_STORAGE_KEY/);
});
