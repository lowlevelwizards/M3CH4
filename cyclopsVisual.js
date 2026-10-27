/** Cyclops / concept reconstruction. One authoritative geometry description is used by
 * the factory model, Armor Lab, and exported Workbench JSON. -Z forward, metres.
 * The eye remains a 'square structural optical carrier' containing one
 * 'single protected teal objective'. All shapes are simple flat-shaded geometry.
 */
import * as THREE from 'three';
import {compileGeometry} from './workbench/geometry.js';
import {CYCLOPS_CORE,CYCLOPS_ARMOR,CYCLOPS_GROUPS} from './cyclopsDesign.js';
import {partMaterial} from './partMaterialPalette.js';
import {finishCommandVisual} from './commandVisualKit.js';

const materialName=Object.freeze({
 iron:'structure',loadSteel:'loadSteel',ochre:'mustard',cream:'cream',
 teal:'teal',optic:'optic',opticRecess:'opticalRecess',recess:'darkMechanism',
 glass:'glazing',raw:'rawSteel',bright:'machined'
});
function makeShape(spec,{ownedMaterial=false}={}){
 const mat=partMaterial(materialName[spec.material]||'structure');
 const mesh=new THREE.Mesh(compileGeometry(spec.geometry),
   ownedMaterial?mat.clone():mat);
 mesh.name=spec.name;
 mesh.position.set(...spec.position);
 mesh.rotation.set(...spec.rotation);
 mesh.castShadow=true;
 mesh.receiveShadow=true;
 mesh.userData.materialRole=mat.userData.materialRole;
 mesh.userData.cyclopsElementId=spec.id;
 return mesh;
}
function ensureGroup(root,name){
 let group=root.children.find(x=>x.isGroup&&x.name===name);
 if(!group){group=new THREE.Group();group.name=name;root.add(group);}
 return group;
}
export function buildCyclopsVisual(fixture){
 const root=new THREE.Group();
 root.name='fit-fixture:cab-cyclops';
 for(const s of CYCLOPS_CORE){
   const group=ensureGroup(root,CYCLOPS_GROUPS[s.group]||s.group);
   group.add(makeShape(s));
 }
 return finishCommandVisual(root,fixture,'square optical workhorse');
}
/** Armor Lab only. Every removable panel is one independently pickable mesh.
 * Tier-specific geometry REPLACES the earlier version of the same armor plate,
 * rather than stacking overlapping shells at levels 2 and 3.
 */
export function buildCyclopsArmorPlate(root,entry,tier){
 const design=CYCLOPS_ARMOR[entry.id];
 if(!design)throw Error('Unknown Cyclops armor plate: '+entry.id);
 const variant=[...design.variants].reverse().find(v=>v.level<=tier);
 if(!variant)throw Error('Cyclops plate not present at tier '+tier+': '+entry.id);
 const mesh=makeShape({
   id:entry.id,name:'REMOVABLE ARMOR / '+entry.label,material:design.material,
   geometry:variant.geo,position:variant.pos,rotation:variant.rot
 },{ownedMaterial:true});
 mesh.userData.armorPlateId=entry.id;
 mesh.userData.armorRegion=entry.region;
 mesh.userData.armorMaximum=entry.hp;
 mesh.userData.armorBaseColor=mesh.material.color.getHex();
 ensureGroup(root,design.group).add(mesh);
 return mesh;
}
