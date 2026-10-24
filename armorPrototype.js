/** k5t4 – Fitted steel shells on production Cyclops/Kestrel cores.
 * Only used by dev Armor Lab; no gameplay physics, ownership or save changes.
 *
 * - Tier 0 retains the original exposed anatomy.
 * - Tier 1 Kestrel is the original restrained two-greave prototype.
 * - Tier 2 adds real aligned frontal thigh/knee protection.
 * - Tier 3 grows/thickens the existing plates AND adds flank, ankle and boot
 *   shields or full slanted encasement around the Cyclops optic.
 * Every plate is one independently named/destructible mesh.
 */
import * as THREE from 'three';
import {buildPartVisual} from './partVisuals.js';
import {KESTREL_LAYOUT} from './mobilityDefinitions.js';
import {ARMOR_PROTOTYPES,installedArmorPlates,armorMassKg,armorHit,armorCrewPatch} from './armorPlan.js';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const vec=p=>new THREE.Vector3(...p);
const UP=new THREE.Vector3(0,1,0);

/** Cut shoulders, tapered sides, and a short pointed leading edge. This
 * is a piece of pressed / cut steel, not a scaled cuboid. */
function plateShape(width,height,depth,cut=.12,taper=.93){
  const w=width*.5,h=height*.5,k=Math.min(w*.70,h*.65,cut);
  const s=new THREE.Shape(),top=w*taper;
  s.moveTo(-w*.77,-h);s.lineTo(w*.77,-h);
  s.lineTo(w,-h+k);s.lineTo(w*.98,h-k);
  s.lineTo(top-k,h);s.lineTo(-top+k,h);
  s.lineTo(-w*.98,h-k);s.lineTo(-w,-h+k);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:1});
  g.translate(0,0,-depth*.5);return g;
}
function makePlate(parent,entry,position,size,{
  lean=0,pitch=0,axis=null,orientation=null,tone=0xc7bea1,cut=.12,taper=.93,geometry=null
}={}){
  if(!parent)throw Error('Missing armor mount for '+entry.id);
  const material=new THREE.MeshStandardMaterial({color:tone,roughness:.86,metalness:.48,flatShading:true});
  const mesh=new THREE.Mesh(geometry??plateShape(...size,cut,taper),material);
  mesh.name='REMOVABLE ARMOR / '+entry.label;
  mesh.position.set(...position);
  if(orientation)mesh.quaternion.copy(orientation);
  else if(axis)mesh.quaternion.setFromUnitVectors(UP,vec(axis).normalize());
  else mesh.rotation.set(pitch,lean,0);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.armorPlateId=entry.id;mesh.userData.armorRegion=entry.region;
  mesh.userData.armorMaximum=entry.hp;mesh.userData.armorBaseColor=tone;
  parent.add(mesh);return mesh;
}
/** Original light Kestrel shin mounting and silhouette, preserved verbatim. */
function originalShin(parent,entry,from,to,width,depth,shift){
  const a=vec(from),b=vec(to),axis=b.clone().sub(a),length=axis.length();
  const centre=a.add(b).multiplyScalar(.5).add(vec(shift));
  return makePlate(parent,entry,centre.toArray(),[width,length*.73,depth],
    {axis:axis.toArray()});
}
/** A plate on a moving mechanical spar: longitudinal Y follows the actual
 * joint-to-joint linkage. Z is the projected front/outboard surface normal.
 * Offset is measured along this local normal, NEVER a guessed world-axis x
 * shift. This avoids the old floating/sideways thigh armor when articulated.
 */
