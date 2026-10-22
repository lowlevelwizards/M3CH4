import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceStampCount,serviceStampLabel} from '../serviceEvidencePolicy.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('service marking reflects exact existing repair counts, never creates imaginary maintenance',()=>{
  assert.equal(serviceStampCount({repairs:0}),0);
  assert.equal(serviceStampCount({repairs:1}),1);
  assert.equal(serviceStampCount({repairs:12}),12);
  assert.equal(serviceStampCount({repairs:150}),150);
  assert.equal(serviceStampCount({repairs:-1}),0);
  assert.equal(serviceStampCount({repairs:1.6}),0);
  assert.equal(serviceStampCount({repairs:'3'}),0);
  assert.equal(serviceStampLabel({repairs:150}),'R-99+');
  assert.equal(serviceStampLabel({repairs:2}),'R-02');
});
test('service plate is graphical only and attached after authentic owner paint',()=>{
  const scene=read('scene.js'),visuals=read('serviceEvidenceVisuals.js');
  assert.match(scene,/addPhysicalServiceStamp\(group,fitted\.instance\)/);
  assert.match(scene,/applyPartFinish\(group,fitted\.definition\.id,fitted\.instance\.paint\)/);
  assert.match(visuals,/selected\.add\(mark\)/);
  assert.match(visuals,/serviceEvidence=\{serial:part\.serial,repairs,label:serviceStampLabel\(part\)\}/);
  assert.doesNotMatch(visuals,/damageInstalledPart|storeStable|storeMachine|applyTargetHit/);
});
test('pit equipment appears only on real disabled machines and has no collision authority',()=>{
  const scene=read('scene.js');
  assert.match(scene,/const serviceDressing=buildServiceDressing\(\)/);
  assert.match(scene,/serviceDressing\.visible=!vendorEnabled&&Object\.values\(latestPilotParts\)/);
  assert.match(scene,/function buildServiceDressing\(\)/);
  assert.match(scene,/if\(!enabled\)serviceDressing\.visible=false/);
  const method=scene.slice(scene.indexOf('function buildServiceDressing()'),
    scene.indexOf('function buildGarageBay()'));
  assert.ok(!/solids\.push|pickMeshes\.push|arenaObstacleId/.test(method));
});
