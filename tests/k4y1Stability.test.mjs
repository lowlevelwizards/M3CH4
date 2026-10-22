import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Controls } from '../controls.js';
import { normalizeSurfaceEvent } from '../partServiceJournal.js';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function pointer(type, id, x = 100, y = 100, options = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: id, pointerType: 'mouse', buttons: 1,
    clientX: x, clientY: y, ...options });
  return event;
}
class MockControl extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.capture = new Set();
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  querySelector() { return this.ring || null; }
  getBoundingClientRect() { return { width: 140, height: 140, left: 0, top: 0 }; }
  setPointerCapture(id) { this.capture.add(id); }
  hasPointerCapture(id) { return this.capture.has(id); }
  releasePointerCapture(id) { this.capture.delete(id); }
}
test('workshop service without a surface anchor remains valid data, never a drawable scar', () => {
  const record = normalizeSurfaceEvent({
    event: 'service', eventId: 'service-no-scar', serial: 'RIG-001',
    mode: 'workshop-repair', timestamp: 150,
  });
  assert.ok(record);
  assert.equal(record.localPoint, null);
  assert.equal(record.localNormal, null);
  const renderer = source('surfaceDamageRenderer.js');
  assert.match(renderer, /if\(!event\.localPoint\|\|!event\.localNormal\)/);
  assert.match(renderer, /validVector\(point\).*validVector\(surfaceNormal\)/);
});

test('captured drive and look release even when their original element misses pointerup', () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  globalThis.document.visibilityState = 'visible';
  try {
    const drive = new MockControl(), ring = new MockControl(), knob = new MockControl();
    drive.ring = ring;
    const look = new MockControl(), brake = new MockControl();
    const controls = new Controls(drive, knob, look, brake);
    drive.dispatchEvent(pointer('pointerdown', 5));
    drive.dispatchEvent(pointer('pointermove', 5, 140, 55));
    assert.notEqual(controls.sample().throttle, 0);
    globalThis.window.dispatchEvent(pointer('pointerup', 5, 140, 55));
    assert.equal(controls.sample().throttle, 0);
    assert.equal(controls.sample().strafe, 0);
    assert.equal(controls.drivePointer, null);
    assert.equal(drive.capture.size, 0);

    drive.dispatchEvent(pointer('pointerdown', 6));
    drive.dispatchEvent(pointer('pointermove', 6, 145, 50));
    globalThis.window.dispatchEvent(pointer('pointermove', 6, 145, 50, {buttons:0}));
    assert.equal(controls.sample().throttle, 0);
    assert.equal(controls.drivePointer, null);

    look.dispatchEvent(pointer('pointerdown', 7));
    globalThis.document.visibilityState = 'hidden';
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(controls.lookPointer, null);
    assert.equal(look.capture.size, 0);

    brake.dispatchEvent(pointer('pointerdown', 8));
    assert.equal(controls.sample().brake, 1);
    controls.setEnabled(false);
    assert.equal(controls.sample().brake, 1); // disabled control samples request braking
    assert.equal(controls.brake, 0);
    assert.equal(brake.classes.has('active'), false);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test('round tableau is genuinely noninteractive, reload uses authoritative timing', () => {
  const main = source('main.js'), css = source('winnerTableau.css');
  assert.match(main, /controls\.setEnabled\(false\);\s*leaveAlliedObservation\(\)/);
  assert.match(main, /classList\.add\('sortie-outro-active'\)/);
  assert.match(main, /classList\.remove\('victory-showcase', 'sortie-outro-active'\)/);
  for (const selector of ['#controls', '#fire', '#reload', '#brake', '#allied-observation'])
    assert.ok(css.includes('body.sortie-outro-active ' + selector), selector);
  assert.match(main, /1 - weaponState\.reloadLeft \/ Math\.max\(\.01, weaponSpec\.reloadSeconds\)/);
  assert.match(main, /--reload-progress/);
  assert.match(source('styles.css'), /reload-button\.reloading::before/);
});

test('repair sparks move upward and outward; absent stations have no airborne plus markers', () => {
  const scene = source('scene.js');
  assert.match(scene, /pilotServiceSparkBudget \+= 64 \* dt/);
  assert.match(scene, /record\.serviceSparkBudget \+= 60 \* dt/);
  assert.match(scene, /1\.2\+Math\.random\(\)\*1\.7/);
  assert.match(scene, /!installedPart\(assembly, 'structure'\)\) return/);
  assert.doesNotMatch(scene, /bracket\.add\(plate\)/);
  assert.doesNotMatch(scene, /bar\.position\.y=\.065/);
});
