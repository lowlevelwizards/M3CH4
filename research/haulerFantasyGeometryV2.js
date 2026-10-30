/** Hauler H2 V2: three independently authored heavy load-path architectures.
 * Naked machinery only. Entirely separate from the production Hauler visual.
 * Local origin is mounting center. +Z is rear, -Y points to ground.
 * Shared facts: U1 top at +0.84 m, load-shoe bottom at -0.84 m.
 */
import * as THREE from 'three';
import {haulerDimensions} from './haulerFantasyDesign.js';

const colors={ochre:0xb88e42,ivory:0xcac1a5,light:0xe0d0aa,
 dark:0x303b34,iron:0x58665d,moss:0x788169,
 teal:0x4a9583,rust:0xa56d3f,rubber:0x313a35};
const materials=Object.fromEntries(Object.entries(colors).map(([n,color])=>
 [n,new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.87,metalness:.12})]));
const V=p=>new THREE.Vector3(...p);
const delta=(a,b)=>a.map((n,i)=>n-b[i]);
const mid=(a,b)=>a.map((n,i)=>(n+b[i])*.5);
const up=new THREE.Vector3(0,1,0);
function group(parent,name,at=[0,0,0]){
 const o=new THREE.Group();o.name=name;o.position.fromArray(at);parent.add(o);return o;
}
function part(parent,name,geometry,material,at=[0,0,0]){
 const o=new THREE.Mesh(geometry,materials[material]);o.name=name;
 o.position.fromArray(at);o.castShadow=o.receiveShadow=true;
 o.userData={mechanicalPart:true,mechanicalName:name};parent.add(o);return o;
}
function box(parent,name,at,size,material){
 return part(parent,name,new THREE.BoxGeometry(...size),material,at);
}
/** Closed 8-corner box casting with large chamfers, rather than overlapping boxes. */
function cast(parent,name,at,size,material,bevel=.06){
 const [w,h,d]=size;
 const c=Math.min(bevel,w*.24,h*.24);
 const shape=new THREE.Shape();
 shape.moveTo(-w*.5+c,-h*.5);shape.lineTo(w*.5-c,-h*.5);
 shape.lineTo(w*.5,-h*.5+c);shape.lineTo(w*.5,h*.5-c);
 shape.lineTo(w*.5-c,h*.5);shape.lineTo(-w*.5+c,h*.5);
 shape.lineTo(-w*.5,h*.5-c);shape.lineTo(-w*.5,-h*.5+c);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1,curveSegments:1});
 g.translate(0,0,-d*.5);
 return part(parent,name,g,material,at);
}
function disk(parent,name,at,r,depth,material){
 const o=part(parent,name,new THREE.CylinderGeometry(r,r,depth,10),material,at);
 o.rotation.z=Math.PI/2;return o;
}
function beam(parent,name,a,b,w,d,material){
 const A=V(a),B=V(b),v=B.clone().sub(A);
 const mesh=part(parent,name,new THREE.BoxGeometry(w,v.length(),d),material,
  A.add(B).multiplyScalar(.5).toArray());
 mesh.quaternion.setFromUnitVectors(up,v.normalize());return mesh;
}
function anchor(parent,name,at){
 const p=group(parent,name,at);p.userData.mechanicalAnchor=true;return p;
}
function coupler(parent,name,at,side,r=.115){
 disk(parent,name,at,r,.050,'dark');
 disk(parent,name+' / dowel',[at[0]+side*.031,at[1],at[2]],r*.54,.015,'teal');
}
function mount(root,p){
 const mount=group(root,'H2 / actual contact standard');
 // Only this mounting face is shared across the concepts.
 cast(mount,'H2 / U1 reference plate',[0,.808,0],[.43,.061,.34],'iron',.025);
 box(mount,'H2 / contact face',[0,.8385,0],[.32,.003,.26],'ivory');
 return mount;
}
function footRubber(foot,name,center,size){
 cast(foot,name,center,size,'rubber',.017);
}
function dockFeet(foot,p,side){
 const w=p.soleWidth,depth=p.soleDepth;
 // Deep square platen, three large toe pads, hydraulic pad hinges.
 cast(foot,'DOCK '+side+' / large pressure platen',[0,-.007,.055],
  [w,.16,depth*.83],'dark',.055);
 cast(foot,'DOCK '+side+' / thick replaceable load pad',[0,.028,-.055],
  [w*.92,.106,depth*.70],'ivory',.030);
 for(let i=-1;i<=1;i++){
  const x=i*w*.293;
  cast(foot,'DOCK '+side+' / forward platen toe '+i,
   [x,-.014,-depth*.355],[w*.286,.128,depth*.21],
   i===0?'ochre':'light',.025);
 }
 footRubber(foot,'DOCK '+side+' / broad sole elastomer',
  [0,-.081,.050],[w*.96,.018,depth*.77]);
}
function striderFeet(foot,p,side){
 const w=p.soleWidth,depth=p.soleDepth;
 // Slender but long skid: front hinged toe and distinctive aft stabilizer.
 beam(foot,'STRIDER '+side+' / long landing skid',
  [0,0,depth*.41],[0,0,-depth*.29],w*.69,.14,'ivory');
 const hinge=group(foot,'STRIDER '+side+' / independent hinged toe',[0,0,-depth*.27]);
 hinge.userData.toeHinge=true;
 cast(hinge,'STRIDER '+side+' / articulated front skid section',
  [0,-.010,-depth*.09],[w*.79,.14,depth*.24],'light',.035);
 disk(foot,'STRIDER '+side+' / cross-skid hinge',
  [side*w*.38,-.002,-depth*.27],.052,.032,'teal');
 cast(foot,'STRIDER '+side+' / heel stabilizer',
  [0,-.01,depth*.38],[w*.80,.14,depth*.18],'iron',.028);
 footRubber(foot,'STRIDER '+side+' / skid sole',
  [0,-.079,0],[w*.66,.018,depth*.83]);
}
function craneFeet(foot,p,side){
 const w=p.soleWidth,depth=p.soleDepth;
 // Broad asymmetric hinged outrigger blades, separate from the ankle jaw.
 cast(foot,'CRANE '+side+' / massive center pad',[0,-.006,.035],
  [w*.67,.15,depth*.72],'iron',.035);
 for(const s of [-1,1]){
  const pivot=group(foot,'CRANE '+side+' / outrigger hinge group '+s,
   [s*w*.26,.035,depth*.21]);
  pivot.userData.outrigger=s;
  cast(pivot,'CRANE '+side+' / folding lateral stabilizer '+s,
   [s*w*.12,-.053,-depth*.29],[w*.245,.13,depth*.65],
   'ivory',.026);
  disk(foot,'CRANE '+side+' / stabilizer hinge '+s,
   [s*w*.26,.035,depth*.21],.053,.021,'rust');
 }
 footRubber(foot,'CRANE '+side+' / outrigger sole',
  [0,-.081,.01],[w*.93,.018,depth*.65]);
}
/** Central low load-table ties two enormous fixed housings together.
 * Bulk is in the stationary pods; almost all moving upper links are recessed.
 */
