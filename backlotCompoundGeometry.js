/** Backlot k5s4 — one physical language for movement, AI, and fire.
 * Fit fractions refer to the twelve *existing* authored tractor/loader
 * part envelopes. A part is [xMin,xMax,zMin,zMax,yMin,yMax].
 *
 * These are conservative steel/rubber volumes, NOT a render-mesh hull:
 * empty upper cabs and the open bucket have no filled central hit prism.
 * All systems consume these same boxes. Original parent IDs survive.
 */
const FITS=Object.freeze({
 'tractor-chassis':[
  [.23,.77,.16,.86,0,1.40], // central transmission backbone
  [.13,.87,.17,.29,.46,1.22], // back differential
  [.18,.82,.69,.82,.42,1.23], // front axle
 ],
 'tractor-cab':[
  [.12,.88,.03,.21,.28,1.39], // seat/gearbox rear
  [.12,.88,.76,.95,.45,1.43], // dashboard/bulkhead
  [.07,.19,.15,.87,1.38,3.08], // left ROPS
  [.81,.93,.15,.87,1.38,3.08], // right ROPS
  [.06,.94,.03,.19,1.55,3.05], // rear cage
  [.02,.98,.02,.97,3.05,3.34], // canopy, air beneath
 ],
 'tractor-bonnet':[
  [.17,.83,.15,.88,.44,1.45], // diesel engine
  [.12,.88,.13,.91,1.44,1.98], // visible bonnet shell
 ],
 'tractor-wheel-fl':[[.08,.92,.08,.92,0,1.43]],
 'tractor-wheel-rl':[[.08,.92,.08,.92,0,1.43]],
 'tractor-wheel-fr':[[.08,.92,.08,.92,0,1.43]],
 'tractor-wheel-rr':[[.08,.92,.08,.92,0,1.43]],
 'loader-scoop':[
  [.02,.98,.02,.98,.08,.42], // working floor
  [.02,.98,.73,.98,.40,1.48], // bucket backplate
  [.01,.10,.04,.96,.37,1.47], // left cheek
  [.90,.99,.04,.96,.37,1.47], // right cheek
  // OPEN above the front cutting edge.
 ],
 'loader-engine':[
  [.15,.85,.10,.89,.12,1.28], // drive/transmission belly
  [.20,.78,.53,.94,1.27,1.88], // engine rear housing
 ],
 'loader-cab':[
  [.14,.86,.08,.93,.35,1.55], // operator plinth
  [.07,.18,.08,.21,1.54,2.76], // front left cage upright
  [.82,.93,.08,.21,1.54,2.76],
  [.07,.18,.79,.92,1.54,2.76], // rear uprights
  [.82,.93,.79,.92,1.54,2.76],
  [.04,.96,.05,.95,2.62,2.77], // canopy
 ],
 'loader-track-left':[
  [.06,.94,.04,.96,0,.34], // grounded track shoes
  [.06,.94,.04,.96,.83,1.04], // upper tread
  [.05,.95,.04,.20,.25,.92], // sprocket end
  [.05,.95,.80,.96,.25,.92],
 ],
 'loader-track-right':[
  [.06,.94,.04,.96,0,.34],
  [.06,.94,.04,.96,.83,1.04],
  [.05,.95,.04,.20,.25,.92],
  [.05,.95,.80,.96,.25,.92],
 ],
});
const CACHE=new WeakMap();
const round=n=>Math.round(n*10000)/10000;
export const COMPOUND_FAMILY_IDS=Object.freeze(Object.keys(FITS));
export const COMPOUND_FAMILIES=Object.freeze(['tractor','loader']);
export const COMPOUND_HULL_CLEARANCE=Object.freeze({bodyTop:2.8});

/** Generate stable, named world-space prisms once for each authored obstacle.
 * Legacy maps, dynamic rigs and other Backlot objects are unchanged.
 */
export function collisionPieces(obstacle){
 if(!obstacle || typeof obstacle!=='object')return [];
 const fit=FITS[obstacle.id];
 if(!fit || obstacle.dynamic)return [obstacle];
 let cached=CACHE.get(obstacle);
 if(cached)return cached;
 const x=obstacle.maxX-obstacle.minX,z=obstacle.maxZ-obstacle.minZ;
 const parts=fit.map(([lx,rx,lz,rz,lo,hi],index)=>Object.freeze({
  id:obstacle.id,partId:obstacle.id+'::'+index,
  parentId:obstacle.id,kind:obstacle.kind,art:obstacle.art,
  minX:round(obstacle.minX+lx*x),maxX:round(obstacle.minX+rx*x),
  minZ:round(obstacle.minZ+lz*z),maxZ:round(obstacle.minZ+rz*z),
  minY:lo,maxY:hi,height:hi,
 }));
 cached=Object.freeze(parts);
 CACHE.set(obstacle,cached);
 return cached;
}
/** Only masses reachable by a 2.8m mech obstruct ground movement.
 * Above-head canopy roofs still block projectiles at canopy elevation.
 */
export function movementPieces(obstacle,bodyTop=COMPOUND_HULL_CLEARANCE.bodyTop){
 return collisionPieces(obstacle).filter(p=>(p.minY??0)<bodyTop);
}
export function isCompoundObstacle(obstacle){return !!FITS[obstacle?.id];}
export function allCollisionPieces(obstacles){
 return (obstacles||[]).flatMap(collisionPieces);
}
export function allMovementPieces(obstacles){
 return (obstacles||[]).flatMap(o=>o.dynamic?[o]:movementPieces(o));
}
/** Test a 2D rig footprint against the real compound solids, not their
 * empty rectangular bounding envelopes.
 */
export function positionHitsCover(point,obstacles,padding=0,{includeDynamic=true}={}){
 return (obstacles||[]).some(o=>(includeDynamic||!o.dynamic)&&
  movementPieces(o).some(p=>
   point.x>p.minX-padding&&point.x<p.maxX+padding&&
   point.z>p.minZ-padding&&point.z<p.maxZ+padding));
}
