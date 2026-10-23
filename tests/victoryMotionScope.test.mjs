import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const scene=readFileSync(new URL('../scene.js',import.meta.url),'utf8');
test('victory movement computes support state without block flag scoped to animation legs',()=>{
 const a=scene.indexOf('const contact=physicalContactWeight(mobilityId');
 const b=scene.indexOf('record.contactPresentation=contact',a);
 assert.ok(a>0&&b>a);
 const contact=scene.slice(a,b);
 assert.match(contact,/record\.disabledSlots\.has\('mobility'\)/);
 assert.match(contact,/record\.destroyedSlots\.has\('mobility'\)/);
 assert.doesNotMatch(contact,/\bblocked\b/);
 assert.match(scene,/function updateVictoryShowcase\(dt\)/);
 assert.match(scene,/poseCombatantExterior\(entry\.record/);
});
