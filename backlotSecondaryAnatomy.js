/** Backlot k.5s.0 — SECONDARY prop anatomy completion.
 * Rebuilds 8 offsite trailers, 2 utility shacks, 3 silos, 3 poles
 * and the venue gates from the original box placeholders.
 * Exclusively VISUAL: no world.obstacles, damage or navigation changes.
 * Every machine remains a connected physical assembly.
 */
import * as THREE from 'three';
import {block,beam,cylinder,ring,wheel,profile,TRIM_COLORS as C}
 from './propAnatomyPrimitives.js';
const R=C.rust,I=C.iron,S=C.steel,Y=C.yellow,W=C.clay,D=C.soot,T=C.rubber;
const b=(g,n,w,h,d,x,y,z,c=I)=>block(g,n,w,h,d,x,y,z,c,.22);
const f=(g,n,a,e,r=.13,c=I)=>beam(g,n,a,e,r,c,7);
function dropOld(root,names){
 const victims=[];root.traverse(o=>{if(names.has(o.name))victims.push(o);});
 for(const o of victims)o.parent?.remove(o);
 return victims.length;
}
function wheelset(g,z){
 // Actual full-width axle with bearings, not wheels pasted to the hull.
 f(g,'wagon-solid-cross-axle',[-1.54,.81,z],[1.54,.81,z],.18,S);
 for(const side of [-1,1]){
  b(g,'wagon-axle-bearing',.26,.34,.48,side*1.18,.81,z,R);
  wheel(g,'wagon-agricultural-wheel',side*1.57,.84,z,{
   radius:.70,width:.37,hub:.20,treadCount:7,rubber:T,rimColor:C.cream});
 }
}
function trailer(root,x,z,type,i,side){
 const g=new THREE.Group();g.name='secondary-trailer-'+type+'-'+i;
 g.position.set(x,0,z);g.rotation.y=side*(.09+.08*(i%3));
 root.add(g);
 const wagon=type==='farm-wagon';
 const bedY=wagon?1.33:1.24;
 for(const s of [-1,1])
  f(g,'wagon-structural-longitudinal-frame',[s*1.16,.80,-3.06],
    [s*1.16,.80,3.06],.21,I);
 for(const zz of [-2.5,0,2.5])
  f(g,'wagon-strong-crossmember',[-1.45,.86,zz],[1.45,.86,zz],.20,R);
 wheelset(g,-2.02);wheelset(g,2.02);
 b(g,'wagon-heavy-deck',3.10,.26,6.15,0,bedY,0,W);
 for(const s of [-1,1]){
  if(wagon){
   // Deep sided grain trailer: load-bearing panels, no floating upper box.
   b(g,'wagon-solid-sidewall',.21,1.62,5.76,s*1.44,2.28,0,
    s===1?R:C.clay);
   b(g,'wagon-upper-rim-beam',.30,.22,5.89,s*1.44,3.09,0,Y);
   for(const zz of [-2.45,0,2.45])
    b(g,'wagon-exterior-bracing',.15,1.57,.30,s*1.57,2.27,zz,I);
  }else{
   // Open salvage bed: shorter, broader uprights attached to the chassis.
   for(const zz of [-2.38,2.38]){
    f(g,'wagon-bed-pocket-post',[s*1.40,1.35,zz],
      [s*1.40,2.17,zz],.18,R);
   }
   f(g,'wagon-side-retainer',[s*1.39,1.53,-2.53],
     [s*1.39,1.53,2.53],.18,I);
  }
 }
 if(wagon){
  b(g,'wagon-solid-end-wall',2.85,1.66,.20,0,2.26,-2.94,W);
  b(g,'wagon-rear-drop-tailgate',2.88,1.50,.23,0,2.20,2.94,R);
  for(const s of [-1,1])
   f(g,'wagon-tailgate-hinge-pin',[s*1.2,1.38,2.97],
     [s*1.2,1.88,2.97],.12,S);
  // A folded tarpaulin gives a broad readable top silhouette.
  b(g,'wagon-folded-tarp-bundle',2.89,.36,.75,0,3.24,-2.32,Y);
 }else{
  // Recognizable spare machinery (big axle, flywheel and engine core),
  // bolted to sleepers rather than floating above the boards.
  for(const zz of [-1.15,1.20])
   b(g,'flatbed-cargo-timber-sleeper',2.39,.26,.49,0,1.56,zz,C.clay);
  b(g,'flatbed-salvage-engine-casting',1.92,.77,2.28,0,2.01,.20,I);
  cylinder(g,'flatbed-broken-flywheel',.67,.32,0,2.12,1.38,R,'z',10);
  ring(g,'flatbed-flywheel-open-spoke-ring',.51,.13,0,2.12,1.58,S,'z',10);
  b(g,'flatbed-dented-side-panel',.19,.84,2.08,-1.08,1.84,.21,Y);
 }
 f(g,'wagon-trailer-drawbar',[-.49,.78,-2.91],[0,.66,-4.27],.20,I);
 f(g,'wagon-trailer-drawbar',[.49,.78,-2.91],[0,.66,-4.27],.20,I);
 cylinder(g,'wagon-tow-eye',.25,.11,0,.64,-4.33,S,'y',9);
 return g;
}
function serviceShack(root,x,z,mechanic){
 const g=new THREE.Group();g.name=mechanic?
   'secondary-mechanic-service-shed':'secondary-fuel-counter-shack';
 g.position.set(x,0,z);root.add(g);
 const width=7,depth=5.5,h=3.4;
 // A real wall arrangement with a door/bay aperture, not a solid cube with
 // the doorway painted onto the face.
 for(const side of [-1,1])
  b(g,'shack-side-structural-wall',.26,h,depth,side*3.42,h/2,0,
    side===1?R:W);
 b(g,'shack-rear-cladding',width-.45,h,.26,0,h/2,2.63,W);
 b(g,'shack-bearing-top-header',6.96,.35,.30,0,h-.12,-2.60,I);
 if(mechanic){
  // Wide authentic service-bay opening, shoulder panels and workshop inside.
  for(const side of [-1,1])
   b(g,'mechanic-bay-front-shoulder',1.42,h,.26,side*2.76,h/2,-2.60,R);
  b(g,'mechanic-bay-raised-concrete-threshold',4.26,.19,.82,0,.10,-2.55,S);
  b(g,'mechanic-solid-workbench',2.62,.22,.85,1.23,1.03,1.45,I);
  for(const zz of [1.08,1.90])
   b(g,'mechanic-workbench-leg',.17,.95,.21,.36,.54,zz,I);
  wheel(g,'mechanic-spare-service-wheel',-1.92,.90,1.33,
    {radius:.81,width:.34,hub:.19,treadCount:7});
  b(g,'mechanic-hanging-lift-housing',.75,.52,1.06,-2.31,2.32,1.16,Y);
  f(g,'mechanic-horizontal-hoist-rail',[-2.90,2.87,-1.82],
    [-2.90,2.87,1.95],.17,I);
 }else{
  for(const side of [-1,1])
   b(g,'fuel-shack-front-corner-wall',2.13,h,.26,
     side*2.37,h/2,-2.60,R);
  b(g,'fuel-shack-lintel-over-door',2.72,.52,.26,0,3.15,-2.60,W);
  // Door is partially open on a real hinge; you can see into the interior.
  const pivot=new THREE.Group();pivot.name='fuel-shack-hinged-door-pivot';
  pivot.position.set(-1.14,0,-2.71);pivot.rotation.y=.50;g.add(pivot);
  b(pivot,'fuel-shack-actual-timber-door',2.14,2.51,.14,1.07,1.26,0,W);
  b(pivot,'fuel-shack-handle',.15,.17,.19,1.93,1.32,-.10,S);
  b(g,'fuel-shack-service-counter',1.83,.29,.85,2.07,1.42,-2.03,Y);
  for(const sx of [-1,1])
   b(g,'fuel-shack-shelf-bracket',.16,.61,.38,2.07+sx*.68,1.10,-2.08,I);
  for(let i=0;i<3;i++)
   cylinder(g,'shack-short-fuel-drum',.46,1.18,
    -2.43+i*.77,.60,1.67,i===0?Y:R,'y',8);
 }
 // Roof is two large angled slabs with an actual ridge and eaves.
 for(const side of [-1,1]){
  const roof=b(g,'shack-one-piece-pitched-roof',3.94,.23,6.20,
    side*1.82,3.91,0,side===1?I:C.clay);
  roof.rotation.z=side*.13;
  f(g,'shack-eave-load-beam',[side*3.35,3.38,-2.96],
    [side*3.35,3.38,2.96],.18,S);
 }
 f(g,'shack-roof-ridge', [0,4.13,-3.07],[0,4.13,3.07],.16,I);
 cylinder(g,'shack-short-chimney-stack',.21,1.26,1.96,4.42,1.32,D,'y',8);
 return g;
}
function grainSilo(root,x,z,height,i){
 const g=new THREE.Group();g.name='secondary-working-grain-silo-'+i;
 g.position.set(x,0,z);root.add(g);
 // Compact steel store with conical cap, grouped ribbing, silo access.
 cylinder(g,'silo-corrugated-main-cylinder',3.91,height,0,height*.5,0,
   i%2?S:C.clay,'y',12);
 for(const y of [1.19,height*.40,height*.75,height-.37])
  ring(g,'silo-wide-structural-rib',3.90,.16,0,y,0,I,'y',12);
 const roof=new THREE.Mesh(new THREE.ConeGeometry(4.12,2.65,12),
   new THREE.MeshStandardMaterial({color:Y,roughness:.91,flatShading:true}));
 roof.name='silo-functional-cone-roof';roof.position.y=height+1.25;
 roof.userData.visualOnly=true;g.add(roof);
 cylinder(g,'silo-roof-vent',.39,.74,0,height+2.81,0,D,'y',8);
 b(g,'silo-service-hatch',1.29,1.95,.20,0,1.11,3.88,I);
 for(const xx of [-.42,.42])
  f(g,'silo-service-ladder-rail',[xx,.30,4.08],
    [xx,height-.65,4.08],.12,S);
 for(let y=.60;y<height-1.0;y+=1.68)
  f(g,'silo-sparse-ladder-rung',[-.43,y,4.11],[.43,y,4.11],.10,Y);
 // Actual gravity grain feed and output elbow mounted against vessel.
 f(g,'silo-horizontal-discharge-pipe',[2.81,3.02,-1.05],
  [5.58,3.02,-1.05],.37,I);
 f(g,'silo-downspout',[5.58,3.02,-1.05],
  [5.58,.87,-1.05],.33,I);
 b(g,'silo-grain-valve-box',1.03,.75,.79,5.58,.73,-1.05,R);
 return g;
}
function powerPole(root,x,z,i){
 const g=new THREE.Group();g.name='secondary-power-pole-'+i;
 g.position.set(x,0,z);root.add(g);
 cylinder(g,'power-heavy-timber-upright',.27,11.95,0,5.97,0,W,'y',9);
 for(const y of [8.70,10.72]){
  b(g,'power-broad-crossarm',4.82,.32,.37,0,y,0,I);
  f(g,'power-diagonal-knee-brace',[-1.58,y-.88,0],
    [-1.58,y,0],.16,R);
  for(const xx of [-1.66,0,1.66]){
   cylinder(g,'power-ceramic-insulator',.25,.45,xx,y+.37,0,C.cream,'y',8);
   cylinder(g,'power-wire-terminal',.10,.18,xx,y+.68,0,D,'y',6);
  }
 }
 b(g,'power-transformer-tank',.91,1.18,.69,.71,7.27,.44,S);
 cylinder(g,'power-transformer-terminal',.16,.29,.48,8.00,.44,I,'y',8);
 f(g,'power-transformer-brace',[.85,6.60,.22],[0,6.96,0],.16,R);
 return g;
}
function steelGate(root,z,large){
 const g=new THREE.Group();
 g.name=large?'secondary-hog-pen-entry-gantry':'secondary-derby-gate';
 g.position.z=z;root.add(g);
 const half=large?10.30:4.60,top=large?8.50:5.48;
 for(const side of [-1,1]){
  const x=side*half;
  b(g,'gate-heavy-angled-foot',.95,.43,.93,x,.22,0,I);
  f(g,'gate-heavy-outer-post',[x,.32,0],[x,top,0],
    large?.31:.24,R);
  f(g,'gate-braced-inside-knee',[x,.70,.13],
    [x-side*.76,top*.56,.13],.17,I);
  b(g,'gate-bolted-corner-gusset',.59,.50,.28,
    x-side*.35,top-.18,0,Y);
 }
 f(g,'gate-main-crossbeam',[-half,top,0],[half,top,0],large?.32:.27,I);
 const members=large?8:4;
 for(let i=0;i<members;i++){
  const x=-half+(i+.5)*2*half/members;
  f(g,'gate-diagonal-truss',[x,top-.30,0],
   [x+(i%2?.58:-.58),top+.39,0],.15,R);
 }
 f(g,'gate-upper-rail',[-half+.31,top+.55,0],
   [half-.31,top+.55,0],.16,S);
 return g;
}
export function upgradeBacklotSecondaryProps(root,w){
 const obsolete=new Set([
  'outside-scrap-trailer','outside-trailer-tyre',
  'shack-body','shack-sheet-roof','shack-door','shack-exhaust','yard-fuel-can',
  'farm-grain-silo','silo-corrosion-band','farm-silo-conical-crown',
  'distant-power-pole','crossbeam-insulator','power-ceramic-cap',
  'entry-gate-column','entry-gate-crossbar',
  'hog-pen-entrance-pylon','hog-pen-warning-cap','hog-pen-scorebridge-girder',
 ]);
 const removed=dropOld(root,obsolete);
 const extent=Math.max(Math.abs(w.minX),Math.abs(w.maxX))+7;
 for(const side of [-1,1])
  for(let i=0;i<4;i++)
   trailer(root,side*extent,-19+i*13,i%2?'salvage-flatbed':'farm-wagon',i,side);
 serviceShack(root,w.minX-11,14,false);
 serviceShack(root,w.maxX+11,14,true);
 for(const [i,[x,z,h]] of [[-86,-39,19],[76,-48,23],[82,39,15]].entries())
  grainSilo(root,x,z,h,i);
 for(const [i,[x,z]] of [[-48,-62],[43,-65],[60,69]].entries())
  powerPole(root,x,z,i);
 steelGate(root,w.maxZ+5.5,false);
 steelGate(root,w.minZ-4.65,true);
 const result=Object.freeze({removed,trailers:8,shacks:2,silos:3,poles:3,gates:2,
  addedAssemblies:18,visualOnly:true});
 root.userData.secondaryBacklotAnatomy=result;
 return result;
}
