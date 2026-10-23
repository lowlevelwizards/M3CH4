import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
import {auditMapFlow} from '../maps/mapFlowAudit.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Backlot keeps certified walkable routes and fair spawn visibility',()=>{
 const a=auditMapFlow(BACKLOT);
 assert.equal(a.exposure.exposed,0,'immediate cross-spawn firing is forbidden');
 assert.equal(a.routes.length,18,'all three pilots must reach all three points');
 assert.ok(a.routes.every(r=>r.ok));
 assert.ok(a.objectiveApproaches.every(p=>p.clearBearings>=3));
 assert.ok(a.routeBias<.55);
});
test('outdoor ring is curved and outside legal play, without invisible fence cover',()=>{
 const environment=source('backlotEnvironmentPass.js');
 const renderer=source('backlotDerbyWorld.js');
 assert.match(environment,/function edge\(t,rx,rz\)/);
 assert.match(environment,/signPow\(Math\.cos\(t\),\.265\)/);
 assert.match(environment,/outsidePlayableBounds:true/);
 assert.match(environment,/SEGMENTS=72/);
 assert.match(renderer,/return buildBacklotTerrainAndFacilities\(root,w\)/);
 assert.doesNotMatch(renderer,/derby-ring-side-rail|timber-side-post/);
 assert.doesNotMatch(environment,/world\.obstacles\.push|solids\.push|new THREE\.PointLight/);
});
test('recognizable machineries retain exactly one raycast prism per true cover',()=>{
 const render=source('backlotDerbyWorld.js');
 assert.match(render,/mass\.userData\.arenaObstacleId=id/);
 assert.match(render,/solids\.push\(mass\)/);
 assert.match(render,/mass\.userData\.certifiedVisibleShell=true/);
 assert.doesNotMatch(render,/colorWrite:false,depthWrite:false/);
 for(const identity of ['wreck-mass-chassis','crushed-cab-body','vertical-radiator-slat',
  'dented-overhung-cab-roof','external-cylinder-bank','agricultural-axle-joint'])
  assert.ok(render.includes(identity),identity);
 assert.doesNotMatch(source('backlotEnvironmentPass.js'),/arenaObstacleId\s*=/);
});
test('arena spectators, distant farm, hanging panels and scars are bounded visuals',()=>{
 const render=source('backlotDerbyWorld.js');
 const decor=source('backlotEnvironmentPass.js');
 const scene=source('scene.js');
 for(const landmark of ['farmyard-horizon','distant-farm-barn','farm-grain-silo',
   'backlot-spectator-and-service-yard','announcer-station','scrapyard-hoist-mast',
   'manual-scoreboard-leg','uneven-oval-dirt-berm','continuous-churned-oval-rut'])
  assert.ok(decor.includes(landmark),landmark);
 assert.match(decor,/impactPool=\[\]/);
 assert.match(decor,/puffPool=\[\]/);
 assert.match(decor,/impact-rattling-sheet-/);
 assert.match(decor,/recordBacklotCoverStrike\(root,contact\)/);
 assert.match(scene,/advanceBacklotTerrain\(backlotEnvironment,dt\)/);
 assert.match(scene,/recordBacklotCoverStrike\(backlotEnvironment,contact\)/);
 assert.match(render,/root\.traverse\(node=>\{if\(node\.isGroup\)groups\.push\(node\);\}\)/);
 assert.match(render,/if\(!node\.isMesh\|\|node\.isInstancedMesh\|\|node\.userData\?\.arenaObstacleId/);
 assert.match(decor,/root\.userData\.backlotReactivity=/);
 assert.doesNotMatch(decor,/setInterval|requestAnimationFrame/);
});

test('foreground wrecks are independently physical rather than single massive boxes',()=>{
 const machine=BACKLOT.world.obstacles.filter(o=>o.art);
 assert.ok(machine.length>=17,'split tractors and loader into individually hittable parts');
 assert.equal(new Set(machine.map(o=>o.id)).size,machine.length);
 for(const old of ['tractor-hull','loader-bucket','coupling-spine','exposed-engine'])
  assert.ok(!BACKLOT.world.obstacles.some(o=>o.id===old),old+' was still a monolith');
 for(const role of ['tractor-cab','tractor-bonnet','tractor-wheel','loader-cab',
  'loader-scoop','loader-track','engine-bank'])
  assert.ok(machine.some(o=>o.art===role),'missing physical '+role);
 const renderer=source('backlotDerbyWorld.js');
 assert.match(renderer,/if\(o\.art\)\{physicalScrapPart\(parent,o,solids\);return;\}/);
 assert.match(renderer,/mass\.userData\.arenaObstacleId=o\.id/);
 assert.match(renderer,/solids\.push\(mass\)/);
 assert.match(renderer,/o\.scale\.set\(w,h,d\)/);
 assert.match(source('backlotEnvironmentPass.js'),/north-facing-hog-pen-marquee/);
 // The machine part registry and visible facades must not alter AI cover.
 assert.doesNotMatch(renderer,/world\.obstacles\.push/);
});