function sparGuard(parent,entry,from,to,{
  width,depth,startFraction=.22,endFraction=.78,
  facing=[0,0,-1],clearance=.050,tone=0xc7bea1,taper=.8,
}){
  if(!(startFraction>=0&&endFraction<=1&&endFraction>startFraction))
    throw Error('Invalid joint-clear armor extent '+entry.id);
  const a=vec(from),span=vec(to).sub(a),long=span.clone().normalize();
  let normal=vec(facing).addScaledVector(long,-vec(facing).dot(long));
  if(normal.lengthSq()<.0001)throw Error('Facing parallel to spar '+entry.id);
  normal.normalize();
  const across=new THREE.Vector3().crossVectors(long,normal).normalize();
  normal=new THREE.Vector3().crossVectors(across,long).normalize();
  const orientation=new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(across,long,normal));
  const longitudinal=(startFraction+endFraction)*.5;
  const center=a.clone().addScaledVector(span,longitudinal)
    .addScaledVector(normal,clearance+depth*.5);
  const mesh=makePlate(parent,entry,center.toArray(),
    [width,span.length()*(endFraction-startFraction),depth],
    {orientation,tone,taper,cut:Math.min(.09,width*.17)});
  mesh.userData.armorAlignment={
    jointFrom:from.slice(),jointTo:to.slice(),longitudinal,startFraction,endFraction,
    normal:normal.toArray(),clearance,depth,
    sparAxis:long.toArray(),mountParent:parent.name,
  };
  return mesh;
}
/** One U-shaped forked plate per foot, preserving both original runner toes
 * and the open gap between them. No isolated cubes atop ankle pivots. */
function splitBootGuardGeometry(){
  const outer=.151,slot=.056,front=-.242,back=.010,slotEnd=-.087;
  const shape=new THREE.Shape();
  shape.moveTo(-outer,back);
  shape.lineTo(-outer,front+.020);shape.lineTo(-outer+.025,front);
  shape.lineTo(-slot,front);shape.lineTo(-slot,slotEnd);
  shape.lineTo(slot,slotEnd);shape.lineTo(slot,front);
  shape.lineTo(outer-.025,front);shape.lineTo(outer,front+.020);
  shape.lineTo(outer,back);shape.closePath();
  const geom=new THREE.ExtrudeGeometry(shape,{depth:.038,bevelEnabled:false,steps:1});
  geom.rotateX(Math.PI/2);return geom;
}

/** Remove only the factory's separate cheek guards. This leaves the naked
 * Cyclops housing, operator tub and iconic single optic completely untouched. */
function clearFactoryCheeks(root){
  const cheeks=root.getObjectByName('CYCLOPS / DETACHABLE CHEEKS');
  if(!cheeks)throw Error('Cyclops needs its original detachable cheek mount');
  for(const mesh of [...cheeks.children]){cheeks.remove(mesh);mesh.geometry?.dispose?.();}
  return cheeks;
}
function cyclopsPlate(root,entry,tier){
  const cheeks=root.getObjectByName('CYCLOPS / DETACHABLE CHEEKS');
  const cell=root.getObjectByName('CYCLOPS / PILOT CELL');
  const heavy=tier===3,medium=tier===2;
  if(entry.id==='cyclops-left-cheek'||entry.id==='cyclops-right-cheek'){
    const sign=entry.id==='cyclops-left-cheek'?-1:1;
    // The broad faceted surface faces sideways. Avoid long blocky slabs:
    // short field cheek → extended face-mask side → heavy helmet flank.
    return makePlate(cheeks,entry,
      heavy?[sign*.516,-.030,-.160]:medium?[sign*.512,-.042,-.092]:[sign*.510,-.047,.038],
      heavy?[.645,.645,.165]:medium?[.640,.548,.113]:[.510,.445,.105],{
        lean:sign*(Math.PI/2+(heavy?.065:.025)),
        tone:heavy?0xada389:medium?0xc3b89d:0xbbb39a,
        taper:heavy?.70:.79,cut:heavy?.095:.075,
      });
  }
  switch(entry.id){
    case 'cyclops-brow':
      return makePlate(cell,entry,
        heavy?[0,.315,-.468]:[0,.300,-.467],
        heavy?[.997,.155,.168]:[.870,.142,.131],{
          pitch:heavy?-.105:-.085,tone:0xb99b63,
          taper:heavy?.78:.84,cut:.100,
        });
    case 'cyclops-chin':
      return makePlate(cell,entry,
        heavy?[0,-.325,-.467]:[0,-.316,-.464],
        heavy?[.965,.162,.152]:[.862,.137,.128],{
          pitch:heavy?.09:.065,tone:0xc5bba1,
          taper:heavy?.80:.87,cut:.084,
        });
    case 'cyclops-rear':
      // Chamfered rear service cassette distinct from helmet's front face.
      return makePlate(cell,entry,[0,-.052,.522],[.764,.442,.085],
        {tone:0x929688,taper:.70,cut:.11});
    case 'cyclops-left-wrap':
    case 'cyclops-right-wrap':{
      const sign=entry.id.includes('left')?-1:1;
      return makePlate(cell,entry,[sign*.507,-.024,.290],[.340,.455,.126],{
        lean:sign*(Math.PI/2+.05),tone:0x8e9283,taper:.65,cut:.084,
      });
    }
    case 'cyclops-crown':
      // Contiguous frontal roof above visor, not a full-length box on top.
      // Raised rear electronics remain outside this helmet cap.
      return makePlate(cell,entry,[0,.328,-.192],[.979,.488,.113],{
        pitch:-Math.PI/2,tone:0xb49c69,taper:.74,cut:.090,
      });
    default:throw Error('Unknown Cyclops armor '+entry.id);
  }
}

