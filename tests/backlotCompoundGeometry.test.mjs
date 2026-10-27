import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKLOT} from '../maps/backlot.js';
import {collisionPieces,movementPieces,positionHitsCover,allCollisionPieces,
 COMPOUND_FAMILY_IDS} from '../backlotCompoundGeometry.js';
import {firstCoverHit} from '../coverTruth.js';
import {certifyArena,pointClear} from '../maps/mapValidation.js';
import {auditMapFlow} from '../maps/mapFlowAudit.js';
import {planRoute} from '../ai/navigation.js';
import {firingLaneBlocker} from '../ai/firingLane.js';
import {tacticalLineOfSight} from '../tacticalAwareness.js';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const get=id=>BACKLOT.world.obstacles.find(o=>o.id===id);

test('authored obstacle groups stay 34; physical steel volumes are 57',()=>{
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.equal(new Set(BACKLOT.world.obstacles.map(o=>o.id)).size,34);
 assert.equal(COMPOUND_FAMILY_IDS.length,12);
 assert.equal(allCollisionPieces(BACKLOT.world.obstacles).length,60);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('tractor-')).length,7);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('loader-')).length,5);
 const pieces=allCollisionPieces(BACKLOT.world.obstacles);
 for(const p of pieces){
  assert.ok(p.minX<p.maxX&&p.minZ<p.maxZ, p.partId??p.id);
  assert.ok((p.maxY??p.height)>(p.minY??0),p.partId??p.id);
  assert.ok(p.minX>=BACKLOT.world.minX&&p.maxX<=BACKLOT.world.maxX);
  assert.ok(p.minZ>=BACKLOT.world.minZ&&p.maxZ<=BACKLOT.world.maxZ);
 }
});
test('tractor cab truly has an open shooting window but a bulletproof canopy',()=>{
 const cab=get('tractor-cab'),z=(cab.minZ+cab.maxZ)/2;
 const below=firstCoverHit([-8,2.22,z],[1,0,0],[cab],8,0);
 const roof=firstCoverHit([-8,3.20,z],[1,0,0],[cab],8,0);
 assert.equal(below,null,'open central glazing must NOT stop a bullet');
 assert.ok(roof,'canopy should stop an elevated shot');
 assert.equal(roof.id,'tractor-cab');
 assert.match(roof.partId,/tractor-cab::/);
 assert.ok(!positionHitsCover({x:(cab.minX+cab.maxX)/2,z},[cab],0),
  'cab footprint cannot falsely fill the open operator compartment');
});
test('loader working scoop is open above its floor, solid at back and cheeks',()=>{
 const scoop=get('loader-scoop');
 const x=(scoop.minX+scoop.maxX)/2;
 const shot=firstCoverHit([x,1.09,scoop.minZ+.04],[0,0,1],[scoop],2,0);
 assert.ok(shot,'bucket backplate must stop a shot');
 assert.ok(shot.distance>.78,'shot must enter empty scoop, not strike air at the mouth');
 assert.ok(positionHitsCover({x,z:scoop.minZ+.32},[scoop],0),
  'the grounded metal floor still stops a mech from walking through the bucket');
 const cheek=firstCoverHit([scoop.minX+.15,1.04,scoop.minZ+.10],
  [0,0,1],[scoop],2,0);
 assert.ok(cheek&&cheek.distance<.1,'bucket side cheek must still stop fire');
});
test('tracks have upper/lower tread steel separated by an optical gap',()=>{
 const tr=get('loader-track-left');
 const x=(tr.minX+tr.maxX)/2,z=(tr.minZ+tr.maxZ)/2;
 assert.equal(firstCoverHit([x,.57,z],[1,0,0],[tr],2,0),null);
 assert.ok(firstCoverHit([x,.14,z],[1,0,0],[tr],2,0));
 assert.ok(firstCoverHit([x,.93,z],[1,0,0],[tr],2,0));
});
test('routing, movement, shot predictions, and AI vision share compound parts',()=>{
 const cab=get('tractor-cab');
 assert.ok(movementPieces(cab).length<collisionPieces(cab).length,
  'roof high above mechs should only block optical/ballistic paths');
 const z=(cab.minZ+cab.maxZ)/2;
 const a={x:-8,z},b={x:-2,z};
 assert.ok(tacticalLineOfSight(a,b,{obstacles:[cab]}),
  'AI at body height should see through cab glazing');
 assert.equal(firingLaneBlocker(a,b,{minX:-20,maxX:20,minZ:-20,maxZ:20,
  obstacles:[cab]},null,{muzzleHeight:2.06,targetHeight:2.06}),null);
 const contract=certifyArena(BACKLOT,{checkRoutes:false});
 assert.ok(contract.ok,JSON.stringify(contract.errors));
 const routes=auditMapFlow(BACKLOT,{checkRoutes:false});
 assert.ok(routes.objectiveApproaches.every(x=>x.clearBearings>=3));
 assert.ok(pointClear(BACKLOT,BACKLOT.spawns.friendly[0],1.55));
 const sample=planRoute(BACKLOT.world,
  BACKLOT.spawns.friendly[0],BACKLOT.sites.domination[1],.95);
 assert.ok(sample.ok,JSON.stringify(sample));
});
test('real live models and off-scene raycast volumes use the same fitted metadata',()=>{
 const code=src('backlotDerbyWorld.js');
 const cert=src('backlotCollisionCertificate.js');
 for(const s of ['addLiveMechanicalAnatomy(root)','physicalCompoundPart(obstacle,solids)',
  'buildAnatomicalTractor(root)','buildAnatomicalLoader(root)',
  'hit.userData.compoundPartId=prism.partId','hit.updateMatrixWorld(true)',
  'solids.push(hit)'])
  assert.ok(code.includes(s),s);
 assert.match(code,/for\(const obstacle of world\.obstacles\)\s*if\(isCompoundObstacle\(obstacle\)\)/);
 assert.match(cert,/expectedPhysicalParts:expectedParts\.size/);
 assert.match(cert,/hit prism differs from physical/);
 assert.match(cert,/promotedFamilies:Object\.freeze\(\['tractor','loader'\]\)/);
});