function dockCarriage(root,p,mountGroup){
 const frame=group(root,'DOCK / load-distribution casting');
 cast(frame,'DOCK / deeply boxed bridge',[0,.595,.045],
  [1.33,.255,.47],'ochre',.075);
 cast(frame,'DOCK / U1 unbroken center load throat',[0,.762,.025],
  [.45,.100,.31],'iron',.035);
 cast(frame,'DOCK / shear web',[0,.445,.055],
  [.94,.12,.30],'dark',.040);
 for(const side of [-1,1]){
  const x=side*(p.hipSpan*.5+.035);
  cast(frame,'DOCK '+side+' / integral stationary drive pod',[x,.215,.025],
   [.55,.665,.58],'ochre',.105);
  cast(frame,'DOCK '+side+' / compact top casting',[x,.527,.025],
   [.50,.09,.53],'ivory',.042);
  cast(frame,'DOCK '+side+' / sliding guide shroud',[x,-.119,.04],
   [.35,.19,.37],'moss',.05);
  coupler(frame,'DOCK '+side+' / enclosed outboard drive motor',
   [x+side*.135,.19,.05],side,.112);
 }
 return frame;
}
function dockAssembly(ctx,leg,p){
 const {hip,knee,ankle,foot}=ctx;
 const s=leg.side,n=s<0?'LEFT':'RIGHT',k=delta(leg.knee,leg.hip),a=delta(leg.ankle,leg.knee);
 // Little exposed upper bone: sliding ram nested into a giant fixed pod.
 beam(hip,n+' / short buried compression rod',[0,.020,0],
  [k[0],k[1]+.06,k[2]],.205,.235,'dark');
 cast(knee,n+' / square traveling ram collar',[0,-.01,-.015],
  [.29,.22,.32],'ivory',.045);
 coupler(knee,n+' / under-pod service bearing',[s*.168,0,.01],s,.089);
 beam(knee,n+' / wide low compression shoe column',[0,-.04,0],
  [a[0],a[1]+.045,a[2]],.31,.35,'iron');
 cast(ankle,n+' / compliant wide load ankle',[0,.02,0],[.36,.18,.36],'moss',.046);
 dockFeet(foot,p,s);
 const top=anchor(ctx.fixed,n+' / dock fixed ram anchor',[s*(p.hipSpan*.5),.315,.190]);
 const bottom=anchor(knee,n+' / dock traveling ram endpoint',[s*.09,.05,.08]);
 ctx.actuators.push({type:'compression',side:s,start:top,end:bottom});
}
function striderCarriage(root,p){
 const carriage=group(root,'STRIDER / independent upper fork');
 cast(carriage,'STRIDER / compact central transverse head',[0,.679,.0],
  [.73,.18,.33],'ochre',.055);
 cast(carriage,'STRIDER / top load bearing collar',[0,.773,0],
  [.32,.085,.29],'iron',.035);
 for(const side of [-1,1]){
  const x=side*(p.hipSpan*.5);
  beam(carriage,'STRIDER '+side+' / cast suspension shoulder',
   [side*.31,.675,0],[x,.46,0],.19,.24,'ochre');
  cast(carriage,'STRIDER '+side+' / stationary guide crown',[x,.435,0],
   [.37,.25,.36],'ochre',.05);
  coupler(carriage,'STRIDER '+side+' / upper spherical bearing',
   [x+side*.205,.405,.015],side,.105);
 }
 return carriage;
}
function striderAssembly(ctx,leg,p){
 const {hip,knee,ankle,foot}=ctx,s=leg.side,n=s<0?'LEFT':'RIGHT';
 const k=delta(leg.knee,leg.hip),a=delta(leg.ankle,leg.knee);
 // Genuinely tall guide: two separated fixed tracks; moving inner slide.
 for(const front of [-1,1]){
  const z=front*.12;
  beam(hip,n+' / enclosed outer guide rail '+front,
   [s*.12,.015,z],[s*.12,k[1]*.78,k[2]*.78+z],.075,.078,'moss');
 }
 beam(hip,n+' / long telescoping rectangular lift casing',
  [0,-.04,0],[k[0],k[1]*.92,k[2]*.92],.215,.235,'iron');
 cast(knee,n+' / moving carriage and travel collar',[0,.025,0],
  [.31,.265,.29],'ivory',.052);
 coupler(knee,n+' / lateral traveling elbow',[s*.174,0,0],s,.105);
 beam(knee,n+' / long straight load column',[0,0,0],
  [a[0],a[1]+.04,a[2]],.21,.25,'ivory');
 cast(ankle,n+' / guided articulated skid ankle',[0,.025,0],
  [.32,.18,.30],'iron',.04);
 striderFeet(foot,p,s);
 const top=anchor(ctx.fixed,n+' / cylinder fixed top',
  [s*(p.hipSpan*.5+.075),.475,.145]);
 const bottom=anchor(knee,n+' / hydraulic sliding rod end',
  [s*.085,-.018,.165]);
 ctx.actuators.push({type:'hydraulic',side:s,start:top,end:bottom});
}
function craneCarriage(root,p){
 const frame=group(root,'CRANE / integrated torque truss');
 // No long orange bar. Exposed open triangular bridge running into offset pivots.
 cast(frame,'CRANE / central engine-support cast block',[0,.678,.0],
  [.62,.205,.36],'ochre',.06);
 for(const side of [-1,1]){
  const x=side*(p.hipSpan*.5);
  beam(frame,'CRANE '+side+' / diagonal fixed shear truss',
   [side*.28,.665,-.12],[x,.348,-.10],.18,.14,'moss');
  beam(frame,'CRANE '+side+' / rear triangulated cross brace',
   [side*.28,.655,.135],[x,.35,-.10],.10,.10,'dark');
  cast(frame,'CRANE '+side+' / main axle mount',[x,.345,-.10],
   [.32,.26,.27],'ochre',.055);
  coupler(frame,'CRANE '+side+' / outer lifting crank hub',
   [x+side*.188,.345,-.10],side,.145);
 }
 return frame;
}
function craneAssembly(ctx,leg,p){
 const {hip,knee,ankle,foot}=ctx,s=leg.side,n=s<0?'LEFT':'RIGHT';
 const k=delta(leg.knee,leg.hip),a=delta(leg.ankle,leg.knee);
 // Angular upper structural arm with true triangular brace from hip to knee.
 beam(hip,n+' / massive diagonal primary lift spar',[0,.02,-.055],
  [k[0],k[1],k[2]],.27,.25,'ivory');
 beam(hip,n+' / rear triangulation member',
  [s*.10,-.010,.095],[k[0]+s*.11,k[1]+.035,k[2]+.11],.095,.085,'dark');
 beam(hip,n+' / front load-transfer cheek',
  [s*.13,-.06,-.13],[k[0]+s*.12,k[1]+.06,k[2]-.09],.09,.09,'moss');
 coupler(knee,n+' / compound elbow outer axle',
  [s*.179,0,0],s,.16);
 beam(knee,n+' / forward driven shin lever',
  [0,0,0],[a[0],a[1]+.05,a[2]],.23,.245,'ivory');
 beam(knee,n+' / diagonal return lever',
  [s*.13,-.055,.14],[a[0]+s*.095,a[1]+.045,a[2]+.09],.088,.085,'iron');
 cast(ankle,n+' / rotating stabilizer clevis',[0,.03,0],
  [.34,.20,.38],'moss',.052);
 craneFeet(foot,p,s);
 const top=anchor(ctx.fixed,n+' / hydraulics fixed-head anchor',
  [s*(p.hipSpan*.5-.15),.59,.13]);
 const bottom=anchor(knee,n+' / power-cylinder knee anchor',
  [s*.068,.08,.055]);
 ctx.actuators.push({type:'crane',side:s,start:top,end:bottom});
}
/** Dynamic hydraulics are two real visible segments, each attached to its
 * selected endpoint. Every render recomputes their exact physical alignment.
 */
