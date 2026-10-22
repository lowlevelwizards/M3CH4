import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=src('unifiedGarageUI.js'),css=src('physicalPitWorkspace.css');
test('pit no longer creates the legacy modal menu and instead presents the live garage machine',()=>{
 const section=ui.slice(ui.indexOf('function renderPit('),ui.indexOf('function setPrimary('));
 assert.match(section,/rail\.append\(moduleStation\(view\)\)/);
 assert.match(section,/pitPhysicalInspector\(stable,view,series,action,options\)/);
 assert.doesNotMatch(section,/dock\.append\(bayHeader\(view\),summary\(view\),moduleStation\(view\)\)/);
 assert.doesNotMatch(section,/patchInPit\(/);
 assert.match(css,/#unified-garage\[data-workspace="pit"\] #unified-garage-dock\{\s*display:none/);
 assert.match(css,/#unified-garage\[data-workspace="pit"\]\.pit-detail-open #unified-garage-dock\{\s*display:flex/);
});
test('tapping model parts works in both the garage and the physical pit',()=>{
 assert.match(ui,/if\(!\['garage','pit'\]\.includes\(actualMode\(loadSeries\(storage\)\)\)\)return;/);
 assert.match(ui,/if\(actualMode\(loadSeries\(storage\)\)==='pit'\)\{\s*selectedSlot=slot;/);
 assert.match(ui,/arena\.selectPart\(selectedSlot\)/);
 assert.match(ui,/arena\.focusPart\(selectedSlot\)/);
 assert.match(ui,/arena\.rebuildAssembly\(assembly\)/);
 assert.match(ui,/arena\?\.setPitPresentation\?\.\(state==='pit',selectedSlot\)/);
 assert.match(src('main.js'),/const slot = arena\.pickPart\(event\.clientX, event\.clientY, renderer\.domElement\)/);
 assert.match(src('main.js'),/new CustomEvent\('m3ch4:bay-picked',\{detail:\{slot\}\}\)/);
});
test('field service stays serial-authoritative and allows adjustments without swapping parts',()=>{
 const pit=ui.slice(ui.indexOf('function ensurePitPlan('),ui.indexOf('function setPrimary('));
 assert.match(pit,/triageOptions\(stable,viewedId\)/);
 assert.match(pit,/triagePreview\(stable,viewedId,selected\)/);
 assert.match(pit,/applyIntermissionTriage\(storage,\{/);
 assert.match(pit,/document\.dispatchEvent\(new CustomEvent\('m3ch4:bay-reconcile-patch'/);
 assert.match(pit,/window\.location\.reload\(\)/);
 assert.match(pit,/oldDeploy|launch\(stable,series\.contractId\)/);
 assert.doesNotMatch(pit,/m3ch4:bay-module|m3ch4:bay-generator-mount/);
});
test('landscape layout preserves physical machine and places work units in a compact footer',()=>{
 assert.match(css,/#unified-garage\[data-workspace="pit"\] \.workshop-rail\{/);
 assert.match(css,/flex-direction:column;gap:7px;width:auto/);
 assert.match(css,/#unified-garage\[data-workspace="pit"\] #unified-garage-action\{/);
 assert.match(css,/\.physical-pit-footer\{/);
 assert.match(css,/transform:translateX\(-50%\);width:clamp\(190px/);
 assert.match(src('index.html'),/physicalPitWorkspace\.css\?v=k4w3/);
});
