import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
import {BACKLOT_COVER_KITS} from '../backlotObstacleKits.js';
import {auditMapFlow} from '../maps/mapFlowAudit.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all remaining Backlot anonymous blockers have authentic authored scrapyard identities',()=>{
 const kits=BACKLOT.world.obstacles.filter(o=>o.artKit);
 const unchangedPhysical=BACKLOT.world.obstacles.filter(o=>o.art&&!o.artKit);
 const poles=BACKLOT.world.obstacles.filter(o=>o.kind==='pillar');
 assert.equal(kits.length,13,'all perimeter, near/far and remaining generic center cover');
 assert.equal(unchangedPhysical.length,17,'retain physically articulated center machines');
 assert.equal(poles.length,4);
 const required=['shipping-container','tire-stack','barrel-cluster','pickup-wreck',
  'generator-unit','scrap-barricade','flatbed-fragment','turbine-housing',
  'tractor-wreck','combine-harvester','concrete-barrier'];
 assert.deepEqual([...new Set(kits.map(o=>o.artKit))].sort(),required.sort());
 assert.deepEqual([...BACKLOT_COVER_KITS].sort(),required.sort());
 for(const o of kits){
  assert.ok(BACKLOT_COVER_KITS.includes(o.artKit),o.id);
  assert.ok(o.maxX>o.minX&&o.maxZ>o.minZ&&o.height>0,o.id);
 }
 assert.equal(new Set(BACKLOT.world.obstacles.map(o=>o.id)).size,
  BACKLOT.world.obstacles.length);
 assert.equal(BACKLOT.version,3);
});
test('new cover visuals inherit exact physical AABBs, never become AI-only or invisible walls',()=>{
 const kit=source('backlotObstacleKits.js');
 const renderer=source('backlotDerbyWorld.js');
 assert.match(kit,/shell\.userData\.arenaObstacleId=o\.id/);
 assert.match(kit,/solids\.push\(shell\)/);
 assert.match(kit,/obstacle\.artKit/);
 assert.match(renderer,/buildBacklotObstacleKit\(parent,o,solids,\{block,drum,mat,P\}\)/);
 assert.match(renderer,/new THREE\.CylinderGeometry\(1,1,1,segments\)/);
 assert.match(renderer,/o\.scale\.set\(r,length,r\)/);
 assert.doesNotMatch(kit,/world\.obstacles\.push|solids\.push\(.*(?:drum|wheel|box)/);
 assert.doesNotMatch(kit,/colorWrite:false|depthWrite:false/);
});
test('prop families contain signature recognisable physical features at camera height',()=>{
 const kit=source('backlotObstacleKits.js');
 for(const signature of ['container-corrugation','container-lock-rod',
  'stacked-tractor-rubber','tractor-tyre-sidewall',
  'steel-55-gallon-drum','drum-rolled-rim','drum-bung',
  'pickup-black-windshield','pickup-wheel-metal-hub','pickup-truck-bed-rails',
  'generator-cooling-louvre','generator-service-hatch',
  'salvage-welded-plate','weld-bead-seam','flatbed-stake',
  'turbine-fan-vane','turbine-centre-hub','farm-tractor-giant-drive-wheel',
  'combine-harvester-header','concrete-barrier-warning-stripe'])
   assert.ok(kit.includes(signature),signature);
 assert.ok(source('backlotDerbyWorld.js').includes('detailedCoverCount'));
});
test('same routes, spawns and objective approaches remain viable with new prop kits',()=>{
 const audit=auditMapFlow(BACKLOT);
 assert.equal(audit.exposure.exposed,0);
 assert.equal(audit.routes.length,18);
 assert.ok(audit.routes.every(r=>r.ok));
 assert.ok(audit.objectiveApproaches.every(o=>o.clearBearings>=3));
 assert.ok(audit.routeBias<.55);
});
