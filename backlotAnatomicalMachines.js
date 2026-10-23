/** Backlot k.5r.3: anatomy-first machine prototypes. DEV gallery only.
 * Structural volumes are built independently of the game's AABB cover.
 * No false claims about traversable gaps or bullet collision are made.
 */
import * as THREE from 'three';
import {block,cylinder,ring,beam,profile,wheel,axlePair,rustPanel,TRIM_COLORS as C}
 from './propAnatomyPrimitives.js';
const R=C.rust,S=C.steel,I=C.iron,Y=C.yellow,P=C.paint,D=C.soot;
const f=(root,n,a,b,r=.07,c=S)=>beam(root,n,a,b,r,c,7);
const metal=(root,n,w,h,d,x,y,z,c=I)=>block(root,n,w,h,d,x,y,z,c,.37);
function ladder(root,name,width,z0,z1,y){
 for(const side of [-1,1])f(root,name+'-rail',[side*width*.5,y,z0],
    [side*width*.5,y,z1],.15,I);
 for(let z=z0+.25;z<z1;z+=.8)
  f(root,name+'-crossmember',[-width*.5,y,z],[width*.5,y,z],.10,S);
}
/** Continuous low crawler tread: connected shoes follow a capsule, not
 * black boxes pretending to be tracks. Axis X carries the sprockets. */
