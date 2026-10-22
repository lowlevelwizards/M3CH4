import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 familyAnimation,footTrajectory,solveLegIK,legPose,aimArticulation,
 reloadArticulation,shortestAngle,
} from '../articulationMotion.js';
import {createMotionSoundState,advanceMotionSound,soundFamilyFor} from '../liveSystemsEvents.js';

const files=['scene.js','sceneAssembly.js','main.js','index.html'];
const text=Object.fromEntries(files.map(p=>[p,readFileSync(new URL('../'+p,import.meta.url),'utf8')]));
const sum=pose=>Math.abs(pose.hip)+Math.abs(pose.knee)+Math.abs(pose.ankle)+Math.abs(pose.foot);
test('all three mobility families have distinct reach, lift, load travel',()=>{
 const a=familyAnimation('legs-yard'),b=familyAnimation('legs-compact'),c=familyAnimation('legs-hauler');
 assert.ok(b.lift>a.lift&&a.lift>c.lift);
 assert.ok(b.reach>a.reach&&a.reach>c.reach);
 assert.ok(c.compression>a.compression&&a.compression>b.compression);
 assert.equal(b.stride,soundFamilyFor('legs-compact').strideM);
 assert.equal(a.stride,soundFamilyFor('legs-yard').strideM);
 assert.equal(c.stride,soundFamilyFor('legs-hauler').strideM);
});
test('opposing feet alternate planted stance and toe-clear swing arc',()=>{
 const at=(phase,side)=>footTrajectory(phase,side,1,'legs-yard',false);
 assert.equal(at(0,-1).planted,true);
 assert.equal(at(0,1).planted,true,'both feet briefly touch during transfer');
 assert.equal(at(.2*Math.PI,1).planted,false);
 assert.equal(at(Math.PI,-1).planted,true,'short two-foot weight-transfer overlap');
 assert.equal(at(1.2*Math.PI,-1).planted,false);
 assert.equal(at(Math.PI,1).planted,true);
 assert.ok(at(1.6*Math.PI,-1).y>0);
 assert.ok(at(.6*Math.PI,1).y>0);
 assert.equal(footTrajectory(1.6*Math.PI,-1,0).y,0);
 assert.equal(at(.3*Math.PI,-1).y,0);
 const backward=footTrajectory(.25*Math.PI,-1,1,'legs-yard',true);
 assert.ok(Math.abs(backward.z+at(.25*Math.PI,-1).z)<1e-10);
});
test('analytic joint solution respects authored reverse-knee shape and physical lengths',()=>{
 const rigs=[
   {upper:[-.51,.10],lower:[-.465,-.10]},
   {upper:[-.38,.21],lower:[-.52,-.30]},
   {upper:[-.44,.07],lower:[-.41,-.09]},
 ];
 for(const {upper,lower} of rigs){
   const rest=solveLegIK(upper,lower,0,0);
   assert.ok(Math.abs(rest.hip)<.005);
   assert.ok(Math.abs(rest.knee)<.005);
   for(const [dy,dz] of [[.07,-.17],[.15,.21],[.24,-.39],[-.05,.35]]){
     const pose=solveLegIK(upper,lower,dy,dz);
     assert.ok(Number.isFinite(pose.hip)&&Number.isFinite(pose.knee));
     assert.ok(Math.abs(pose.hip)<=.85001&&Math.abs(pose.knee)<=1.20001);
     assert.ok(pose.reach<Math.hypot(...upper)+Math.hypot(...lower));
   }
 }
});
test('walking poses are dramatically more visible than former ~0.075 rad oscillation',()=>{
 const upper=[-.48,.12],lower=[-.47,-.14];
 const p=legPose(upper,lower,{phase:1.6*Math.PI,side:-1,weight:1,family:'legs-yard',health:1});
 const idle=legPose(upper,lower,{phase:1.6*Math.PI,side:-1,weight:0,family:'legs-yard',health:1});
 assert.ok(sum(p)>.16,'visible mechanical swing and knee action');
 assert.ok(sum(idle)<.03,'idle recovers authored rest pose');
 const disabled=legPose(upper,lower,{phase:1.6*Math.PI,side:-1,weight:1,family:'legs-yard',disabled:true});
 assert.ok(disabled.knee<-.28,'disabled joint buckles visibly');
});
test('rendered gait phase is driven by the very same landing event as audio',()=>{
 const state=createMotionSoundState(),family=soundFamilyFor('legs-yard');
 let steps=0,last=state.phase;
 for(let i=0;i<800;i++){
   const events=advanceMotionSound(state,family,3,.015);
   if(events.includes('yardwalker')){
     steps++;
     assert.equal(state.stepCount,steps);
     assert.ok(Math.abs(state.phase-Math.PI*steps) < .40,'audio contact coincides with pose stance transition');
     assert.equal(state.lastFoot,steps%2?'right':'left');
   }
   assert.ok(state.phase>=last-.001,'phase does not run backwards');
   last=state.phase;
 }
 assert.ok(steps>10);
 const before=state.phase;
 for(let i=0;i<100;i++)advanceMotionSound(state,family,0,.016);
 assert.equal(state.phase,before,'standing feet do not slide forward with an idle clock');
 assert.ok(state.gaitWeight<.002);
});
test('aim, bounded waist and compensated gun traverse preserve direction',()=>{
 let pose={waist:0,gun:0,elevation:0};
 for(let i=0;i<100;i++)pose=aimArticulation(.8,.22,.016,pose);
 assert.ok(pose.waist>.20&&pose.waist<.30);
 assert.ok(Math.abs((pose.waist+pose.gun)-.8)<.02,'yaw not double counted');
 assert.ok(Math.abs(pose.elevation-.22)<.02);
 const dead=aimArticulation(3,1,.016,pose,{fault:true});
 assert.ok(dead.waist<.4&&dead.elevation<.46);
 assert.ok(Math.abs(shortestAngle(-Math.PI*2))<1e-10);
});
test('all four weapon reloads have distinct visual mechanical staging',()=>{
 const weapons=['gun-cannon','gun-short','gun-light','gun-scatter'];
 for(const id of weapons){
   assert.deepEqual(reloadArticulation(0,2.5,id),{slide:0,bolt:0,cassette:0});
   const samples=Array.from({length:20},(_,i)=>reloadArticulation((1-i/20)*2.5,2.5,id));
   assert.ok(samples.some(x=>x.slide>.05),id+' moving breech');
   assert.ok(samples.some(x=>x.bolt>.02),id+' shifting bolt');
   assert.ok(samples.every(x=>x.slide>=0&&x.bolt>=0&&x.cassette>=0));
 }
 assert.ok(reloadArticulation(1.0,2.5,'gun-scatter').cassette>.05);
 assert.equal(reloadArticulation(1.0,2.5,'gun-cannon').cassette,0);
});
test('real leg hierarchy and frame independent root remain authoritative',()=>{
 for(const p of ['yardwalkerVisual.js','kestrelVisual.js','haulerVisual.js']){
   const source=readFileSync(new URL('../'+p,import.meta.url),'utf8');
   assert.match(source,/joint:'hip'/);
   assert.match(source,/joint:'knee'/);
   assert.match(source,/joint:'ankle'/);
   assert.match(source,/joint:'foot'/);
 }
 assert.match(text['scene.js'],/const isLegs=slot==='mobility'/);
 assert.match(text['sceneAssembly.js'],/const mountParent=slot==='mobility'\?hull.parent:hull/);
 assert.match(text['scene.js'],/poseCombatantExterior/);
 assert.match(text['scene.js'],/legPose\(leg.upper,leg.lower/);
 assert.match(text['scene.js'],/weaponMechanism/);
 assert.match(text['scene.js'],/reloadArticulation/);
 assert.match(text['scene.js'],/weaponFault/);
 assert.match(text['scene.js'],/setAnimationPreview/);
 assert.match(text['main.js'],/gait:actor.visualGait/);
 assert.match(text['main.js'],/gait:movementSoundStates.get\(rig\)/);
 assert.match(text['main.js'],/reloadLeft:actor.weaponState\?\.reloadLeft/);
 assert.match(text['main.js'],/reloadLeft:weaponState\?\.reloadLeft/);
 assert.match(text['index.html'],/id="animation-preview-toggle"/);
 assert.match(text['index.html'],/id="animation-preview-mode"/);
 assert.match(text['index.html'],/id="animation-preview-speed"/);
 assert.match(text['index.html'],/0\.0\.1k\.4s\.3 — Deploy and Layout/);
 assert.doesNotMatch(text['main.js'],/storeMachine\(.*gait/);
});
