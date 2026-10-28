/** Yardwalker silhouette-lab armor study, NOT career armor or a combat collider.
 * Each armored shape is parented to the actual experimental thigh, shin or foot
 * mesh. It therefore follows the limb's canted coordinate system instead of
 * floating in world space. No original Naked geometry is modified.
 */
import * as THREE from 'three';

export const ARMOR_LEVELS=Object.freeze([
  {id:0,label:'0 NAKED',detail:'Unchanged exposed machine'},
  {id:1,label:'1 LIGHT',detail:'Fitted front strike plates on thigh and shin'},
  {id:2,label:'2 HEAVY',detail:'Front and outer side plates on both links'},
  {id:3,label:'3 ENCASED',detail:'Hollow flared upper-leg shell, reinforced shin, optional boot cap'},
]);
export const ENCASED_STYLES=Object.freeze([
  {id:'box',label:'BOX FLARE',detail:'Broad rectangular industrial enclosure'},
  {id:'taper',label:'TAPERED HOOD',detail:'Stronger upper flare, narrow knee exit'},
]);
export function normalizeArmor(tier=0,style='box',bootPlate=true){
 const parsed=Number(tier),level=Number.isFinite(parsed)?Math.max(0,Math.min(3,Math.round(parsed))):0;
 return {tier:level,style:ENCASED_STYLES.some(s=>s.id===style)?style:'box',bootPlate:!!bootPlate};
}
const white=new THREE.MeshStandardMaterial({color:0xd0c6aa,flatShading:true,roughness:.87,metalness:.14});
const sideWhite=new THREE.MeshStandardMaterial({color:0xb6ae98,flatShading:true,roughness:.88,metalness:.17});
const soleWhite=new THREE.MeshStandardMaterial({color:0xc5bb9d,flatShading:true,roughness:.91,metalness:.12});
const RING=8;
function outline(station){
 const {y,x=0,width,front,back}=station;
 const w=width/2,cut=Math.min(.035,width*.14,(back-front)*.16);
 return [
  [x-w+cut,y,front],[x+w-cut,y,front],[x+w,y,front+cut],[x+w,y,back-cut],
  [x+w-cut,y,back],[x-w+cut,y,back],[x-w,y,back-cut],[x-w,y,front+cut]
 ];
}
function emitGeometry(verts,indices,label){
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts.flat(),3));
 g.setIndex(indices);g.computeVertexNormals();
 g.userData={yardwalkerArmor:true,armorMesh:label};
 return g;
}
function outerFaces(indices,lower=0,upper=8){
 for(let i=0;i<8;i++){
  const a=lower+i,b=lower+(i+1)%8,c=upper+i,d=upper+(i+1)%8;
  indices.push(a,d,b,a,c,d);
 }
}
function cap(indices,center,ring,top=false){
 for(let i=0;i<8;i++){
  indices.push(top?center:center,
   top?ring+(i+1)%8:ring+i,
   top?ring+i:ring+(i+1)%8);
 }
}
/** Solid, tapered, chamfered strike plate. Both stations are in limb-local
 * coordinates. The back intersects the casting by 0.02–0.035 m, while the
 * exposed face sits safely in front, so there is no coplanar z-fighting.
 */
export function plateGeometry(low,high){
 const lo=outline(low),hi=outline(high),verts=[...lo,...hi];
 const indices=[];outerFaces(indices);
 const centroid=ring=>ring.reduce((sum,v)=>sum.map((k,i)=>k+v[i]/8),[0,0,0]);
 const bottomCenter=verts.length;verts.push(centroid(lo));
 const topCenter=verts.length;verts.push(centroid(hi));
 cap(indices,bottomCenter,0,false);cap(indices,topCenter,8,true);
 return emitGeometry(verts,indices,'fitted-plate');
}
/** Open-ended hollow continuous shell around the actual thigh, with outward
 * exterior faces, inward-facing interior, and top/bottom steel thickness rims.
 * A shell is one piece, not a column of touching cuffs.
 */
