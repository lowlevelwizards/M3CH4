import test from 'node:test';
import assert from 'node:assert/strict';
import {SILHOUETTE_PRESETS,TUNABLES,U1_SILHOUETTE_MOUNT,SILHOUETTE_GROUND_Y,
 candidateById,deriveSilhouette,clampParameter} from '../research/yardwalkerSilhouetteDesign.js';
import {readFileSync} from 'node:fs';

test('three genuinely distinct independent prototype configurations',()=>{
 assert.deepEqual(SILHOUETTE_PRESETS.map(x=>x.id),['strider','bruiser','hound']);
 const [a,b,c]=SILHOUETTE_PRESETS.map(deriveSilhouette);
 assert.ok(b.thighMass>a.thighMass+.15&&b.thighMass>c.thighMass+.1);
 assert.ok(c.kneeOffset>a.kneeOffset+.1&&a.kneeOffset>b.kneeOffset+.1);
 assert.ok(b.thighShare>a.thighShare+.10);
 assert.ok(b.footWidth>a.footWidth+.10&&b.footDepth>c.footDepth+.10);
 assert.ok(b.hipSpan>a.hipSpan+.1&&a.hipSpan>=c.hipSpan);
 assert.ok([a,b,c].every(p=>p.isNominalWidth));
 assert.deepEqual([a,b,c].map(p=>p.mount),Array(3).fill(U1_SILHOUETTE_MOUNT));
});
test('all concepts retain only the reference U1 interface and a shared ground plane',()=>{
 for(const p of SILHOUETTE_PRESETS.map(deriveSilhouette)){
  assert.equal(p.floor,SILHOUETTE_GROUND_Y);
  assert.equal(p.legs.length,2);
  assert.equal(p.legs[0].side,-1);
  assert.equal(p.legs[1].side,1);
  const [l,r]=p.legs;
  for(const tag of ['hip','knee','ankle','foot']){
   assert.ok(l[tag].every(Number.isFinite));
   assert.ok(r[tag].every(Number.isFinite));
   assert.equal(l[tag][0],-r[tag][0]);
   assert.equal(l[tag][1],r[tag][1]);
   assert.equal(l[tag][2],r[tag][2]);
  }
  assert.ok(p.kneeY<p.hipY&&p.kneeY>p.legs[0].ankle[1]);
  assert.ok(l.knee[2]>l.hip[2] && l.knee[2]>l.ankle[2]);
  assert.ok(Math.abs((l.foot[1]-p.footHeight/2)-SILHOUETTE_GROUND_Y)<1e-9);
 }
});
test('parameters are isolated and clamped, resetting one leaves the others unchanged',()=>{
 const a=candidateById('strider'),b=candidateById('bruiser');
 const originalB=structuredClone(b);
 a.thighMass=clampParameter('thighMass',.58);
 assert.equal(deriveSilhouette(a).thighMass,.58);
 assert.deepEqual(b,originalB);
 assert.equal(candidateById('strider').thighMass,SILHOUETTE_PRESETS[0].thighMass);
 for(const [key,v] of Object.entries(TUNABLES)){
  assert.equal(clampParameter(key,v.max+100),v.max);
  assert.equal(clampParameter(key,v.min-100),v.min);
  assert.ok(v.step>0);
 }
 assert.throws(()=>candidateById('fake'),/Unknown study/);
});
test('the dev lab is linked, keeps production code isolated and has usable controls',()=>{
 const get=f=>readFileSync(new URL(f,import.meta.url),'utf8');
 const html=get('../yardwalker-silhouette.html'),
  renderer=get('../research/yardwalkerSilhouetteLab.js'),
  geometry=get('../research/yardwalkerSilhouetteGeometry.js'),
  main=get('../index.html');
 assert.match(main,/id="yardwalker-silhouette-open"/);
 assert.match(html,/id="hipSpan"/);
 assert.match(html,/id="kneeOffset"/);
 assert.match(html,/id="thighShare"/);
 assert.match(html,/id="silhouette"/);
 assert.match(html,/data-view="side"/);
 assert.match(renderer,/buildExteriorRig\(makeTestAssembly\(\)\)/);
 assert.match(renderer,/root\.clone\(true\)/);
 assert.match(renderer,/mobilityGroup\.add\(study\.root\)/);
 assert.doesNotMatch(renderer,/localStorage|sessionStorage|fetch\(|saveAssembly|equip\(/);
 assert.doesNotMatch(geometry,/buildYardwalkerVisual|yardwalkerDesignData|productionArmorPlan/);
 assert.match(html,/NO SAVE/);
 assert.match(html,/data-armor-tier="0"/);
 assert.match(html,/data-armor-tier="3"/);
 assert.match(html,/id="encased-style"/);
 assert.match(html,/id="boot-plate"/);
 assert.match(armor,/enclosureGeometry/);
 assert.match(armor,/addArmorToLeg/);
 assert.match(armor,/frontPlate/);
 assert.match(armor,/outerPlate/);
 assert.match(renderer,/createSilhouetteMachine\(state\.configs\[id\],state\)/);
 assert.doesNotMatch(armor,/legs-yard|partGroups|buildExteriorRig/);
});
