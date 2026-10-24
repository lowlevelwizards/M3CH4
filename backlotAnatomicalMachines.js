/** Backlot k.5r.6: integrated, chunky solid-core mechanical anatomy. DEV gallery only.
 * Structural volumes are built independently of the game's AABB cover.
 * No false claims about traversable gaps or bullet collision are made.
 */
import * as THREE from 'three';
import {block,cylinder,ring,beam,profile,wheel,axlePair,rustPanel,TRIM_COLORS as C}
 from './propAnatomyPrimitives.js';
const R=C.rust,S=C.steel,I=C.iron,Y=C.yellow,P=C.paint,D=C.soot;
const f=(root,n,a,b,r=.105,c=S)=>beam(root,n,a,b,r,c,7);
const metal=(root,n,w,h,d,x,y,z,c=I)=>block(root,n,w,h,d,x,y,z,c,.37);
function ladder(root,name,width,z0,z1,y){
 for(const side of [-1,1])f(root,name+'-rail',[side*width*.5,y,z0],
    [side*width*.5,y,z1],.21,I);
 for(let z=z0+.42;z<z1;z+=1.38)
  f(root,name+'-crossmember',[-width*.5,y,z],[width*.5,y,z],.16,S);
}
/** Continuous low crawler tread: connected shoes follow a capsule, not
 * black boxes pretending to be tracks. Axis X carries the sprockets. */
