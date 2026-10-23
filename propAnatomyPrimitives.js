/** Low-poly *anatomical* modeling primitives, k.5r.1.
 * Unlike an AABB with glued-on decorations these describe exposed frames,
 * hollow rings, tapered housings and connected mechanisms. All materials are
 * shared and geometry is bounded for iPhone WebGL.
 */
import * as THREE from 'three';
const materials=new Map(),boxes=new Map(),cylinders=new Map(),toruses=new Map();
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function material(color,metalness=.2){
 const k=color+':'+metalness;
 if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({
  color,roughness:.87,metalness,flatShading:true,
 }));
 return materials.get(k);
}
function geometry(type,segments=10){
 if(type==='box'){
  if(!boxes.has('box'))boxes.set('box',new THREE.BoxGeometry(1,1,1));
  return boxes.get('box');
 }
 if(type==='cylinder'){
  if(!cylinders.has(segments))cylinders.set(segments,new THREE.CylinderGeometry(1,1,1,segments));
  return cylinders.get(segments);
 }
}
function attach(parent,mesh,name,color,metalness=.2){
 mesh.name=name;
 if(color!==undefined)mesh.material=material(color,metalness);
 mesh.userData.visualOnly=true;
 mesh.castShadow=false;mesh.receiveShadow=true;
 parent.add(mesh);return mesh;
}
export function block(parent,name,w,h,d,x,y,z,color,metal=.2){
 const mesh=new THREE.Mesh(geometry('box'),material(color,metal));
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 return attach(parent,mesh,name);
}
export function cylinder(parent,name,r,length,x,y,z,color,axis='y',segments=12,metal=.25){
 const mesh=new THREE.Mesh(geometry('cylinder',segments),material(color,metal));
 mesh.scale.set(r,length,r);mesh.position.set(x,y,z);
 if(axis==='x')mesh.rotation.z=Math.PI/2;
 if(axis==='z')mesh.rotation.x=Math.PI/2;
 return attach(parent,mesh,name);
}
export function ring(parent,name,major,tube,x,y,z,color,axis='x',segments=12){
 const key=[major,tube,segments].map(n=>n.toFixed(3)).join(':');
 let geom=toruses.get(key);
 if(!geom){geom=new THREE.TorusGeometry(major,tube,5,segments);toruses.set(key,geom);}
 const mesh=new THREE.Mesh(geom,material(color,.14));
 mesh.position.set(x,y,z);
 if(axis==='x')mesh.rotation.y=Math.PI/2;
 if(axis==='y')mesh.rotation.x=Math.PI/2;
 return attach(parent,mesh,name);
}
export function beam(parent,name,a,b,r,color,segments=7){
 const start=Array.isArray(a)?V(...a):a,end=Array.isArray(b)?V(...b):b;
 const delta=end.clone().sub(start);
 const mesh=new THREE.Mesh(geometry('cylinder',segments),material(color,.38));
 mesh.position.copy(start).add(end).multiplyScalar(.5);
 mesh.scale.set(r,delta.length(),r);
 mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());
 return attach(parent,mesh,name);
}
/** Flat-shaded, end-capped extruded side profile.
 * coords are [z,y] contour in the side view; width along the machine X axis.
 * Used for actual wedge-shaped bonnets, fenders and loader buckets.
 */
export function profile(parent,name,outline,width,x,color,metal=.22){
 const n=outline.length,vertices=[],indices=[];
 for(const xx of [x-width*.5,x+width*.5])
  for(const [z,y]of outline)vertices.push(xx,y,z);
 for(let i=1;i<n-1;i++){
  indices.push(0,i,i+1);indices.push(n,n+i+1,n+i);
 }
 for(let i=0;i<n;i++){
  const j=(i+1)%n,aa=i,bb=j,cc=n+j,dd=n+i;
  indices.push(aa,bb,cc,aa,cc,dd);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,material(color,metal));
 return attach(parent,mesh,name);
}
/** Place a polygonal, hollow tyre in a wheel orientation; center is empty,
 * not backed by a slab. Tread chunks live on the actual circumference.
 */
export function wheel(parent,name,x,y,z,{radius=.75,width=.33,hub=.20,
 treadCount=10,rubber=0x252724,rimColor=0x8e7d60}={}){
 const group=new THREE.Group();group.name=name;group.position.set(x,y,z);
 group.userData.visualOnly=true;parent.add(group);
 for(const s of [-1,1]){
  const side=s*width*.43;
  ring(group,name+'-rubber-sidewall',radius*.78,radius*.22,side,0,0,rubber,'x',12);
  ring(group,name+'-steel-rim',radius*.34,radius*.105,side+s*.06,0,0,
   rimColor,'x',12);
  cylinder(group,name+'-hub',hub,.11,side+s*.09,0,0,rimColor,'x',10);
 }
 cylinder(group,name+'-axle',hub*.32,width+.1,0,0,0,0x303735,'x',8);
 for(let i=0;i<treadCount;i++){
  const a=i*Math.PI*2/treadCount,y0=Math.cos(a)*radius,z0=Math.sin(a)*radius;
  const tread=block(group,name+'-raised-tread',width*.99,radius*.24,radius*.23,
    0,y0,z0,0x30312b,.08);
  tread.rotation.x=a;
 }
 return group;
}
export function rustPanel(parent,name,w,h,d,x,y,z,color,patch=0x6e4834){
 block(parent,name,w,h,d,x,y,z,color,.32);
 block(parent,name+'-oxidized-edge',w*.37,.035,d*.88,
  x+w*.26,y+h*.50+.025,z,patch,.08);
}
export function axlePair(parent,name,xLeft,xRight,y,z,color){
 beam(parent,name+'-axle',[xLeft,y,z],[xRight,y,z],.115,color,8);
 for(const x of [xLeft+.23,xRight-.23])
  cylinder(parent,name+'-bearing',.20,.21,x,y,z,color,'x',9);
}
export const TRIM_COLORS=Object.freeze({
 iron:0x444940,rubber:0x252923,rust:0x9c5437,paint:0xb56840,
 yellow:0xc5a04f,glass:0x273f40,steel:0x899184,
 clay:0x6f5140,soot:0x32322f,cream:0xc6b58e,
});
