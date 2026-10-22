import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {framingOffsetWorld} from '../inspectionCamera.js';
import {createSortieObjective,advanceSortieObjective} from '../sortieObjectives.js';
import {contractById} from '../contracts.js';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('inspection uses fixed physical pivot and panel-aware composition, not selected part',()=>{
    const scene=source('scene.js'),main=source('main.js');
    assert.match(scene,/camera\.position\.addScaledVector\(screenRight,-shift\)/);
    assert.match(scene,/camera\.lookAt\(center\.clone\(\)\.addScaledVector\(screenRight,-shift\)\)/);
    assert.match(scene,/function focusPart\(slot\)/);
    assert.doesNotMatch(scene,/desiredTarget\.copy\(machineCenter\)\.lerp/);
    assert.doesNotMatch(scene,/radius = Math\.max\(radius, 6\.85\)/);
    assert.doesNotMatch(main,/arena\.panBy\(/);
    assert.ok(framingOffsetWorld(400,844,390,7.2,36)>0);
    assert.equal(framingOffsetWorld(0,844,390,7.2,36),0);
});
test('paint never resets orbit, and spectator UI is one small row without reset',()=>{
    const garage=source('unifiedGarageUI.js'),scene=source('scene.js');
    const main=source('main.js'),css=source('interfaceClarity.css');
    assert.match(garage,/arena\.rebuildAssembly\(assembly\)/);
    assert.match(scene,/function focusPart\(slot\)/);
    assert.doesNotMatch(main,/observeOverlay\.append\(observePrev, observeCaption, observeNext,observeReset\)/);
    assert.match(main,/orbitSpectatorBy/);
    assert.match(css,/#allied-observation/);
});
test('round result: all five real part previews, armor and integrity bars, no accordion',()=>{
    const series=source('seriesUI.js'),css=source('reportClarity.css');
    assert.match(series,/className='debrief-lines k4n-report'/);
    assert.match(series,/for\(const p of health\)/);
    assert.match(series,/partThumbnailDataUrl/);
    assert.match(series,/\['core',p\.condition\]/);
    assert.match(series,/\['armor',p\.armorRatio\]/);
    assert.match(series,/tile\.setAttribute\('aria-label'/);
    assert.doesNotMatch(series,/row\.classList\.toggle\('expanded'/);
    assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
    assert.match(css,/overflow:hidden/);
});
test('score uses three metrics and six no-scroll ranked pilot rows',()=>{
    const score=source('acquisitionUI.js'),css=source('reportClarity.css');
    assert.match(score,/k4o-highlights/);
    assert.match(score,/\['YOUR SCORE'/);
    assert.match(score,/\['K \/ A \/ DIS'/);
    assert.match(score,/\['RANK'/);
    assert.match(score,/k4o-standings/);
    assert.doesNotMatch(score,/statTile\(/);
    assert.match(css,/grid-template-rows:auto repeat\(6,minmax\(0,1fr\)\)/);
    assert.match(css,/#sortie-debrief \.debrief-content/);
});
test('combat HUD uses actual three-zone capture/owner state and separates idle/hit sights',()=>{
    const main=source('main.js'),ui=source('interfaceClarity.css');
    assert.match(main,/point\.friendly>0&&point\.owner!=='friendly'/);
    assert.match(main,/card\.dataset\.owner=owner/);
    assert.match(main,/card\.classList\.toggle\('contested'/);
    assert.match(main,/localCapture\.textContent/);
    assert.match(main,/dominationHud\.append\(objectiveBand,localCapture\)/);
    assert.match(main,/matchHud\.parentElement!==dominationHud/);
    assert.match(ui,/#center-crosshair\.center-crosshair\.scatter-sight:not\(\.confirmed-hit\)/);
    assert.match(ui,/#center-crosshair\.center-crosshair:not\(\.confirmed-hit\)::before/);
    assert.match(ui,/#domination-hud \.k4p-zone\.contested/);
});
test('new UI audit requires symbols for states, labels for actions, prose only when needed',()=>{
    const audit=source('INTERFACE_CLARITY_AUDIT.md');
    for(const word of ['Symbol alone','Short label','Full explanation','aria-label','Domination'])
        assert.ok(audit.includes(word));
});
