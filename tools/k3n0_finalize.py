from pathlib import Path

# Keep DEV wipe semantically fresh: machine + campaign disappear together.
p = Path('persistence.js')
s = p.read_text()
old = "import { CIRCUIT_ORDER, createLegacyProgressionState, createProgressionState, loadProgression } from './progression.js';\n"
new = old + "import { CAMPAIGN_STORAGE_KEY } from './campaign.js';\n"
if old not in s or 'CAMPAIGN_STORAGE_KEY' in s:
    raise RuntimeError('persistence import anchor changed')
s = s.replace(old, new, 1)
old = "for (const key of [MACHINE_SAVE_V8_KEY, MACHINE_SAVE_V7_KEY, MACHINE_SAVE_V6_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_KEY])"
new = "for (const key of [MACHINE_SAVE_V8_KEY, MACHINE_SAVE_V7_KEY, MACHINE_SAVE_V6_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_KEY, CAMPAIGN_STORAGE_KEY])"
if old not in s:
    raise RuntimeError('clearMachineSave anchor changed')
p.write_text(s.replace(old, new, 1))

# Force phones to request the campaign UI/module graph instead of stale cached adapters.
p = Path('garageMountUI.js')
s = p.read_text()
s = s.replace("import './acquisitionUI.js?v=k3l5';", "import './acquisitionUI.js?v=k3n0';")
s = s.replace("import './contractUI.js?v=k3h0';", "import './contractUI.js?v=k3n0';")
p.write_text(s)

p = Path('index.html')
s = p.read_text()
s = s.replace('./main.js?v=k3m0', './main.js?v=k3n0')
s = s.replace('./garageMountUI.js?v=k3l5', './garageMountUI.js?v=k3n0')
p.write_text(s)

# Static integration guard: campaign stays a thin orchestration layer over existing systems.
Path('tests/k3n0CampaignIntegration.test.mjs').write_text(r'''import test from 'node:test';
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
''')
