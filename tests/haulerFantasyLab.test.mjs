import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG} from '../components.js';
import {HAULER_PRESETS,HAULER_IDS,H2_INTERFACE,HAULER_TUNABLES,preset,adjust,haulerDimensions}
 from '../research/haulerFantasyDesign.js';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('three distinct original Hauler fantasies stay independent',()=>{
 assert.deepEqual(HAULER_IDS,['dock','strider','crane']);
 assert.equal(HAULER_PRESETS.length,3);
 assert.equal(new Set(HAULER_PRESETS.map(p=>p.mechanism)).size,3);
 assert.equal(new Set(HAULER_PRESETS.map(p=>p.hipY)).size,3);
 assert.equal(new Set(HAULER_PRESETS.map(p=>p.stride)).size,3);
 for(const p of HAULER_PRESETS)assert.ok(Object.isFrozen(p));
});
test('all three prototypes respect shared actual H2 interface, broad footprint and ground',()=>{
 const catalog=CATALOG.find(x=>x.id==='legs-hauler');
 assert.deepEqual(catalog.envelope,[H2_INTERFACE.width,H2_INTERFACE.height,H2_INTERFACE.depth]);
 assert.equal(catalog.massKg,1520);
 assert.equal(H2_INTERFACE.adapterKg,110);
 for(const id of HAULER_IDS){
  const p=haulerDimensions(preset(id));
  assert.deepEqual(p.topContact,[0,.84,0]);
  assert.equal(p.ground,-.84);
  assert.equal(p.legs.length,2);
  assert.ok(p.maxFootX<1.275);
  assert.ok(p.soleDepth<=.96);
  assert.ok(p.strideDistance>0);
  for(const l of p.legs){
   assert.ok(l.hip[1]>l.knee[1]&&l.knee[1]>l.ankle[1]);
   assert.ok(l.ankle[1]>l.foot[1]);
  }
 }
});
test('experimental controls stay scoped and never change immutable design values',()=>{
 for(const id of HAULER_IDS){
  const baseline=preset(id);
  const changed=adjust(id,{footScale:999,podScale:-500,hipSpread:999,stroke:999});
  for(const [name,rule] of Object.entries(HAULER_TUNABLES))
   assert.ok(changed[name]>=rule.min-1e-9&&changed[name]<=rule.max+1e-9);
  assert.deepEqual(preset(id),baseline);
 }
});
test('Hauler fantasy comes from original constructors and not production Hauler',()=>{
 const geometry=source('../research/haulerFantasyGeometryV2.js');
 const motion=source('../research/haulerFantasyMotion.js');
 const lab=source('../research/haulerFantasyLab.js');
 const registry=source('../partVisuals.js');
 const live=source('../haulerVisual.js');
 const html=source('../hauler-fantasy-lab.html');
 const index=source('../index.html');
 for(const name of ['dockAssembly','striderAssembly','craneAssembly','createHaulerConcept','dockFeet','striderFeet','craneFeet'])
  assert.ok(geometry.includes(name));
 assert.ok(!geometry.includes('buildHaulerVisual(') && !geometry.includes('import {HAULER_LAYOUT'), 'No legacy Hauler builder or layout imports');
 assert.match(motion,/solveHeavyLinks/);
 for(const name of ['poseDockyardMechanism','poseStriderMechanism','poseCraneMechanism'])
  assert.ok(motion.includes('function '+name),name+' requires independent action rig');
 assert.match(geometry,/function dockCarriage/);
 assert.match(geometry,/function striderCarriage/);
 assert.match(geometry,/function craneCarriage/);
 assert.match(geometry,/updateHaulerActuators/);
 assert.match(lab,/assemblyView/);
 assert.match(lab,/applySectionVisibility/);
 assert.match(lab,/buildExteriorRig\(makeTestAssembly\(\)\)/);
 assert.match(lab,/createMovingHauler/);
 assert.match(registry,/'legs-hauler': buildHaulerVisual/);
 assert.doesNotMatch(live,/haulerFantasy/);
 for(const id of HAULER_IDS)assert.match(html,new RegExp('data-id="'+id+'"'));
 assert.match(index,/id="hauler-fantasy-open"/);
 assert.doesNotMatch(lab,/localStorage|sessionStorage|setItem\(/);
});
