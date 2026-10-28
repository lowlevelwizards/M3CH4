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
export function enclosureGeometry(lower,upper){
 const bo=outline(lower.outer),to=outline(upper.outer),
       bi=outline(lower.inner),ti=outline(upper.inner);
 const verts=[...bo,...to,...bi,...ti],indices=[];
 outerFaces(indices,0,8);
 // Inside wall normals must face the empty bore, the opposite of exterior.
 for(let i=0;i<RING;i++){
  const a=16+i,b=16+(i+1)%8,c=24+i,d=24+(i+1)%8;
  indices.push(a,b,d,a,d,c);
 }
 // End faces, not caps across the limb: leave a real open knee/hip bore.
 for(let i=0;i<RING;i++){
  const j=(i+1)%8;
  indices.push(i,j,16+j,i,16+j,16+i);
  indices.push(8+i,24+j,8+j,8+i,24+i,24+j);
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
 const plate=(at,y)=>({y,width:at.width*(role==='light'?.73:.91),
    front:-at.depth/2-projection,back:-at.depth/2+.028});
 return plateGeometry(plate(low,lowY),plate(high,highY));
}
function outerPlate(profile,side,extent){
 const h=profile.length,yLo=-h*extent,yHi=h*extent;
 const st=y=>{
  const b=sample(profile,y);
  // Outer rail is inserted 0.03m into the original casting; side-facing
  // plating never competes with the central front plate.
  const x=side*(b.width/2+.016),thickness=.116;
  return {y,x,width:thickness,
   front:-b.depth*.43,back:b.depth*.45};
 };
 return plateGeometry(st(yLo),st(yHi));
}
function upperShell(profile,style){
 const h=profile.length;
 const stations=[-.38,.39].map((t,i)=>{
  const y=h*t,base=sample(profile,y);
  const isUpper=i===1;
  const widen=style==='box'
    ?(isUpper?.285:.175):(isUpper?.40:.115);
  const depth=style==='box'
    ?(isUpper?.26:.19):(isUpper?.31:.155);
  return {
   outer:{y,width:base.width+widen,
     front:-base.depth/2-depth*.54,back:base.depth/2+depth*.46},
   inner:{y,width:base.width+.061,
     front:-base.depth/2-.032,back:base.depth/2+.032}
  };
 });
 return enclosureGeometry(stations[0],stations[1]);
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
 const fExtent=armor.tier===1?.34:.37;
 if(armor.tier===3){
  put(thigh,'continuous upper shell',upperShell(thighProfile,armor.style),white,'thigh-wrap');
 }else{
  put(thigh,'thigh front plate',frontPlate(thighProfile,armor.tier===1?'light':'heavy',fExtent,armor.tier===1?.050:.072),white,'thigh-front');
  if(armor.tier>=2)put(thigh,'outer thigh side plate',outerPlate(thighProfile,leg.side,.365),sideWhite,'thigh-side');
 }
 put(shin,'shin front plate',frontPlate(shinProfile,armor.tier===1?'light':'heavy',armor.tier===1?.32:.38,armor.tier===1?.050:.072),white,'shin-front');
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