function track(root,side){
 const x=side*2.04,y=.85,r=.69,a=1.10;
 const g=new THREE.Group();g.name='crawler-track-assembly-'+side;
 g.position.x=x;root.add(g);
 for(const z of [-a,a]){
  ring(g,'track-drive-rim',.48,.16,0,y,z,I,'x',10);
  cylinder(g,'track-sprocket',.36,.42,0,y,z,S,'x',8);
  for(let tooth=0;tooth<6;tooth++){
   const t=tooth*Math.PI/3;
   const tab=metal(g,'sprocket-tooth',.52,.18,.22,0,
      y+Math.cos(t)*.42,z+Math.sin(t)*.42,D);
   tab.rotation.x=-t;
  }
 }
 for(const z of [-.62,.62])
  cylinder(g,'track-road-wheel',.34,.42,0,.59,z,C.clay,'x',8);
 // Each link lies tangent to the capsule. Distinct linked shoes visibly
 // curve around the front and rear instead of hiding a box inside.
 const route=[];
 for(let i=0;i<=6;i++)route.push([-a+i*2*a/6,y+r,0]);
 for(let i=1;i<=5;i++){const t=i*Math.PI/5;route.push([a+r*Math.sin(t),y+r*Math.cos(t),-t]);}
 for(let i=1;i<=6;i++)route.push([a-i*2*a/6,y-r,Math.PI]);
 for(let i=1;i<=5;i++){const t=i*Math.PI/5;route.push([-a-r*Math.sin(t),y-r*Math.cos(t),Math.PI+t]);}
 // Capsule coordinates above are [z,y,angle] for top/bottom and rounded ends.
 for(let i=0;i<route.length;i++){
  const [z,yy,angle]=route[i];
  const shoe=metal(g,'connected-crawler-track-shoe',.85,.23,.48,0,yy,z,C.rubber);
  shoe.rotation.x=angle;
  if(i%2===0)metal(g,'raised-track-cleat',.89,.14,.18,0,
   yy+Math.cos(angle)*.14,z+Math.sin(angle)*.14,I).rotation.x=angle;
 }
 // Side frames are deliberately open around bogies.
 f(g,'track-bogie-support',[0,.57,-1.10],[0,.57,1.10],.19,C.clay);
 for(const z of [-.67,.67])f(g,'track-suspension-strut',
   [0,.55,z],[side*.04,1.34,z+.18],.14,S);
 return g;
}
export function buildAnatomicalLoader(root){
 const g=new THREE.Group();g.name='LOADER WITH REAR-MOUNTED EXTERNAL BUCKET TRUNNIONS';
 root.add(g);
 // Forward is -Z. The track carriage outweighs the cab and engine.
 ladder(g,'loader-box-frame',3.35,-2.10,2.35,1.08);
 track(g,-1);track(g,1);
 axlePair(g,'rear-final-drive',-2.05,2.05,1.07,1.21,I);
 for(const z of [-1.2,1.1])metal(g,'loader-bogie-cross-truss',
  3.90,.36,.42,0,.98,z,C.clay);
 // Integrated transmission belly connects track carriers to the engine.
 // The cab/windows and outside track loops remain genuinely open.
 metal(g,'loader-main-transmission-belly',2.96,.96,3.88,0,1.01,.11,C.olive);
 metal(g,'loader-operator-pedestal',2.16,.51,1.54,0,1.48,-.29,I);
 metal(g,'loader-front-bulkhead',2.54,.62,.34,0,1.62,-1.14,R);
 for(const side of [-1,1]){
  metal(g,'loader-bolted-track-cheek',.25,.65,2.22,
    side*1.55,1.29,-.24,C.clay);
  metal(g,'loader-final-drive-guard',.35,.64,.93,
    side*1.49,1.12,1.43,R);
 }
 // Rear engine is a block only where there is an actual engine.
 rustPanel(g,'rear-diesel-crankcase',2.66,1.04,1.55,0,1.62,1.23,C.olive,R);
 for(let z=.84;z<1.74;z+=.39){
  cylinder(g,'loader-diesel-cylinder',.32,.42,-.36,2.25,z,C.clay,'y',8);
  cylinder(g,'loader-cylinder-head',.35,.15,-.36,2.52,z,I,'y',8);
 }
 for(const s of [-1,1]){
  for(let i=0;i<3;i++)metal(g,'rear-engine-cooling-louvre',
   .12,.16,.30,s*1.36,1.74,.83+i*.40,D);
 }
 metal(g,'loader-hood-forward-shoulder',2.50,.48,.54,0,1.72,.58,C.olive);
 // Center cab: open sightlines, real seat, canopy, four structural posts.
 const cab=new THREE.Group();cab.name='loader-open-operator-station';
 g.add(cab);
 metal(cab,'cab-floor',2.25,.23,1.66,0,1.63,-.28,I);
 metal(cab,'operator-seat-cushion',1.03,.22,.75,0,2.00,.0,C.rubber);
 metal(cab,'operator-seat-back',1.01,.83,.21,0,2.40,.34,C.rubber);
 for(const s of [-1,1])for(const z of [-1.03,.55])
  f(cab,'rollover-cage-upright',[s*1.06,1.68,z],
    [s*1.15,3.24,z],.17,P);
 for(const s of [-1,1])f(cab,'rollover-canopy-rail',
  [s*1.15,3.24,-1.03],[s*1.15,3.24,.55],.15,I);
 metal(cab,'roof-canopy-panel',2.89,.27,2.13,0,3.32,-.26,Y);
 f(cab,'front-cage-crossbar',[-1.15,3.18,-1.03],[1.15,3.18,-1.03],.14,S);
 f(cab,'steering-column',[0,1.86,-.81],[0,2.42,-.98],.12,S);
 ring(cab,'operator-control-wheel',.31,.073,0,2.42,-1.0,D,'z',9);
 // Lift arms stop at the REAR of the bucket and connect through
 // outboard trunnions. The working scoop surface stays unobstructed.
 // Back plate occupies z=-2.48..-2.81: all boom links are behind it.
 for(const side of [-1,1]){
  const rearX=side*1.30,elbowX=side*1.79,lugX=side*2.72;
  cylinder(g,'rear-boom-pivot',.35,.48,rearX,2.04,.69,S,'x',10);
  f(g,'loader-lift-boom',[rearX,2.06,.66],[elbowX,1.70,-1.67],.36,Y);
  cylinder(g,'loader-elbow-pivot',.27,.33,elbowX,1.70,-1.67,S,'x',8);
  const link=f(g,'loader-boom-drop-link',[elbowX,1.70,-1.67],
    [lugX,1.30,-2.31],.28,Y);
  // Maintain inspectable engineering attachment data for the gallery audit.
  link.userData.rearBucketPin=[lugX,1.30,-2.31];
  metal(g,'bucket-side-external-hinge-bracket',.31,.57,.45,
    side*2.68,1.29,-2.44,R);
  cylinder(g,'bucket-hinge-pin',.27,.39,lugX,1.29,-2.36,S,'x',9);
  // Hydraulic rod operates the boom hinge, NOT the bucket wall.
  f(g,'lift-hydraulic-outer',[side*1.09,1.32,.44],
    [side*1.45,1.46,-.99],.25,I);
  f(g,'exposed-chrome-piston',[side*1.45,1.46,-.99],
    [side*1.64,1.72,-1.52],.14,S);
  cylinder(g,'loader-hydraulic-rod-clevis',.20,.30,
    side*1.64,1.72,-1.52,C.clay,'x',8);
 }
 // Hollow V-section bucket with a floor and high rear wall, NOT a solid box.
 profile(g,'welded-hollow-bucket-floor',
   [[-2.64,.44],[-3.45,.38],[-3.70,.63],[-2.74,.91]],5.30,0,I);
 profile(g,'welded-bucket-backplate',
   [[-2.78,.52],[-2.81,1.91],[-2.50,2.01],[-2.48,.68]],5.22,0,C.clay);
 for(const s of [-1,1])profile(g,'bucket-open-end-plate',
   [[-2.57,.46],[-3.70,.60],[-3.40,1.20],[-2.54,1.97]],.26,s*2.55,R);
 for(let i=0;i<5;i++){
  const xx=-2.15+i*1.08;
  profile(g,'individual-bucket-teeth',[[-3.47,.43],[-4.01,.29],[-3.53,.70]],.42,xx,S);
 }
 metal(g,'damaged-bucket-reinforcement',5.03,.23,.21,0,1.70,-2.69,P);
 // Brackets and side cheeks form the outboard path into the scoop.
 for(const side of [-1,1])
  metal(g,'bucket-side-rear-gusset',.24,.72,.24,
    side*2.59,1.23,-2.43,I);
 // Operating scars: offset and missing components without arbitrary clutter.
 metal(g,'bent-side-service-panel',.95,.52,.095,1.26,1.79,1.16,R)
  .rotation.y=.24;
 f(g,'loader-engine-exhaust',[.80,2.04,1.35],[.88,2.80,1.36],.17,D);
 cylinder(g,'exhaust-flapper',.19,.055,.89,2.82,1.36,S,'y',8);
 return g;
}
export function buildAnatomicalCombine(root){
 const g=new THREE.Group();g.name='ANATOMICAL FARM COMBINE HARVESTER';root.add(g);
 // The large grain body is behind the header, not a tractor body enlarged.
 ladder(g,'combine-ladder-frame',2.4,-2.8,2.72,.93);
 for(const s of [-1,1]){
  wheel(g,'large-driven-front-tire-'+s,s*1.80,1.04,-.73,
   {radius:1.02,width:.62,hub:.25,treadCount:8,rubber:C.rubber,rimColor:C.cream});
  wheel(g,'small-rear-steering-tire-'+s,s*1.36,.52,2.25,
   {radius:.54,width:.36,hub:.16,treadCount:7,rubber:C.rubber,rimColor:S});
 }
 axlePair(g,'combine-front-axle',-1.84,1.84,1.02,-.74,I);
 axlePair(g,'combine-rear-axle',-1.4,1.4,.58,2.26,I);
 // Large angular threshing chamber; a distinct top grain tank.
 profile(g,'elevated-threshing-chamber',
   [[-1.50,1.27],[-1.54,2.87],[.16,3.13],[2.51,2.62],[2.51,1.27]],3.06,0,C.olive);
 profile(g,'grain-hopper-tapered-bin',
   [[-.91,2.91],[-.54,3.68],[1.55,3.68],[2.02,2.77]],3.36,0,Y);
 metal(g,'hopper-rim',3.45,.25,2.58,0,3.67,.48,R);
 for(const s of [-1,1]){
  metal(g,'side-service-panel',.13,.92,1.52,s*1.56,1.98,.65,P);
  for(let i=0;i<3;i++)metal(g,'thresher-vent-row',
    .13,.12,.33,s*1.62,1.73+i*.25,.10,D);
 }
 // Substantial threshing body: the grain tank and cab must sit on a
 // contiguous machine, not hover above an exposed farm-tractor frame.
 metal(g,'combine-solid-thresher-core',3.12,1.84,3.93,0,2.03,.55,C.olive);
 metal(g,'combine-lower-axle-belly',2.48,.66,3.76,0,1.10,.60,I);
 metal(g,'combine-supported-grain-bin',3.19,.67,2.47,0,3.10,.57,Y);
 for(const side of [-1,1])
  metal(g,'combine-heavy-service-cheek',.18,1.35,1.43,
    side*1.66,1.92,.58,C.clay);
 // Elevated glass-free cab exposes the actual operator station.
 metal(g,'operator-platform',2.32,.25,1.55,0,2.07,-1.95,I);
 // Keep genuine window openings above the joined lower operator cell.
 metal(g,'combine-operator-footwell',2.17,.56,1.43,0,2.27,-1.96,C.clay);
 metal(g,'combine-cab-rear-firewall',2.28,1.18,.24,0,2.47,-1.41,C.olive);
 metal(g,'combine-low-windscreen-dash',2.24,.44,.21,0,2.47,-2.56,P);
 for(const side of [-1,1])metal(g,'combine-lower-cab-door',
   .18,.53,1.30,side*1.13,2.42,-1.98,R);
 for(const s of [-1,1]){
  for(const z of [-2.55,-1.43])
   f(g,'harvester-cab-upright',[s*1.02,2.05,z],[s*1.07,3.33,z],.15,C.paint);
  f(g,'cab-window-sill',[s*1.02,2.52,-2.55],[s*1.03,2.52,-1.43],.11,S);
 }
 metal(g,'harvester-cab-roof',2.68,.26,1.58,0,3.38,-2.0,C.paint);
 metal(g,'cab-seat',.93,.22,.76,0,2.34,-1.70,C.rubber);
 ring(g,'harvester-steering-wheel',.31,.072,0,2.72,-2.3,D,'z',10);
 metal(g,'combine-reinforced-feeder-case',1.88,.59,1.91,0,1.14,-2.37,I);
 metal(g,'combine-feeder-hinge-housing',2.12,.62,.33,0,1.30,-1.58,R);
 // Open feeder throat connects the header to the threshing chamber.
 for(const s of [-1,1])f(g,'feeder-throat-side-rail',
  [s*.66,1.34,-1.7],[s*.88,1.03,-3.11],.22,S);
 // Distinct wide cutting header and rotating reel drum.
 const headerZ=-3.24;
 metal(g,'combine-header-receiving-trough',5.52,.48,.67,0,.75,-3.31,C.clay);
 metal(g,'combine-header-centre-intake',1.92,.61,.76,0,.92,-3.10,R);
 metal(g,'header-cutter-bar',5.90,.32,.38,0,.57,headerZ-.38,I);
 cylinder(g,'open-header-reel-shaft',.20,5.24,0,1.21,headerZ,S,'x',9);
 for(const s of [-1,1]){
  ring(g,'header-reel-spoked-end',.51,.10,s*2.49,1.21,headerZ,R,'x',10);
  for(let t=0;t<4;t++){
   const a=t*Math.PI/2;
   f(g,'header-reel-spoke',[s*2.49,1.21,headerZ],
     [s*2.49,1.21+Math.cos(a)*.50,headerZ+Math.sin(a)*.50],.10,I);
  }
 }
 for(let i=0;i<6;i++){
  const x=-2.50+i*1.0;
  profile(g,'individual-harvester-cutter-finger',
   [[headerZ-.38,.51],[headerZ-.86,.38],[headerZ-.32,.72]],.35,x,S);
 }
 f(g,'unloading-auger-swing-arm',[1.05,2.92,.70],
   [2.50,3.26,.84],.22,I);
 f(g,'unloading-auger-long-tube',[2.50,3.26,.84],
   [4.05,3.24,.35],.30,Y);
 f(g,'auger-downspout',[4.05,3.24,.35],[4.14,2.65,.35],.17,I);
 metal(g,'dented-grain-tank-side',1.06,.35,.13,-1.15,2.92,.97,R)
  .rotation.z=.13;
 return g;
}
export function buildAnatomicalPickup(root){
 const g=new THREE.Group();g.name='ANATOMICAL ABANDONED PICKUP';root.add(g);
 ladder(g,'truck-ladder-frame',1.72,-2.35,2.40,.63);
 for(const s of [-1,1])for(const z of [-1.42,1.55])
  wheel(g,'truck-pneumatic-tyre',s*1.06,.59,z,
   {radius:.66,width:.39,hub:.20,treadCount:8,rubber:C.rubber,rimColor:C.cream});
 for(const z of [-1.42,1.55])axlePair(g,'truck-live-axle',-1.05,1.05,.63,z,I);
 // Rear is -Z, bonnet/front points +Z.
 metal(g,'truck-bed-floor',2.18,.22,2.19,0,1.04,-1.36,C.clay);
 for(const s of [-1,1]){
  metal(g,'pickup-bed-side-wall',.20,.64,2.27,s*1.02,1.40,-1.34,R);
  metal(g,'pickup-inner-wheel-arch',.35,.35,.98,s*.83,1.17,-1.53,I);
 }
 metal(g,'pickup-tailgate-dented',2.20,.65,.17,0,1.37,-2.40,P)
  .rotation.y=.06;
 // The complete engine bay and bulkhead join the hood to the chassis.
 // Front wheels and upper window apertures remain unobstructed.
 metal(g,'pickup-deep-engine-bay',1.79,.77,1.94,0,1.07,1.40,I);
 metal(g,'pickup-firewall-bellhousing',1.86,.65,.63,0,1.10,.31,C.clay);
 for(const side of [-1,1]){
  metal(g,'pickup-front-quarter-panel',.20,.55,1.64,
   side*.85,1.47,1.56,P);
  metal(g,'pickup-rocker-sill',.25,.40,1.37,
   side*.91,.89,-.18,I);
 }
 // Cab is framed as a greenhouse, rather than an opaque upright box.
 metal(g,'cab-firewall',2.05,1.06,.17,0,1.43,.04,R);
 metal(g,'pickup-cab-floor',2.06,.22,1.45,0,.97,-.13,I);
 metal(g,'pickup-solid-rear-cab-wall',2.01,.95,.22,0,1.53,-.76,C.clay);
 metal(g,'pickup-lower-dashboard',1.95,.43,.28,0,1.51,.56,I);
 for(const s of [-1,1]){
  f(g,'pickup-a-pillar',[s*.95,1.31,.66],[s*.89,2.32,.44],.15,R);
  f(g,'pickup-b-pillar',[s*.93,1.24,-.73],[s*.97,2.32,-.72],.17,R);
  f(g,'truck-window-sill',[s*.96,1.44,-.72],[s*.93,1.49,.62],.105,S);
  metal(g,'sagging-side-door',.17,.64,1.30,s*.99,1.18,-.12,P);
 }
 metal(g,'creased-cab-roof',2.36,.26,1.70,0,2.35,-.14,C.clay)
  .rotation.z=.055;
 metal(g,'torn-bench-seat',1.60,.23,.70,0,1.23,-.32,C.rubber);
 ring(g,'truck-steering-wheel',.30,.073,-.44,1.62,.38,D,'z',10);
 // Raised tapered bonnet is hollow over a believable engine.
 profile(g,'pickup-tapered-bonnet-shell',
  [[.72,1.58],[1.09,1.88],[2.26,1.67],[2.40,1.29],[.78,1.29]],2.10,0,P);
 metal(g,'truck-engine-block',1.48,.64,1.34,0,.94,1.55,I);
 for(let i=0;i<2;i++)cylinder(g,'inline-four-engine-head',
  .24,.29,-.29,1.03,1.26+i*.48,C.clay,'y',8);
 for(let i=0;i<3;i++)metal(g,'truck-open-radiator-slat',
  1.62,.13,.085,0,.86+i*.19,2.42,D);
 for(const s of [-1,1]){
  metal(g,'front-fender-arch-skin',.42,.25,.92,s*.88,1.10,1.64,R);
  metal(g,'side-headlamp',.30,.29,.15,s*.67,1.30,2.40,C.cream);
 }
 metal(g,'twisted-front-bumper',2.43,.23,.29,0,.65,2.62,S)
  .rotation.y=.09;
 f(g,'side-exhaust-tailpipe',[-.75,.55,-1.28],[-.76,.52,-2.31],.13,D);
 return g;
}
export function buildAnatomicalEngine(root){
 const g=new THREE.Group();g.name='EXPOSED ENGINE BANK & FLYWHEEL';root.add(g);
 ladder(g,'engine-mount-sled',2.30,-2.0,2.0,.31);
 metal(g,'cast-open-crankcase',1.88,1.11,2.93,0,1.08,0,I);
 metal(g,'oil-sump-housing',1.46,.45,2.42,0,.51,0,C.clay);
 metal(g,'engine-structural-gearbox-bell',1.92,.68,.80,0,.91,-1.26,R);
 for(const side of [-1,1])
  metal(g,'engine-bank-cast-shoulder',.34,.57,2.53,side*.75,1.47,0,C.clay);
 for(const s of [-1,1]){
  for(let i=0;i<3;i++){
   const z=-1.02+i*1.02;
   f(g,'engine-cylinder-bank-angled-mount',[s*.28,1.22,z],
     [s*.74,2.08,z],.28,C.clay);
   cylinder(g,'cast-cylinder-head',.37,.48,s*.78,2.10,z,S,'y',8);
   ring(g,'engine-head-cover-ring',.27,.075,s*.78,2.36,z,C.cream,'y',8);
   // Large cylinder housings and gaskets stand in for injector plumbing.
  }
  f(g,'exhaust-manifold-header',[s*.91,2.13,-1.40],
    [s*1.03,2.20,1.43],.17,D);
 }
 cylinder(g,'giant-open-flywheel',.91,.34,0,1.23,1.63,S,'z',12);
 ring(g,'outer-flywheel-ring',.91,.20,0,1.23,1.79,C.clay,'z',12);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2;
  f(g,'flywheel-spoke',[0,1.23,1.82],
    [Math.sin(a)*.82,1.23+Math.cos(a)*.82,1.82],.14,I);
 }
 f(g,'exposed-drive-shaft',[0,.97,-2.30],[0,.97,-1.31],.24,S);
 for(const z of [-2.19,2.09])f(g,'engine-bed-mount-crossbar',
   [-1.21,.37,z],[1.21,.37,z],.23,R);
 metal(g,'missing-valve-cover-on-ground',1.22,.15,.49,.98,.14,-1.42,P)
  .rotation.y=-.26;
 return g;
}
export function buildAnatomicalCoupling(root){
 const g=new THREE.Group();g.name='CENTRAL EXPOSED POWER COUPLING';root.add(g);
 ladder(g,'coupling-skid',2.36,-1.65,1.63,.33);
 for(const s of [-1,1]){
  metal(g,'gearbox-foot',.52,.48,.62,s*.83,.56,0,C.clay);
  cylinder(g,'exposed-ratio-gear',.76,.31,s*.63,1.45,0,S,'x',12);
  ring(g,'ring-gear-teeth',.73,.19,s*.78,1.45,0,I,'x',12);
  f(g,'gearbox-transverse-shaft',[s*.25,1.45,0],[s*1.28,1.45,0],.23,S);
 }
 metal(g,'gearcase-open-bottom',1.61,.78,1.68,0,.83,0,I);
 metal(g,'coupling-lower-bearing-plinth',1.91,.66,1.78,0,.48,0,C.clay);
 metal(g,'coupling-middle-drive-web',1.18,.68,1.09,0,1.23,0,I);
 for(const x of [-.83,.83])f(g,'drive-cage-post',
   [x,.45,-.88],[x,2.18,-.88],.18,R);
 f(g,'exposed-input-shaft',[0,1.46,-1.82],[0,1.46,-.25],.25,S);
 ring(g,'coupling-front-hub',.36,.13,0,1.46,-1.62,Y,'z',11);
 metal(g,'broken-gear-guard',.87,.20,1.01,-.85,1.94,.76,P)
  .rotation.z=-.21;
 return g;
}
export const MACHINE_EXHIBITS=Object.freeze([
 {id:'loader',label:'TRACKED LOADER · FINISH V6',details:'FULL TRACK LOOP · BOOM · BUCKET · HYDRAULICS',
  match:o=>o.id.startsWith('loader-'),front:'-z',build:buildAnatomicalLoader},
 {id:'combine',label:'COMBINE HARVESTER · FINISH V6',details:'OPEN REEL · CUTTER HEADER · HOPPER · AUGER',
  match:o=>o.artKit==='combine-harvester',front:'-z',build:buildAnatomicalCombine},
 {id:'pickup',label:'PICKUP WRECK · FINISH V6',details:'REAL FRAME · HOLLOW CAB · BED · ENGINE',
  match:o=>o.artKit==='pickup-wreck',build:buildAnatomicalPickup},
 {id:'engine',label:'ENGINE BANK · FINISH V6',details:'V8 HEADS · FLYWHEEL · EXHAUST · MOUNTING SLED',
  match:o=>o.id.startsWith('exposed-engine-'),build:buildAnatomicalEngine},
 {id:'coupling',label:'GEAR COUPLING · FINISH V6',details:'SHAFTS · RING GEARS · EXPOSED DRIVE',
  match:o=>o.id.startsWith('coupling-'),build:buildAnatomicalCoupling},
]);
