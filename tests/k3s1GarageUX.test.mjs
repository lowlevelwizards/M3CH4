import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../unifiedGarageUI.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../unifiedGarageStyles.css', import.meta.url), 'utf8');
const scene = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('orbit is never a machine swipe; only the bay selector handles swipe gestures', () => {
    assert.doesNotMatch(ui, /surface\?\.addEventListener\('pointer(?:down|up)'/);
    assert.match(ui, /navigator\.addEventListener\('pointerdown'/);
    assert.match(ui, /navigator\.addEventListener\('pointerup'/);
    assert.match(ui, /event\.target\.closest\('button'\)/);
    assert.match(ui, /Math\.abs\(dx\)>44/);
    assert.match(ui, /stepBay\(dx<0\?1:-1\)/);
});
test('all three bays have the same fixed navigation geometry', () => {
    assert.match(css, /grid-template-columns:44px minmax\(0,1fr\) 44px/);
    assert.match(css, /\.bay-index strong\{[\s\S]*?width:100%/);
    assert.match(css, /--garage-dock-width/);
    assert.match(css, /width:var\(--garage-dock-width\)/);
});
test('five physical station icons return with accessible missing, damaged and destroyed colors', () => {
    for (const glyph of ['⬡','⋀','ϟ','◉','✦']) assert.ok(ui.includes(glyph));
    assert.match(ui, /unified-station-glyph/);
    assert.match(ui,/state-' \+ state/);
    assert.match(ui,/!item\.serial \? 'empty'/);
    assert.match(ui,/item\.destroyed \? 'destroyed'/);
    assert.match(ui,/weakest < \.995 \? 'damaged'/);
    assert.match(css, /\.unified-station\.state-empty/);
    assert.match(css, /\.unified-station\.state-destroyed/);
    assert.match(css, /\.unified-station\.state-damaged/);
    assert.doesNotMatch(css, /#unified-garage button,#unified-garage input\{font:inherit\}/);
});
test('contract list and detail are mutually exclusive with one visible dock-level action',()=>{
    assert.match(ui, /function renderContracts\(stable\)/);
    assert.match(ui, /if \(selectedJobId && unlocked\.includes\(selectedJobId\)\)/);
    assert.match(ui, /setPrimary\('TAKE CONTRACT/);
    assert.match(ui, /return;\s*\}\s*selectedJobId = null/);
    assert.match(ui, /function setPrimary\(label,callback,disabled=false\)/);
    assert.match(ui, /actionBar\.replaceChildren/);
    assert.match(css, /#unified-garage-action/);
    assert.match(css, /\.has-primary #unified-garage-dock\{bottom:58px\}/);
    assert.match(css, /#unified-garage-action \.unified-primary/);
});
test('reload restores only pending valid job setups, not completed deployments',()=>{
    assert.match(ui, /restoredAssignment\?\.phase === 'pending' && !loadSeries\(storage\)/);
    assert.match(ui, /availableCampaignNodes\(campaign\)\.includes\(restoredAssignment\.contractId\)/);
    assert.match(ui, /mode = 'setup'/);
    assert.match(ui, /selectedJobId = restoredAssignment\.contractId/);
});
test('machine naming stays secondary, stations are read-only but inspectable in setup and pit',()=>{
    assert.match(ui, /MACHINE DETAILS \/ RENAME/);
    assert.match(ui, /NAME & COMMISSION MACHINE/);
    assert.match(ui, /if \(identityExpanded\) dock\.append\(appendIdentityForm/);
    assert.match(ui, /function renderStationReadout/);
    assert.match(ui, /if \(readout\) dock\.append\(readout\)/);
});
test('unfinished machinery uses non-combat supports instead of levitating disconnected parts',()=>{
    assert.match(scene, /garage-work-fixtures/);
    assert.match(scene, /function updateGarageFixtures\(assembly\)/);
    assert.match(scene, /if \(!hasFrame\)/);
    assert.match(scene, /else if \(!hasMobility\)/);
    assert.match(scene, /stagingFixtures\.visible = enabled/);
    assert.match(scene, /updateGarageFixtures\(assembly\)/);
    assert.match(scene, /stagingFixtures\.clear\(\)/);
});
test('the physical part picture gallery and serialized ownership remain unchanged',()=>{
    assert.match(ui, /partThumbnailDataUrl/);
    assert.match(ui, /createPartCard\(/);
    assert.match(ui, /createPartDetail\(/);
    assert.match(ui, /actionDisabled: !!here \|\| !!elsewhere/);
    assert.match(ui, /oldDeploy\.click\(\)/);
    assert.match(html, /unifiedGarageStyles\.css/);
});
