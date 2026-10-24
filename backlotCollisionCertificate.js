/** Backlot k5s2 - shared collision/display certificate.
 *
 * Offsite wagons, silos, poles, gates and shacks are set dressing, outside
 * the combat bounds. Deliberately DO NOT manufacture AABBs for them:
 * adding solid cover outside the yard is not a physical promotion.
 *
 * These checks run on the actual authored render graph, before decoration
 * instancing, and on the actual solids used by the firing raycaster.
 */
import * as THREE from 'three';

const SECONDARY=/^secondary-(?:trailer-|fuel-counter-|mechanic-|working-grain-|power-pole-|derby-gate|hog-pen-)/;
const EPS=.035,SAFE_MARGIN=.65;
const rounded=n=>Math.round(n*1000)/1000;
function boundaryClearance(box,world){
 // Positive = gap between the outside object and nearest PLAYABLE rectangle.
 // A model that touches or intrudes into the actual combat bounds is negative.
 const left=world.minX-box.max.x,right=box.min.x-world.maxX;
 const near=world.minZ-box.max.z,far=box.min.z-world.maxZ;
 return Math.max(left,right,near,far);
}
export function secondaryGeometryClearance(root,world,{margin=SAFE_MARGIN}={}){
 root.updateMatrixWorld(true);
 const items=[];
 for(const group of root.children){
  if(!group.isGroup||!SECONDARY.test(group.name))continue;
  const box=new THREE.Box3().setFromObject(group);
  const gap=boundaryClearance(box,world);
  items.push(Object.freeze({id:group.name,
    clearance:rounded(gap),
    minX:rounded(box.min.x),maxX:rounded(box.max.x),
    minZ:rounded(box.min.z),maxZ:rounded(box.max.z),
    safe:gap>=margin}));
 }
 const bad=items.filter(item=>!item.safe);
 return Object.freeze({expected:18,count:items.length,requiredClearance:margin,
  pass:items.length===18&&bad.length===0,
  offsiteWithoutCollider:items.length,
  errors:[...(items.length===18?[]:['Expected eighteen rebuilt offsite props']),
    ...bad.map(item=>item.id+' intersects or approaches the playable yard')],
  items});
}
export function auditBacklotCollisionTruth(root,world,solids){
 const secondary=secondaryGeometryClearance(root,world);
 const expected=new Map((world.obstacles||[]).map(o=>[o.id,o]));
 const hits=new Map();
 const errors=[...secondary.errors];
 for(const solid of solids||[]){
  const id=solid.userData?.arenaObstacleId;
  if(!id||id==='floor')continue;
  if(!expected.has(id)){
   errors.push('Unknown physical blocker '+id);continue;
  }
  hits.set(id,(hits.get(id)||0)+1);
  const o=expected.get(id);
  solid.updateWorldMatrix(true,false);
  const actual=new THREE.Box3().setFromObject(solid);
  for(const [have,want,key] of [
   [actual.min.x,o.minX,'minX'],[actual.max.x,o.maxX,'maxX'],
   [actual.min.z,o.minZ,'minZ'],[actual.max.z,o.maxZ,'maxZ'],
   [actual.min.y,0,'minY'],[actual.max.y,o.height,'maxY']]){
   if(Math.abs(have-want)>EPS)
    errors.push(id+' rendered hit volume does not match authored '+key+
      ' (actual '+rounded(have)+', authored '+rounded(want)+')');
  }
 }
 for(const id of expected.keys())
  if(hits.get(id)!==1)errors.push(id+' must have one authoritative raycast prism, got '+(hits.get(id)||0));
 const artGroups=root.children.filter(group=>SECONDARY.test(group.name));
 for(const group of artGroups)
  group.traverse(o=>{
   if(o.userData?.arenaObstacleId)
    errors.push('Offsite scenery incorrectly marked as a projectile/AI solid: '+group.name);
  });
 return Object.freeze({
  pass:errors.length===0,
  gameplayObstacleCount:expected.size,
  authoritativeRaycastSolids:[...hits.values()].reduce((a,b)=>a+b,0),
  uncollidableOffsiteAssets:secondary.count,
  secondary,
  errors,
 });
}
/** Explicit disposition of existing gallery anatomy.
 * These still require compound shape fitting BEFORE their live box blockers
 * can be deleted. Treating OPEN cab, track or tyre voids as fully opaque
 * would preserve invisible hits and is not an acceptable promotion.
 */
export const ANATOMY_COLLISION_PROMOTION=Object.freeze({
  currentPolicy:'retain-certified-AABBs-until-compound-fit',
  galleryOnly:true,
  plannedFamilies:Object.freeze([
   'tractor','loader','combine','pickup','engine','coupling','generator',
   'turbine','tyres','drums','flatbed','barricade','container','concrete',
  ]),
});