export function enclosureGeometry(lower,upper,intermediate=null){
 // A Bruiser-only middle section controls the hip-to-knee silhouette without
 // adding a separate cuff or interrupting the open mechanical bore.
 const stages=intermediate?[lower,intermediate,upper]:[lower,upper];
 const n=stages.length;
 const verts=[
  ...stages.flatMap(st=>outline(st.outer)),
  ...stages.flatMap(st=>outline(st.inner))
 ],indices=[];
 const innerBase=n*RING;
 for(let j=0;j<n-1;j++){
  outerFaces(indices,j*RING,(j+1)*RING);
  for(let i=0;i<RING;i++){
   const a=innerBase+j*RING+i,b=innerBase+j*RING+(i+1)%RING,
    c=innerBase+(j+1)*RING+i,d=innerBase+(j+1)*RING+(i+1)%RING;
   indices.push(a,b,d,a,d,c);
  }
 }
 // A watertight metal rim around each open end, not a solid lid.
 for(const j of [0,n-1]){
  const outer=j*RING,inner=innerBase+j*RING;
  for(let i=0;i<RING;i++){
   const k=(i+1)%RING,a=outer+i,b=outer+k,c=inner+i,d=inner+k;
   if(j===0)indices.push(a,b,d,a,d,c);
   else indices.push(a,d,b,a,c,d);
  }
 }
 return emitGeometry(verts,indices,'open-hollow-enclosure');
}
function install(parent,name,geometry,material,zone,level){
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=name;mesh.userData={armorZone:zone,armorLevel:level,prototype:true};
 mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);return mesh;
}
function sample(profile,y){
 // Principal link is symmetrical in local Y and tapers linearly at stations.
 const alpha=Math.min(1,Math.max(0,y/profile.length+.5));
 return {width:profile.bottomW+(profile.topW-profile.bottomW)*alpha,
  depth:profile.bottomD+(profile.topD-profile.bottomD)*alpha};
}
function frontPlate(profile,role,extent,projection=0.048){
 const h=profile.length,lowY=-h*extent,highY=h*extent;
 const low=sample(profile,lowY),high=sample(profile,highY);
 // Light is a longer, deliberately tapering strike plate, not a tiny
 // rectangle. Heavy stops short of the outer side guard to leave a real seam.
 const plate=(at,y,upper)=>({y,
    width:at.width*(role==='light'?(upper?.83:.69):.80),
    front:-at.depth/2-projection,back:-at.depth/2+.028});
 return plateGeometry(plate(low,lowY,false),plate(high,highY,true));
}
function outerPlate(profile,side,extent){
 const h=profile.length,yLo=-h*extent,yHi=h*extent;
 const st=y=>{
  const b=sample(profile,y);
  // Outer rail is inserted 0.03m into the original casting; side-facing
  // plating never competes with the central front plate.
  const x=side*(b.width/2+.027),thickness=.090;
  return {y,x,width:thickness,
   front:-b.depth*.39,back:b.depth*.45};
 };
 return plateGeometry(st(yLo),st(yHi));
}
export function upperShell(profile,style,candidate='strider'){
 const h=profile.length;
 // Preserve the approved two-station silhouettes for Strider and Hound.
 // Bruiser has a very short upper link: the default lower flare makes it
 // appear as a horizontal cuff. Add one sculpted transition INSIDE a single
 // closed, hollow, joint-parented shell instead of piling up geometry.
 const profiles=candidate==='bruiser'?
  (style==='box'?
   [[-.38,.132,.115],[-.015,.205,.178],[.39,.295,.255]]:
   [[-.38,.122,.105],[-.015,.205,.193],[.39,.365,.305]]):
  (style==='box'?[[-.38,.175,.19],[.39,.285,.26]]:
    [[-.38,.115,.155],[.39,.40,.31]]);
 const stages=profiles.map(([t,widen,depth])=>{
  const y=h*t,base=sample(profile,y);
  return {
   outer:{y,width:base.width+widen,
     front:-base.depth/2-depth*.54,back:base.depth/2+depth*.46},
   inner:{y,width:base.width+.061,
     front:-base.depth/2-.032,back:base.depth/2+.032}
  };
 });
 return enclosureGeometry(stages[0],stages.at(-1),
   stages.length===3?stages[1]:null);
}
/** Install a deliberately limited, testable armor vocabulary onto one leg.
 * Only named links are used as parents; no additional detached world-space
 * shoulder armor, and the bearing and actuator remain visible.
 */
export function addArmorToLeg({leg,thigh,shin,boot,thighProfile,shinProfile,footWidth,footDepth},options){
 const armor=normalizeArmor(options.tier,options.style,options.bootPlate);
 if(armor.tier===0)return [];
 const tag=leg.side<0?'L':'R',result=[];
 const put=(parent,name,g,mat,zone)=>result.push(install(parent,tag+'/armor '+name,g,mat,zone,armor.tier));
 const fExtent=armor.tier===1?.385:.37;
 if(armor.tier===3){
  put(thigh,'continuous upper shell',upperShell(thighProfile,armor.style,leg.candidateId),white,'thigh-wrap');
 }else{
  put(thigh,'thigh front plate',frontPlate(thighProfile,armor.tier===1?'light':'heavy',fExtent,armor.tier===1?.050:.072),white,'thigh-front');
  if(armor.tier>=2)put(thigh,'outer thigh side plate',outerPlate(thighProfile,leg.side,.365),sideWhite,'thigh-side');
 }
 put(shin,'shin front plate',frontPlate(shinProfile,armor.tier===1?'light':'heavy',armor.tier===1?.355:.38,armor.tier===1?.050:.072),white,'shin-front');
 if(armor.tier>=2)put(shin,'outer shin side plate',outerPlate(shinProfile,leg.side,.365),sideWhite,'shin-side');
 if(armor.tier===3&&armor.bootPlate){
  // A single shallow raised instep cap, leaving sole and toe pad recognizable.
  const height=.085,front=-footDepth*.30,back=front+.23;
  put(boot,'boot instep plate',plateGeometry(
    {y:.054,width:footWidth*.74,front,back},
    {y:.054+height,width:footWidth*.84,front:front+.015,back:back+.01}),
   soleWhite,'boot');
 }
 return result;
}
