/** Backlot V5 gallery-only structural adjacency inspection.
 * Bounding boxes are a conservative early warning, NOT collision geometry
 * or proof of physical connectivity. It catches conspicuous floating hulls.
 */
import * as THREE from 'three';

// Pairs describe the load path that should exist in each assembled object.
// Deliberate voids (windscreens, tire holes, buckets) are never filled by audit.
const JOINS=Object.freeze({
 tractor:[
  ['cast-engine-crankcase','tractor-integrated-clutch-bellhousing'],
  ['rear-transmission-tail','tractor-integrated-clutch-bellhousing'],
  ['tractor-integrated-clutch-bellhousing','tractor-rear-gearbox-backbone'],
  ['tractor-side-fuel-tank','tractor-integrated-clutch-bellhousing'],
 ],
 loader:[
  ['loader-main-transmission-belly','rear-diesel-crankcase'],
  ['loader-main-transmission-belly','loader-operator-pedestal'],
  ['loader-operator-pedestal','cab-floor'],
  ['loader-main-transmission-belly','loader-front-bulkhead'],
  ['loader-main-transmission-belly','loader-bolted-track-cheek'],
 ],
 combine:[
  ['combine-solid-thresher-core','grain-hopper-tapered-bin'],
  ['combine-solid-thresher-core','combine-supported-grain-bin'],
  ['combine-solid-thresher-core','combine-cab-rear-firewall'],
  ['combine-cab-rear-firewall','combine-operator-footwell'],
  ['combine-reinforced-feeder-case','combine-feeder-hinge-housing'],
  ['combine-reinforced-feeder-case','combine-header-receiving-trough'],
 ],
 pickup:[
  ['pickup-deep-engine-bay','pickup-firewall-bellhousing'],
  ['pickup-deep-engine-bay','pickup-tapered-bonnet-shell'],
  ['pickup-deep-engine-bay','pickup-front-quarter-panel'],
  ['pickup-firewall-bellhousing','cab-firewall'],
  ['pickup-solid-rear-cab-wall','pickup-cab-floor'],
  ['pickup-rocker-sill','sagging-side-door'],
 ],
 engine:[
  ['cast-open-crankcase','engine-structural-gearbox-bell'],
  ['cast-open-crankcase','engine-bank-cast-shoulder'],
  ['cast-open-crankcase','oil-sump-housing'],
 ],
 coupling:[
  ['gearcase-open-bottom','coupling-lower-bearing-plinth'],
  ['gearcase-open-bottom','coupling-middle-drive-web'],
 ],
 generator:[
  ['generator-coupled-machinery-bed','diesel-engine-crankcase'],
  ['generator-alternator-bottom-cradle','dynamo-rotor-core'],
 ],
 turbine:[
  ['turbine-structural-bearing-stand','turbine-centre-bearing-case'],
  ['turbine-centre-bearing-case','split-heavy-cast-housing'],
 ],
 flatbed:[
  ['gear-cargo-support-cradle','salvaged-gear-rim'],
  ['gear-cargo-support-cradle','individual-flatbed-wood-plank'],
 ],
 container:[
  ['continuous-container-roof-deck','container-long-corrugated-sheet'],
 ],
 barricade:[
  ['continuous-scrap-wall-foundation','salvaged-vehicle-body-panel'],
 ],
});

function gap(a,b){
 const dx=Math.max(0,b.min.x-a.max.x,a.min.x-b.max.x);
 const dy=Math.max(0,b.min.y-a.max.y,a.min.y-b.max.y);
 const dz=Math.max(0,b.min.z-a.max.z,a.min.z-b.max.z);
 return Math.hypot(dx,dy,dz);
}
export function auditBacklotAssembly(group,family,{maxGap:.22}={}){
 group.updateWorldMatrix(true,true);
 const pairs=JOINS[family]||[];
 const failures=[];
 for(const [left,right] of pairs){
  const a=group.getObjectByName(left),b=group.getObjectByName(right);
  if(!a||!b){
   failures.push({pair:left+' ↔ '+right,issue:'missing named structural assembly'});
   continue;
  }
  const separation=gap(new THREE.Box3().setFromObject(a),
    new THREE.Box3().setFromObject(b));
  if(separation>maxGap)failures.push({
   pair:left+' ↔ '+right,
   issue:'unsupported structural gap',separation:Number(separation.toFixed(3)),
  });
 }
 if(family==='tyres'){
  // Prevent an accidental return to shafts/racks that don't read as tires.
  const tyres=[1,2,3].map(i=>group.getObjectByName('individual-grounded-tractor-tyre-'+i));
  if(tyres.some(t=>!t))failures.push({pair:'tyre pile',issue:'must contain exactly three named tyres'});
  else{
   const bounds=tyres.map(t=>new THREE.Box3().setFromObject(t));
   if(bounds.some(b=>b.min.y<-.22))
    failures.push({pair:'tyre pile',issue:'tyres penetrate floor'});
   if(gap(bounds[0],bounds[1])>.22||gap(bounds[0],bounds[2])>.24)
    failures.push({pair:'tyre pile',issue:'tyres do not form a contiguous pile'});
   if(Math.abs(tyres[2].rotation.z)<.55)
    failures.push({pair:'tyre pile',issue:'third tyre should lean against pile'});
  }
 }
 return {family,checked:pairs.length+(family==='tyres'?3:0),
  pass:failures.length===0,failures};
}
