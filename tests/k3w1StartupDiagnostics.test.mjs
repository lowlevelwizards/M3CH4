import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

test('startup errors are captured before module scripts, without modifying local saves', () => {
  const instrumentation = html.indexOf('id = "startup-diagnostic"');
  const moduleEntry = html.indexOf('src="./main.js?v=k3v6"');
  assert.ok(instrumentation >= 0);
  assert.ok(moduleEntry > instrumentation);
  assert.match(html, /addEventListener\("error", event =>/);
  assert.match(html, /addEventListener\("unhandledrejection", event =>/);
  assert.match(html, /FIRST FRAME NEVER COMPLETED/);
  assert.match(html, /RESOURCE LOAD FAILED/);
  assert.match(html, /RELOAD \(KEEPS SAVE\)/);
  const capture = html.slice(html.indexOf('// k.3w.1:'), html.indexOf('</script>', instrumentation));
  assert.doesNotMatch(capture, /localStorage|sessionStorage|clearMachineSave/);
});

test('the boot ready flag is set after a complete frame render', () => {
  const marker = main.indexOf('window.__m3ch4BootOK = true;');
  const rendering = main.lastIndexOf('hudRenderer.render(arena.scene, arena.camera);', marker);
  const subsequent = main.indexOf('requestAnimationFrame(frame);', marker);
  assert.ok(rendering >= 0 && rendering < marker, 'marker follows real HUD render');
  assert.ok(subsequent > marker, 'marker precedes frame scheduling');
  assert.ok(main.endsWith('requestAnimationFrame(frame);\n'));
});
