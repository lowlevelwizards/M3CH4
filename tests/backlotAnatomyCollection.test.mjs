import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const machines=source('backlotAnatomicalMachines.js');
const salvage=source('backlotAnatomicalSalvage.js');
const derby=source('backlotDerbyWorld.js');
const gallery=source('backlotPropGallery.js');
test('five real machines expose connected anatomy instead of featureless obstacle boxes',()=>{
 for(const name of [
  'buildAnatomicalLoader','buildAnatomicalCombine','buildAnatomicalPickup',
  'buildAnatomicalEngine','buildAnatomicalCoupling'])
  assert.ok(machines.includes('export function '+name+'(root)'),name);
 for(const feature of [
  'connected-crawler-track-shoe','loader-lift-boom','exposed-chrome-piston',
  'individual-bucket-teeth','operator-control-wheel',
  'grain-hopper-tapered-bin','header-reel-spoke','unloading-auger-long-tube',
  'truck-ladder-frame','pickup-a-pillar','inline-four-engine-head',
  'flywheel-spoke','exposed-input-shaft'])
  assert.ok(machines.includes(feature),feature);
 assert.match(machines,/MACHINE_EXHIBITS=Object.freeze\(\[/);
});
test('eight salvage families contain mechanically legible profiles and empty space',()=>{
 for(const name of [
  'buildAnatomicalGenerator','buildAnatomicalTurbine','buildAnatomicalTyreStack',
  'buildAnatomicalDrums','buildAnatomicalFlatbed','buildAnatomicalScrapWall',
  'buildAnatomicalContainer','buildAnatomicalConcrete'])
  assert.ok(salvage.includes('export function '+name+'(root)'),name);
 for(const detail of [
  'alternator-cooling-rib','curved-impeller-vane','real-open-tyre-sidewall',
  'rolled-barrel-stiffening-rim','stake-pocket-post',
  'salvaged-vehicle-body-panel','buckled-open-container-door',
  'solid-sloped-jersey-profile'])
  assert.ok(salvage.includes(detail),detail);
 assert.match(salvage,/SALVAGE_EXHIBITS=Object.freeze\(\[/);
});
test('gallery compares thirteen new assemblies to actual Backlot meshes and true map AABBs',()=>{
 assert.match(derby,/\.\.\.MACHINE_EXHIBITS,\.\.\.SALVAGE_EXHIBITS/);
 assert.match(derby,/world\.obstacles\.filter\(exhibit\.match\)/);
 assert.match(derby,/createWreck\(oldRoot,o,collisionMeshes\)/);
 assert.match(derby,/exhibit\.build\(newPart\)/);
 assert.match(derby,/category:'experiment'/);
 assert.match(derby,/experimentCount:1\+extraExhibits\.length/);
 assert.match(gallery,/batchBacklotDerbyDecorations\(entry\.experiment\.newPart\)/);
 assert.match(gallery,/batchBacklotDerbyDecorations\(entry\.experiment\.oldPart\)/);
 assert.match(gallery,/experimentalIds:entries\.filter\(e=>e\.experiment\)/);
});
test('art specimens are isolated from live physics and persistent game state',()=>{
 for(const src of [machines,salvage]){
  assert.doesNotMatch(src,/arenaObstacleId|world\.obstacles\.push|localStorage|window\./);
 }
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('loader-')).length,5);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.artKit==='combine-harvester').length,1);
});
