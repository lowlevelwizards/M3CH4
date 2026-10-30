/** Kestrel V3 physical armor – standalone experimental Three.js geometry.
 * Shells are long, continuous faceted fairings with real hollow end bores.
 * Each panel is parented to its own rigid thigh/shin/hip/foot mount, not world.
 */
import * as THREE from 'three';
import {plateGeometry} from './yardwalkerSilhouetteArmor.js';
import {tailoredThighShell,tailoredSplitCheek,tailoredFrontStrike,
 tailoredOuterCheek} from './kestrelArmorGeometryV4.js';
import {armorRecipe,ARMOR_ZONES} from './kestrelArmorSpec.js';

const colors={front:0xe0d1af,side:0xafa58a,hip:0xcbbd99,instep:0xd4c39f};
const mat=Object.fromEntries(Object.entries(colors).map(([name,color])=>
 [name,new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.85,metalness:.12,side:THREE.FrontSide})]));
const selectedMat=Object.fromEntries(Object.entries(mat).map(([id,m])=>{
 const highlight=m.clone();
 highlight.emissive=new THREE.Color(0x785329);
 highlight.emissiveIntensity=.35;
 return [id,highlight];
}));
function localProfile(mesh){
 const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();
 const b=g.boundingBox;
 return {len:b.max.y-b.min.y,upperW:b.max.x-b.min.x,
  lowerW:b.max.x-b.min.x,upperD:b.max.z-b.min.z,lowerD:b.max.z-b.min.z,
  middleY:(b.max.y+b.min.y)/2};
}
function specifiedProfile(p,zone,cast){
 const b=localProfile(cast);
 if(zone==='thigh'){
  const w=p.thighMass,top=p.id==='field'?w*1.08:p.id==='perch'?w*.88:w*.92;
  return {len:b.len,topW:top,bottomW:w*.69,topD:p.id==='raptor'?.245:.275,bottomD:.19};
 }
 const w=p.shinMass;
 return {len:b.len,topW:w*(p.id==='perch'?1.13:1.08),bottomW:w*.78,topD:.225,bottomD:.155};
}
function hipBrow(p,leg,anatomy){
 const [x,y,z]=leg.hip,span=p.thighMass*anatomy.hip*.84;
 return plateGeometry(
  {y:y+.055,x,width:span,front:z-p.carriageDepth*.47-.058,back:z-p.carriageDepth*.47+.034},
  {y:y+.19,x,width:span*1.09,front:z-p.carriageDepth*.49-.075,back:z-p.carriageDepth*.49+.025}
 );
}
function footPlate(p,side){
 const w=p.footWidth,d=p.footDepth;
 // Very low instep plate: leave toes and heel mechanically recognizable.
 return plateGeometry(
  {y:.078,width:w*.56,front:-d*.40,back:-d*.09},
  {y:.143,width:w*.68,front:-d*.36,back:-d*.07}
 );
}
function locate(parent,phrase){
 const result=parent.children.find(o=>o.isMesh&&o.name.includes(phrase));
 if(!result)throw Error('Kestrel armor mount missing '+phrase+' in '+parent.name);
 return result;
}
function mountOn(parent,casting,label){
 const anchor=new THREE.Group();
 anchor.name='ARMOR ANCHOR '+label;
 anchor.position.copy(casting.position);
 anchor.quaternion.copy(casting.quaternion);
 anchor.scale.copy(casting.scale);
 parent.add(anchor);
 return anchor;
}
export function installKestrelArmor(study,settings={}){
 const recipe=armorRecipe(study.params.id,settings),p=study.params;
 const anchors=[],meshes=[],cores=[];
 // Remember the original machine geometry without reparenting or modifying it.
 study.root.traverse(o=>{if(o.isMesh&&!o.userData.kestrelArmor)cores.push(o);});
 if(recipe.tier>0){
  for(const limb of study.limbs){
   const side=limb.leg.side,tag=side<0?'L':'R';
   const thigh=locate(limb.thigh,'single swept thigh');
   const shin=locate(limb.shin,'primary forward shin');
   const foot=locate(limb.foot,'tapered landing sole');
   const profiles={thigh:specifiedProfile(p,'thigh',thigh),shin:specifiedProfile(p,'shin',shin)};
   const mounts={thigh:mountOn(limb.thigh,thigh,tag+' thigh'),
    shin:mountOn(limb.shin,shin,tag+' shin'),foot:mountOn(limb.foot,foot,tag+' foot')};
   for(const key of Object.keys(mounts))anchors.push({object:mounts[key],side,zone:key});
   for(const part of recipe.parts.filter(piece=>piece.side===side)){
    let parent,g,material='front';
    if(part.zone==='thigh'){
     parent=mounts.thigh;
     if(part.role==='shell'){
      g=part.form==='split'?
       tailoredSplitCheek(profiles.thigh,recipe.anatomy,part.piece):
       tailoredThighShell(profiles.thigh,recipe.anatomy,part.form);
     }else if(part.role==='side'){
      g=tailoredOuterCheek(profiles.thigh,side,recipe.anatomy,'thigh');material='side';
     }else g=tailoredFrontStrike(profiles.thigh,'thigh',recipe.anatomy,recipe.tier);
    }else if(part.zone==='shin'){
     parent=mounts.shin;
     if(part.role==='side'){
      g=tailoredOuterCheek(profiles.shin,side,recipe.anatomy,'shin');material='side';
     }else g=tailoredFrontStrike(profiles.shin,'shin',recipe.anatomy,recipe.tier);
    }else if(part.zone==='hip'){
     parent=study.root;material='hip';g=hipBrow(p,limb.leg,recipe.anatomy);
    }else{
     parent=mounts.foot;g=footPlate(p,side);material='instep';
    }
    const mesh=new THREE.Mesh(g,mat[material]);mesh.name='ARMOR / '+part.name;
    mesh.userData={kestrelArmor:true,armorZone:part.zone,armorRole:part.role,
     armorMaterial:material,
     removable:true,experimentalOnly:true,armorPartId:part.name,side,level:recipe.tier};
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);meshes.push(mesh);
   }
  }
 }
 const zoneMap=Object.fromEntries(ARMOR_ZONES.map(x=>[x,true]));
 function present({armorOnly=false,exploded=false,zones=zoneMap,hiddenParts=new Set(),selectedPart=''}={}){
  for(const obj of cores)obj.visible=!armorOnly;
  for(const anchor of anchors){
   anchor.object.position.copy(anchor.object.userData.restPosition||anchor.object.position);
   if(!anchor.object.userData.restPosition)
    anchor.object.userData.restPosition=anchor.object.position.clone();
   anchor.object.position.copy(anchor.object.userData.restPosition);
   if(exploded){
    anchor.object.position.x+=anchor.side*(anchor.zone==='thigh'?.18:.14);
    anchor.object.position.z-=anchor.zone==='foot'?.09:.11;
   }
  }
  for(const mesh of meshes){
   mesh.material=mesh.userData.armorPartId===selectedPart?selectedMat[mesh.userData.armorMaterial]:mat[mesh.userData.armorMaterial];
   mesh.visible=zones[mesh.userData.armorZone]!==false &&
    !hiddenParts.has(mesh.userData.armorPartId);
   if(mesh.userData.armorZone==='hip'){
    mesh.position.x=exploded?mesh.userData.side*.21:0;
    mesh.position.z=exploded?-.12:0;
   }
  }
 }
 function dispose(){
  for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}
  for(const anchor of anchors)anchor.object.removeFromParent();
  for(const core of cores)core.visible=true;
 }
 present();
 study.root.userData.armorTier=recipe.tier;
 study.root.userData.armorForm=recipe.form;
 study.root.userData.armorMeshes=meshes.length;
 return {recipe,anchors,meshes,cores,present,dispose};
}
