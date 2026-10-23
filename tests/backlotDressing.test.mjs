import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_WORLD} from '../locomotion.js';
import {backlotVisualPlan} from '../backlotVisualPlan.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('existing cover is the ONLY source for arena metal facades',()=>{
  const plan=backlotVisualPlan(DEFAULT_WORLD);
  const cover=DEFAULT_WORLD.obstacles.filter(x=>x.kind!=='pillar');
  assert.equal(plan.obstacleFacades.length,cover.length);
  assert.ok(plan.obstacleFacades.length>=10);
  for(const facade of plan.obstacleFacades){
    const real=cover.find(x=>x.id===facade.id);
    assert.ok(real,'never decorate invented cover');
    assert.ok(facade.width>0&&facade.height>0);
    assert.ok(facade.height<=real.height);
    assert.ok(facade.centerX>=real.minX&&facade.centerX<=real.maxX);
    // 18mm flush facing follows the true collision envelope within a
    // small visual tolerance, not an extra false bulletproof barricade.
    assert.ok(Math.abs(facade.faceZ-real.minZ)<=.020);
  }
});
test('four floodlight heads bolt to existing world pillars, not lanes',()=>{
  const plan=backlotVisualPlan(DEFAULT_WORLD);
  assert.equal(plan.floodlightBases.length,4);
  const pillars=DEFAULT_WORLD.obstacles.filter(x=>x.kind==='pillar');
  for(const f of plan.floodlightBases)
    assert.ok(pillars.some(p=>f.x>=p.minX&&f.x<=p.maxX&&
      f.z>=p.minZ&&f.z<=p.maxZ&&f.y===p.height));
});
test('background decks are beyond certified northern wall, never player spawn',()=>{
  const plan=backlotVisualPlan(DEFAULT_WORLD);
  assert.equal(plan.spectatorDecks.length,2);
  assert.ok(plan.spectatorDecks.every(p=>p.z<DEFAULT_WORLD.minZ-1));
  assert.ok(plan.northPosts.length>10);
  assert.ok(plan.sidePosts.length>6);
});
test('live Backlot bypasses industrial arena shell for open-air derby',()=>{
  const scene=src('scene.js'),venue=src('backlotDerbyWorld.js');
  assert.match(scene,/buildBacklotDerbyWorld\(scene,world,solids\)/);
  assert.match(scene,/if\(arenaMap\.id==='backlot-dustbowl'\)/);
  assert.match(scene,/setBacklotOpenSky\(scene\)/);
  assert.match(scene,/backlotGroundTexture\(\)/);
  assert.match(venue,/root\.name='backlot-outdoor-derby-world'/);
  assert.match(venue,/enclosingWarehouseWalls:0/);
  assert.match(venue,/overheadWarehouseFixtures:0/);
  assert.match(venue,/perimeter\(root,world\)/);
  assert.match(venue,/spectatorYard\(root,world\)/);
  assert.match(venue,/dirtMarks\(root,world\)/);
  // Render every obstacle once and only once for bullet raycasts.
  assert.match(venue,/mass\.userData\.arenaObstacleId=id/);
  assert.match(venue,/solids\.push\(mass\)/);
  assert.doesNotMatch(venue,/world\.obstacles\.push|new THREE\.PointLight/);
});

test('repeat scrapyard fixtures batch into identical physical instance geometry',()=>{
 const visuals=src('backlotDressing.js');
 assert.match(visuals,/export function batchBacklotFixtures\(root\)/);
 assert.match(visuals,/new THREE\.InstancedMesh\(items\[0\]\.geometry,items\[0\]\.material,items\.length\)/);
 assert.match(visuals,/mesh\.setMatrixAt\(i,original\.matrix\)/);
 assert.match(visuals,/root\.remove\(original\)/);
 assert.match(visuals,/fixtureBatch=batchBacklotFixtures\(group\)/);
 assert.match(visuals,/callsSaved:instances-batchedMeshes/);
 assert.doesNotMatch(visuals,/solids\.push|worldSolids\.push/);
});
