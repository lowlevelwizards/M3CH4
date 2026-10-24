/** Backlot k.5r.4 — production-safe spectator & farmyard anatomy.
 * Everything here is OUTSIDE gameplay: scenery only, never weapon/AI cover.
 * Replaces anonymous box structures with connected timber/steel assemblies.
 */
import * as THREE from 'three';
import {block,cylinder,ring,beam,profile,TRIM_COLORS as C}
 from './propAnatomyPrimitives.js';
const I=C.iron,S=C.steel,R=C.rust,Y=C.yellow,W=C.clay,D=C.soot;
const b=(g,n,w,h,d,x,y,z,c=I)=>block(g,n,w,h,d,x,y,z,c,.23);
const f=(g,n,a,e,r=.09,c=I)=>beam(g,n,a,e,r,c,7);
function removeNamed(root,names){
 const dead=[];
 root.traverse(o=>{if(names.has(o.name))dead.push(o);});
 for(const o of dead)o.parent?.remove(o);
 return dead.length;
}
function barn(root,x,z,w,h,d,i){
 const g=new THREE.Group();g.name='anatomical-farm-barn-'+i;
 g.position.set(x,0,z);root.add(g);
 // Rectangular occupied barn, but a real gabled roof, distinct portal,
 // structural corner posts and planked end walls.
 b(g,'barn-worn-wood-body',w,h,d,0,h*.5,0,i%2?C.clay:R);
 profile(g,'actual-sloping-barn-roof',
   [[-d*.56,h-.14],[0,h+2.5],[d*.56,h-.14]],w+1,0,I);
 for(const s of [-1,1]){
  for(const xx of [-w*.46,w*.46])
   f(g,'barn-upright-corner',[xx,.10,s*d*.49],
     [xx,h-.22,s*d*.49],.13,C.clay);
  f(g,'barn-eave-beam',[-w*.51,h-.12,s*d*.50],
    [w*.51,h-.12,s*d*.50],.12,S);
 }
 // Door physically reads as a sliding pair and crossbuck, not a sticker.
 for(const s of [-1,1]){
  const door=b(g,'suspended-sliding-barn-door',
    w*.19,h*.60,.11,s*w*.12,h*.30,d*.51,C.clay);
  door.rotation.y=s*.065;
  f(g,'door-x-crossbuck',[s*w*.12-w*.08,.19,d*.59],
   [s*w*.12+w*.08,h*.57,d*.59],.07,I);
 }
 f(g,'barn-upper-track',[-w*.28,h*.63,d*.56],
   [w*.28,h*.63,d*.56],.10,S);
 // Tiny distant roof vent omitted: three unique torus draws with negligible
 // contribution at actual first-person combat distance.
 // Keep broad gabled geometry and the sliding door, but omit tiny
 // roof seam rails: on iPhone they cost one draw batch per distant barn.
 return g;
}
function bleachers(root,cx,z){
 const g=new THREE.Group();g.name='structural-bleachers';
 g.position.set(cx,0,z);root.add(g);
 for(let tier=0;tier<4;tier++){
  const bz=-tier*1.09,y=1.04+tier*.70;
  b(g,'individual-wooden-bleacher-bench',10.8,.13,.92,0,y,bz,W);
  b(g,'bleacher-narrow-footwell',10.6,.16,.42,0,y-.42,bz+.60,I);
  for(const xx of [-4.72,0,4.72]){
   f(g,'bleacher-leg-to-ground',[xx,.10,bz-.42],[xx,y-.06,bz-.42],.15,S);
   f(g,'diagonal-stadium-raker',[xx,.13,bz+.48],
      [xx,y-.11,bz-.42],.16,R);
  }
 }
 for(const side of [-1,1]){
  f(g,'bleacher-side-hand-rail',[side*5.30,.58,.55],
   [side*5.30,4.03,-3.52],.11,I);
  for(const tier of [0,2])f(g,'bleacher-guard-upright',
   [side*5.27,.46+tier*.70,-tier*1.09],
   [side*5.27,1.62+tier*.70,-tier*1.09],.06,S);
 }
 // Canvas awning has two separate visibly angled sections.
 for(const side of [-1,1]){
  const roof=b(g,'seamed-faded-canvas-canopy',5.91,.11,4.96,
   side*3.04,5.02,-3.10,side===1?Y:C.clay);
  roof.rotation.x=side*.065;
 }
 for(const xx of [-5.42,5.42]){
  f(g,'canopy-pole',[xx,.19,-2.04],[xx,5.07,-2.04],.11,I);
  f(g,'canopy-wire-guy',[xx,5.04,-2.03],[xx*.91,.30,-5.57],.042,S);
 }
 return g;
}
function announcer(root,z){
 const g=new THREE.Group();g.name='anatomical-announcer-booth';
 g.position.z=z;root.add(g);
 for(const xx of [-4.41,0,4.41])for(const zz of [-2.22,2.22]){
  f(g,'real-scaffold-upright',[xx,.14,zz],[xx,4.23,zz],.14,I);
  f(g,'scaffold-cross-brace',[xx,.20,zz],
    [xx+(xx<0?.7:-.7),3.70,-zz],.065,R);
 }
 b(g,'raised-booth-plank-deck',10.16,.23,5.48,0,3.82,0,W);
 for(let i=0;i<11;i++)
  b(g,'individual-platform-decking',.79,.035,5.34,-4.6+i*.91,3.98,0,
    i%3?W:C.cream);
 // The lower wall is solid, upper level is ACTUALLY open.
 for(const side of [-1,1]){
  b(g,'station-low-side-cladding',.13,1.21,3.77,side*4.29,4.76,0,R);
  for(const zz of [-1.80,1.80])
   f(g,'announcer-upper-wall-upright',[side*4.27,5.31,zz],
      [side*4.27,7.34,zz],.095,S);
 }
 b(g,'announcer-low-front-wall',8.35,1.14,.13,0,4.76,1.91,R);
 b(g,'announcer-low-rear-wall',8.37,1.58,.14,0,4.99,-1.91,W);
 for(const xx of [-4.19,0,4.19]){
  f(g,'real-booth-window-mullion',[xx,5.32,1.90],
    [xx,7.29,1.90],.13,I);
 }
 for(const z0 of [-1.97,1.95])
  f(g,'station-roof-sill',[-4.39,7.29,z0],
    [4.39,7.29,z0],.12,S);
 for(const s of [-1,1]){
  const roof=b(g,'patched-station-roof-panel',5.05,.13,4.89,
    s*2.55,7.59,0,s===1?I:C.clay);
  roof.rotation.z=s*.055;
 }
 b(g,'announcer-desk',3.65,.20,.82,0,4.84,1.28,I);
 b(g,'announcer-control-radio',.62,.34,.35,-.90,5.12,1.20,D);
 cylinder(g,'speaker-horn-flare',.26,.52,3.38,7.35,1.78,I,'z',9);
 f(g,'speaker-support',[3.37,7.20,1.60],[3.37,7.35,1.89],.07,S);
 // External access ladder from rear: real rails and rungs.
 for(const xx of [-3.87,-3.26])
  f(g,'rear-booth-service-ladder-rail',[xx,.25,-2.78],
    [xx,4.12,-2.07],.06,S);
 for(let i=0;i<9;i++)
  f(g,'rear-ladder-rung',[-3.89,.38+i*.42,-2.76+i*.079],
    [-3.24,.38+i*.42,-2.76+i*.079],.048,I);
 return g;
}
function crane(root,x,z){
 const g=new THREE.Group();g.name='functional-scrapyard-crane';
 g.position.set(x,0,z);root.add(g);
 // Rigid ground foot, triangulated upright, cantilever arm, hoist gear.
 for(const xx of [-.63,.63]){
  f(g,'crane-mast-leg',[xx,.11,-.69],[xx,13.77,-.40],.23,I);
  f(g,'crane-mast-leg',[xx,.11,.69],[xx,13.77,.40],.23,I);
 }
 for(let y=1.4;y<13.5;y+=1.45){
  f(g,'steel-lattice-vertical-tie',[-.63,y,-.52],[.63,y,.52],.10,R);
  f(g,'steel-lattice-diagonal',[0,y,-.48],[0,y+1.40,.48],.083,S);
 }
 for(const zz of [-.45,.45]){
  f(g,'crane-horizontal-jib',[0,13.75,zz],[12.9,13.75,zz],.19,R);
  for(let i=0;i<5;i++){
   const xx=i*2.4;
   f(g,'jib-truss-angled-brace',[xx,13.74,zz],
     [xx+1.20,14.64,zz],.13,I);
   f(g,'jib-truss-return-brace',[xx+1.20,14.64,zz],
     [xx+2.40,13.74,zz],.13,I);
  }
 }
 f(g,'crane-gantry-tie',[0,14.55,0],[12.91,14.55,0],.07,S);
 f(g,'crane-diagonal-tension',[0,10.16,0],
   [9.12,14.48,0],.115,Y);
 cylinder(g,'crane-winch-drum',.47,.93,1.34,11.11,0,S,'x',11);
 ring(g,'winch-heavy-gear',.45,.08,1.87,11.11,0,R,'x',10);
 cylinder(g,'trolley-roller',.25,.74,12.51,13.54,0,I,'z',9);
 f(g,'vertical-hoist-cable',[12.48,13.52,0],
   [12.48,7.98,0],.045,D);
 ring(g,'lifting-hook-curve',.39,.09,12.48,7.79,0,S,'z',9);
 cylinder(g,'hook-swivel-bearing',.18,.24,12.48,8.16,0,Y,'y',8);
 b(g,'bolted-anchor-block',1.82,.30,1.62,0,.16,0,R);
 return g;
}
function scoreboard(root,w){
 const x=w.maxX+12,z=-5;
 const g=new THREE.Group();g.name='steel-frame-derby-scoreboard';
 g.position.set(x,0,z);root.add(g);
 for(const zz of [-5,5]){
  // The heavy scoreboard frame and mast ribs establish its silhouette.
  for(let yy=3;yy<11;yy+=1.7)
   f(g,'scoreboard-mast-cross-rib',[-.54,yy,zz],
     [.54,yy,zz],.095,R);
 }
 // Existing textured digits retained; frame is made legible from a distance.
 for(const yy of [6.61,11.40])
  f(g,'scoreboard-header-lintel',[-.41,yy,-5.91],
    [-.41,yy,5.91],.16,R);
 for(const zz of [-5.91,5.91])
  f(g,'scoreboard-outer-upright',[-.41,6.56,zz],
    [-.41,11.45,zz],.14,R);
 return g;
}
export function upgradeBacklotScenery(root,world){
 // Operates on exactly the render graph, never map obstacles/certified solids.
 const obsolete=new Set([
  'distant-farm-barn','barn-steel-roof','barn-sagging-door',
  'spectator-bleacher','bleacher-support','patched-awning','awning-post',
  'announcer-platform','announcer-scaffold-post','announcer-station',
  'announcer-corrugated-roof','announcer-open-window','booth-window-batten',
  'scrapyard-hoist-mast','scrapyard-hoist-jib','hoist-cable','hoist-hook',
 ]);
 const removed=removeNamed(root,obsolete);
 for(const [i,[x,z,w,h,d]] of [[-69,-66,16,10,12],
  [67,-70,12,8,10],[-65,57,10,7,10]].entries())barn(root,x,z,w,h,d,i);
 for(const x of [world.minX+11,world.maxX-11])
  bleachers(root,x,world.minZ-3.25);
 announcer(root,world.minZ-10.5);
 crane(root,world.minX-19,-10);
 scoreboard(root,world);
 root.userData.backlotAnatomicalScenery={removed,
  barns:3,bleachers:2,announcer:1,crane:1,scoreboard:1,visualOnly:true};
 return root.userData.backlotAnatomicalScenery;
}
