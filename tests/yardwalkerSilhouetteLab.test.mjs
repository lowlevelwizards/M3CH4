import test from 'node:test';
import assert from 'node:assert/strict';
import {SILHOUETTE_PRESETS,TUNABLES,U1_SILHOUETTE_MOUNT,SILHOUETTE_GROUND_Y,
 candidateById,deriveSilhouette,clampParameter} from '../research/yardwalkerSilhouetteDesign.js';
import {readFileSync} from 'node:fs';
import {sampleStudyPose,sagittalKnee,POSE_MODES} from '../research/yardwalkerSilhouettePose.js';

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
  armor=get('../research/yardwalkerSilhouetteArmor.js'),
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
 assert.match(html,/data-pose="walk"/);
 assert.match(html,/data-pose="crouch"/);
 assert.match(html,/id="pose-phase"/);
 assert.match(renderer,/applyPosePreview/);
 assert.match(renderer,/createSilhouetteMachine\(state\.configs\[id\],state\)/);
 assert.doesNotMatch(armor,/legs-yard|partGroups|buildExteriorRig/);
});

test('pose preview preserves exact Naked rest landmarks and baseline foot contacts',()=>{
 for(const preset of SILHOUETTE_PRESETS){
  const p=deriveSilhouette(preset),pose=sampleStudyPose(p,'neutral',.42);
  assert.equal(pose.bodyY,0);
  assert.equal(pose.reachLimited,false);
  for(let i=0;i<2;i++){
   assert.deepEqual(pose.legs[i].hip,p.legs[i].hip);
   assert.deepEqual(pose.legs[i].knee,p.legs[i].knee);
   assert.deepEqual(pose.legs[i].ankle,p.legs[i].ankle);
  }
 }
 assert.deepEqual(POSE_MODES.map(m=>m.id),['neutral','walk','crouch']);
 assert.throws(()=>sampleStudyPose(deriveSilhouette(SILHOUETTE_PRESETS[0]),'run'),/Unknown/);
});
test('walk alternates stance and swing and keeps grounded feet at rest level',()=>{
 for(const preset of SILHOUETTE_PRESETS){
  const p=deriveSilhouette(preset);
  for(let frame=0;frame<100;frame++){
   const pose=sampleStudyPose(p,'walk',frame/100);
   assert.ok(Math.abs(pose.bodyY)<.03);
   assert.ok(pose.legs.some(l=>l.planted));
   for(const leg of pose.legs){
    const rest=p.legs.find(l=>l.side===leg.side);
    assert.ok(leg.footLift>=0);
    if(leg.planted)assert.ok(Math.abs(leg.ankle[1]+pose.bodyY-rest.ankle[1])<1e-9);
    else assert.ok(leg.footLift<=.15001);
    assert.ok(leg.knee.every(Number.isFinite));
    const upper=Math.hypot(leg.knee[1]-leg.hip[1],leg.knee[2]-leg.hip[2]);
    const lower=Math.hypot(leg.knee[1]-leg.ankle[1],leg.knee[2]-leg.ankle[2]);
    const originalUpper=Math.hypot(rest.knee[1]-rest.hip[1],rest.knee[2]-rest.hip[2]);
    const originalLower=Math.hypot(rest.knee[1]-rest.ankle[1],rest.knee[2]-rest.ankle[2]);
    assert.ok(Math.abs(upper-originalUpper)<.0015,'moving upper link length should remain fixed');
    assert.ok(Math.abs(lower-originalLower)<.0015,'moving lower link length should remain fixed');
   }
  }
  const phaseA=sampleStudyPose(p,'walk',.11),phaseB=sampleStudyPose(p,'walk',.61);
  assert.ok(phaseA.legs[0].planted!==phaseB.legs[0].planted);
 }
});
test('deep bend lowers upper rig but feet remain at original ground level',()=>{
 for(const preset of SILHOUETTE_PRESETS){
  const p=deriveSilhouette(preset),pose=sampleStudyPose(p,'crouch',.25);
  assert.equal(pose.bodyY,-.17);
  for(let i=0;i<2;i++){
   assert.ok(pose.legs[i].planted);
   assert.ok(Math.abs(pose.legs[i].ankle[1]+pose.bodyY-p.legs[i].ankle[1])<1e-9);
   assert.ok(pose.legs[i].knee.every(Number.isFinite));
  }
 }
});
