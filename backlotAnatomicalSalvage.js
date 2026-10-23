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
export function buildAnatomicalTyreStack(root){
 const g=shell(root,'DISCARDED AGRICULTURAL TYRE STACK');
 for(let i=0;i<3;i++){
  const x=(i-1)*1.42,n=1;
  for(let j=0;j<n;j++){
   const radius=i===1?.91:.77;
   const yy=radius*.27+.14+(i===1?.18:0),dx=i===1?.08:0;
   ring(g,'real-open-tyre-sidewall',radius*.80,radius*.28,
     x+dx,yy,0,C.rubber,'y',12);
   ring(g,'tyre-inner-bead',radius*.35,.14,
     x+dx,yy+.08,0,I,'y',12);
   // Radial lugged tread, not a black disc with a painted hole.
   for(let k=0;k<7;k++){
    const a=k*Math.PI*2/7;
    const p=b(g,'agricultural-rubber-lug',.35,.25,.41,
      x+dx+Math.cos(a)*radius,yy,Math.sin(a)*radius,D);
    p.rotation.y=-a;
   }
  }
 }
 for(const s of [-1,1])f(g,'old-rack-upright',
   [s*2.24,.12,-.84],[s*2.24,1.86,-.84],.16,R);
 f(g,'old-rack-beam',[-2.21,.16,-.84],[2.21,.16,-.84],.20,S);
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
  f(g,'open-trailer-frame-rail',[s*.95,.75,-3.05],[s*.95,.75,3.04],.16,I);
  for(const z of [-2.10,1.55])wheel(g,'trailer-road-wheel',
    s*1.13,.62,z,{radius:.59,width:.27,hub:.13,treadCount:9,
      rubber:C.rubber,rimColor:C.clay});
 }
 for(let z=-2.50;z<2.80;z+=.52)
  b(g,'individual-flatbed-wood-plank',2.38,.105,.44,0,1.06,z,C.clay);
 for(const s of [-1,1])for(let z=-2.43;z<2.8;z+=1.08){
  f(g,'stake-pocket-post',[s*1.15,1.09,z],[s*1.17,1.96,z],.075,R);
 }
 f(g,'trailer-a-frame-drawbar',[-.90,.69,2.91],[0,.66,3.92],.15,S);
 f(g,'trailer-a-frame-drawbar',[.90,.69,2.91],[0,.66,3.92],.15,S);
 // Scrap cargo is coherent dismantled machinery, not a welded cube.
 for(const zz of [-1.51,1.24]){
  ring(g,'salvaged-gear-rim',.64,.14,0,1.87,zz,I,'z',11);
  cylinder(g,'salvaged-wheel-hub',.23,.16,0,1.87,zz,S,'z',10);
 }
 for(let i=0;i<5;i++){
  const x=-.87+i*.39,z=(i%2?-.80:.55);
  f(g,'scattered-girders',[x,1.29,z-1.06],[x+.12,1.87,z+.80],.11,i%2?R:S);
 }
 b(g,'bent-industrial-sheet',1.56,.065,1.05,-.50,2.05,-.18,Y)
  .rotation.z=-.15;
 return g;
}
export function buildAnatomicalScrapWall(root){
 const g=shell(root,'WELDED RURAL SCRAP BARRICADE');
 const plates=[
  [-2.33,1.13,.89,R],[-1.34,1.70,1.07,I],
  [-.18,1.45,.95,C.olive],[.86,1.86,.90,P],[1.91,1.33,1.08,C.clay]
 ];
 for(const [x,h,w,color]of plates){
  const p=b(g,'salvaged-vehicle-body-panel',w,h,.11,x,h*.5,0,color);
  p.rotation.z=Math.sin(x*3)*.09;
 }
 for(const s of [-1,1]){
  f(g,'welded-barrier-support-foot',[s*2.22,.17,-.65],
   [s*2.22,.17,.78],.15,I);
  f(g,'welded-barrier-upright',[s*2.22,.13,0],[s*2.22,1.64,0],.13,S);
 }
 f(g,'continuous-lower-cross-brace',[-2.28,.41,-.15],
   [2.22,.41,-.15],.10,D);
 f(g,'overlapping-steel-diagonal',[-1.98,.20,-.22],
   [.94,1.75,-.22],.11,S);
 ring(g,'reused-wheel-sidewall',.62,.14,-.71,.76,-.25,C.rubber,'z',10);
 cylinder(g,'wheel-center-bearing',.19,.11,-.71,.76,-.35,S,'z',9);
 for(let i=0;i<10;i++)cylinder(g,'individual-weld-head',.047,.06,
    -2.0+i*.43,.33+(i%3)*.27,-.22,C.cream,'z',6);
 return g;
}
export function buildAnatomicalContainer(root){
 const g=shell(root,'CRUSHED ISO SHIPPING CONTAINER');
 // Actual corrugated shell: four open-sided panels close in a hollow tube.
 for(const s of [-1,1]){
  b(g,'container-long-corrugated-sheet',.08,2.30,5.70,s*1.24,1.38,0,C.olive);
  for(let i=0;i<15;i++){
   const z=-2.63+i*.37;
   b(g,'individual-corrugated-pressed-rib',.12,2.20,.09,
    s*1.29,1.38,z,i%4===0?R:C.olive);
  }
  for(const z of [-2.9,2.9]){
   b(g,'corner-stacking-post',.23,2.67,.23,s*1.27,1.36,z,I);
  }
  f(g,'corner-upper-longitudinal-rail',[s*1.25,2.72,-2.93],
    [s*1.25,2.72,2.93],.105,S);
  f(g,'corner-lower-longitudinal-rail',[s*1.25,.15,-2.93],
    [s*1.25,.15,2.93],.105,S);
 }
 for(let i=0;i<8;i++){
  const z=-2.60+i*.74;
  b(g,'seamed-roof-panel',2.44,.065,.65,0,2.71,z,C.clay);
  b(g,'container-reinforced-floor',2.43,.07,.65,0,.13,z,I);
 }
 // Door end is visibly hinged; one leaf twisted outward.
 b(g,'intact-container-door',1.16,2.40,.075,-.61,1.37,2.96,P);
 const door=b(g,'buckled-open-container-door',1.16,2.40,.075,.64,1.37,2.96,R);
 door.rotation.y=-.36;
 for(const x of [-.91,.88])f(g,'vertical-locking-bar',
   [x,.30,3.02],[x,2.49,3.02],.067,S);
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
  b(g,'cast-orange-warning-stripe',1.37,.09,.045,x,.97,-.39,Y);
  b(g,'chipped-exposed-rebar',.09,.37,.065,x+.59,1.19,-.13,S)
    .rotation.z=.10;
 }
 return g;
}
export const SALVAGE_EXHIBITS=Object.freeze([
 {id:'generator',label:'GENERATOR · ANATOMY V3',details:'OPEN ALTERNATOR · ENGINE · EXHAUST',
  match:o=>o.artKit==='generator-unit',build:buildAnatomicalGenerator},
 {id:'turbine',label:'TURBINE HOUSING · ANATOMY V3',details:'HOLLOW VOLUTE · IMPELLER · SHAFT',
  match:o=>o.artKit==='turbine-housing',build:buildAnatomicalTurbine},
 {id:'tyres',label:'TYRE STACK · ANATOMY V3',details:'OPEN SIDEWALLS · BEADS · LUGS',
  match:o=>o.artKit==='tire-stack',build:buildAnatomicalTyreStack},
 {id:'barrels',label:'OIL DRUM PALLET · ANATOMY V3',details:'CURVED BARRELS · ROLLED RIMS · PALLET',
  match:o=>o.artKit==='barrel-cluster',build:buildAnatomicalDrums},
 {id:'flatbed',label:'FLATBED TRAILER · ANATOMY V3',details:'RAILS · SUSPENSION · ACTUAL SCRAP LOAD',
  match:o=>o.artKit==='flatbed-fragment',build:buildAnatomicalFlatbed},
 {id:'barricade',label:'WELDED SCRAP WALL · ANATOMY V3',details:'IRREGULAR WELDED PANELS · BRACING',
  match:o=>o.artKit==='scrap-barricade',build:buildAnatomicalScrapWall},
 {id:'container',label:'SHIPPING CONTAINER · ANATOMY V3',details:'HOLLOW CORRUGATED FRAME · HINGED DOORS',
  match:o=>o.artKit==='shipping-container',build:buildAnatomicalContainer},
 {id:'concrete',label:'CONCRETE BARRIER · ANATOMY V3',details:'TRUE CAST SLOPES · CHIPPED REBAR',
  match:o=>o.artKit==='concrete-barrier',build:buildAnatomicalConcrete},
]);
