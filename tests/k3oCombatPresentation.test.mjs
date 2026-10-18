import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scene = readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('combat scene exposes objective marker and simple joint articulation', () => { assert.match(scene, /updateObjectivePresentation/); assert.match(scene, /userData\?\.joint/); assert.match(scene, /articulation\.phase/); assert.match(scene, /recoilKick/); });
test('live combat integrates squad intent, damage posture and objective resolution', () => { assert.match(main, /planTeam\(aiSnapshot/); assert.match(main, /damagePosture\(/); assert.match(main, /advanceSortieObjective\(/); assert.match(main, /observeBattlefield\(aiMemory/); });
test('objective status is visible as its own compact HUD readout', () => { assert.match(index, /id="objective-status"/); assert.match(index, /aria-live="polite">OBJ/); });
