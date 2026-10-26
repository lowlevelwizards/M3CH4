import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitAfterDrag,ORBIT_PITCH_MAX,ORBIT_PITCH_MIN} from '../workbench/orbitCamera.js';

test('touch orbit responds in the non-inverted direction on both axes',()=>{
 const start={yaw:.65,pitch:.32,distance:4};
 const dragged=orbitAfterDrag(start,60,40);
 assert.ok(dragged.yaw<start.yaw,'rightward finger drag must reduce camera yaw');
 assert.ok(dragged.pitch>start.pitch,'downward finger drag must increase camera elevation');
 assert.equal(dragged.distance,start.distance,'orbit must not change zoom');
 assert.deepEqual(start,{yaw:.65,pitch:.32,distance:4},'orbit helper must not mutate caller');
});

test('inverse drag restores the original view and pitch is bounded',()=>{
 const initial={yaw:-.2,pitch:.1,distance:6};
 const next=orbitAfterDrag(initial,45,-26);
 const back=orbitAfterDrag(next,-45,26);
 assert.ok(Math.abs(back.yaw-initial.yaw)<1e-10);
 assert.ok(Math.abs(back.pitch-initial.pitch)<1e-10);
 assert.equal(orbitAfterDrag(initial,0,5000).pitch,ORBIT_PITCH_MAX);
 assert.equal(orbitAfterDrag(initial,0,-5000).pitch,ORBIT_PITCH_MIN);
 assert.throws(()=>orbitAfterDrag(initial,NaN,0),/Invalid orbit drag/);
});
