/** k.5r.5 — sculpted in low-poly forms from tractor anatomy, NOT a decorated
 * collision block. Experimental model for the DEV gallery only until the
 * physical integration / navigation pass is audited.
 */
import * as THREE from 'three';
import {block,cylinder,ring,beam,profile,wheel,axlePair,rustPanel,TRIM_COLORS as C}
 from './propAnatomyPrimitives.js';

export const TRACTOR_ANATOMY_SPEC=Object.freeze({
 id:'yard-farm-tractor-anatomy-v2',orientation:'+Z FRONT',
 length:6.3,width:4.0,height:3.3,
 requiredParts:Object.freeze(['rear-drive-tyres','smaller-steered-wheels',
  'exposed-ladder-frame','front-diesel-engine','rear-gearbox',
  'real-front-axle','real-rear-axle','operator-safety-cage',
  'exhaust-stack','angled-bonnet','open-undercarriage']),
});
export function buildAnatomicalTractor(root){
 const g=new THREE.Group();g.name='CHUNKY ANATOMICAL WRECKED TRACTOR — experimental';
 g.userData.experimentalAnatomy=true;root.add(g);
 // Actual drivetrain first: twin rails, transverse axles, bolted crossmembers.
 for(const side of [-1,1]){
  beam(g,'open-ladder-chassis-rail', [side*.82,.90,-2.98],
    [side*.82,.86,2.76],.20,C.iron,7);
  beam(g,'triangulated-rear-support',[side*.78,.93,-2.55],
    [side*1.45,1.13,-1.86],.17,C.steel,7);
 }
 for(const z of [-2.55,-.25,2.26])
  beam(g,'crossmember-revealing-open-undercarriage',[-.86,.88,z],
    [.86,.88,z],.17,C.iron,8);
 axlePair(g,'rear-differential',-1.92,1.92,1.19,-1.90,C.steel);
 axlePair(g,'front-steered-axle',-1.71,1.71,.68,2.39,C.steel);
 cylinder(g,'gearbox-round-clutch-case',.40,.71,0,1.15,-.65,C.iron,'z',10);
 block(g,'rear-transmission-tail',1.28,.49,1.1,0,1.16,-1.15,C.clay,.27);
 cylinder(g,'rear-differential-housing',.46,.77,0,1.18,-1.90,C.iron,'x',10);
 beam(g,'visible-drive-shaft',[0,1.09,-1.8],[0,1.00,.63],.14,C.steel,8);
 for(const z of [-1.8,-.4,.75])ring(g,'drivetrain-bearing',
   .24,.07,0,1.07,z,C.steel,'z',10);

 // Heavy dissimilar tires are the strongest silhouette markers.
 for(const side of [-1,1]){
  wheel(g,'rear-drive-tyre-'+side,side*1.77,1.17,-1.87,
   {radius:1.05,width:.68,hub:.27,treadCount:9,
    rubber:C.rubber,rimColor:C.cream});
  wheel(g,'front-steered-wheel-'+side,side*1.51,.66,2.36,
   {radius:.59,width:.42,hub:.16,treadCount:8,
    rubber:C.rubber,rimColor:C.steel});
  // A real steering arm connects the steering knuckle to the frame.
  beam(g,'exposed-front-steering-link',[side*.81,.83,1.95],
   [side*1.47,.70,2.36],.078,C.steel,6);
  // Metal fenders arc above the rear wheel instead of concealing it.
  const a=side*1.71;
  for(let i=0;i<3;i++){
   const theta=Math.PI*.18+(i/2)*Math.PI*.67;
   const z=-1.87+Math.cos(theta)*1.18;
   const y=1.17+Math.sin(theta)*1.15;
   const slat=block(g,'segmented-rear-wheel-fender',
     .86,.20,.57,a,y,z,i===0?C.iron:C.paint,.26);
   slat.rotation.x=-theta+.5;
  }
 }
 // Diesel engine, raised off the open chassis. Four recognizable cylinders.
 rustPanel(g,'cast-engine-crankcase',1.48,.90,1.54,0,1.28,.76,C.iron,C.rust);
 for(let i=0;i<4;i++){
  const z=.20+i*.43;
  cylinder(g,'diesel-four-cylinder-head',.32,.44,0,1.88,z,C.clay,'y',10);
  ring(g,'head-gasket-edge',.245,.042,0,2.10,z,C.cream,'y',10);
  block(g,'cooling-fin',1.41,.11,.30,0,1.62,z,C.steel,.42);
  beam(g,'injector-line',[.28,2.10,z],[.59,1.95,z+.08],.075,C.cream,6);
 }
 beam(g,'oil-feed-pipe',[.54,1.96,.0],[.54,1.95,1.60],.11,C.steel,7);
 beam(g,'exhaust-manifold',[ -.55,1.92,.05],[-.55,1.95,1.64],.10,C.soot,8);
 // Fan pulleys and belt at the actual forward engine end.
 for(const [r,y]of [[.26,1.36],[.20,1.89]]){
  ring(g,'visible-front-belt-pulley',r,.06,0,y,1.66,C.steel,'z',12);
  cylinder(g,'fan-drive-hub',r*.38,.15,0,y,1.73,C.iron,'z',9);
 }
 // Half shroud: bonnet is a tapered SHELL with visible lower clearance,
 // rather than a single solid cuboid covering the engine block.
 profile(g,'left-angled-bonnet-shoulder',[
   [.05,2.09],[1.05,2.03],[2.28,1.82],[2.57,1.60],
   [2.49,1.46],[.28,1.68]],.14,-.85,C.yellow,.23);
 profile(g,'right-angled-bonnet-shoulder',[
   [.05,2.09],[1.05,2.03],[2.28,1.82],[2.57,1.60],
   [2.49,1.46],[.28,1.68]],.14,.85,C.yellow,.23);
 profile(g,'tapered-bonnet-top',[
   [.05,2.09],[1.13,2.04],[2.44,1.78],[2.44,1.67],[.05,1.89]],
   1.65,0,C.yellow,.18);
 for(const side of [-1,1]){
  for(let i=0;i<3;i++)
   block(g,'engine-hood-cooling-louvre',.09,.16,.21,
    side*.94,1.79-(i*.04),.70+i*.40,C.soot,.35);
 }
 // Two hollow grille posts frame the radiator.
 for(const side of [-1,1])
  block(g,'hood-radiator-side',.12,.59,.12,side*.67,1.53,2.53,C.iron);
 for(let i=0;i<3;i++)
  block(g,'radiator-open-slat',1.29,.11,.08,0,1.30+i*.18,2.59,C.soot);
 // Operator position, seat on transmission, no featureless opaque cab mass.
 cylinder(g,'steering-column-pivot',.105,.25,0,1.89,-.85,C.soot,'x',8);
 beam(g,'steering-column',[0,1.49,-1.02],[0,2.12,-.56],.065,C.steel);
 ring(g,'visible-steering-wheel',.35,.055,0,2.13,-.51,C.soot,'z',12);
 block(g,'saddle-seat',.98,.23,.79,0,1.71,-1.76,C.rubber,.09);
 block(g,'seat-back',1.01,.85,.21,0,2.04,-2.09,C.rubber,.10);
 beam(g,'seat-support',[0,1.05,-1.82],[0,1.65,-1.79],.14,C.iron);
 for(const side of [-1,1]){
  block(g,'operator-foot-platform',.68,.13,1.24,side*.82,1.22,-1.20,C.iron);
  block(g,'work-boot-running-step',.41,.09,.56,side*1.25,.85,-1.43,C.steel);
 }
 // Rear protective cage made of connected posts and open glazing space.
 for(const side of [-1,1]){
  for(const z of [-2.98,-1.01]){
   beam(g,'operator-cage-vertical-post',
     [side*1.10,1.38,z],[side*1.20,3.05,z],.14,C.paint,7);
  }
  beam(g,'upper-cage-side-rail',[side*1.20,3.05,-2.98],
    [side*1.20,3.05,-1.01],.16,C.steel);
  beam(g,'rear-safety-cage-diagonal',[side*1.10,1.47,-2.94],
    [side*1.19,2.95,-2.20],.062,C.rust,6);
 }
 block(g,'cab-floating-canopy-roof',2.98,.27,2.52,0,3.15,-1.99,C.paint,.27);
 beam(g,'canopy-front-crossrail',[-1.2,3.04,-1.01],
   [1.2,3.04,-1.01],.08,C.iron);
 beam(g,'canopy-rear-crossrail',[-1.2,3.04,-2.98],
   [1.2,3.04,-2.98],.09,C.iron);
 // Asymmetric exhaust travels from actual engine to above bonnet.
 beam(g,'exhaust-header',[-.54,1.90,1.10],[-.76,2.00,1.20],.11,C.soot);
 beam(g,'vertical-smokestack',[-.76,1.98,1.20],[-.76,2.86,1.20],.17,C.soot);
 cylinder(g,'exhaust-rain-flapper',.20,.06,-.77,2.88,1.20,C.steel,'y',8);
 block(g,'scraped-serial-plate',.53,.25,.065,.02,2.00,2.36,C.cream,.12);
 // The machine is wrecked, not a clean museum model.
 profile(g,'bent-left-panel',[[.18,1.72],[.86,1.64],[1.2,1.51],[.57,1.40]],
   .14,-1.00,C.rust);
 block(g,'dangling-right-service-hatch',.77,.42,.12,.91,1.36,.42,C.clay).rotation.z=-.23;
 return g;
}
