/** Bake an existing linked X mirror to editable independent geometry without a visual flip. */
import {clone,validateGeometry} from './blueprint.js';
export function bakeXReflection(source){
 const next=clone(source);
 if(next.type==='mesh'){
  for(let i=0;i<next.positions.length;i+=3)next.positions[i]=-next.positions[i];
  if(next.normals)for(let i=0;i<next.normals.length;i+=3)next.normals[i]=-next.normals[i];
  for(let i=0;i<next.indices.length;i+=3)[next.indices[i+1],next.indices[i+2]]=[next.indices[i+2],next.indices[i+1]];
  // Group indices remain linked to their exact source vertex memberships.
  return validateGeometry(next);
 }
 if(next.profile){
  next.profile=next.profile.map(([x,y])=>[-x,y]).reverse();
  return validateGeometry(next);
 }
 // Box, chamfer, cylinder, tube, taper and loft are all X-symmetric.
 return validateGeometry(next);
}
