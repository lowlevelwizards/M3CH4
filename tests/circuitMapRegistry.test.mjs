import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,mapForContract,contractAtMap} from '../maps/mapRegistry.js';
import {certifyArena} from '../maps/mapValidation.js';
import {CONTRACTS} from '../contracts.js';
import {DEFAULT_WORLD} from '../locomotion.js';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('exactly three purpose-built and distinct circuit venues',()=>{
 assert.deepEqual(MAPS.map(x=>x.id),['backlot-dustbowl','culvert-nine','grainhouse']);
 assert.equal(new Set(MAPS.map(x=>x.theme)).size,3);
 assert.ok(MAPS.every(x=>x.world!==DEFAULT_WORLD));
 assert.ok(MAPS.every(x=>x.world.obstacles.length>=12));
});
test('all contract nodes bind their authored venue without touching payout or progression',()=>{
 const expected={
  'yard-dog':'backlot-dustbowl','recovery-run':'backlot-dustbowl',
  'cutter':'culvert-nine','domination':'culvert-nine',
  'mule':'grainhouse','circuit-final':'grainhouse'};
 assert.equal(CONTRACTS.length,6);
 for(const c of CONTRACTS){
  assert.equal(mapForContract(c).id,expected[c.id]);
  const projected=contractAtMap(c);
  assert.equal(projected.payout,c.payout);
  assert.equal(projected.objective.type,c.objective.type);
  assert.notStrictEqual(projected.objective,c.objective);
  assert.equal(c.mapId,expected[c.id]);
 }
 assert.deepEqual(contractAtMap(CONTRACTS.find(x=>x.id==='domination')).objective.points,
  mapForContract(CONTRACTS.find(x=>x.id==='domination')).sites.domination);
});
test('maps pass real physical collision clearance, primary sightline and route checks',()=>{
 for(const map of MAPS){
  const report=certifyArena(map,{radius:1.55,checkRoutes:true});
  assert.equal(report.ok,true,map.name+' '+report.errors.join('; '));
  assert.equal(report.routes.length,14);
  for(const side of ['friendly','hostile'])for(const spawn of map.spawns[side])
   for(const site of map.sites.domination)
    assert.ok(Math.hypot(spawn.x-site.x,spawn.z-site.z)>=6.25,
      `${map.id}: ${side} begins at capture point ${site.id}`);
  assert.ok(report.routes.every(r=>r.ok));
 }
});
test('live scene and combat use the same contract world for line-of-fire and AI',()=>{
 const main=src('main.js'),scene=src('scene.js'),bridge=src('sceneAssembly.js');
 assert.match(main,/const selectedMap=mapForContract\(activeContract\)/);
 assert.match(main,/const selectedWorld=selectedMap\.world/);
 assert.match(main,/createArenaScene\(assembly, targetAssembly,selectedMap\)/);
 // The import-map bridge must not silently drop the selected arena and
 // fall back to the default Backlot when creating the physical scene.
 assert.match(bridge,/createArenaScene\(assembly, targetAssembly,arenaMap\)/);
 assert.match(bridge,/createBaseArenaScene\(assembly, targetAssembly,arenaMap\)/);
 assert.match(main,/world:selectedWorld/);
 // Coordinates are map-specific, but runtime actor IDs remain the stable
 // roster identities required by damage, target choice and bout scoring.
 assert.match(main,/makeSupportActor\(HOSTILE_SUPPORT_SPAWNS\[index\]\.id/);
 assert.doesNotMatch(main,/makeSupportActor\(spawn\.id, HOSTILE_TEAM/);
 assert.match(main,/observeBattlefield\(aiMemory,participants,sortieObjective,selectedWorld,aiClock,smokeState\.clouds\)/);
 assert.match(main,/createSortieObjective\(mappedContract\)/);
 assert.match(scene,/const world=arenaMap\.world/);
 assert.match(scene,/firstCoverHit\(muzzle, bore, world\.obstacles/);
 assert.match(scene,/buildArenaWorld\(arenaRoot,world,arenaMap,playerSpawn,hostileSpawn\)/);
 assert.match(scene,/buildVenueDressing\(arenaMap\)/);
});
