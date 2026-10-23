import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFootContacts,advanceFootContacts,footPresentation,footContactProfile} from '../footContactController.js';
import {legPose,footTrajectory} from '../articulationMotion.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const families=['legs-yard','legs-compact','legs-hauler'];
const rig=(x=0,z=0,yaw=0,vx=0,vz=0)=>({x,z,yaw,vx,vz});
test('stationary stance anchors stay fixed and IK targets remain finite',()=>{
 for(const family of families){
  const r=rig(),s=createFootContacts(r,family);
  for(let i=0;i<80;i++)advanceFootContacts(s,r,family,1/60);
  assert.equal(s.landings,0);
  assert.equal(s.stanceCount,2);
  for(const f of s.feet){
   assert.equal(f.mode,'stance');assert.equal(f.lift,0);
   assert.ok(Math.abs(f.localX)<1e-8&&Math.abs(f.localZ)<1e-8);
   const target=footPresentation(s,f.side);
   const pose=legPose([-.5,.05],[-.45,.12],{
     family,side:f.side,weight:1,contact:target,upperX:0,lowerX:0
   });
   for(const k of ['hip','knee','ankle','foot','hipRoll','kneeRoll'])
     assert.ok(Number.isFinite(pose[k]),family+' '+k);
   assert.equal(pose.planted,true);
  }
 }
});
test('walking keeps stance anchors in world coordinates, with committed swings',()=>{
 for(const family of families){
  const p=footContactProfile(family),s=createFootContacts(rig(),family);
  let first=null,previousAnchors=s.feet.map(f=>({x:f.x,z:f.z}));
  let seenSwing=false,seenLanding=false,maxSimultaneous=0;
  for(let i=0;i<240;i++){
   const x=i*.012;
   advanceFootContacts(s,rig(x,0,0,.72,0),family,1/60);
   const swing=s.feet.filter(f=>f.mode==='swing');
   maxSimultaneous=Math.max(maxSimultaneous,swing.length);
   if(swing.length)seenSwing=true;
   if(s.landings)seenLanding=true;
   for(let j=0;j<2;j++){
    const f=s.feet[j];
    if(f.mode==='stance' && previousAnchors[j].x===f.startX){
      // Anchor is never translated merely because the chassis moved.
      assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.z));
    }
    previousAnchors[j]={x:f.x,z:f.z};
    const pose=footPresentation(s,f.side);
    assert.ok(Number.isFinite(pose.x)&&Number.isFinite(pose.z)&&Number.isFinite(pose.y));
    assert.ok(pose.y>=0&&pose.y<=p.lift+.00001);
   }
  }
  assert.equal(maxSimultaneous,1,family+' maintains a support foot');
  assert.equal(seenSwing,true,family+' initiates swings');
  assert.equal(seenLanding,true,family+' plants subsequent contacts');
 }
});
test('in-place yaw alone produces recovery/pivot steps without an invented translation',()=>{
 for(const family of families){
  const s=createFootContacts(rig(),family);
  let stepped=false,landed=false;
  for(let i=0;i<180;i++){
   advanceFootContacts(s,rig(0,0,i*.014,0,0),family,1/60);
   stepped ||=s.feet.some(f=>f.mode==='swing');
   landed ||=s.landings>0;
   assert.ok(s.feet.some(f=>f.mode==='stance'),family+' support remains');
  }
  assert.ok(stepped&&landed,family+' has pivoting contact steps');
 });
});
test('teleport resets foot contacts without long stretched limbs',()=>{
 const s=createFootContacts(rig(),'legs-yard');
 const next=advanceFootContacts(s,rig(9,-12,1.5),'legs-yard',1/60);
 assert.notEqual(next,s);
 assert.equal(next.stanceCount,2);
 for(const f of next.feet)assert.equal(f.mode,'stance');
});
test('disabled foot controller does not initiate new steps',()=>{
 const s=createFootContacts(rig(),'legs-yard');
 for(let i=0;i<50;i++)advanceFootContacts(s,rig(i*.012,0),'legs-yard',1/60,{disabled:true});
 assert.ok(s.feet.every(f=>f.mode==='stance'));
});
test('live arena and IK connect contact controller, preserve physics and remove decorative clock bob',()=>{
 const scene=source('scene.js'),leg=source('articulationMotion.js');
 assert.match(scene,/advanceFootContacts\(record\.footContacts,state,mobilityId,dt/);
 assert.match(scene,/contact:footPresentation\(record\.footContacts,side\)/);
 assert.match(scene,/pilotLandingKick/);
 assert.doesNotMatch(scene,/Math\.sin\(performance\.now\(\) \* 0\.009/);
 assert.match(leg,/contact\?contact\.z:/);
 assert.match(scene,/pilotingLabFootReadout/);
 const physics=source('locomotion.js');
 assert.doesNotMatch(physics,/footContactController/);
});