function kestrelPlate(root,entry,tier){
  const m=entry.id.match(/^kestrel-(left|right)-(shin|thigh|flank|boot)$/);
  if(!m)throw Error('Unknown Kestrel plate '+entry.id);
  const [,side,section]=m;
  const leg=KESTREL_LAYOUT.legs.find(l=>l.side===(side==='left'?-1:1));
  if(!leg)throw Error('Missing leg anchors');
  const sign=leg.side,hip=root.getObjectByName(side+'Hip'),
    knee=root.getObjectByName(side+'Knee'),
    ankle=root.getObjectByName(side+'Ankle'),
    foot=root.getObjectByName(side+'Foot');
  if(!hip||!knee||!ankle||!foot)throw Error('Missing Kestrel anatomical joints '+side);
  const upper=leg.knee.map((v,i)=>v-leg.hip[i]);
  const lower=leg.ankle.map((v,i)=>v-leg.knee[i]);
  if(section==='shin'){
    // Exactly preserve the existing successful light shin guard.
    if(tier===1)return originalShin(knee,entry,[0,0,0],lower,.155,.071,
      [sign*.002,0,-.105]);
    return sparGuard(knee,entry,[0,0,0],lower,{
      width:tier===3?.284:.208,depth:tier===3?.102:.077,
      startFraction:.22,endFraction:.78,
      facing:[sign*.09,0,-1],clearance:.052,
      tone:tier===3?0xbfb79e:0xcfc6a5,taper:.77,
    });
  }
  if(section==='thigh'){
    // Armor follows the moving diagonal, terminating before each bearing.
    return sparGuard(hip,entry,[0,0,0],upper,{
      width:tier===3?.276:.205,depth:tier===3?.103:.077,
      startFraction:.27,endFraction:.73,
      facing:[sign*.18,0,-1],clearance:.061,
      tone:0xbab093,taper:.72,
    });
  }
  if(section==='flank'){
    // Outer facet belongs to the SAME thigh, not a floating knee cover.
    return sparGuard(hip,entry,[0,0,0],upper,{
      width:.165,depth:.075,startFraction:.33,endFraction:.68,
      facing:[sign,0,-.17],clearance:.079,
      tone:0x8f9382,taper:.70,
    });
  }
  // Physically on the moving foot, not ankle. The plate protects both
  // toe prongs without filling the slot and remains one removable part.
  return makePlate(foot,entry,[0,.072,0],[.30,.24,.038],{
    geometry:splitBootGuardGeometry(),tone:0xaaa18a,
  });
}

export function createArmoredPrototype(partId,tier=0){
  if(!ARMOR_PROTOTYPES[partId])throw Error('Unsupported armor specimen: '+partId);
  const level=Math.max(0,Math.min(3,Math.floor(tier)));
  const root=buildPartVisual(partId,{mode:'gameplay'});
  if(partId==='cab-cyclops')clearFactoryCheeks(root);
  const plates=new Map();
  for(const entry of installedArmorPlates(partId,level)){
    const mesh=partId==='cab-cyclops'
      ?cyclopsPlate(root,entry,level):kestrelPlate(root,entry,level);
    plates.set(entry.id,{...entry,mesh,health:1});
  }
  root.userData.armorPrototype=true;root.userData.armorTier=level;
  root.userData.armorAddedMassKg=armorMassKg(partId,level);
  return {root,plates,partId,tier:level};
}
export function setPrototypePlateHealth(specimen,id,health){
  const plate=specimen?.plates.get(id);if(!plate)return false;
  plate.health=clamp(health);plate.mesh.visible=plate.health>0;
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
