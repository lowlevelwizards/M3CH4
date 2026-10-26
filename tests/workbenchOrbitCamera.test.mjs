import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitAfterDrag,ORBIT_YAW_PER_PX,ORBIT_PITCH_MAX,ORBIT_PITCH_MIN,
 normalizeYaw,TAU,cameraPose,cameraFacing} from '../workbench/orbitCamera.js';

const near=(a,b)=>Math.abs(a-b)<1e-9;
test('world directions are canonical: front -Z, right +X, rear +Z, left -X and up +Y',()=>{
 assert.deepEqual(cameraPose('front').position,[0,0,-20]);
 assert.deepEqual(cameraPose('side').position,[20,0,0]);
 assert.deepEqual(cameraPose('rear').position,[0,0,20]);
 assert.deepEqual(cameraPose('left').position,[-20,0,0]);
 assert.deepEqual(cameraPose('top').position,[0,20,0]);
 assert.deepEqual(cameraPose('top').up,[0,0,-1]);
 assert.equal(cameraFacing('front'),'FRONT  -Z');
 assert.equal(cameraFacing('side'),'RIGHT  +X');
 assert.equal(cameraFacing('rear'),'REAR  +Z');
 assert.equal(cameraFacing('left'),'LEFT  -X');
 const front=cameraPose('quarter',{yaw:0,pitch:0,distance:5});
 assert.deepEqual(front.position,[0,0,-5]);
 const right=cameraPose('quarter',{yaw:Math.PI/2,pitch:0,distance:5});
 assert.ok(near(right.position[0],5));
 assert.ok(near(right.position[2],0));
});
test('dragging right turns the visible front silhouette right; downward drag lowers silhouette',()=>{
 const start={yaw:0,pitch:0,distance:4};
 const moved=orbitAfterDrag(start,60,40);
 assert.ok(moved.yaw>start.yaw,'right drag MUST increase yaw with the -Z-forward game convention');
 assert.ok(moved.pitch>start.pitch,'down drag MUST increase elevation');
 assert.equal(moved.distance,start.distance,'orbit must preserve zoom');
 assert.deepEqual(start,{yaw:0,pitch:0,distance:4},'camera helper is pure');
});
test('orbit genuinely reaches every side over 360 degrees and returns to FRONT',()=>{
 let orbit={yaw:0,pitch:0,distance:4};
 for(let side=1;side<=4;side++){
  orbit=orbitAfterDrag(orbit,(Math.PI/2)/ORBIT_YAW_PER_PX,0);
  assert.equal(cameraFacing('quarter',orbit.yaw),
   ['RIGHT  +X','REAR  +Z','LEFT  -X','FRONT  -Z'][side-1]);
 }
 assert.ok(near(orbit.yaw,0),'full revolution returns to same azimuth');
 assert.equal(orbit.distance,4);
});
test('reversible drag, bounded pitch and no NaN',()=>{
 const initial={yaw:1.1,pitch:.1,distance:6};
 const next=orbitAfterDrag(initial,45,-26);
 const back=orbitAfterDrag(next,-45,26);
 assert.ok(near(back.yaw,initial.yaw));
 assert.ok(near(back.pitch,initial.pitch));
 assert.equal(orbitAfterDrag(initial,0,5000).pitch,ORBIT_PITCH_MAX);
 assert.equal(orbitAfterDrag(initial,0,-5000).pitch,ORBIT_PITCH_MIN);
 assert.ok(near(normalizeYaw(TAU+Math.PI/3),Math.PI/3));
 assert.throws(()=>orbitAfterDrag(initial,NaN,0),/Invalid orbit drag/);
});
