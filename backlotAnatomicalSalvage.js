/** k.5r.5 chunky silhouette pass: distinct structural salvage assemblies for Backlot gallery.
 * These are genuine component models, not facade details on certified AABBs.
 * Battlefield integration requires a separate collision-coverage pass.
 */
import * as THREE from 'three';
import {block,cylinder,ring,beam,profile,wheel,rustPanel,TRIM_COLORS as C}
 from './propAnatomyPrimitives.js';
const {iron:I,steel:S,rust:R,paint:P,yellow:Y,soot:D}=C;
const b=(g,n,w,h,d,x,y,z,c=I)=>block(g,n,w,h,d,x,y,z,c,.27);
const f=(g,n,a,e,r=.12,c=S)=>beam(g,n,a,e,r,c,7);
function shell(root,name){
 const g=new THREE.Group();g.name=name;root.add(g);return g;
}
export function buildAnatomicalGenerator(root){
 const g=shell(root,'RUSTED GENERATOR · EXPOSED POWERTRAIN');
 for(const s of [-1,1]){
  f(g,'generator-rail',[s*.83,.20,-1.58],[s*.83,.20,1.62],.21,I);
  for(const z of [-1.18,1.22])b(g,'generator-ground-mount',.50,.28,.63,s*.82,.18,z,D);
 }
 b(g,'diesel-engine-crankcase',1.66,1.11,1.48,0,.91,-.73,I);
 for(let i=0;i<3;i++){
  const z=-1.14+i*.45;
  cylinder(g,'diesel-generator-head',.31,.38,-.20,1.55,z,C.clay,'y',9);
  b(g,'head-cooling-fin',1.04,.12,.30,0,1.64,z,S);
 }
 cylinder(g,'dynamo-rotor-core',.79,1.34,0,.98,.61,C.clay,'z',12);
 for(let i=0;i<5;i++)b(g,'alternator-cooling-rib',1.69,.15,.16,
   0,.98+Math.sin(i*.95)*.63,.17+i*.21,S);
 for(const z of [.13,1.15])ring(g,'generator-rotor-housing',
   .72,.16,0,.98,z,R,'z',12);
 f(g,'coupling-shaft',[0,.98,-.11],[0,.98,.24],.22,S);
 cylinder(g,'generator-flywheel',.48,.21,0,1.0,-.10,I,'z',11);
 b(g,'starter-battery-tray',.86,.23,.64,-1.12,.55,1.02,D);
 b(g,'battery-body',.66,.46,.46,-1.11,.81,1.02,C.olive);
 f(g,'vertical-exhaust-stack',[.55,1.30,-1.08],[.56,2.28,-1.08],.18,D);
 cylinder(g,'exhaust-weather-cap',.20,.05,.56,2.31,-1.08,S,'y',8);
 for(const s of [-1,1])f(g,'lifting-frame',
   [s*.80,.34,-1.43],[s*.86,1.98,-1.43],.14,R);
 for(const s of [-1,1])f(g,'lifting-roof-rail',
   [s*.86,1.98,-1.43],[s*.86,1.98,1.36],.13,R);
 b(g,'fallen-inspection-panel',1.05,.13,1.44,1.11,.11,.45,Y).rotation.z=.17;
 return g;
}
export function buildAnatomicalTurbine(root){
 const g=shell(root,'DISCARDED INDUSTRIAL TURBINE · HOLLOW VOLUTE');
 // A genuinely open center: the impeller is visible through the ring.
 for(const z of [-.48,.48])ring(g,'split-heavy-cast-housing',
   1.25,.32,0,1.42,z,I,'z',16);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3;
  f(g,'radial-housing-rib',
   [Math.cos(a)*1.08,1.42+Math.sin(a)*1.08,-.54],
   [Math.cos(a)*1.08,1.42+Math.sin(a)*1.08,.56],.13,C.clay);
 }
 cylinder(g,'impeller-shaft',.27,1.67,0,1.42,.12,S,'z',12);
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5;
  const blade=b(g,'curved-impeller-vane',.34,.84,.19,
    Math.cos(a)*.52,1.42+Math.sin(a)*.52,.69,S);
  blade.rotation.z=-a+.26;
 }
 ring(g,'center-bearing-ring',.39,.17,0,1.42,.75,R,'z',12);
 for(const s of [-1,1]){
  b(g,'turbine-base-foot',.55,.34,.94,s*.78,.21,0,D);
  f(g,'turbine-angled-mount',[s*.81,.33,0],
   [s*.76,1.02,0],.22,I);
 }
 f(g,'severed-pressure-pipe',[.93,2.05,.12],[1.62,2.56,.30],.29,R);
 ring(g,'flanged-disconnect',.39,.15,1.67,2.58,.30,S,'x',10);
 return g;
}
/** Three hollow, thick agricultural tyres in a grounded, asymmetrical
 * pile. Two are stacked flat and the third is propped at a lean.
 * No shaft, hub, wheel disk, or tall presentation rack.
 */
