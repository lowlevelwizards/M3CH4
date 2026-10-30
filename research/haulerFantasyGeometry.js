/** Original Hauler H2 fantasy concept castings, not based on haulerVisual.js.
 * Three distinct load paths: buried dock compression, hydraulic long-travel,
 * and exposed triangular crane leverage. Naked structural geometry only.
 */
import * as THREE from 'three';
import {haulerDimensions} from './haulerFantasyDesign.js';

const swatches={paint:0xb18a3c,cream:0xc7bda0,olive:0x6c795e,
 steel:0x66746d,black:0x34423b,teal:0x518f84,rust:0x9b6844,
 boot:0x424b40,bone:0xe0d1ab};
const mats=Object.fromEntries(Object.entries(swatches).map(([k,c])=>
 [k,new THREE.MeshStandardMaterial({color:c,roughness:.86,metalness:.13,flatShading:true})]));
const v=a=>new THREE.Vector3(...a);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function group(parent,name,point=[0,0,0]){
 const o=new THREE.Group();o.name=name;o.position.fromArray(point);parent.add(o);return o;
}
function mesh(parent,name,geometry,tone,position=[0,0,0]){
 const o=new THREE.Mesh(geometry,mats[tone]);o.name=name;
 o.position.fromArray(position);o.castShadow=true;o.receiveShadow=true;
 parent.add(o);return o;
}
function block(parent,name,pos,size,tone){
 return mesh(parent,name,new THREE.BoxGeometry(...size),tone,pos);
}
/** One low-poly beveled silhouette casting: extruded closed octagonal outline. */
function casting(parent,name,pos,size,tone,cut=.055){
 const [w,h,d]=size,c=Math.min(cut,w*.20,h*.20);
 const path=new THREE.Shape();
 path.moveTo(-w/2+c,-h/2);path.lineTo(w/2-c,-h/2);
 path.lineTo(w/2,-h/2+c);path.lineTo(w/2,h/2-c);
 path.lineTo(w/2-c,h/2);path.lineTo(-w/2+c,h/2);
 path.lineTo(-w/2,h/2-c);path.lineTo(-w/2,-h/2+c);path.closePath();
 const geo=new THREE.ExtrudeGeometry(path,{depth:d,steps:1,bevelEnabled:false,curveSegments:1});
 geo.translate(0,0,-d*.5);
 return mesh(parent,name,geo,tone,pos);
}
function pin(parent,name,pos,r,depth,tone){
 const m=mesh(parent,name,new THREE.CylinderGeometry(r,r,depth,10),tone,pos);
 m.rotation.z=Math.PI/2;return m;
}
const up=new THREE.Vector3(0,1,0);
function beam(parent,name,a,b,wx,wz,tone){
 const start=v(a),end=v(b),difference=end.clone().sub(start);
 const m=mesh(parent,name,new THREE.BoxGeometry(wx,difference.length(),wz),tone,
  start.clone().add(end).multiplyScalar(.5).toArray());
 m.quaternion.setFromUnitVectors(up,difference.normalize());return m;
}
function cylinderAlong(parent,name,a,b,r,tone){
 const start=v(a),end=v(b),diff=end.clone().sub(start);
 const m=mesh(parent,name,new THREE.CylinderGeometry(r,r,diff.length(),9),tone,
  start.clone().add(end).multiplyScalar(.5).toArray());
 m.quaternion.setFromUnitVectors(up,diff.normalize());return m;
}
function doubleShoe(foot,p,style,tag){
 const w=p.soleWidth,depth=p.soleDepth;
 const heel=style==='dock'?.18:.16;
 casting(foot,'SERVICE / solid rear load bridge',[0,0,depth*.20],
  [w*.90,.145,depth*.41],'boot',.025);
 for(const side of [-1,1]){
  const x=side*w*.247;
  const width=w*.47;
  casting(foot,'SERVICE / '+(side<0?'left':'right')+' ground shoe',
   [x,-.008,-depth*.10],[width,.164,depth*.77],
   style==='crane'?'bone':'cream',.045);
  block(foot,'SERVICE / sacrificial sole rubber '+side,
   [x,-.081,-depth*.15],[width*.93,.021,depth*.65],'black');
 }
 if(style==='dock'){
  casting(foot,'SERVICE / forward compacting tread',[0,.010,-depth*.39],
   [w*.89,.098,depth*.19],'paint',.026);
 }
 if(style==='strider'){
  for(const sign of [-1,1])pin(foot,'SERVICE / toe axle '+sign,
   [sign*w*.26,.025,-depth*.37],.035,.062,'teal');
 }
 for(const piece of foot.children)piece.name=tag+'/'+piece.name;
}
function fixedUpper(root,p){
 const carriage=group(root,'HAULER CONCEPT / FRAME MOUNT');
 // Real H2-to-U1 height and contact; not copied from the legacy Hauler mesh.
 casting(carriage,'H2 / raised U1 crown',[0,.811,0],[.48,.058,.35],'steel',.034);
 casting(carriage,'H2 / compression adapter throat',[0,.739,0],[.53,.114,.38],'black',.038);
 casting(carriage,'H2 / boxed load transfer yoke',[0,.636,.025],
  [p.id==='dock'?2.05:p.id==='strider'?1.88:1.96,.16,.38],'paint',.055);
 block(carriage,'H2 / machined receiver face',[0,.837,0],[.31,.006,.25],'cream');
 for(const side of [-1,1]){
  casting(carriage,'H2 / side connector '+side,
   [side*.44,.745,0],[.19,.16,.21],'steel',.027);
 }
 return carriage;
}
function dockAssembly(root,p,carriage,leg,joints){
 const s=leg.side,sign=s<0?'L':'R';
 // Stationary drive pods carry the mass. Short lower columns do the stepping.
 const x=s*.985;
 casting(carriage,sign+'/DOCK / fixed ochre drive pod',[x,.29,.01],
  [.52*.97,.54*p.podScale,.53],'paint',.10);
 casting(carriage,sign+'/DOCK / upper end cap',
  [x,.52,.01],[.49,.14,.54],'cream',.052);
 casting(carriage,sign+'/DOCK / lower maintenance housing',
  [x,.065,.045],[.46,.16,.49],'olive',.045);
 pin(carriage,sign+'/DOCK / accessible outboard motor',
  [s*1.245,.20,.035],.145,.044,'teal');
 const k=sub(leg.knee,leg.hip),a=sub(leg.ankle,leg.knee);
 beam(joints.hip,sign+'/DOCK / square compression ram',[0,.015,0],k,.21,.25,'black');
 cylinderAlong(joints.hip,sign+'/DOCK / exposed piston rod',
  [s*.11,-.055,-.125],[k[0]+s*.11,k[1]+.06,k[2]-.12],.058,'steel');
 casting(joints.knee,sign+'/DOCK / sliding boot',[0,.015,0],[.32,.27,.32],'olive',.057);
 pin(joints.knee,sign+'/DOCK / knee service pin',[s*.175,0,0],.12,.056,'teal');
 beam(joints.knee,sign+'/DOCK / short compression column',[0,0,0],a,.30,.35,'black');
 beam(joints.knee,sign+'/DOCK / cream sliding face',
  [0,-.07,-.165],[a[0],a[1]+.08,a[2]-.14],.22,.07,'cream');
 casting(joints.ankle,sign+'/DOCK / grounded ankle block',[0,0,0],[.39,.24,.35],'steel');
}
function striderAssembly(root,p,carriage,leg,joints){
 const s=leg.side,sign=s<0?'L':'R';
 const k=sub(leg.knee,leg.hip),a=sub(leg.ankle,leg.knee);
 // Twin vertical columns frame a long-stroke central piston.
 casting(carriage,sign+'/STRIDER / compact top winch housing',
  [s*.96,.49,0],[.45,.29,.39],'paint',.055);
 pin(carriage,sign+'/STRIDER / outboard barrel bearing',
  [s*1.197,.40,.06],.125,.05,'teal');
 casting(joints.hip,sign+'/STRIDER / slim upper sliding channel',
  [0,k[1]*.43,k[2]*.43],[.29,.49,.29],'olive',.055);
 cylinderAlong(joints.hip,sign+'/STRIDER / hydraulic ram',
  [s*.11,-.035,-.095],[k[0]+s*.11,k[1]+.085,k[2]-.085],.074,'steel');
 beam(joints.hip,sign+'/STRIDER / vertical outboard rail',
  [s*.16,-.04,.08],[k[0]+s*.16,k[1]+.10,k[2]+.08],.078,.07,'cream');
 pin(joints.knee,sign+'/STRIDER / exposed elbow pin',[s*.16,0,0],.125,.05,'rust');
 casting(joints.knee,sign+'/STRIDER / traveling lower carriage',
  [0,-.12,0],[.32,.36,.31],'olive',.050);
 beam(joints.knee,sign+'/STRIDER / long compression column',
  [0,-.08,0],[a[0],a[1]+.02,a[2]],.24,.27,'cream');
 cylinderAlong(joints.knee,sign+'/STRIDER / supplementary tension rod',
  [s*.13,-.08,.13],[a[0]+s*.13,a[1]+.06,a[2]+.11],.035,'rust');
 casting(joints.ankle,sign+'/STRIDER / tall shoe guide',[0,.035,0],
  [.28,.21,.29],'steel',.035);
}
function craneAssembly(root,p,carriage,leg,joints){
 const s=leg.side,sign=s<0?'L':'R';
 const k=sub(leg.knee,leg.hip),a=sub(leg.ankle,leg.knee);
 // Main power transmission is a *triangle*, not a stack of thick columns.
 casting(carriage,sign+'/CRANE / housed crank drum',
  [s*.995,.465,.045],[.45,.31,.43],'olive',.065);
 pin(carriage,sign+'/CRANE / external crank spindle',
  [s*1.240,.38,.08],.16,.045,'teal');
 beam(joints.hip,sign+'/CRANE / angled lift girder',
  [0,.05,-.095],[k[0],k[1]+.08,k[2]-.06],.27,.27,'cream');
 beam(joints.hip,sign+'/CRANE / rear parallel tension bar',
  [s*.16,-.06,.16],[k[0]+s*.11,k[1]+.035,k[2]+.115],.067,.066,'rust');
 beam(joints.hip,sign+'/CRANE / diagonal stiffening spar',
  [s*.16,-.01,-.14],[k[0]+s*.11,k[1]+.12,k[2]+.12],.068,.075,'black');
 pin(joints.knee,sign+'/CRANE / compound articulated knee',
  [s*.14,0,0],.15,.065,'black');
 pin(joints.knee,sign+'/CRANE / crank retaining pin',
  [s*.187,0,0],.085,.055,'teal');
 beam(joints.knee,sign+'/CRANE / front load lever',
  [0,-.012,-.065],[a[0],a[1]+.06,a[2]-.03],.23,.22,'cream');
 beam(joints.knee,sign+'/CRANE / diagonal tension brace',
  [s*.13,-.065,.16],[a[0]+s*.12,a[1]+.035,a[2]+.06],.082,.075,'steel');
 cylinderAlong(joints.knee,sign+'/CRANE / long exposed power rod',
  [s*.13,-.075,.085],[a[0]+s*.12,a[1]+.06,a[2]+.10],.041,'rust');
 casting(joints.ankle,sign+'/CRANE / adjustable landing knuckle',
  [0,.018,.025],[.32,.25,.34],'olive',.05);
}
/** Creates an independently editable, fully articulated, nonpersistent specimen.
 * Does not touch any production Hauler visual, engine IK or save.
 */
