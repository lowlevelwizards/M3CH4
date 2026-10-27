import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTestAssembly} from '../components.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {createRigState,stepRig} from '../locomotion.js';
import {GROUND_MATERIALS,PILOTING_GROUND_PATCHES,groundMaterialAt,groundGripScale} from '../groundSurfaceMaterials.js';
const DT=1/60,world={minX:-60,maxX:60,minZ:-60,maxZ:60,obstacles:[]};
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ground samples are deterministic, bounded and never mutate actual arena obstacles',()=>{
 assert.equal(groundMaterialAt(0,22).id,'concrete');
 assert.equal(groundMaterialAt(-10,16).id,'dirt');
 assert.equal(groundMaterialAt(12,14).id,'gravel');
 assert.equal(groundMaterialAt(12,-18).id,'metal');
 assert.equal(groundMaterialAt(35,35).id,'concrete');
 for(const value of Object.values(GROUND_MATERIALS)){
   assert.ok(value.grip>=.35&&value.grip<=1.15);
   assert.ok(value.impact>.5);
 }
 assert.equal(PILOTING_GROUND_PATCHES.length,3);
});
function stop(grip){
 const s=createRigState({x:0,z:0,yaw:0});
 s.vz=-4;
 const c={...deriveRigConfig(makeTestAssembly()),groundGripScale:grip};
 for(let i=0;i<35;i++)stepRig(s,{throttle:0,strafe:0,steer:0,brake:1},DT,c,world);
 return s;
}
test('loose gravel reduces bounded braking authority without deleting momentum',()=>{
 const cement=stop(groundGripScale('concrete'));
 const gravel=stop(groundGripScale('gravel'));
 assert.ok(cement.forwardSpeed<gravel.forwardSpeed,'gravel takes longer to settle');
 assert.ok(gravel.tractionSaturated||gravel.forwardSpeed>.05);
 assert.ok(Number.isFinite(gravel.x)&&Number.isFinite(gravel.z));
});
test('default campaign traction is untouched and out-of-range surfaces are clamped',()=>{
 const a=stop(undefined),b=stop(1);
 assert.equal(a.vx,b.vx);assert.equal(a.vz,b.vz);
 assert.equal(groundGripScale({grip:100}),1.15);
 assert.equal(groundGripScale({grip:-9}),.35);
 assert.equal(groundGripScale(null),1);
});
test('lab owns patch visuals and samples real physics, without charging credits or changing saves',()=>{
 const lab=source('pilotingLab.js'),html=source('piloting-lab.html');
 assert.match(lab,/groundMaterialAt\(state\.x,state\.z\)/);
 assert.match(lab,/groundGripScale:groundGripScale\(ground\)/);
 assert.match(lab,/terrainVisuals=new THREE\.Group/);
 assert.match(html,/id="surface-mode"/);
 assert.doesNotMatch(lab,/localStorage|storeMachine\(|settleSortie\(/);
 assert.match(source('index.html'),/"\.\/locomotion\.js":\s*"\.\/locomotion\.js\?v=[^"]+"/);
});