function createActuatorMeshes(root,def){
 const n=def.type.toUpperCase()+' '+def.side;
 const actuator=group(root,n+' / hydraulics mechanism');
 const sleeve=part(actuator,n+' / fixed hydraulic barrel',
  new THREE.CylinderGeometry(1,1,1,9),'dark');
 const rod=part(actuator,n+' / exposed bright piston',
  new THREE.CylinderGeometry(1,1,1,9),def.type==='crane'?'rust':'iron');
 const couplerA=part(actuator,n+' / head eye',
  new THREE.SphereGeometry(.061,9,6),'moss');
 const couplerB=part(actuator,n+' / traveling clevis',
  new THREE.SphereGeometry(.058,9,6),'teal');
 for(const m of [sleeve,rod,couplerA,couplerB])m.userData.dynamicActuator=true;
 return {...def,barrel:sleeve,rod,couplerA,couplerB,group:actuator};
}
function setCylinder(mesh,a,b,r){
 const start=V(a),end=V(b),direction=end.clone().sub(start);
 const length=direction.length();
 mesh.position.copy(start).add(end).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(up,direction.normalize());
 mesh.scale.set(r,Math.max(.0001,length),r);
}
export function updateHaulerActuators(study){
 study.root.updateWorldMatrix(true,true);
 for(const a of study.actuators){
  const A=study.root.worldToLocal(a.start.getWorldPosition(new THREE.Vector3())).toArray();
  const B=study.root.worldToLocal(a.end.getWorldPosition(new THREE.Vector3())).toArray();
  const middle=A.map((n,i)=>n+(B[i]-n)*.60);
  const barrelEnd=A.map((n,i)=>n+(B[i]-n)*.68);
  setCylinder(a.barrel,A,barrelEnd,.075);
  setCylinder(a.rod,middle,B,.042);
  a.couplerA.position.fromArray(A);a.couplerB.position.fromArray(B);
  a.barrel.userData.anchorError=0;a.rod.userData.anchorError=0;
  a.travel=Math.hypot(...delta(B,A));
 }
}
/** No production import; three completely different naked machines. */
export function createHaulerConcept(config){
 const p=haulerDimensions(config);
 const root=group(new THREE.Group(),'HAULER / FANTASY '+p.id.toUpperCase());
 root.userData={haulerStudy:p.id,prototypeOnly:true,noSave:true,notGameplay:true,
  armorTier:0,mount:[...p.topContact],floor:p.ground,mechanism:p.mechanism};
 mount(root,p);
 const fixed=p.id==='dock'?dockCarriage(root,p):
  p.id==='strider'?striderCarriage(root,p):craneCarriage(root,p);
 const limbs=[],definitions=[];
 for(const leg of p.legs){
  const side=leg.side,n=side<0?'left':'right';
  const hip=group(fixed,n+'Hip',leg.hip);
  const knee=group(hip,n+'Knee',delta(leg.knee,leg.hip));
  const ankle=group(knee,n+'Ankle',delta(leg.ankle,leg.knee));
  const foot=group(ankle,n+'Foot',delta(leg.foot,leg.ankle));
  for(const [joint,g] of Object.entries({hip,knee,ankle,foot}))
   g.userData={joint,side,prototypeOnly:true};
  const marker=part(foot,n.toUpperCase()+' / DEV ground contact',
   new THREE.CylinderGeometry(.052,.052,.006,10),'teal',[0,-.093,0]);
  // Marker glow must not leak into shared teal bearing materials.
  marker.material=marker.material.clone();
  marker.visible=false;marker.userData.contactMarker=true;
  const ctx={hip,knee,ankle,foot,fixed,actuators:definitions};
  if(p.id==='dock')dockAssembly(ctx,leg,p);
  else if(p.id==='strider')striderAssembly(ctx,leg,p);
  else craneAssembly(ctx,leg,p);
  limbs.push({...ctx,leg,marker});
 }
 const actuators=definitions.map(d=>createActuatorMeshes(root,d));
 const study={root,params:p,limbs,actuators};
 updateHaulerActuators(study);
 return study;
}
