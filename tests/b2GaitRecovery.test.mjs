import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFootContacts,advanceFootContacts,footPresentation} from '../footContactController.js';
import {makeTestAssembly} from '../components.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {createRigState,stepRig} from '../locomotion.js';
const DT=1/60, source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const [label,speed] of [['CREEP',.35],['WALK',1.1],['HUSTLE',3.2]]){
 test(label+' is reached through actual walking speed without applying bonus forces',()=>{
  const rig={x:0,z:0,yaw:0,vx:speed,vz:0,driveLoad:.5,tractionUse:.5};
  let feet=createFootContacts(rig,'legs-yard');
  for(let i=0;i<45;i++){
   rig.x+=speed*DT;
   feet=advanceFootContacts(feet,rig,'legs-yard',DT);
  }
  assert.equal(feet.gaitMode,label);
  assert.ok(feet.feet.every(f=>Number.isFinite(footPresentation(feet,f.side).y)));
 });
}
test('saturated contact requests limited recovery, with no phantom stumbles while idle',()=>{
 const rig={x:0,z:0,yaw:0,vx:0,vz:0,footSlipMps:0,tractionUse:0,impact:0};
 let feet=createFootContacts(rig,'legs-compact');
 for(let i=0;i<80;i++)feet=advanceFootContacts(feet,rig,'legs-compact',DT);
 assert.equal(feet.gaitMode,'IDLE');
 assert.equal(feet.recovery,0);
 let loaded={...rig,vx:2,vz:0,footSlipMps:3,tractionUse:1,impact:.6};
 for(let i=0;i<35;i++){loaded={...loaded,x:i*.03};feet=advanceFootContacts(feet,loaded,'legs-compact',DT);}
 assert.ok(feet.recovery>.5);
 assert.ok(feet.recovery<=1);
 assert.equal(feet.maneuver,'WALK');
});
test('short directional footwork is bounded by motor force and cannot make disabled legs dash',()=>{
 const config=deriveRigConfig(makeTestAssembly());
 const base=createRigState(),disabled=createRigState();
 const world={minX:-200,maxX:200,minZ:-200,maxZ:200,obstacles:[]};
 for(let i=0;i<16;i++){
  stepRig(base,{throttle:0,strafe:1,steer:0,brake:0},DT,config,world);
  stepRig(disabled,{throttle:0,strafe:1,steer:0,brake:0},DT,{
   ...config,lateralDriveForceN:0,lateralGripNsPerM:0,driveForceN:0,
  },world);
 }
 assert.ok(base.lateralSpeed>.04);
 assert.ok(Math.abs(disabled.lateralSpeed)<1e-8);
 assert.ok(base.lateralSpeed<=config.maxLateralSpeedMps);
});
test('real cockpit secondary motion and mobile lab maneuvers share measured state',()=>{
 const scene=source('scene.js'),lab=source('pilotingLab.js');
 assert.match(scene,/cockpitLagX\+=/);
 assert.match(scene,/cockpitLagZ\+=/);
 assert.match(scene,/recovery:contacts.recovery/);
 assert.match(lab,/quickstep\.remaining/);
 assert.match(lab,/strafe:stepStrafe/);
 assert.match(source('piloting-lab.html'),/id="quick-left"/);
});
