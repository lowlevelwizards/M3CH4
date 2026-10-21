/** k.3x | Fixed-authored low-poly weapon vocabulary; local -Z fires forward.
 * Every object is physical, opaque Three.js mesh geometry. No dummy hitboxes.
 * Meshes and damage-isolated materials are owned by buildPartVisual gameplay mode.
 */
import * as THREE from 'three';
import {partMaterial,materialRoleOf} from './partMaterialPalette.js';

// Builder tones retain their names; physical variants are explicitly chosen per mesh.
export const WEAPON_MATERIALS=Object.freeze({
  yellow:partMaterial('mustard'),wornYellow:partMaterial('wornMustard'),
  teal:partMaterial('teal'),steel:partMaterial('structure'),
  warmSteel:partMaterial('loadSteel'),machined:partMaterial('machined'),
  raw:partMaterial('rawSteel'),dark:partMaterial('darkMechanism'),
  heat:partMaterial('heatSteel'),cream:partMaterial('cream'),
  shells:partMaterial('oxide'),olive:partMaterial('olive'),
});
const put=(parent,name,mesh,at)=>{
  mesh.name=name;mesh.position.set(...at);
  mesh.userData.materialRole=materialRoleOf(mesh.material);
  parent.add(mesh);return mesh;
};
export function weaponRoot(fixture,family){
  if(fixture?.slot!=='combat'||!fixture.envelope?.every(n=>n>0&&Number.isFinite(n)))
    throw new Error('A catalogue-backed combat fixture is required');
  const root=new THREE.Group();
  root.name='weapon:'+fixture.id;
  root.userData={fitFixtureId:fixture.id,previewOnly:true,weaponFamily:family};
  return root;
}
export function group(parent,name,at=[0,0,0]){
  const g=new THREE.Group();g.name=name;g.position.set(...at);parent.add(g);return g;
}
export function block(parent,name,at,size,tone='steel'){
  return put(parent,name,new THREE.Mesh(new THREE.BoxGeometry(...size),WEAPON_MATERIALS[tone]),at);
}
/** Axial cylinder: cylinder's bottom face is at forward (-Z) end. */
export function tube(parent,name,at,radius,length,tone='steel',sides=8){
  const mesh=put(parent,name,new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,length,sides),
    WEAPON_MATERIALS[tone]),at);
  mesh.rotation.x=Math.PI/2;return mesh;
}
/** A rear-small/front-large pressure bell or choke: local -Z is the wide end. */
export function taper(parent,name,at,rearRadius,frontRadius,length,tone='cream'){
  const mesh=put(parent,name,new THREE.Mesh(
    new THREE.CylinderGeometry(rearRadius,frontRadius,length,8),
    WEAPON_MATERIALS[tone]),at);
  mesh.rotation.x=Math.PI/2;return mesh;
}
export function bearing(parent,name,at,radius,width,tone='steel'){
  const mesh=put(parent,name,new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,width,10),
    WEAPON_MATERIALS[tone]),at);
  mesh.rotation.z=Math.PI/2;return mesh;
}
/** Square-ended load bar joining real attachment points. */
export function strut(parent,name,from,to,width,depth,tone='steel'){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
  const delta=b.clone().sub(a),len=delta.length();
  if(!(len>.001))throw new Error('Collapsed weapon strut: '+name);
  const mesh=put(parent,name,new THREE.Mesh(
    new THREE.BoxGeometry(width,len,depth),WEAPON_MATERIALS[tone]),
    a.clone().add(b).multiplyScalar(.5).toArray());
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  return mesh;
}
/** The model's serviceable moving elements use their own authored rest pose.
 * All values are presentation-only; reload/firing rules stay in combat.js.
 */
export function finishWeapon(root,{carriage,bolt,cassette=null}){
  if(!carriage||!bolt)throw new Error('Weapon missing physical moving action');
  root.userData.weaponMechanism={
    carriage,bolt,cassette,
    rest:{
      carriage:carriage.position.clone(),
      bolt:bolt.position.clone(),
      cassette:cassette?.position.clone()??null,
    },
    baseY:carriage.position.y,baseZ:carriage.position.z,
  };
  root.traverse(n=>{if(n.isMesh)n.userData.fitFixtureId=root.userData.fitFixtureId;});
  return root;
}