function track(root,side){
 const x=side*2.02,y=.83,r=.63,a=1.15,n=30;
 const g=new THREE.Group();g.name='crawler-track-assembly-'+side;
 g.position.x=x;root.add(g);
 for(const z of [-a,a]){
  ring(g,'track-drive-rim',.46,.11,0,y,z,I,'x',12);
  cylinder(g,'track-sprocket',.31,.33,0,y,z,S,'x',10);
  for(let tooth=0;tooth<10;tooth++){
   const t=tooth*Math.PI/5;
   const tab=metal(g,'sprocket-tooth',.43,.12,.16,0,
      y+Math.cos(t)*.39,z+Math.sin(t)*.39,D);
   tab.rotation.x=-t;
  }
 }
 for(const z of [-.67,0,.67])
  cylinder(g,'track-road-wheel',.30,.32,0,.56,z,C.clay,'x',10);
 // Each link lies tangent to the capsule. Distinct linked shoes visibly
 // curve around the front and rear instead of hiding a box inside.
 const route=[];
 for(let i=0;i<=9;i++)route.push([-a+i*2*a/9,y+r,0]);
 for(let i=1;i<=6;i++){const t=i*Math.PI/6;route.push([a+r*Math.sin(t),y+r*Math.cos(t),-t]);}
 for(let i=1;i<=9;i++)route.push([a-i*2*a/9,y-r,Math.PI]);
 for(let i=1;i<=6;i++){const t=i*Math.PI/6;route.push([-a-r*Math.sin(t),y-r*Math.cos(t),Math.PI+t]);}
 // Capsule coordinates above are [z,y,angle] for top/bottom and rounded ends.
 for(let i=0;i<route.length;i++){
  const [z,yy,angle]=route[i];
  const shoe=metal(g,'connected-crawler-track-shoe',.66,.15,.36,0,yy,z,C.rubber);
  shoe.rotation.x=angle;
  metal(g,'raised-track-cleat',.71,.095,.11,0,
   yy+Math.cos(angle)*.09,z+Math.sin(angle)*.09,I).rotation.x=angle;
 }
 // Side frames are deliberately open around bogies.
 f(g,'track-bogie-support',[0,.57,-1.10],[0,.57,1.10],.13,C.clay);
 for(const z of [-.67,.67])f(g,'track-suspension-strut',
   [0,.55,z],[side*.04,1.34,z+.18],.09,S);
 return g;
}
export function buildAnatomicalLoader(root){
 const g=new THREE.Group();g.name='ANATOMICAL TRACKED FRONT LOADER';
 root.add(g);
 // Forward is -Z. The track carriage outweighs the cab and engine.
 ladder(g,'loader-box-frame',3.3,-2.10,2.35,1.05);
 track(g,-1);track(g,1);
 axlePair(g,'rear-final-drive',-2.05,2.05,1.07,1.21,I);
 for(const z of [-1.2,1.1])metal(g,'loader-bogie-cross-truss',
  3.80,.25,.30,0,.98,z,C.clay);
 // Rear engine is a block only where there is an actual engine.
 rustPanel(g,'rear-diesel-crankcase',2.32,.87,1.32,0,1.59,1.24,C.olive,R);
 for(let z=.76;z<1.82;z+=.29){
  cylinder(g,'loader-diesel-cylinder',.24,.40,-.36,2.17,z,C.clay,'y',8);
  cylinder(g,'loader-cylinder-head',.25,.12,-.36,2.43,z,I,'y',8);
 }
 for(const s of [-1,1]){
  for(let i=0;i<5;i++)metal(g,'rear-engine-cooling-louvre',
   .09,.10,.19,s*1.23,1.68,.77+i*.29,D);
 }
 // Center cab: open sightlines, real seat, canopy, four structural posts.
 const cab=new THREE.Group();cab.name='loader-open-operator-station';
 g.add(cab);
 metal(cab,'cab-floor',2.12,.16,1.53,0,1.63,-.28,I);
 metal(cab,'operator-seat-cushion',.86,.16,.65,0,1.99,.0,C.rubber);
 metal(cab,'operator-seat-back',.87,.77,.16,0,2.34,.31,C.rubber);
 for(const s of [-1,1])for(const z of [-1.03,.55])
  f(cab,'rollover-cage-upright',[s*1.06,1.68,z],
    [s*1.15,3.24,z],.115,P);
 for(const s of [-1,1])f(cab,'rollover-canopy-rail',
  [s*1.15,3.24,-1.03],[s*1.15,3.24,.55],.10,I);
 metal(cab,'roof-canopy-panel',2.62,.15,1.91,0,3.28,-.26,Y);
 f(cab,'front-cage-crossbar',[-1.15,3.18,-1.03],[1.15,3.18,-1.03],.08,S);
 f(cab,'steering-column',[0,1.86,-.81],[0,2.42,-.98],.08,S);
 ring(cab,'operator-control-wheel',.28,.052,0,2.42,-1.0,D,'z',10);
 // Articulating two-arm bucket: every member reaches an actual pivot.
 for(const s of [-1,1]){
  const x=s*1.30;
  cylinder(g,'rear-boom-pivot',.25,.32,x,2.05,.70,S,'x',10);
  f(g,'loader-lift-boom',[x,2.08,.66],[x,1.94,-1.83],.25,Y);
  f(g,'loader-boom-drop-link',[x,1.94,-1.83],[s*1.48,1.24,-2.72],.19,Y);
  f(g,'lift-hydraulic-outer',[s*1.09,1.30,.55],[x,1.63,-1.15],.19,I);
  f(g,'exposed-chrome-piston',[x,1.63,-1.15],[x,1.89,-1.84],.098,S);
  cylinder(g,'bucket-hinge-pin',.19,.43,s*1.48,1.24,-2.72,S,'x',9);
 }
 // Hollow V-section bucket with a floor and high rear wall, NOT a solid box.
 profile(g,'welded-hollow-bucket-floor',
   [[-2.64,.45],[-3.45,.40],[-3.67,.59],[-2.75,.82]],5.20,0,I);
 profile(g,'welded-bucket-backplate',
   [[-2.75,.60],[-2.77,1.83],[-2.57,1.90],[-2.55,.71]],5.12,0,C.clay);
 for(const s of [-1,1])profile(g,'bucket-open-end-plate',
   [[-2.57,.49],[-3.67,.59],[-3.40,1.14],[-2.58,1.89]],.15,s*2.53,R);
 for(let i=0;i<7;i++){
  const xx=-2.38+i*.79;
  profile(g,'individual-bucket-teeth',[[-3.47,.43],[-3.95,.34],[-3.52,.63]],.25,xx,S);
 }
 metal(g,'damaged-bucket-reinforcement',4.95,.15,.14,0,1.70,-2.69,P);
 // Operating scars: offset and missing components without arbitrary clutter.
 metal(g,'bent-side-service-panel',.70,.41,.065,1.26,1.79,1.16,R)
  .rotation.y=.24;
 f(g,'loader-engine-exhaust',[.80,2.04,1.35],[.88,2.80,1.36],.12,D);
 cylinder(g,'exhaust-flapper',.19,.055,.89,2.82,1.36,S,'y',8);
 return g;
}
export function buildAnatomicalCombine(root){
 const g=new THREE.Group();g.name='ANATOMICAL FARM COMBINE HARVESTER';root.add(g);
 // The large grain body is behind the header, not a tractor body enlarged.
 ladder(g,'combine-ladder-frame',2.4,-2.8,2.72,.93);
 for(const s of [-1,1]){
  wheel(g,'large-driven-front-tire-'+s,s*1.80,1.04,-.73,
   {radius:.88,width:.48,hub:.19,treadCount:12,rubber:C.rubber,rimColor:C.cream});
  wheel(g,'small-rear-steering-tire-'+s,s*1.36,.52,2.25,
   {radius:.46,width:.28,hub:.12,treadCount:9,rubber:C.rubber,rimColor:S});
 }
 axlePair(g,'combine-front-axle',-1.84,1.84,1.02,-.74,I);
 axlePair(g,'combine-rear-axle',-1.4,1.4,.58,2.26,I);
 // Large angular threshing chamber; a distinct top grain tank.
 profile(g,'elevated-threshing-chamber',
   [[-1.45,1.36],[-1.49,2.75],[.16,2.93],[2.48,2.53],[2.47,1.35]],2.52,0,C.olive);
 profile(g,'grain-hopper-tapered-bin',
   [[-.88,2.77],[-.54,3.37],[1.55,3.37],[1.94,2.64]],2.94,0,Y);
 metal(g,'hopper-rim',3.11,.12,2.47,0,3.38,.48,R);
 for(const s of [-1,1]){
  metal(g,'side-service-panel',.065,.78,1.3,s*1.37,1.91,.65,P);
  for(let i=0;i<5;i++)metal(g,'thresher-vent-row',
    .075,.065,.19,s*1.42,1.70+i*.11,.10,D);
 }
 // Elevated glass-free cab exposes the actual operator station.
 metal(g,'operator-platform',2.04,.13,1.39,0,2.07,-1.95,I);
 for(const s of [-1,1]){
  for(const z of [-2.55,-1.43])
   f(g,'harvester-cab-upright',[s*1.02,2.05,z],[s*1.07,3.33,z],.078,C.paint);
  f(g,'cab-window-sill',[s*1.02,2.52,-2.55],[s*1.03,2.52,-1.43],.06,S);
 }
 metal(g,'harvester-cab-roof',2.35,.13,1.38,0,3.38,-2.0,C.paint);
 metal(g,'cab-seat',.71,.14,.62,0,2.34,-1.70,C.rubber);
 ring(g,'harvester-steering-wheel',.26,.048,0,2.72,-2.3,D,'z',10);
 // Open feeder throat connects the header to the threshing chamber.
 for(const s of [-1,1])f(g,'feeder-throat-side-rail',
  [s*.66,1.34,-1.7],[s*.88,1.03,-3.11],.15,S);
 // Distinct wide cutting header and rotating reel drum.
 const headerZ=-3.24;
 metal(g,'header-cutter-bar',5.42,.17,.28,0,.57,headerZ-.38,I);
 cylinder(g,'open-header-reel-shaft',.13,5.08,0,1.21,headerZ,S,'x',9);
 for(const s of [-1,1]){
  ring(g,'header-reel-spoked-end',.42,.053,s*2.41,1.21,headerZ,R,'x',10);
  for(let t=0;t<8;t++){
   const a=t*Math.PI/4;
   f(g,'header-reel-spoke',[s*2.41,1.21,headerZ],
     [s*2.41,1.21+Math.cos(a)*.42,headerZ+Math.sin(a)*.42],.045,I);
  }
 }
 for(let i=0;i<11;i++){
  const x=-2.50+i*.50;
  profile(g,'individual-harvester-cutter-finger',
   [[headerZ-.38,.53],[headerZ-.72,.44],[headerZ-.37,.65]],.18,x,S);
 }
 f(g,'unloading-auger-swing-arm',[1.05,2.92,.70],
   [2.50,3.26,.84],.16,I);
 f(g,'unloading-auger-long-tube',[2.50,3.26,.84],
   [4.05,3.24,.35],.22,Y);
 f(g,'auger-downspout',[4.05,3.24,.35],[4.14,2.65,.35],.11,I);
 metal(g,'dented-grain-tank-side',.68,.22,.095,-1.15,2.92,.97,R)
  .rotation.z=.13;
 return g;
}
export function buildAnatomicalPickup(root){
 const g=new THREE.Group();g.name='ANATOMICAL ABANDONED PICKUP';root.add(g);
 ladder(g,'truck-ladder-frame',1.57,-2.35,2.40,.63);
 for(const s of [-1,1])for(const z of [-1.42,1.55])
  wheel(g,'truck-pneumatic-tyre',s*1.06,.59,z,
   {radius:.57,width:.29,hub:.15,treadCount:10,rubber:C.rubber,rimColor:C.cream});
 for(const z of [-1.42,1.55])axlePair(g,'truck-live-axle',-1.05,1.05,.63,z,I);
 // Rear is -Z, bonnet/front points +Z.
 metal(g,'truck-bed-floor',2.0,.13,2.02,0,1.04,-1.36,C.clay);
 for(const s of [-1,1]){
  metal(g,'pickup-bed-side-wall',.11,.54,2.20,s*.96,1.32,-1.34,R);
  metal(g,'pickup-inner-wheel-arch',.28,.28,.83,s*.83,1.17,-1.53,I);
 }
 metal(g,'pickup-tailgate-dented',1.96,.55,.095,0,1.37,-2.40,P)
  .rotation.y=.06;
 // Cab is framed as a greenhouse, rather than an opaque upright box.
 metal(g,'cab-firewall',1.92,.92,.12,0,1.43,.04,R);
 metal(g,'pickup-cab-floor',1.92,.16,1.35,0,.97,-.13,I);
 for(const s of [-1,1]){
  f(g,'pickup-a-pillar',[s*.95,1.31,.66],[s*.89,2.19,.44],.088,R);
  f(g,'pickup-b-pillar',[s*.93,1.24,-.73],[s*.97,2.19,-.72],.10,R);
  f(g,'truck-window-sill',[s*.96,1.44,-.72],[s*.93,1.44,.62],.055,S);
  metal(g,'sagging-side-door',.10,.48,1.18,s*.99,1.18,-.12,P);
 }
 metal(g,'creased-cab-roof',2.12,.13,1.52,0,2.25,-.14,C.clay)
  .rotation.z=.055;
 metal(g,'torn-bench-seat',1.52,.16,.55,0,1.23,-.32,C.rubber);
 ring(g,'truck-steering-wheel',.26,.046,-.44,1.62,.38,D,'z',10);
 // Raised tapered bonnet is hollow over a believable engine.
 profile(g,'pickup-tapered-bonnet-shell',
  [[.72,1.53],[1.09,1.69],[2.24,1.54],[2.35,1.25],[.78,1.27]],1.88,0,P);
 metal(g,'truck-engine-block',1.22,.49,1.15,0,.94,1.55,I);
 for(let i=0;i<4;i++)cylinder(g,'inline-four-engine-head',
  .14,.23,-.29,.99,1.09+i*.28,C.clay,'y',8);
 for(let i=0;i<6;i++)metal(g,'truck-open-radiator-slat',
  1.45,.06,.05,0,.86+i*.09,2.42,D);
 for(const s of [-1,1]){
  metal(g,'front-fender-arch-skin',.32,.17,.77,s*.88,1.10,1.64,R);
  metal(g,'side-headlamp',.24,.23,.12,s*.67,1.30,2.40,C.cream);
 }
 metal(g,'twisted-front-bumper',2.22,.12,.18,0,.65,2.62,S)
  .rotation.y=.09;
 f(g,'side-exhaust-tailpipe',[-.75,.55,-1.28],[-.76,.52,-2.31],.08,D);
 return g;
}
export function buildAnatomicalEngine(root){
 const g=new THREE.Group();g.name='EXPOSED ENGINE BANK & FLYWHEEL';root.add(g);
 ladder(g,'engine-mount-sled',2.12,-2.0,2.0,.31);
 metal(g,'cast-open-crankcase',1.60,.85,2.75,0,1.08,0,I);
 metal(g,'oil-sump-housing',1.21,.37,2.30,0,.51,0,C.clay);
 for(const s of [-1,1]){
  for(let i=0;i<4;i++){
   const z=-1.02+i*.64;
   f(g,'engine-cylinder-bank-angled-mount',[s*.28,1.22,z],
     [s*.65,1.92,z],.20,C.clay);
   cylinder(g,'cast-cylinder-head',.25,.36,s*.71,1.98,z,S,'y',10);
   ring(g,'engine-head-cover-ring',.19,.04,s*.71,2.18,z,C.cream,'y',10);
   f(g,'individual-injector-line',[s*.71,2.24,z],[s*.90,2.15,z+.15],.041,Y);
  }
  f(g,'exhaust-manifold-header',[s*.91,2.13,-1.40],
    [s*.91,2.13,1.43],.09,D);
 }
 cylinder(g,'giant-open-flywheel',.76,.24,0,1.23,1.63,S,'z',12);
 ring(g,'outer-flywheel-ring',.71,.12,0,1.23,1.79,C.clay,'z',12);
 for(let i=0;i<7;i++){
  const a=i*Math.PI*2/7;
  f(g,'flywheel-spoke',[0,1.23,1.82],
    [Math.sin(a)*.68,1.23+Math.cos(a)*.68,1.82],.064,I);
 }
 f(g,'exposed-drive-shaft',[0,.97,-2.30],[0,.97,-1.31],.16,S);
 for(const z of [-2.19,2.09])f(g,'engine-bed-mount-crossbar',
   [-1.21,.37,z],[1.21,.37,z],.16,R);
 metal(g,'missing-valve-cover-on-ground',.92,.07,.30,.98,.14,-1.42,P)
  .rotation.y=-.26;
 return g;
}
export function buildAnatomicalCoupling(root){
 const g=new THREE.Group();g.name='CENTRAL EXPOSED POWER COUPLING';root.add(g);
 ladder(g,'coupling-skid',2.18,-1.65,1.63,.33);
 for(const s of [-1,1]){
  metal(g,'gearbox-foot',.36,.39,.45,s*.83,.56,0,C.clay);
  cylinder(g,'exposed-ratio-gear',.65,.20,s*.63,1.45,0,S,'x',12);
  ring(g,'ring-gear-teeth',.59,.13,s*.78,1.45,0,I,'x',12);
  f(g,'gearbox-transverse-shaft',[s*.25,1.45,0],[s*1.28,1.45,0],.15,S);
 }
 metal(g,'gearcase-open-bottom',1.40,.59,1.50,0,.83,0,I);
 for(let i=0;i<4;i++)f(g,'drive-cage-post',
   [i<2?-.83:.83,.45,i%2?-.91:.91],
   [i<2?-.83:.83,2.17,i%2?-.91:.91],.10,R);
 f(g,'exposed-input-shaft',[0,1.46,-1.82],[0,1.46,-.25],.18,S);
 ring(g,'coupling-front-hub',.29,.07,0,1.46,-1.62,Y,'z',11);
 metal(g,'broken-gear-guard',.56,.11,.79,-.85,1.94,.76,P)
  .rotation.z=-.21;
 return g;
}
export const MACHINE_EXHIBITS=Object.freeze([
 {id:'loader',label:'TRACKED LOADER · ANATOMY V3',details:'FULL TRACK LOOP · BOOM · BUCKET · HYDRAULICS',
  match:o=>o.id.startsWith('loader-'),build:buildAnatomicalLoader},
 {id:'combine',label:'COMBINE HARVESTER · ANATOMY V3',details:'OPEN REEL · CUTTER HEADER · HOPPER · AUGER',
  match:o=>o.artKit==='combine-harvester',build:buildAnatomicalCombine},
 {id:'pickup',label:'PICKUP WRECK · ANATOMY V3',details:'REAL FRAME · HOLLOW CAB · BED · ENGINE',
  match:o=>o.artKit==='pickup-wreck',build:buildAnatomicalPickup},
 {id:'engine',label:'ENGINE BANK · ANATOMY V3',details:'V8 HEADS · FLYWHEEL · EXHAUST · MOUNTING SLED',
  match:o=>o.id.startsWith('exposed-engine-'),build:buildAnatomicalEngine},
 {id:'coupling',label:'GEAR COUPLING · ANATOMY V3',details:'SHAFTS · RING GEARS · EXPOSED DRIVE',
  match:o=>o.id.startsWith('coupling-'),build:buildAnatomicalCoupling},
]);
