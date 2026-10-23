import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOADING_DOCK,loadingDockHeight,advanceLabElevation} from '../loadingDockTraversal.js';
import {createFootContacts,advanceFootContacts,footPresentation} from '../footContactController.js';
import {createPilotChallenge,advancePilotChallenge,PILOT_CHALLENGES} from '../pilotChallenges.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('the authored loading platform is flat outside and continuous along the entry/exit ramps',()=>{
 assert.equal(loadingDockHeight(0,22),0);
 assert.equal(loadingDockHeight(5,12),0);
 assert.equal(loadingDockHeight(0,LOADING_DOCK.northZ),0);
 assert.equal(loadingDockHeight(0,LOADING_DOCK.upperNorthZ),.42);
 assert.equal(loadingDockHeight(0,12),.42);
 assert.equal(loadingDockHeight(0,LOADING_DOCK.southZ),0);
 assert.ok(Math.abs(loadingDockHeight(0,16.5)-.21)<1e-8);
});
test('installed motor force bounds vertical climb rate; disabled drive cannot climb',()=>{
 const full={x:0,z:12,vx:1,vz:0,groundHeightM:0};
 const failed={...full};
 const config={massKg:4250,driveForceN:12400};
 const unpowered={...config,driveForceN:0};
 let before=full.groundHeightM;
 for(let i=0;i<200;i++){
   const after=advanceLabElevation(full,config,1/60);
   assert.ok(after-before<=.73/60,'no vertical teleport');
   before=after;
   advanceLabElevation(failed,unpowered,1/60);
 }
 assert.ok(Math.abs(full.groundHeightM-.42)<.001);
 assert.equal(failed.groundHeightM,0);
 assert.equal(full.vx,1,'no invented horizontal impulse');
 assert.equal(failed.vx,1);
});
test('world-fixed stance contacts keep surface height while the torso rises',()=>{
 const rig={x:0,z:19,yaw:0,vx:0,vz:-1,groundHeightM:0,
   terrainHeightAt:loadingDockHeight,driveLoad:.6,tractionUse:.6};
 let feet=createFootContacts(rig,'legs-yard');
 for(let i=0;i<110;i++){
  rig.z=19-i*.055;
  advanceLabElevation(rig,{massKg:4200,driveForceN:12500},1/60,true);
  feet=advanceFootContacts(feet,rig,'legs-yard',1/60);
  for(const f of feet.feet){
   assert.ok(Number.isFinite(f.y));
   assert.ok(f.y>=0&&f.y<=.42);
   const contact=footPresentation(feet,f.side);
   assert.ok(Number.isFinite(contact.y));
   assert.ok(contact.y>-1&&contact.y<1);
  }
 }
 assert.ok(rig.groundHeightM>0);
 assert.ok(feet.feet.some(f=>f.y>0));
});
test('loading dock is session-only and requires a held stable finish',()=>{
 const ch=createPilotChallenge('climb');
 assert.equal(PILOT_CHALLENGES.climb.label,'LOADING DOCK');
 const rig={x:0,z:11.5,vx:0,vz:2};
 for(let i=0;i<100;i++)advancePilotChallenge(ch,rig,[],1/60);
 assert.equal(ch.complete,false);
 rig.vz=0;
 for(let i=0;i<40;i++)advancePilotChallenge(ch,rig,[],1/60);
 assert.equal(ch.complete,true);
});
test('only isolated lab calls elevation integration, normal game remains planar',()=>{
 const lab=src('pilotingLab.js'),scene=src('scene.js');
 assert.match(lab,/advanceLabElevation\(state,config,DT/);
 assert.match(lab,/state\.terrainHeightAt=/);
 assert.match(lab,/dockGeometry\.computeVertexNormals/);
 assert.match(scene,/state\.groundHeightM\?\?0/);
 assert.doesNotMatch(src('main.js'),/advanceLabElevation|loadingDockHeight/);
 assert.doesNotMatch(src('loadingDockTraversal.js'),/localStorage|storeMachine/);
});
