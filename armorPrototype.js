/** Authored removable steel kit on the ACTUAL Cyclops and Kestrel constructors.
 * This is experimental, in Armor Lab only. Live damage/saves remain untouched
 * until independent plate-HP authority and migration are implemented.
 */
import * as THREE from 'three';
import {buildPartVisual} from './partVisuals.js';
import {KESTREL_LAYOUT} from './mobilityDefinitions.js';
import {ARMOR_PROTOTYPES,installedArmorPlates,armorMassKg,armorHit,armorCrewPatch} from './armorPlan.js';

const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
function plateShape(width,height,depth,cut=.12){
  const w=width/2,h=height/2,k=Math.min(w*.7,h*.7,cut);
  const s=new THREE.Shape();
  s.moveTo(-w+k,-h);s.lineTo(w-k,-h);s.lineTo(w,-h+k);s.lineTo(w,h-k);
  s.lineTo(w-k,h);s.lineTo(-w+k,h);s.lineTo(-w,h-k);s.lineTo(-w,-h+k);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:1});
  g.translate(0,0,-depth/2);return g;
}
const vec=p=>new THREE.Vector3(...p);
function makePlate(parent,entry,position,size,{lean=0,axis=null,tone=0xc7bea1}={}){
  if(!parent)throw Error('Missing armor mount for '+entry.id);
  const material=new THREE.MeshStandardMaterial({color:tone,roughness:.86,metalness:.48,flatShading:true});
  const mesh=new THREE.Mesh(plateShape(...size),material);
  mesh.name='REMOVABLE ARMOR / '+entry.label;
  mesh.position.set(...position);
  if(axis)mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vec(axis).normalize());
  else mesh.rotation.y=lean;
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.armorPlateId=entry.id;mesh.userData.armorRegion=entry.region;
  mesh.userData.armorMaximum=entry.hp;
  mesh.userData.armorBaseColor=tone;
  parent.add(mesh);
  return mesh;
}
function between(parent,entry,from,to,width,depth,shift=[0,0,0]){
  const a=vec(from),b=vec(to),axis=b.clone().sub(a),length=axis.length();
  const centre=a.add(b).multiplyScalar(.5).add(vec(shift));
  return makePlate(parent,entry,centre.toArray(),[width,length*.73,depth],{axis:axis.toArray()});
}
function clearFactoryCheeks(root){
  const cheeks=root.getObjectByName('CYCLOPS / DETACHABLE CHEEKS');
  if(!cheeks)throw Error('Cyclops needs its original detachable cheek mount');
  // Only the two explicitly removable guards; never hollow out pilot tub or optics.
  for(const mesh of [...cheeks.children]){
    cheeks.remove(mesh);mesh.geometry?.dispose?.();
  }
  return cheeks;
}
function cyclopsPlate(root,entry,tier){
  const cheeks=root.getObjectByName('CYCLOPS / DETACHABLE CHEEKS');
  const cell=root.getObjectByName('CYCLOPS / PILOT CELL');
  const thick=tier>=3;
  switch(entry.id){
    case 'cyclops-left-cheek':
      return makePlate(cheeks,entry,[-.502,-.075,.060],[thick?.225:.142,.445,.49],
        {lean:-.06,tone:0xc3bba2});
    case 'cyclops-right-cheek':
      return makePlate(cheeks,entry,[.501,-.020,.052],[thick?.235:.195,.535,.65],
        {lean:.06,tone:0xc8bfa5});
    case 'cyclops-brow':
      return makePlate(cell,entry,[0,.311,-.397],[.73,.108,.18],{tone:0xa98f57});
    case 'cyclops-chin':
      return makePlate(cell,entry,[0,-.305,-.401],[.72,.105,.14],{tone:0xb3ada1});
    case 'cyclops-rear':
      return makePlate(cell,entry,[0,.012,.503],[.67,.39,.116],{tone:0x828f84});
    default:throw Error('Unknown Cyclops armor '+entry.id);
  }
}
function kestrelPlate(root,entry){
  const match=entry.id.match(/^kestrel-(left|right)-(shin|knee|thigh)$/);
  if(!match)throw Error('Unknown Kestrel plate '+entry.id);
  const [,side,section]=match,leg=KESTREL_LAYOUT.legs.find(l=>l.side===(side==='left'?-1:1));
  if(!leg)throw Error('Missing Kestrel anatomical anchors');
  const knee=root.getObjectByName(side+'Knee'),hip=root.getObjectByName(side+'Hip');
  if(!knee||!hip)throw Error('Missing Kestrel joint '+side);
  const sign=leg.side;
  if(section==='shin'){
    const end=leg.ankle.map((v,i)=>v-leg.knee[i]);
    return between(knee,entry,[0,0,0],end,.155,.071,[sign*.002,0,-.105]);
  }
  if(section==='knee'){
    return makePlate(knee,entry,[sign*.020,0,-.139],[.215,.195,.066],
      {lean:sign*.055,tone:0xa99d83});
  }
  const upper=leg.knee.map((v,i)=>v-leg.hip[i]);
  return between(hip,entry,[0,0,0],upper,.165,.075,[sign*.118,0,-.023]);
}
export function createArmoredPrototype(partId,tier=0){
  if(!ARMOR_PROTOTYPES[partId])throw Error('Unsupported armor specimen: '+partId);
  const level=Math.max(0,Math.min(3,Math.floor(tier)));
  // Use production geometry and immutable catalogue anchors, not duplicate mockups.
  const root=buildPartVisual(partId,{mode:'gameplay'});
  if(partId==='cab-cyclops')clearFactoryCheeks(root);
  const plates=new Map();
  for(const entry of installedArmorPlates(partId,level)){
    const mesh=partId==='cab-cyclops'
      ?cyclopsPlate(root,entry,level):kestrelPlate(root,entry);
    plates.set(entry.id,{...entry,mesh,health:1});
  }
  root.userData.armorPrototype=true;
  root.userData.armorTier=level;
  root.userData.armorAddedMassKg=armorMassKg(partId,level);
  return {root,plates,partId,tier:level};
}
export function setPrototypePlateHealth(specimen,id,health){
  const plate=specimen?.plates.get(id);
  if(!plate)return false;
  plate.health=clamp(health);
  plate.mesh.visible=plate.health>0;
  plate.mesh.userData.armorHealth=plate.health;
  plate.mesh.material.color.setHex(plate.mesh.userData.armorBaseColor);
  plate.mesh.material.color.multiplyScalar(.42+.58*plate.health);
  return true;
}
export function damagePrototypePlate(specimen,id,damage=25){
  const plate=specimen?.plates.get(id);
  return plate?setPrototypePlateHealth(specimen,id,armorHit(plate.health,damage,plate.hp)):false;
}
export function patchPrototypePlate(specimen,id){
  const plate=specimen?.plates.get(id);
  return plate?setPrototypePlateHealth(specimen,id,armorCrewPatch(plate.health)):false;
}
export function prototypePlateFromMesh(mesh){
  let node=mesh;
  while(node){if(node.userData?.armorPlateId)return node.userData.armorPlateId;node=node.parent;}
  return null;
}
export function disposeArmorSpecimen(specimen){
  if(!specimen)return;
  specimen.root.traverse(node=>{
    if(!node.isMesh)return;
    node.geometry?.dispose?.();
    if(Array.isArray(node.material))node.material.forEach(mat=>mat.dispose?.());
    else node.material?.dispose?.();
  });
  specimen.root.parent?.remove(specimen.root);
}
