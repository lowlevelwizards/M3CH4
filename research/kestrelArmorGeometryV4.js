/** Kestrel V4: deliberately faceted, genuinely hollow upper leg housings.
 * The old 2-ring wide-open cuff looked like an oversized U-bracket. These are
 * elongated five-station tapered casings, designed around the diagonal castings
 * and with small openings at both ends. The outside face is one continuous
 * plate, side walls are integrated, and the rear hock remains uncovered.
 *
 * All coordinates are in the ORIGINAL CASTING local frame (Y = long axis,
 * -Z = strike face); orientation is inherited from the animated link mount.
 * No geometry references the game save format or production armor system.
 */
import * as THREE from 'three';
import {plateGeometry} from './yardwalkerSilhouetteArmor.js';

const sample=(profile,y)=>{
 const t=Math.max(0,Math.min(1,y/profile.len+.5));
 return {width:profile.bottomW+(profile.topW-profile.bottomW)*t,
  depth:profile.bottomD+(profile.topD-profile.bottomD)*t};
};
const contour=(s)=>{
 const {y,width,front,back,x=0}=s,w=width/2;
 const chamfer=Math.min(.055,width*.17,(back-front)*.19);
 return [
  [x-w+chamfer,y,front],[x+w-chamfer,y,front],
  [x+w,y,front+chamfer],[x+w,y,back-chamfer],
  [x+w-chamfer,y,back],[x-w+chamfer,y,back],
  [x-w,y,back-chamfer],[x-w,y,front+chamfer]
 ];
};
const ringIndices=(indices,a,b,reverse=false)=>{
 for(let i=0;i<8;i++){
  const n=(i+1)%8,ai=a+i,aj=a+n,bi=b+i,bj=b+n;
  if(reverse)indices.push(ai,aj,bj,ai,bj,bi);
  else indices.push(ai,bj,aj,ai,bi,bj);
 }
};
/** Tube with front/side/back all continuously covered and open top + bottom.
 * Connected inner-wall and bevelled end rims; winding is consistent for
 * FrontSide lighting, including from below in the workbench.
 */
export function loftedOpenCasing(stations,label='kestrel-fairing'){
 if(stations.length<3)throw Error('Armor shell needs at least three stations');
 const n=stations.length,outer=stations.map(s=>contour(s.outer)),
  inner=stations.map(s=>contour(s.inner));
 const verts=[...outer.flat(),...inner.flat()],indices=[];
 for(let k=0;k<n-1;k++){
  ringIndices(indices,k*8,(k+1)*8,false);
  ringIndices(indices,(n+k)*8,(n+k+1)*8,true);
 }
 for(let i=0;i<8;i++){
  const j=(i+1)%8;
  // Bottom and top thin physical rim, NOT a solid cap over the piston.
  indices.push(i,j,n*8+j,i,n*8+j,n*8+i);
  const a=(n-1)*8,b=(2*n-1)*8;
  indices.push(a+i,b+j,a+j,a+i,b+i,b+j);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(verts.flat(),3));
 geo.setIndex(indices);
 geo.computeVertexNormals();
 geo.userData={kestrelArmor:true,kind:label,openEnded:true,stations:n};
 return geo;
}
/** Upper leg enclosure: five cross sections create a distinct shoulder,
 * long continuous upper-body face, sharp silhouette break, and tight hock
 * exit. Width is gained from the hip end, not by bolting on giant wings.
 */
export function tailoredThighShell(profile,anatomy,style='swept'){
 if(!['swept','pod'].includes(style))throw Error('Unknown full shell '+style);
 const pod=style==='pod';
 const shoulders=pod?
  [ // squat, broad industrial pod with chamfered leading shoulder
   [-.395,.105,.115,.095],
   [-.32,.178,.14,.105],
   [.16,.285,.18,.125],
   [.32,.328,.19,.135],
   [.39,.285,.165,.12]
  ]:
  [ // streamlined raptor fairing; clear hip -> tapered knee
   [-.40,.067,.074,.063],
   [-.30,.091,.086,.073],
   [.06,.19,.115,.084],
   [.31,.308,.152,.095],
   [.41,.25,.12,.08]
  ];
 const stations=shoulders.map(([fraction,extraW,frontW,rearW])=>{
  const y=profile.len*fraction,base=sample(profile,y),fl=anatomy.flare;
  // Inner bore is *small* enough to stay visually closed from front/side,
  // but intentionally open and 15–20 mm outside the structural casting.
  const clearance=.022;
  const inner={y,width:base.width+clearance*2,
   front:-base.depth/2-clearance,back:base.depth/2+clearance};
  const outer={y,width:base.width+extraW*fl,
   front:-base.depth/2-frontW*fl,
   back:base.depth/2+rearW*fl};
  return {outer,inner};
 });
 return loftedOpenCasing(stations,pod?'kestrel-thigh-pod':'kestrel-swept-fairing');
}
/** Split is intentionally NOT a hollow band: separate bolted side cheek
 * castings framing a small dark central machine spine. No giant top bridge.
 */
export function tailoredSplitCheek(profile,anatomy,index){
 const sign=index===0?-1:1;
 const station=y=>{
  const base=sample(profile,y),t=y/profile.len+.5;
  const narrowAtKnee=.065,wideAtHip=.142*anatomy.flare;
  const extra=narrowAtKnee+(wideAtHip-narrowAtKnee)*t;
  const gap=Math.min(anatomy.splitGap*.28,base.width*.24);
  const stripW=base.width*.31+extra*.52;
  const center=sign*(gap/2+stripW/2);
  return {y,x:center,width:stripW,
   front:-base.depth/2-(.068+.035*t),
   back:base.depth*.10};
 };
 return plateGeometry(station(-profile.len*.375),station(profile.len*.37));
}
/** Individually removable front piece. Light remains very close-fitting;
 * Heavy is intentionally broader, with a consistent outer cheek seam.
 */
export function tailoredFrontStrike(profile,kind,anatomy,tier){
 const isLight=tier===1;
 const extent=kind==='thigh'?(isLight?.31:.355):(isLight?.35:.39);
 const station=y=>{
  const base=sample(profile,y);
  const ratio=(isLight?.74:.89)*anatomy.front;
  const thickness=isLight?.059:.080;
  return {y,width:base.width*ratio,
   front:-base.depth/2-thickness,
   back:-base.depth/2-.018};
 };
 return plateGeometry(station(-profile.len*extent),station(profile.len*extent));
}
/** Instead of a detached side strip, overlap the edge of the main plate
 * slightly and tuck this angular cheek into the original casting. The
 * 6–10mm exposed join reads as a single multi-piece mechanical fairing.
 */
export function tailoredOuterCheek(profile,side,anatomy,kind){
 const extent=kind==='thigh'?.328:.355;
 const station=y=>{
  const b=sample(profile,y);
  const width=kind==='thigh'?.088*anatomy.heavy:.075*anatomy.shin;
  const front=-b.depth/2-.052;
  const x=side*(b.width*.48+.007);
  return {y,x,width,front,back:b.depth*.33};
 };
 return plateGeometry(station(-profile.len*extent),station(profile.len*extent));
}
