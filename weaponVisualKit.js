/** k.3x | Fixed-authored low-poly weapon vocabulary; local -Z fires forward.
 * Every object is physical, opaque Three.js mesh geometry. No dummy hitboxes.
 * Meshes and damage-isolated materials are owned by buildPartVisual gameplay mode.
 */
import * as THREE from 'three';
import {partMaterial,materialRoleOf} from './partMaterialPalette.js';
import {reloadMechanism} from './reloadMechanism.js';

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
/** Four or fewer oversized chunks per kit: the replaceable ammunition
 * carrier and a service latch. These are visual-only meshes: their animation
 * cannot move a ballistic collider or masquerade as new target armor.
 */
export function attachReloadHardware(root,id){
 const profile=reloadMechanism(id),form=profile.feedStyle;
 const feed=group(root,'RELOAD / physical '+form+' carrier',[.28,-.25,.41]);
 if(form==='shell'||form==='penetrator'){
   tube(feed,'RELOAD / heavy chambered shell',[0,0,0],
     form==='penetrator'?.13:.16,form==='penetrator'?.52:.42,
     form==='penetrator'?'machined':'shells');
   block(feed,'RELOAD / breech head',[0,0,.21],[.30,.22,.10],'steel');
 }else if(form==='clip'||form==='tray'){
   block(feed,'RELOAD / rectangular ammunition shuttle',[0,0,0],
     form==='clip'?[.17,.21,.39]:[.35,.19,.34],'olive');
   block(feed,'RELOAD / forward brass nose',[0,0,-.20],[.15,.12,.10],'raw');
 }else if(form==='cassette'){
   block(feed,'RELOAD / industrial six-shot cassette',[0,0,0],[.39,.37,.42],'shells');
   for(const y of [-.10,.10])tube(feed,'RELOAD / large shell '+y,[0,y,-.24],.09,.10,'raw');
 }else if(form==='drum'){
   bearing(feed,'RELOAD / heavy feed drum',[0,0,0],.29,.24,'olive');
   bearing(feed,'RELOAD / central locking hub',[.16,0,0],.09,.035,'machined');
 }else if(form==='rack'){
   block(feed,'RELOAD / sliding triple rocket carrier',[0,0,0],[.52,.28,.50],'olive');
   for(const x of [-.16,0,.16])tube(feed,'RELOAD / visible rocket '+x,
        [x,.06,-.13],.065,.38,'raw');
 }else{
   block(feed,'RELOAD / power cell',[0,0,0],[.33,.37,.29],'teal');
   block(feed,'RELOAD / copper contacts',[0,.22,0],[.26,.09,.22],'raw');
 }
 // Broad, readable latch, never a tiny decorative hinge.
 // Extract the empty shell, drum, rocket carrier or discharged cell
 // before loading the replacement. One recycled moving assembly per weapon.
 const spent=group(root,'RELOAD / withdrawn '+form,[0,.06,.37]);
 if(form==='shell'||form==='penetrator')
   tube(spent,'RELOAD / spent steel case',[0,0,0],.115,.34,'heat');
 else if(form==='drum')
   bearing(spent,'RELOAD / empty rivet drum',[0,0,0],.25,.20,'steel');
 else if(form==='rack')
   block(spent,'RELOAD / empty rocket carrier',[0,0,0],[.47,.23,.39],'heat');
 else if(form==='cell')
   block(spent,'RELOAD / discharged cell',[0,0,0],[.27,.31,.25],'dark');
 else
   block(spent,'RELOAD / old feed unit',[0,0,0],[.29,.22,.32],'heat');
 const latch=group(root,'RELOAD / battery locking jaw',[0,.34,.35]);
 block(latch,'RELOAD / massive catch',[0,0,0],[.35,.14,.23],'machined');
 const guide=group(root,'RELOAD / fixed ammunition feed track',[.24,-.20,.24]);
 for(const node of [feed,spent,latch,guide])node.userData.visualOnly=true;
 block(guide,'RELOAD / feeding rails',[0,0,0],[.13,.12,.46],'dark');
 root.traverse(node=>{if(node.isMesh&&(feed===node.parent||spent===node.parent||latch===node.parent||guide===node.parent))
   node.userData.visualOnly=true;});
 feed.visible=false;spent.visible=false;
 return {feed,spent,latch,rest:{feed:feed.position.clone(),
   spent:spent.position.clone(),latch:latch.position.clone()}};
}
export function poseReloadHardware(mechanism,phase){
 const loader=mechanism?.loader;
 if(!loader)return;
 const {feed,spent,latch,rest}=loader;
 feed.visible=!!phase?.feedVisible;
 const t=phase?.progress??1;
 spent.visible=!!phase?.active&&t>=.13&&t<.40;
 const withdrawal=Math.max(0,Math.min(1,(t-.13)/.22));
 spent.position.set(rest.spent.x+.52*withdrawal,
   rest.spent.y-.30*withdrawal,rest.spent.z+.19*withdrawal);
 const shift=phase?.feed??0;
 const displacement=phase?.cassette??0;
 const style=mechanism.feedAxis??'z';
 // Both the disengaged carrier and incoming rounds move on large,
 // physically readable mechanical guides, never across open air.
 if(style==='x'){
   feed.position.set(rest.feed.x+displacement*.90-shift*.38,
     rest.feed.y+.11*shift,rest.feed.z-.31*shift);
 }else if(style==='y'){
   feed.position.set(rest.feed.x-.14*shift,
     rest.feed.y-displacement+.29*shift,rest.feed.z-.27*shift);
 }else{
   feed.position.set(rest.feed.x-.18*shift,
     rest.feed.y+.12*shift,rest.feed.z+displacement*.35-.42*shift);
 }
 latch.position.copy(rest.latch);
 latch.position.y-=(phase?.slide??0)*.35;
 latch.rotation.x=(phase?.active?1-(phase.lock??0):0)*-.42;
}

/** The model's serviceable moving elements use their own authored rest pose.
 * All values are presentation-only; reload/firing rules stay in combat.js.
 */
export function finishWeapon(root,{carriage,bolt,cassette=null}){
  if(!carriage||!bolt)throw new Error('Weapon missing physical moving action');
  const loader=attachReloadHardware(root,root.userData.fitFixtureId);
  root.userData.weaponMechanism={
    carriage,bolt,cassette,loader,
    feedAxis:reloadMechanism(root.userData.fitFixtureId).feedAxis,
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
