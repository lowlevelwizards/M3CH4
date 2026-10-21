/** Run with 'npm install --no-save --no-package-lock three@0.186.0'
 * Full actual Three.js ray geometry, muzzle, ownership, animation and
 * cloned-material audit. Zero gameplay mocks or invisible hit volumes.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildPartVisual} from '../partVisuals.js';
import {fitFixtureFor} from '../chassisFitFixtures.js';
import {buildExteriorRig} from '../scene.js';
import {makeTestAssembly,equip} from '../components.js';

const anchors={
  'gun-cannon':-1.58,
  'gun-short':-1.03,
  'gun-light':-2.16,
  'gun-scatter':-1.12,
};
const report=[];
for(const [id,z] of Object.entries(anchors)){
  const fixture=fitFixtureFor(id);
  assert.deepEqual(fixture.envelope,fixture.envelope.map(Number));
  const a=makeTestAssembly();equip(a,'combat',id);
  const exterior=buildExteriorRig(a);
  const combat=exterior.partGroups.get('combat');
  assert.ok(combat,id+' combat group');
  const meshes=exterior.partMeshes.get('combat');
  assert.ok(meshes.length>=10,id+' physical meshes');
  assert.ok(meshes.every(m=>m.isMesh&&m.userData.slot==='combat'&&exterior.pickMeshes.includes(m)));
  assert.ok(meshes.every(m=>m.material?.isMaterial),'invalid raw material');
  for(const mesh of meshes){
    const m=mesh.matrixWorld;
    assert.ok(mesh.geometry.attributes.position,'geometry vertices required');
    assert.ok([...mesh.position.toArray(),...mesh.scale.toArray(),...m.elements].every(Number.isFinite),id+' finite transforms');
  }
  const mechanism=combat.userData.weaponMechanism;
  assert.ok(mechanism&&mechanism.carriage&&mechanism.bolt&&mechanism.rest,id+' action');
  if(id==='gun-scatter')assert.ok(mechanism.cassette,'physical shell cassette');
  const moving=[];mechanism.carriage.traverse(o=>{if(o.isMesh)moving.push(o);});
  assert.ok(moving.length&&moving.every(x=>meshes.includes(x)));
  const moved=moving[0];
  exterior.root.updateMatrixWorld(true);
  const before=moved.getWorldPosition(new THREE.Vector3());
  mechanism.carriage.position.z+=.17;
  exterior.root.updateMatrixWorld(true);
  const after=moved.getWorldPosition(new THREE.Vector3());
  assert.ok(before.distanceTo(after)>.16,'moving geometry must move raycast mesh');
  mechanism.carriage.position.copy(mechanism.rest.carriage);
  const targetPoint=combat.localToWorld(new THREE.Vector3(0,-.05,z));
  const origin=targetPoint.clone().add(new THREE.Vector3(0,0,-2.2));
  const weaponRay=new THREE.Raycaster(origin,new THREE.Vector3(0,0,1),0,3);
  exterior.root.updateMatrixWorld(true);
  const hits=weaponRay.intersectObjects(meshes,false);
  assert.ok(hits.length>0,id+' actual weapon front is ray-intersectable');
  const authored=buildPartVisual(id,{mode:'preview'});
  const bb=new THREE.Box3().setFromObject(authored),size=bb.getSize(new THREE.Vector3());
  assert.ok(Math.abs(bb.min.z-z)<.16,id+' visible muzzle opening aligns with shot anchor: '+bb.min.z+' vs '+z);
  assert.ok(size.toArray().every(n=>n>.1&&Number.isFinite(n)));
  const other=buildPartVisual(id,{mode:'gameplay'});
  const first=other.getObjectByProperty('isMesh',true);
  assert.ok(first);
  const firstGame=meshes[0];
  assert.notEqual(first.material,firstGame.material,id+' damage materials independent');
  report.push({id,physicalMeshes:meshes.length,bounds:size.toArray().map(v=>+v.toFixed(3)),muzzleZ:z,frontZ:+bb.min.z.toFixed(3),frontIntersections:hits.length,actionMeshes:moving.length});
}
const specs=Object.fromEntries(report.map(item=>[item.id,item.bounds]));
assert.ok(specs['gun-light'][2]>specs['gun-cannon'][2]);
assert.ok(specs['gun-cannon'][2]>specs['gun-short'][2]);
assert.ok(specs['gun-scatter'][0]>specs['gun-light'][0]);
console.log(JSON.stringify({pass:true,weapons:report},null,2));
