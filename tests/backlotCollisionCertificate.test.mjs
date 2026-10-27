import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
import {auditMapFlow} from '../maps/mapFlowAudit.js';
import {certifyArena} from '../maps/mapValidation.js';

const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cert=src('backlotCollisionCertificate.js');
const derby=src('backlotDerbyWorld.js');
const gallery=src('backlotPropGallery.js');
const secondary=src('backlotSecondaryAnatomy.js');
const stage=src('research/browserQuickSmoke.mjs');

test('rebuilt exterior scenery does not become physically blocked cover',()=>{
 assert.match(cert,/offsiteWithoutCollider:items.length/);
 assert.match(cert,/expected:18,count:items.length/);
 assert.match(cert,/SAFE_MARGIN=\.65/);
 assert.match(cert,/SECONDARY=/);
 assert.match(cert,/Math\.max\(left,right,near,far\)/);
 assert.match(cert,/if\(o\.userData\?\.arenaObstacleId\)/);
 assert.match(derby,/auditBacklotCollisionTruth\(root,world,solids,liveFit\.sources\)/);
 assert.match(derby,/secondaryGeometryClearance\(source,world\)/);
 assert.match(gallery,/secondaryCollisionClearance:catalog.secondaryCollisionClearance/);
 assert.match(stage,/collisionCertificate\.authoritativeRaycastSolids!==/);
 assert.match(stage,/uncollidableOffsiteAssets!==18/);
});
test('every LIVE raycast solid is independently compared to the authored gameplay prism',()=>{
 for(const axis of ['minX','maxX','minZ','maxZ','minY','maxY'])
  assert.ok(cert.includes("'"+axis+"'"),axis);
 assert.match(cert,/hits\.get\(key\)!==1/);
 assert.match(cert,/new THREE\.Box3\(\)\.setFromObject\(solid\)/);
 assert.match(cert,/expectedParts=new Map/);
 assert.match(cert,/authoritativeRaycastSolids/);
 assert.match(cert,/visible steel differs from hit prism/);
 assert.match(cert,/Live model combat\/route regression/);
});
test("the gallery\u0027s fourteen hollow mechanical prototypes are NOT deceptively certified as solid",()=>{
 assert.match(cert,/currentPolicy:'tractor-and-loader-compound-live/);
 assert.match(cert,/galleryOnly:false/);
 assert.match(cert,/plannedFamilies:Object\.freeze/);
 assert.match(cert,/promotedFamilies:Object\.freeze\(\['tractor','loader'\]\)/);
 assert.doesNotMatch(secondary,/world\.obstacles\.|solids\.push|arenaObstacleId/);
});
test('Backlot physical and tactical routes preserve their shared collision truth',()=>{
 assert.equal(BACKLOT.world.obstacles.length,34);
 const testMap=certifyArena(BACKLOT,{checkRoutes:false});
 assert.equal(testMap.ok,true,JSON.stringify(testMap.errors));
 const audit=auditMapFlow(BACKLOT,{checkRoutes:false});
 assert.equal(audit.exposure.exposed,0);
 assert.ok(audit.objectiveApproaches.every(a=>a.clearBearings>=3));
});
