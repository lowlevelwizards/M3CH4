import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scene = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const acquisition = fs.readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('garage lighting uses broad fill instead of blown-out fixtures over black geometry', () => {
  assert.match(scene, /HemisphereLight\(0xa9c0b4, 0x2b241b, \.86\)/);
  assert.match(scene, /DirectionalLight\(0x8fa99f, \.72\)/);
  assert.match(scene, /emissiveIntensity: 2\.25/);
});

test('garage inspection favors selected parts without losing the complete machine', () => {
  assert.match(scene, /desiredTarget\.set\(0,1\.85,0\)/);
  assert.match(scene, /radius = Math\.max\(radius, 6\.85\)/);
  assert.match(scene, /framingOffsetWorld[^\n]+\* \.78/);
  assert.match(scene, /radius = 7\.20/);
});

test('result page centers its compact accounting block and destructive return is visually secondary', () => {
  assert.match(html, /class="debrief-result-summary"/);
  assert.match(acquisition, /debrief-result-summary/);
  assert.match(acquisition, /UNCLAIMED SALVAGE WILL BE FORFEITED/);
  assert.match(acquisition, /data-mode=\"forfeit\"/);
  assert.match(acquisition, /setGarageAction\('CLAIM SECURED · RETURN TO GARAGE'/);
});