export function buildAnatomicalTyreStack(root){
 const g=shell(root,'GROUNDED THREE-TYRE AGRICULTURAL SCRAP PILE');
 const placement=[
  {x:-.63,y:.42,z:-.11,tilt:0,r:.81},
  {x:-.60,y:.88,z:-.05,tilt:.06,r:.81},
  {x:.95,y:.83,z:.16,tilt:.84,r:.88},
 ];
 for(let i=0;i<placement.length;i++){
  const {x,y,z,tilt,r}=placement[i];
  const tyre=new THREE.Group();
  tyre.name='individual-grounded-tractor-tyre-'+(i+1);
  tyre.position.set(x,y,z);
  tyre.rotation.z=tilt;
  g.add(tyre);
  // Rings are truly hollow. Two thick sidewalls bridge tread blocks,
  // with an exposed inner bead rather than a solid hub or axle.
  for(const side of [-1,1]){
   ring(tyre,'real-open-tyre-sidewall',r*.79,r*.255,
    0,side*.15,0,C.rubber,'y',12);
   ring(tyre,'open-rubber-tyre-inner-bead',r*.43,.10,
    0,side*.18,0,D,'y',12);
  }
  for(let k=0;k<8;k++){
   const a=k*Math.PI/4;
   const tread=b(tyre,'broad-circumferential-tyre-lug',
    .42,.38,.36,Math.cos(a)*r,0,Math.sin(a)*r,D);
   tread.rotation.y=-a;
  }
 }
 b(g,'abandoned-chock-block',.38,.24,.52,1.65,.13,-.25,R)
  .rotation.y=-.21;
 return g;
}
export function buildAnatomicalDrums(root){
 const g=shell(root,'RUSTED OIL DRUMS · PALLET');
 for(const s of [-1,1]){
  f(g,'pallet-lumber-stringer',[s*.82,.14,-1.12],[s*.82,.14,1.10],.20,C.clay);
  // Wide cross-planks are placed once across the shared skid, below.
 }
 for(const z of [-.78,0,.78])b(g,'pallet-top-board',2.18,.17,.56,0,.28,z,C.cream);
 let n=0;
 for(const x of [-.59,.58])for(const z of [-.56,.52]){
  const y=.96,c=[C.rust,C.olive,C.yellow,P][n++];
  cylinder(g,'barrel-curved-wall',.46,1.24,x,y,z,c,'y',12);
  for(const a of [-1,1])ring(g,'rolled-barrel-stiffening-rim',
   .45,.085,x,y+a*.42,z,I,'y',12);
  cylinder(g,'recessed-barrel-top',.38,.06,x,1.54,z,D,'y',12);
  cylinder(g,'threaded-barrel-bung',.073,.07,x+.22,1.59,z-.18,S,'y',8);
 }
 b(g,'fallen-dented-barrel-lid',.85,.11,.82,1.29,.10,.74,S).rotation.z=.16;
 return g;
}
export function buildAnatomicalFlatbed(root){
 const g=shell(root,'WRECKED FLATBED TRAILER · SALVAGE LOAD');
 for(const s of [-1,1]){
  f(g,'open-trailer-frame-rail',[s*.95,.75,-3.05],[s*.95,.75,3.04],.24,I);
  for(const z of [-2.10,1.55])wheel(g,'trailer-road-wheel',
    s*1.13,.62,z,{radius:.68,width:.39,hub:.19,treadCount:7,
      rubber:C.rubber,rimColor:C.clay});
 }
 for(let z=-2.28;z<2.80;z+=1.15)
  b(g,'individual-flatbed-wood-plank',2.52,.19,1.03,0,1.06,z,C.clay);
 for(const s of [-1,1])for(const z of [-2.25,.13,2.48]){
  f(g,'stake-pocket-post',[s*1.15,1.09,z],[s*1.17,1.96,z],.14,R);
 }
 f(g,'trailer-a-frame-drawbar',[-.90,.69,2.91],[0,.66,3.92],.22,S);
 f(g,'trailer-a-frame-drawbar',[.90,.69,2.91],[0,.66,3.92],.15,S);
 // Scrap cargo is coherent dismantled machinery, not a welded cube.
 for(const zz of [-1.51,1.24]){
  ring(g,'salvaged-gear-rim',.81,.21,0,1.87,zz,I,'z',11);
  cylinder(g,'salvaged-wheel-hub',.30,.23,0,1.87,zz,S,'z',10);
 }
 for(let i=0;i<2;i++){
  const x=-.71+i*1.42,z=(i?-.80:.55);
  f(g,'scattered-girders',[x,1.29,z-1.06],[x+.12,1.87,z+.80],.19,i%2?R:S);
 }
 b(g,'bent-industrial-sheet',2.05,.17,1.42,-.50,2.05,-.18,Y)
  .rotation.z=-.15;
 return g;
}
export function buildAnatomicalScrapWall(root){
 const g=shell(root,'WELDED RURAL SCRAP BARRICADE');
 const plates=[
  [-1.94,1.52,1.25,R],[-.67,1.94,1.43,I],
  [.79,1.73,1.47,C.olive],[2.05,1.35,1.29,P]
 ];
 for(const [x,h,w,color]of plates){
  const p=b(g,'salvaged-vehicle-body-panel',w,h,.22,x,h*.5,0,color);
  p.rotation.z=Math.sin(x*3)*.09;
 }
 for(const s of [-1,1]){
  f(g,'welded-barrier-support-foot',[s*2.22,.17,-.65],
   [s*2.22,.17,.78],.23,I);
  f(g,'welded-barrier-upright',[s*2.22,.13,0],[s*2.22,1.64,0],.20,S);
 }
 f(g,'continuous-lower-cross-brace',[-2.28,.41,-.15],
   [2.22,.41,-.15],.17,D);
 f(g,'overlapping-steel-diagonal',[-1.98,.20,-.22],
   [.94,1.75,-.22],.18,S);
 ring(g,'reused-wheel-sidewall',.72,.21,-.71,.76,-.25,C.rubber,'z',10);
 cylinder(g,'wheel-center-bearing',.29,.17,-.71,.76,-.35,S,'z',9);
 // Welds read through slab overlap and material contrast; no tiny beads.
 return g;
}
export function buildAnatomicalContainer(root){
 const g=shell(root,'CRUSHED ISO SHIPPING CONTAINER');
 // Actual corrugated shell: four open-sided panels close in a hollow tube.
 for(const s of [-1,1]){
  b(g,'container-long-corrugated-sheet',.16,2.37,5.70,s*1.24,1.38,0,C.olive);
  for(let i=0;i<7;i++){
   const z=-2.49+i*.83;
   b(g,'individual-corrugated-pressed-rib',.20,2.27,.17,
    s*1.29,1.38,z,i%4===0?R:C.olive);
  }
  for(const z of [-2.9,2.9]){
   b(g,'corner-stacking-post',.34,2.69,.34,s*1.27,1.36,z,I);
  }
  f(g,'corner-upper-longitudinal-rail',[s*1.25,2.72,-2.93],
    [s*1.25,2.72,2.93],.18,S);
  f(g,'corner-lower-longitudinal-rail',[s*1.25,.15,-2.93],
    [s*1.25,.15,2.93],.18,S);
 }
 for(let i=0;i<3;i++){
  const z=-1.94+i*1.95;
  b(g,'seamed-roof-panel',2.45,.15,1.89,0,2.73,z,C.clay);
  b(g,'container-reinforced-floor',2.45,.15,1.89,0,.13,z,I);
 }
 // Door end is visibly hinged; one leaf twisted outward.
 b(g,'intact-container-door',1.16,2.40,.18,-.61,1.37,2.96,P);
 const door=b(g,'buckled-open-container-door',1.16,2.40,.18,.64,1.37,2.96,R);
 door.rotation.y=-.36;
 for(const x of [-.91,.88])f(g,'vertical-locking-bar',
   [x,.30,3.02],[x,2.49,3.02],.13,S);
 return g;
}
export function buildAnatomicalConcrete(root){
 const g=shell(root,'SCRAPYARD CAST CONCRETE ROAD BLOCKS');
 for(let j=0;j<3;j++){
  const x=(j-1)*1.75,tilt=j===1?.07:0;
  const piece=profile(g,'solid-sloped-jersey-profile',
   [[-.42,.05],[-.56,.40],[-.29,.77],[-.20,1.28],
   [.20,1.28],[.29,.77],[.56,.40],[.42,.05]],1.60,x,
   j===1?C.cream:C.clay,.02);
  piece.rotation.z=tilt;
  b(g,'cast-orange-warning-stripe',1.37,.19,.075,x,.97,-.39,Y);
  if(j===1)b(g,'chipped-exposed-rebar',.17,.34,.14,x+.59,1.19,-.13,S)
    .rotation.z=.10;
 }
 return g;
}
export const SALVAGE_EXHIBITS=Object.freeze([
 {id:'generator',label:'GENERATOR · CHUNK V4',details:'OPEN ALTERNATOR · ENGINE · EXHAUST',
  match:o=>o.artKit==='generator-unit',build:buildAnatomicalGenerator},
 {id:'turbine',label:'TURBINE HOUSING · CHUNK V4',details:'HOLLOW VOLUTE · IMPELLER · SHAFT',
  match:o=>o.artKit==='turbine-housing',build:buildAnatomicalTurbine},
 {id:'tyres',label:'TYRE STACK · SOLID V5',details:'THREE GROUNDED HOLLOW TYRES · NO RACK',
  match:o=>o.artKit==='tire-stack',build:buildAnatomicalTyreStack},
 {id:'barrels',label:'OIL DRUM PALLET · CHUNK V4',details:'CURVED BARRELS · ROLLED RIMS · PALLET',
  match:o=>o.artKit==='barrel-cluster',build:buildAnatomicalDrums},
 {id:'flatbed',label:'FLATBED TRAILER · CHUNK V4',details:'RAILS · SUSPENSION · ACTUAL SCRAP LOAD',
  match:o=>o.artKit==='flatbed-fragment',build:buildAnatomicalFlatbed},
 {id:'barricade',label:'WELDED SCRAP WALL · CHUNK V4',details:'IRREGULAR WELDED PANELS · BRACING',
  match:o=>o.artKit==='scrap-barricade',build:buildAnatomicalScrapWall},
 {id:'container',label:'SHIPPING CONTAINER · CHUNK V4',details:'HOLLOW CORRUGATED FRAME · HINGED DOORS',
  match:o=>o.artKit==='shipping-container',build:buildAnatomicalContainer},
 {id:'concrete',label:'CONCRETE BARRIER · CHUNK V4',details:'TRUE CAST SLOPES · CHIPPED REBAR',
  match:o=>o.artKit==='concrete-barrier',build:buildAnatomicalConcrete},
]);
