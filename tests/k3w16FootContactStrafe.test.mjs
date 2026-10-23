import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legPose,footTrajectory,familyAnimation} from '../articulationMotion.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sets=[
  ['legs-yard',[-.52,.10],[-.445,-.10],.03,-.04],
  ['legs-compact',[-.405,.33],[-.485,-.45],-.07,.11],
  ['legs-hauler',[-.45,.05],[-.37,-.10],0,-.05],
];
test('lateral gait moves feet sideways without turning it into a forward march',()=>{
 for(const [family,upper,lower,upperX,lowerX] of sets){
  const shared={family,upperX,lowerX,phase:1.89*Math.PI,side:-1,weight:1,health:1};
  const left=legPose(upper,lower,{...shared,strafe:-1,forward:0});
  const right=legPose(upper,lower,{...shared,strafe:1,forward:0});
  const fwd=legPose(upper,lower,{...shared,strafe:0,forward:1});
  assert.ok(left.lateralReach*right.lateralReach<0,family+' feet reach opposite sides');
  assert.ok(Math.abs(left.lateralReach)>.04,family+' meaningful side reach');
  assert.ok(Math.abs(left.hipRoll)+Math.abs(left.kneeRoll)>.035,
    family+' visibly different hip and knee lateral rotations');
  assert.ok(Math.abs(fwd.hipRoll)<1e-9&&Math.abs(fwd.kneeRoll)<1e-9,
    family+' approved forward gait has unchanged lateral pose');
  assert.ok(Math.abs(left.hipRoll)<=.35001&&Math.abs(left.kneeRoll)<=.43001);
  assert.ok(Math.abs(left.ankleRoll)<=.32001&&Math.abs(left.footRoll)<=.25001);
  assert.ok([left,right,fwd].every(p=>Object.values(p).every(v=>typeof v==='boolean'||Number.isFinite(v))));
 }
});
test('strafe blends continuously into diagonal travel and preserves physical landing phase',()=>{
 for(const [family,upper,lower,upperX,lowerX] of sets){
  const pose=(strafe,forward)=>legPose(upper,lower,{
   family,upperX,lowerX,phase:.8*Math.PI,side:1,weight:1,strafe,forward,
  });
  const lateral=pose(1,0);
  const diagonal=pose(.6,.7);
  const forward=pose(0,1);
  assert.ok(Math.abs(diagonal.lateralReach)<Math.abs(lateral.lateralReach));
  assert.ok(Math.abs(diagonal.lateralReach)>0);
  assert.equal(lateral.planted,forward.planted);
  assert.equal(lateral.lift,forward.lift,'lateral/forward footsteps share physical contact phase');
  const rest=pose(0,0);
  assert.ok(Math.abs(rest.hipRoll)<.001);
  assert.ok(familyAnimation(family).lateralReach>0);
 }
});
test('sole height is calibrated from real feet, not a global magic offset',()=>{
 const scene=source('scene.js'),bridge=source('sceneAssembly.js');
 assert.match(scene,/function calibrateExteriorSoles\(visual\)/);
 assert.match(scene,/node\.userData\?\.joint==='foot'/);
 assert.match(scene,/bounds\.setFromObject\(foot\)/);
 assert.match(scene,/\.groundOffset=height/);
 assert.match(scene,/GARAGE_PAD_TOP_Y=\.09/);
 assert.match(scene,/targetExterior\.groundOffset/);
 assert.match(scene,/actorExterior\.groundOffset/);
 assert.match(scene,/record\.exterior\.groundOffset/);
 assert.match(scene,/recalibratePlayerSoles/);
 assert.match(bridge,/arena\.recalibratePlayerSoles\?\.\(\)/);
 assert.doesNotMatch(source('locomotion.js'),/groundOffset|calibrateExteriorSoles/,
  'locomotion physics never receives visual offsets');
});
test('DEV strafe inspection and Safari deployment versions are fresh',()=>{
 const scene=source('scene.js'),html=source('index.html');
 assert.match(scene,/animationPreviewMode==='strafe-left'/);
 assert.match(scene,/animationPreviewMode==='strafe-right'/);
 assert.match(scene,/sideStep\*speed/);
 assert.match(html,/<option value="strafe-left">STRAFE LEFT<\/option>/);
 assert.match(html,/<option value="strafe-right">STRAFE RIGHT<\/option>/);
 assert.match(html,/articulationMotion\.js\?v=k5a2/);
 assert.match(html,/sceneAssembly\.js\?v=k5q1/);
 assert.match(html,/main\.js\?v=k5q1/);
 assert.match(source('sceneAssembly.js'),/scene\.js\?source=k5q1/);
 assert.match(html,/<title>MECH ARENA — 0\.0\.1k\.[^<]+<\/title>/);
});
