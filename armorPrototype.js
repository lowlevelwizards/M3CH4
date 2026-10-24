/** k5t3 – Art-directed steel panels on real production Cyclops/Kestrel cores.
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
  lean=0,pitch=0,axis=null,orientation=null,tone=0xc7bea1,cut=.12,taper=.93
}={}){
  if(!parent)throw Error('Missing armor mount for '+entry.id);
  const material=new THREE.MeshStandardMaterial({color:tone,roughness:.86,metalness:.48,flatShading:true});
  const mesh=new THREE.Mesh(plateShape(...size,cut,taper),material);
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
  width,depth,length=.78,facing=[0,0,-1],clearance=.052,tone=0xc7bea1,
  longitudinal=.5,taper=.8
}){
  const start=vec(from),end=vec(to),span=end.clone().sub(start);
  const lengthM=span.length(),long=span.clone().normalize();
  let normal=vec(facing).addScaledVector(long,-vec(facing).dot(long));
  if(normal.lengthSq()<.0001)throw Error('Armour facing parallel to '+entry.id);
  normal.normalize();
  const across=new THREE.Vector3().crossVectors(long,normal).normalize();
  normal=new THREE.Vector3().crossVectors(across,long).normalize();
  const basis=new THREE.Matrix4().makeBasis(across,long,normal);
  const centre=start.clone().addScaledVector(span,longitudinal)
    .addScaledVector(normal,clearance+depth*.5);
  const mesh=makePlate(parent,entry,centre.toArray(),
    [width,lengthM*length,depth],{
      orientation:new THREE.Quaternion().setFromRotationMatrix(basis),tone,taper,
      cut:Math.min(.12,width*.21),
    });
  mesh.userData.armorAlignment={
    jointFrom:from.slice(),jointTo:to.slice(),longitudinal,
    normal:normal.toArray(),clearance,depth,
    sparAxis:long.toArray(),mountParent:parent.name,
  };
  return mesh;
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
  const heavy=tier===3,standard=tier===2;
  switch(entry.id){
    case 'cyclops-left-cheek':
      // L1 stays close to the salvaged factory flanking cheek. At L3 this
      // becomes a massive bevel-faced blast cheek close around the optic.
      return makePlate(cheeks,entry,
        heavy?[-.475,-.035,-.200]:[-.502,-.075,.060],
        heavy?[.260,.665,.570]:standard?[.195,.57,.55]:[.142,.445,.49],
        {lean:heavy?-.14:-.06,tone:0xc3bba2,taper:heavy?.79:.94});
    case 'cyclops-right-cheek':
      return makePlate(cheeks,entry,
        heavy?[.475,-.035,-.200]:[.501,-.020,.052],
        heavy?[.260,.665,.570]:standard?[.205,.57,.58]:[.195,.535,.65],
        {lean:heavy?.14:.06,tone:0xc8bfa5,taper:heavy?.79:.94});
    case 'cyclops-brow':
      return makePlate(cell,entry,[0,heavy?.326:.313,heavy?-.397:-.388],
        heavy?[1.00,.200,.165]:[.94,.157,.175],
        {pitch:heavy?-.15:-.12,tone:0xbba363,taper:heavy?.82:.90});
    case 'cyclops-chin':
      return makePlate(cell,entry,[0,heavy?-.326:-.327,heavy?-.414:-.393],
        heavy?[1.00,.185,.170]:[.93,.150,.166],
        {pitch:heavy?.14:.07,tone:0xbdb4a2,taper:heavy?.85:.90});
    case 'cyclops-rear':
      // The roof electronics still exist underneath; this is removable steel.
      return makePlate(cell,entry,[0,.002,.487],[.85,.56,.108],
        {tone:0x89958a,taper:.86});
    case 'cyclops-left-wrap':
    case 'cyclops-right-wrap':{
      const side=entry.id.includes('left')?-1:1;
      // Long slanted lateral cassettes complete the heavy face's corners
      // without installing a single indestructible invisible armor shell.
      return makePlate(cell,entry,[side*.488,.025,.120],[.205,.64,.510],
        {lean:side*.23,tone:0xaba58e,taper:.80});
    }
    case 'cyclops-crown':
      // The cap sits atop the heavy brow; rear of optic remains serviceable.
      return makePlate(cell,entry,[0,.391,.026],[.98,.102,.70],
        {pitch:-.07,tone:0xb39d6d,taper:.83});
    default:throw Error('Unknown Cyclops armor '+entry.id);
  }
}
function kestrelPlate(root,entry,tier){
  const match=entry.id.match(/^kestrel-(left|right)-(shin|knee|thigh|flank|ankle|boot)$/);
  if(!match)throw Error('Unknown Kestrel plate '+entry.id);
  const [,side,section]=match;
  const leg=KESTREL_LAYOUT.legs.find(l=>l.side===(side==='left'?-1:1));
  if(!leg)throw Error('Missing Kestrel anatomical anchors');
  const sign=leg.side;
  const hip=root.getObjectByName(side+'Hip');
  const knee=root.getObjectByName(side+'Knee');
  const ankle=root.getObjectByName(side+'Ankle');
  const foot=root.getObjectByName(side+'Foot');
  if(!hip||!knee||!ankle||!foot)throw Error('Kestrel lacks linked anatomy '+side);
  const upper=leg.knee.map((v,i)=>v-leg.hip[i]);
  const lower=leg.ankle.map((v,i)=>v-leg.knee[i]);
  if(section==='shin'){
    if(tier===1) return originalShin(knee,entry,[0,0,0],lower,.155,.071,
      [sign*.002,0,-.105]);
    return sparGuard(knee,entry,[0,0,0],lower,{
      width:tier===3?.285:.203,depth:tier===3?.125:.090,
      length:tier===3?.88:.82,facing:[sign*.22,0,-1],clearance:.048,
      tone:tier===3?0xbfb79e:0xcfc6a5,taper:.76,
    });
  }
  if(section==='knee'){
    // The knee shield is a true forward-facing convex-ish cap, while the
    // bearing/hub is still visible from the outer side.
    return makePlate(knee,entry,[sign*.018,-.007,tier===3?-.157:-.146],
      tier===3?[.34,.337,.13]:[.265,.272,.085],
      {lean:sign*.08,pitch:-.08,tone:0xc5b893,taper:.74});
  }
  if(section==='thigh'){
    // Critical fix: share the upper spar's hip joint, aim the guard along
    // hip -> knee, and sit just outside the actual spar's FRONT face.
    return sparGuard(hip,entry,[0,0,0],upper,{
      width:tier===3?.245:.198,depth:tier===3?.126:.080,
      length:tier===3?.85:.74,facing:[sign*.28,0,-1],
      clearance:.058,tone:0xbcb397,taper:.80,
    });
  }
  if(section==='flank'){
    // Two true lateral cassettes reinforce the bare outer thigh. No groin
    // or central saddle skirt: that hardware belongs to structure armor.
    return sparGuard(hip,entry,[0,0,0],upper,{
      width:.225,depth:.105,length:.72,facing:[sign,0,-.10],
      clearance:.072,tone:0x968e7a,taper:.77,longitudinal:.47,
    });
  }
  if(section==='ankle'){
    return makePlate(ankle,entry,[sign*.087,-.018,-.048],[.145,.178,.125],
      {lean:sign*.12,tone:0xb2a98f,taper:.72});
  }
  // Boot caps belong to the actual articulated foot, not the shin or saddle;
  // outer toe only, keeping the characteristic split-toe negative space.
  return makePlate(foot,entry,[sign*.085,.011,-.168],[.145,.095,.166],
    {lean:sign*.12,pitch:.10,tone:0xafa48b,taper:.74});
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
