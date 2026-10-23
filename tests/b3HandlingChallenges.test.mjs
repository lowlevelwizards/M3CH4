import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PILOT_CHALLENGES,createPilotChallenge,advancePilotChallenge,challengePrompt} from '../pilotChallenges.js';
import {groundFootprint,FOOTPRINT_POOL_CAP,FAMILY_SOLES} from '../groundFootprintEvidence.js';
import {createFootContacts,advanceFootContacts} from '../footContactController.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('only real landed contacts produce foot evidence; families own distinctive soles',()=>{
 for(const id of Object.keys(FAMILY_SOLES)){
  const rig={x:0,z:0,yaw:0,vx:1.5,vz:0,driveLoad:.6,tractionUse:.5};
  let feet=createFootContacts(rig,id);
  assert.equal(groundFootprint(feet,rig,id),null);
  let marked=null;
  for(let i=0;i<240;i++){
   rig.x+=1.5/60;
   feet=advanceFootContacts(feet,rig,id,1/60);
   const mark=groundFootprint(feet,rig,id,'dirt');
   if(mark){marked=mark;break;}
  }
  assert.ok(marked,id+' actually lands');
  assert.equal(marked.surface,'dirt');
  assert.equal(marked.width,FAMILY_SOLES[id].width);
  assert.ok(Number.isFinite(marked.x)&&Number.isFinite(marked.z));
  assert.ok(marked.opacity>.05&&marked.opacity<.28);
 }
 assert.ok(FOOTPRINT_POOL_CAP<=64);
});
test('precision stop requires body to enter the pad and remain settled',()=>{
 const ch=createPilotChallenge('precision');
 let rig={x:0,z:22,vx:0,vz:0};
 for(let i=0;i<50;i++)advancePilotChallenge(ch,rig,[],1/60);
 assert.equal(ch.started,false,'timer waits for pilot to move');
 rig={...rig,z:13,vz:-2};
 for(let i=0;i<180;i++)advancePilotChallenge(ch,rig,[],1/60);
 assert.equal(ch.complete,false,'a fast rolling pass must not win');
 rig={...rig,vz:0};
 for(let i=0;i<41;i++)advancePilotChallenge(ch,rig,[],1/60);
 assert.equal(ch.complete,true);
 assert.ok(ch.elapsed>0);
 assert.match(challengePrompt(ch),/COMPLETE/);
});
test('slalom checks gate order and demands a settled finish',()=>{
 const ch=createPilotChallenge('slalom');
 const gates=PILOT_CHALLENGES.slalom.checkpoints;
 const rig={x:0,z:22,vx:0,vz:0};
 // Jump to final pad should not advance the first gate.
 rig.x=0;rig.z=-6;
 advancePilotChallenge(ch,rig,[],1/60);
 assert.equal(ch.progress,0);
 for(const [i,gate] of gates.entries()){
  rig.x=gate.x;rig.z=gate.z;
  rig.vz=i===gates.length-1?0:1;
  for(let k=0;k<(gate.stop?45:10);k++)advancePilotChallenge(ch,rig,[],1/60);
  assert.ok(ch.progress>=i+1,'gate '+i);
 }
 assert.equal(ch.complete,true);
});
test('heavy haul is scored by physical crate position rather than rig position',()=>{
 const ch=createPilotChallenge('haul');
 const rig={x:0,z:18,vx:0,vz:0};
 const props=[{id:'tool-chest',x:0,z:12}];
 for(let i=0;i<120;i++)advancePilotChallenge(ch,rig,props,1/60);
 assert.equal(ch.complete,false);
 props[0].z=8;
 for(let i=0;i<12;i++)advancePilotChallenge(ch,rig,props,1/60);
 assert.equal(ch.complete,true);
});
test('real lab and game place prints from synchronized grounded feet without persistent rewards',()=>{
 const scene=src('scene.js'),main=src('main.js'),lab=src('pilotingLab.js');
 assert.match(scene,/footEvidencePool=Array\.from\(\{length:56\}/);
 assert.match(scene,/function recordFootprint\(mark\)/);
 assert.match(main,/arena\.recordFootprint\(mark\)/);
 assert.match(lab,/arena\.recordFootprint\(mark\)/);
 assert.match(lab,/advancePilotChallenge\(challengeState/);
 assert.doesNotMatch(src('pilotChallenges.js'),/localStorage|storeMachine|settleSortie/);
});
