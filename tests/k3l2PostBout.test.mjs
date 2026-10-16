import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const acquisition = readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('post-bout salvage shares the canonical active arena singleton', () => {
  assert.match(acquisition, /activePlayerArena[^\n]+from '\.\/scene\.js'/s);
  assert.doesNotMatch(acquisition, /from '\.\/sceneAssembly\.js'/);
  assert.match(acquisition, /LIVE GARAGE ASSEMBLY NOT CONNECTED/);
});

test('post-bout report is split into result score and salvage swipe pages', () => {
  assert.match(html, /id="debrief-pages"/);
  assert.match(html, /id="debrief-score-page"/);
  assert.match(html, /id="debrief-salvage-page"/);
  assert.match(html, /data-debrief-target="0"/);
  assert.match(html, /data-debrief-target="1"/);
  assert.match(html, /data-debrief-target="2"/);
  assert.match(acquisition, /scroll-snap-type:x mandatory/);
});

test('mobile renderer deliberately uses a chunky low-cost lighting budget', () => {
  assert.match(main, /THREE\.BasicShadowMap/);
  assert.match(main, /const renderScales = \[\.42, \.55, \.70\]/);
  assert.match(scene, /sun\.shadow\.mapSize\.set\(128, 128\)/);
  assert.match(scene, /partThumbnailRenderer\.setSize\(96, 72, false\)/);
});
