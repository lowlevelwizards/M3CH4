/** One Three.js compiler for editor blueprints and production preview overrides. */
import * as THREE from 'three';
import {validateDocument,validateGeometry,clone} from './blueprint.js';
const palette={
 olive:0x849275,ochre:0xb48c37,cream:0xcac4ae,
 iron:0x4c5a56,teal:0x468786,orange:0xc07852,
 dark:0x293431,bright:0x9ba6a3,armor:0xbbb49c
};
const material=role=>new THREE.MeshStandardMaterial({color:palette[role]||palette.olive,
 roughness:.84,metalness:.20,flatShading:true,side:THREE.FrontSide});
function extrude(profile,depth){
 const shape=new THREE.Shape();
 profile.forEach((p,i)=>i?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));
 shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:1});
 geo.translate(0,0,-depth/2);
 return geo;
}
function loft(sections){
 const positions=[],indices=[];
 for(const s of sections){
  const w=s.width/2;
  positions.push(-w,s.y,s.front,w,s.y,s.front,w,s.y,s.back,-w,s.y,s.back);
 }
 for(let i=0;i<sections.length-1;i++){
  const a=i*4,b=a+4;
  for(let k=0;k<4;k++){
   const k2=(k+1)%4;
   indices.push(a+k,b+k2,a+k2,a+k,b+k,b+k2);
  }
 }
 indices.push(0,1,2,0,2,3);
 const z=(sections.length-1)*4;
 indices.push(z,z+2,z+1,z,z+3,z+2);
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setIndex(indices);g.computeVertexNormals();return g;
}
export function compileGeometry(input){
 const g=validateGeometry(clone(input));
 let geo;
 switch(g.type){
 case 'mesh': {
  geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(g.positions,3));
  geo.setIndex(g.indices);
  if(g.normals)geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.normals,3));
  else geo.computeVertexNormals();
  for(const group of(g.groups||[]))geo.addGroup(group.start,group.count,group.materialIndex);
  break;
 }
 case 'box':geo=new THREE.BoxGeometry(...g.size);break;
 case 'chamfer':{
  const [w,h,d]=g.size,b=g.bevel,s=new THREE.Shape();
  [[-w/2+b,-h/2],[w/2-b,-h/2],[w/2,-h/2+b],[w/2,h/2-b],
   [w/2-b,h/2],[-w/2+b,h/2],[-w/2,h/2-b],[-w/2,-h/2+b]]
   .forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));
  s.closePath();geo=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:false,curveSegments:1});geo.translate(0,0,-d/2);break;
 }
 case 'cylinder':geo=new THREE.CylinderGeometry(g.radius,g.radius,g.length,g.sides,1,false);break;
 case 'tube':{
  const sh=new THREE.Shape();
  sh.absarc(0,0,g.outerRadius,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(0,0,g.innerRadius,0,Math.PI*2,true);sh.holes.push(hole);
  geo=new THREE.ExtrudeGeometry(sh,{depth:g.length,steps:1,bevelEnabled:false,curveSegments:1});
  geo.translate(0,0,-g.length/2);break;
 }
 case 'wedge':case 'plate':geo=extrude(g.profile,g.depth);break;
 case 'taper':geo=loft([
  {y:-g.length/2,width:g.from[0],front:-g.from[1]/2,back:g.from[1]/2},
  {y:g.length/2,width:g.to[0],front:-g.to[1]/2,back:g.to[1]/2}
 ]);break;
 case 'loft':geo=loft(g.sections);break;
 }
 if(g.type==='cylinder'){
  if(g.axis==='x')geo.rotateZ(Math.PI/2);
  if(g.axis==='z')geo.rotateX(Math.PI/2);
 }
 if(g.type==='tube'){
  if(g.axis==='y')geo.rotateX(-Math.PI/2);
  if(g.axis==='x')geo.rotateY(Math.PI/2);
 }
 geo.computeBoundingBox();geo.computeBoundingSphere();
 return geo;
}
export function compileBlueprint(input,{materials=null}={}){
 const doc=validateDocument(input),root=new THREE.Group(),objects=new Map();
 root.name='WORKBENCH / '+doc.name;
 for(const node of doc.nodes){
  let object;
  if(node.kind==='shape'){
   const source=node.mirrorOf?doc.nodes.find(n=>n.id===node.mirrorOf):node;
   const materialColors=node.materialColors||(
    node.materialColor!==undefined?[node.materialColor]:null);
   const meshMaterials=materialColors?.length?
    materialColors.map(hex=>new THREE.MeshStandardMaterial({color:hex,roughness:.83,metalness:.18,
      flatShading:!source.geometry.normals,side:THREE.DoubleSide})):
    [materials?.[node.materialRole]||material(node.materialRole)];
   object=new THREE.Mesh(compileGeometry(source.geometry),
      meshMaterials.length>1?meshMaterials:meshMaterials[0]);
   object.castShadow=true;object.receiveShadow=true;
   object.userData.workbenchSelectable=true;
  }else object=new THREE.Group();
  object.name=node.name;
  object.userData.workbenchNodeId=node.id;
  object.userData.workbenchKind=node.kind;
  object.userData.workbenchLocked=node.locked;
  object.position.set(...node.transform.position);
  object.rotation.set(...node.transform.rotation,'XYZ');
  object.scale.set(...node.transform.scale);
  if(node.mirrorOf)object.scale.x*=-1;
  object.visible=node.visible;
  objects.set(node.id,object);
 }
 for(const node of doc.nodes){
  const obj=objects.get(node.id);
  if(node.parentId)objects.get(node.parentId).add(obj);
  else root.add(obj);
 }
 return {root,objects};
}
export function disposeBlueprint(root){
 const materials=new Set();
 root?.traverse(n=>{
  if(!n.isMesh)return;
  n.geometry?.dispose?.();
  for(const m of(Array.isArray(n.material)?n.material:[n.material]))materials.add(m);
 });
 materials.forEach(m=>m?.dispose?.());
}
/** Check only broad-phase envelope; do not claim swept articulation clearance. */
export function measureBlueprint(root){
 root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root);
 if(box.isEmpty())return {empty:true};
 return {empty:false,size:box.getSize(new THREE.Vector3()).toArray(),
  min:box.min.toArray(),max:box.max.toArray()};
}