export function createHaulerConcept(config){
 const p=haulerDimensions(config),root=group(new THREE.Group(),'HAULER / '+p.id);
 root.userData={haulerStudy:p.id,prototypeOnly:true,noSave:true,notGameplay:true,
  armorTier:0,mount:[...p.topContact],floor:p.ground,mechanism:p.mechanism};
 const fixed=fixedUpper(root,p);
 const limbs=[];
 for(const leg of p.legs){
  const prefix=leg.side<0?'left':'right';
  const hip=group(fixed,prefix+'Hip',leg.hip);
  const knee=group(hip,prefix+'Knee',sub(leg.knee,leg.hip));
  const ankle=group(knee,prefix+'Ankle',sub(leg.ankle,leg.knee));
  const foot=group(ankle,prefix+'Foot',sub(leg.foot,leg.ankle));
  for(const [joint,obj] of Object.entries({hip,knee,ankle,foot}))
   obj.userData={joint,side:leg.side,prototypeOnly:true};
  const joints={hip,knee,ankle,foot};
  if(p.id==='dock')dockAssembly(root,p,fixed,leg,joints);
  else if(p.id==='strider')striderAssembly(root,p,fixed,leg,joints);
  else craneAssembly(root,p,fixed,leg,joints);
  doubleShoe(foot,p,p.id,prefix.toUpperCase());
  const marker=mesh(foot,'DEV / foot contact indicator',
   new THREE.CylinderGeometry(.052,.052,.006,10),'teal',
   [0,-.095,0]);
  marker.visible=false;marker.userData.contactMarker=true;
  limbs.push({...joints,leg,marker});
 }
 return {root,params:p,limbs};
}
