/** k.3x | Fixed-authored low-poly weapon vocabulary; local -Z fires forward.
 * Every object is physical, opaque Three.js mesh geometry. No dummy hitboxes.
 * Meshes and damage-isolated materials are owned by buildPartVisual gameplay mode.
 */
import * as THREE from 'three';
import {partMaterial,materialRoleOf} from './partMaterialPalette.js';
import {reloadMechanism,reloadVisualLayout} from './reloadMechanism.js';

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
/** k5r.7 — Subtractive reload modeling.
 * ONE existing receiver socket, ONE removable carrier. The actual authored
 * carriage/bolt is the opening and locking action. No ghost spent unit, second
 * drum, floating lid, detached rail, miniature loading machine or extra
 * collider. The carrier stays mechanically engaged in its existing port.
 */
export function attachReloadHardware(root,id){
 const layout=reloadVisualLayout(id);
 const style=reloadMechanism(id).feedStyle;
 const carrier=group(root,'RELOAD / single integrated '+style,layout.feed);
 const shell=style==='shell'||style==='penetrator';
 const width=id==='gun-short'?.38:id==='gun-breaker'?.40:
   style==='rack'?.45:style==='drum'?.36:.28;
 // The sole dark inset is FLUSH with the existing receiver and remains
 // partly under the cartridge/drum. It is the same slot for all four beats.
 const socket=group(root,'RELOAD / receiver socket',
   [layout.feed[0],layout.feed[1]-.10,layout.feed[2]]);
 block(socket,'RELOAD / inset receiver well',[0,0,0],
   [width+.05,.10,style==='rack'?.48:.39],'dark');
 if(shell){
   tube(carrier,'RELOAD / single heavy shell or penetrator',[0,0,0],
     id==='gun-short'?.17:id==='gun-breaker'?.14:.105,
     id==='gun-breaker'?.38:id==='gun-short'?.35:.29,
     id==='gun-breaker'?'machined':'shells');
   if(id==='gun-short')
     block(carrier,'RELOAD / integral shell rim',[0,0,.145],
       [.35,.23,.065],'raw');
 }else if(style==='drum'){
   bearing(carrier,'RELOAD / one drum on its receiver axle',[0,0,0],
     .235,.23,'olive');
   bearing(carrier,'RELOAD / inboard drum hub',[-.13,0,0],
     .09,.035,'machined');
 }else if(style==='rack'){
   block(carrier,'RELOAD / one triple rocket carrier',[0,0,0],
     [.43,.24,.46],'olive');
   // Three bold ordnance faces, no second rack or exposed wire forest.
   for(const x of [-.14,0,.14])
     tube(carrier,'RELOAD / rocket head '+x,[x,.035,-.23],
       .059,.085,'raw');
 }else if(style==='cell'){
   block(carrier,'RELOAD / single plug-in cell',[0,0,0],
     [.30,.28,.28],'teal');
   block(carrier,'RELOAD / single connector band',[0,0,-.145],
     [.25,.21,.065],'machined');
 }else if(style==='cassette'){
   block(carrier,'RELOAD / one shell cassette',[0,0,0],
     [.33,.31,.34],'shells');
 }else{
   block(carrier,'RELOAD / simple feed tray or clip',[0,0,0],
     style==='clip'?[.16,.18,.29]:[.28,.16,.31],'raw');
 }
 for(const subtree of [socket,carrier]){
   subtree.userData.visualOnly=true;
   subtree.traverse(node=>{
     if(node.isMesh)node.userData.visualOnly=true;
   });
 }
 // Large visible magazines must remain part of the complete weapon body
 // before and after reload. Hidden chambers reveal their ONE shell only
 // while the ORIGINAL sliding breech is open.
 carrier.visible=!!layout.exposed;
 return {feed:carrier,socket,layout,rest:{
   feed:carrier.position.clone(),socket:socket.position.clone(),
 }};
}
export function poseReloadHardware(mechanism,phase){
 const loader=mechanism?.loader;
 if(!loader)return;
 const {feed,socket,layout,rest}=loader;
 const t=phase?.progress??1;
 const active=!!phase?.active;
 feed.visible=layout.exposed||(active&&t>=.21&&t<.83);
 const extension=active?(phase?.feed??0)*layout.travel:0;
 // The cartridge NEVER leaves the port: displacement is smaller than its
 // depth (or drum diameter), and the dark receiver well never moves.
 feed.position.copy(rest.feed);
 if(layout.step==='integral side cassette'||layout.step==='integral rotary drum'){
   feed.position.x-=extension;
   feed.position.y-=extension*.18;
 }else if(layout.step==='plug-in power cell'){
   feed.position.y+=extension*.60;
 }else{
   feed.position.z+=extension;
   feed.position.y+=extension*.12;
 }
 socket.position.copy(rest.socket);
}

/** An exterior Scattergun and Rivet already contain ORIGINAL side-mounted
 * magazines. Shift those existing hardware groups along their real side
 * receiver, instead of duplicating a floating magazine above the weapon.
 */
export function poseExistingReloadMagazine(mechanism,phase,id){
 const magazine=mechanism?.cassette,rest=mechanism?.rest?.cassette;
 if(!magazine||!rest)return;
 const travel=(phase?.active?phase.feed:0)*
   reloadVisualLayout(id).travel;
 magazine.position.copy(rest);
 magazine.position.x+=travel;
 magazine.position.y-=travel*.18;
}
/** The model's serviceable moving elements use their own authored rest pose.
 * All values are presentation-only; reload/firing rules stay in combat.js.
 */
export function finishWeapon(root,{carriage,bolt,cassette=null}){
  if(!carriage||!bolt)throw new Error('Weapon missing physical moving action');
  // Scattergun and Rivet already have properly mounted functional
  // magazines. Do not create a second cartridge on those exterior guns.
  const loader=cassette?null:attachReloadHardware(root,root.userData.fitFixtureId);
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
