import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scene = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const acquisition = fs.readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
const mount = fs.readFileSync(new URL('../garageMountUI.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('world shadows keep coherent source resolution while the world stays pixelated', () => {
    assert.match(scene, /sun\.shadow\.mapSize\.set\(512, 512\)/);
    assert.match(main, /THREE\.PCFShadowMap/);
    assert.match(main, /const renderScales = \[\.42, \.55, \.70\]/);
});

test('combiner HUD has an independent high-resolution render path', () => {
    assert.match(scene, /combinerHud\.traverse\(object => object\.layers\.set\(1\)\)/);
    assert.match(main, /const hudRenderer = new THREE\.WebGLRenderer/);
    assert.match(main, /arena\.camera\.layers\.set\(1\)/);
    assert.match(main, /arena\.scene\.background = null/);
});

test('garage is an isolated service-bay presentation at a stable origin', () => {
    assert.match(scene, /function buildGarageBay\(\)/);
    assert.match(scene, /arenaRoot\.visible = !enabled/);
    assert.match(scene, /garageRoot\.visible = enabled/);
    assert.match(scene, /exterior\.root\.position\.set\(0,\(exterior\.groundOffset\?\?0\)\+GARAGE_PAD_TOP_Y,0\)/);
});

test('post-bout flow exposes compact two-card layouts and explicit page arrows', () => {
    assert.match(acquisition, /score-layout/);
    assert.match(acquisition, /salvage-layout/);
    assert.doesNotMatch(acquisition, /scheduleGarageReturn/);
    assert.match(acquisition, /CLAIM SECURED · RETURN TO GARAGE/);
    assert.match(html, /id="debrief-prev"/);
    assert.match(html, /id="debrief-next"/);
});

test('all garage adapters consume the canonical active arena singleton', () => {
    assert.match(mount, /from '\.\/scene\.js'/);
    assert.doesNotMatch(mount, /from '\.\/sceneAssembly\.js'/);
});
