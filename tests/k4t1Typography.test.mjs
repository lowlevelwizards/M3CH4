import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canvasFont, TYPEFACES, whenGameFontsReady } from '../typography.js';

const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all three fonts are centrally assigned to distinct semantic roles', () => {
  const css = text('typography.css');
  for (const [role, family] of Object.entries(TYPEFACES)) {
    assert.match(css, new RegExp('--m3-font-' + role + ':\\s*\\x27' + family));
    assert.match(css, new RegExp('family=' + family.replace(/ /g, '\\+')));
  }
  assert.match(css, /font-family: var\(--m3-font-ui\) !important/);
  assert.match(css, /font-family: var\(--m3-font-identity\) !important/);
  assert.match(css, /font-family: var\(--m3-font-data\) !important/);
});

test('game and separate anatomy lab pages load shared final typography stylesheet', () => {
  for (const file of [
    'index.html','chassis-preview.html','chassis-audit.html',
    'mobility-anatomy.html','cab-anatomy.html','weapon-anatomy.html',
    'frame-anatomy.html','color-material-gallery.html',
  ]) assert.match(text(file), /typography\.css\?v=k4t1/, file);
  const index = text('index.html');
  assert.ok(index.indexOf('typography.css?v=k4t1') > index.indexOf('k4s2GarageFlow.css'));
});

test('CanvasTexture code uses shared font roles, not built-in monospace', () => {
  for (const path of ['scene.js', 'cockpitDisplays.js']) {
    const file = text(path);
    assert.match(file, /canvasFont\(/, path);
    assert.doesNotMatch(file, /(?:ctx|paint)\.font\s*=\s*['`"]bold [\d$]+px monospace/, path);
  }
});

test('font-ready repaint hooks protect static labels and cockpit texture snapshots', () => {
  assert.match(text('scene.js'), /whenGameFontsReady\(/);
  assert.match(text('cockpitIdentityScene.js'), /whenGameFontsReady\(/);
});

test('canvas font roles use the intended families and avoid fake bold monospace', () => {
  assert.equal(canvasFont(20, 'identity'), '700 20px "Quantico", sans-serif');
  assert.equal(canvasFont(20, 'ui', 600), '600 20px "Oxanium", sans-serif');
  assert.equal(canvasFont(20), '400 20px "Share Tech Mono", monospace');
  // Safe in headless Node tests without a document.
  assert.doesNotThrow(() => whenGameFontsReady(() => {}));
});
