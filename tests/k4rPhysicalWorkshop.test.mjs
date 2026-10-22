import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BY_ID} from '../components.js';
import {loadStable} from '../stable.js';
import {bayAssembly,bayPreviewAssembly} from '../garageBay.js';

const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('preview fits a compatible owned serial without changing a machine or ownership',()=>{
    const stable=loadStable(null).stable;
    const rig=stable.rigs[0], slot='combat';
    const installed=rig.installed[slot];
    const original=stable.inventory.find(part=>part.serial===installed);
    assert.ok(original);
    const spare={...original,serial:'WORKSHOP-SPARE',condition:1,wear:0,destroyed:false};
    stable.inventory.push(spare);
    const before=JSON.stringify(stable);
    const proposed=bayPreviewAssembly(stable,rig.id,slot,spare.serial);
    assert.ok(proposed);
    assert.equal(proposed.installed.combat,spare.serial);
    assert.equal(bayAssembly(stable,rig.id).installed.combat,installed);
    assert.equal(JSON.stringify(stable),before);
    assert.ok(proposed.graph);
    assert.equal(bayPreviewAssembly(stable,rig.id,'power',spare.serial),null);
    assert.equal(bayPreviewAssembly(stable,rig.id,slot,'MISSING'),null);
    // Parts fitted to another machine may be inspected but never preview-fitted.
    stable.rigs[1].installed[slot]=spare.serial;
    assert.equal(bayPreviewAssembly(stable,rig.id,slot,spare.serial),null);
});

test('garage selection shares the physical model tap and the five station shortcuts',()=>{
    const ui=source('unifiedGarageUI.js'), main=source('main.js'), scene=source('scene.js');
    assert.match(main,/m3ch4:bay-picked/);
    assert.match(ui,/document\.addEventListener\('m3ch4:bay-picked'/);
    assert.match(ui,/function moduleStation\(view\)/);
    assert.match(ui,/function moduleDetails\(stable, view, machine\)/);
    assert.match(scene,/garage-empty-mounts/);
    assert.match(scene,/emptyMountPicks/);
    assert.match(scene,/raycaster\.intersectObjects\(\[\.\.\.exterior\.pickMeshes,\.\.\.emptyMountPicks\]/);
});

test('parts shelf previews but only confirmed action emits the persisted bay edit',()=>{
    const ui=source('unifiedGarageUI.js'),css=source('unifiedGarageStyles.css');
    assert.match(ui,/bayPreviewAssembly\(stable,viewedId,selectedSlot,fitSerial\)/);
    assert.match(ui,/arena\.rebuildAssembly\(assembly\)/);
    assert.match(ui,/garage-shelf-title/);
    assert.match(ui,/ALL PARTS ↗/);
    assert.match(ui,/COMPACT SHELF/);
    assert.match(ui,/\(drawerExpanded\?box:shelf\)\.append\(detail\)/);
    assert.match(ui,/onAction: \(\) => editModule\(slot, focused\.serial\)/);
    assert.match(ui,/emitEdit\('m3ch4:bay-module'/);
    assert.match(css,/#unified-garage-shelf\.shown/);
    assert.match(css,/scroll-snap-type:x proximity/);
});

test('camera orbit remains upright and independent of part or paint changes',()=>{
    const scene=source('scene.js'),ui=source('unifiedGarageUI.js');
    assert.match(scene,/camera\.up\.set\(0,1,0\)/);
    assert.match(scene,/function focusPart\(slot\)/);
    assert.match(ui,/arena\.setPreviewPart\?\.\(proposed\?selectedSlot:null\)/);
    assert.match(ui,/onPreview:edits=>\{paintPreviewEdits=edits;previewSignature='';preview/);
    assert.doesNotMatch(ui,/onPreview:[^\n]*resetOrbit/);
});
