import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizedPartStatus } from '../partGridUI.js';

test('unified garage restores the existing 3D component picture gallery instead of text-only installation rows',()=>{
    const ui=fs.readFileSync(new URL('../unifiedGarageUI.js',import.meta.url),'utf8');
    const partGrid=fs.readFileSync(new URL('../partGridUI.js',import.meta.url),'utf8');
    const scene=fs.readFileSync(new URL('../scene.js',import.meta.url),'utf8');
    assert.match(ui,/createPartCard\(/);
    assert.match(ui,/createPartDetail\(/);
    assert.match(ui,/partThumbnailDataUrl/);
    assert.match(ui,/classList\.add\('unified-part-card'\)/);
    assert.match(ui,/onSelect: \(\) => \{ selectedHardwareSerial = part\.serial; render\(\); \}/);
    assert.match(ui,/onAction: \(\) => editModule\(slot, focused\.serial\)/);
    assert.match(ui,/if\(!swapExpanded\)return box/);
    assert.match(ui,/actionDisabled: !!elsewhere/);
    assert.match(ui,/elsewhere \? 'BAY '/);
    assert.match(partGrid,/const img = document\.createElement\('img'\)/);
    assert.match(partGrid,/img\.src = thumbnailUrl/);
    assert.match(scene,/export function partThumbnailDataUrl\(/);
    assert.match(scene,/const sharedVisual = buildPartVisual/);
});
test('component picture borders reflect serialized condition without treating destroyed hardware as healthy',()=>{
    assert.equal(normalizedPartStatus({condition:1}),'operational');
    assert.equal(normalizedPartStatus({condition:.65}),'damaged');
    assert.equal(normalizedPartStatus({condition:.2}),'critical');
    assert.equal(normalizedPartStatus({condition:0}),'disabled');
    assert.equal(normalizedPartStatus({condition:1,destroyed:true}),'destroyed');
});
test('picture gallery and detail previews are sized for landscape phones',()=>{
    const css=fs.readFileSync(new URL('../unifiedGarageStyles.css',import.meta.url),'utf8');
    assert.match(css,/\.unified-part-gallery\{display:grid/);
    assert.match(css,/\.unified-part-card img/);
    assert.match(css,/\.unified-part-detail \.part-detail-preview/);
    assert.match(css,/@media\(max-width:690px\)/);
    const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const mount=fs.readFileSync(new URL('../garageMountUI.js',import.meta.url),'utf8');
    assert.match(html,/uiRedesign\.css\?v=k4q/);
    assert.match(html,/garageMountUI\.js\?v=k4r/);
    assert.match(mount,/unifiedGarageUI\.js\?v=k4r/);
});
