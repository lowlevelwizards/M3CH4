/** Kestrel V3 physical armor – standalone experimental Three.js geometry.
 * Shells are genuinely open-ended. No coplanar decals or canned armor boxes.
 * Each panel is parented to its own rigid thigh/shin/hip/foot mount, not world.
 */
import * as THREE from 'three';
import {plateGeometry,enclosureGeometry} from './yardwalkerSilhouetteArmor.js';
import {armorRecipe,ARMOR_ZONES} from './kestrelArmorSpec.js';

const colors={front:0xd7c8a6,side:0xb7ae94,hip:0xc7b995,instep:0xcabf9d};
const mat=Object.fromEntries(Object.entries(colors).map(([name,color])=>
 [name,new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.85,metalness:.12,side:THREE.FrontSide})]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
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
function sizeAt(p,y){
 const t=clamp(y/p.len+.5,0,1);
 return {width:p.bottomW+(p.topW-p.bottomW)*t,
  depth:p.bottomD+(p.topD-p.bottomD)*t};
}
function stations(p,ratio,kind,anatomy,tier){
 const low=-p.len*ratio,high=p.len*ratio;
 const at=(y)=>{
  const {width,depth}=sizeAt(p,y);
  const shrink=(tier===1?.725:kind==='thigh'?.88:.83)*anatomy.front;
  const projection=tier===1?.047:kind==='thigh'?.076:.068;
  return {y,width:width*shrink,front:-depth/2-projection,
   back:-depth/2+.027};
 };
 return [at(low),at(high)];
}
function frontStrike(profile,kind,anatomy,tier){
 const r=kind==='thigh'?(tier===1?.305:.34):(tier===1?.36:.385);
 return plateGeometry(...stations(profile,r,kind,anatomy,tier));
}
function sideCheek(profile,side,anatomy,kind){
 // An outer-facing cheek remains separate from the main front shield.
 const r=kind==='thigh'?.295:.33;
 const ring=y=>{
  const {width,depth}=sizeAt(profile,y);
  return {y,x:side*(width/2+.022),width:kind==='thigh'?.090:.079,
   front:-depth*.33,back:depth*.36};
 };
 return plateGeometry(ring(-profile.len*r),ring(profile.len*r));
}
function shellGeometry(profile,anatomy,style){
 // Never cover the rotary knee or upper shoulder; leave open physical bores.
 const lowY=-profile.len*.315,highY=profile.len*.34;
 const station=(y,upper)=>{
  const {width,depth}=sizeAt(profile,y);
  const flare=anatomy.flare;
  const widthBonus=style==='pod'?(upper?.33:.19):
   upper?.26:.065;
  const frontBonus=style==='pod'?(upper?.16:.15):
   upper?.18:.095;
  const backBonus=style==='pod'?.13:upper?.12:.085;
  return {
   outer:{y,width:width+widthBonus*flare,
    front:-depth/2-frontBonus*flare,
    back:depth/2+backBonus*flare},
   inner:{y,width:width+.055,
    front:-depth/2-.028,back:depth/2+.028}
  };
 };
 return enclosureGeometry(station(lowY,false),station(highY,true));
}
function splitCheek(profile,anatomy,index){
 const sign=index===0?-1:1;
 const f=y=>{
  const {width,depth}=sizeAt(profile,y);
  const t=y/profile.len+.5;
  const flare=(.09+t*.17)*anatomy.flare;
  const gap=anatomy.splitGap;
  const spread=width+flare;
  const half=(spread-gap)/2;
  return {y,x:sign*(gap/2+half/2),width:half,
   front:-depth/2-.12,back:-depth/2+.025};
 };
 return plateGeometry(f(-profile.len*.31),f(profile.len*.33));
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
      g=part.form==='split'?splitCheek(profiles.thigh,recipe.anatomy,part.piece):
       shellGeometry(profiles.thigh,recipe.anatomy,part.form);
     }else if(part.role==='side'){
      g=sideCheek(profiles.thigh,side,recipe.anatomy,'thigh');material='side';
     }else g=frontStrike(profiles.thigh,'thigh',recipe.anatomy,recipe.tier);
    }else if(part.zone==='shin'){
     parent=mounts.shin;
     if(part.role==='side'){
      g=sideCheek(profiles.shin,side,recipe.anatomy,'shin');material='side';
     }else g=frontStrike(profiles.shin,'shin',recipe.anatomy,recipe.tier);
    }else if(part.zone==='hip'){
     parent=study.root;material='hip';g=hipBrow(p,limb.leg,recipe.anatomy);
    }else{
     parent=mounts.foot;g=footPlate(p,side);material='instep';
    }
    const mesh=new THREE.Mesh(g,mat[material]);mesh.name='ARMOR / '+part.name;
    mesh.userData={kestrelArmor:true,armorZone:part.zone,armorRole:part.role,
     removable:true,experimentalOnly:true,side,level:recipe.tier};
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);meshes.push(mesh);
   }
  }
 }
 const zoneMap=Object.fromEntries(ARMOR_ZONES.map(x=>[x,true]));
 function present({armorOnly=false,exploded=false,zones=zoneMap}={}){
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
   mesh.visible=zones[mesh.userData.armorZone]!==false;
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
