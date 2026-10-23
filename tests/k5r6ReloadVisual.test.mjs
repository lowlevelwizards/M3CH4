import test from 'node:test';import assert from 'node:assert/strict';
import {buildPartVisual} from '../partVisuals.js';
import {WEAPONS} from '../combat.js';
import {reloadPhase} from '../reloadMechanism.js';
import {poseReloadHardware} from '../weaponVisualKit.js';
test('the actual gameplay mesh of every gun has reloadable moving hardware',()=>{
 for(const [id,spec] of Object.entries(WEAPONS)){
   const model=buildPartVisual(id,{mode:'gameplay'});
   const mechanism=model.userData.weaponMechanism;
   assert.ok(mechanism, id+' actual action missing');
   const {loader,carriage,bolt,rest}=mechanism;
   assert.ok(loader?.feed?.children.length>0,id+' physical ammunition missing');
   assert.ok(loader?.latch?.children.length>0,id+' physical locking jaw missing');
   assert.ok(carriage?.children.length&&bolt?.children.length,id+' moving action missing');
   const hitMeshes=[];loader.feed.traverse(x=>{if(x.isMesh)hitMeshes.push(x);});
   assert.ok(hitMeshes.length>0&&hitMeshes.every(x=>x.userData.visualOnly),id);
   const mid=reloadPhase(spec.reloadSeconds*.52,spec.reloadSeconds,id);
   poseReloadHardware(mechanism,mid);
   assert.equal(loader.feed.visible,true,id);
   assert.ok(loader.feed.position.distanceTo(loader.rest.feed)>.01,id);
   assert.ok(loader.latch.rotation.x<0,id);
   poseReloadHardware(mechanism,reloadPhase(0,spec.reloadSeconds,id));
   assert.equal(loader.feed.visible,false,id);
   assert.ok(loader.feed.position.distanceTo(loader.rest.feed)<1e-9,id);
   assert.equal(loader.latch.rotation.x,0,id);
   assert.ok(carriage.position.distanceTo(rest.carriage)<1e-9,id);
 }
});
test('inspection cancellation restores all physical loader nodes without NaNs',()=>{
 const model=buildPartVisual('gun-scatter',{mode:'gameplay'});
 const mechanism=model.userData.weaponMechanism;
 poseReloadHardware(mechanism,reloadPhase(1.1,3,'gun-scatter'));
 poseReloadHardware(mechanism,null);
 assert.ok(['x','y','z'].every(axis=>Number.isFinite(mechanism.loader.latch.position[axis])));
 assert.equal(mechanism.loader.feed.visible,false);
});
