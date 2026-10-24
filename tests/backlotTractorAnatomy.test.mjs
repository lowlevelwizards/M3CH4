import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('new anatomy library supports meaningful silhouettes and negative space',()=>{
 const primitives=source('propAnatomyPrimitives.js');
 for(const requirement of [
  'export function wheel(','export function ring(','export function beam(',
  'export function profile(','export function axlePair(',
  'export function block(','new THREE.TorusGeometry(',
  'new THREE.BufferGeometry()','new THREE.MeshStandardMaterial('])
  assert.ok(primitives.includes(requirement),requirement);
 assert.match(primitives,/const j=\(i\+1\)%n/);
});
test('tractor has genuinely exposed physical assemblies rather than single silhouette prism',()=>{
 const tractor=source('backlotAnatomicalTractor.js');
 for(const feature of [
  'open-ladder-chassis-rail','rear-drive-tyre','front-steered-wheel',
  'four-cylinder-head','steering-column','operator-cage-vertical-post',
  'exhaust-header','rear-differential','front-steered-axle','tapered-bonnet-top',
  'cab-floating-canopy-roof','visible-drive-shaft','radiator-open-slat'])
  assert.ok(tractor.includes(feature),feature);
 assert.match(tractor,/buildAnatomicalTractor\(root\)/);
 assert.doesNotMatch(tractor,/arenaObstacleId|world\.obstacles\.push|localStorage/);
});
test('comparison renders live source separately from prototype and exposes true map collider data',()=>{
 const derby=source('backlotDerbyWorld.js');
 const gallery=source('backlotPropGallery.js');
 assert.match(derby,/buildAnatomicalTractor\(newPart\)/);
 assert.match(derby,/oldTractor\.position\.set/);
 assert.match(derby,/world\.obstacles\.filter\(o=>o\.id\.startsWith\('tractor-'\)\)/);
 assert.match(derby,/for\(const o of currentTractor\)for\(const part of collisionPieces\(o\)\)/);
 assert.match(derby,/comparison\.add\(newPart,oldPart,collisionOverlay\)/);
 assert.match(gallery,/GREY_MAT/);
 assert.match(gallery,/expState\.view==='both'/);
 assert.match(gallery,/collisionOverlay\.visible=expState\.colliders/);
 assert.match(gallery,/batchBacklotDerbyDecorations\(entry\.experiment\.newPart\)/);
});
test('production Backlot preserves its 34 parent IDs while tractor/loader compound fitting is live',()=>{
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 const tractor=BACKLOT.world.obstacles.filter(o=>o.id.startsWith('tractor-'));
 assert.equal(tractor.length,7);
 assert.ok(tractor.every(o=>o.art&&o.minX<o.maxX&&o.minZ<o.maxZ));
});
