/** Point editing on imported indexed/nonindexed production meshes.
 * Weld coincident render vertices for dragging, preserving UV/hard-edge seams.
 * Geometry ownership stays inside V2 blueprints, never the factory builder.
 */
import {clone,validateGeometry} from './blueprint.js';
import {deriveLogicalVertexGroups,freezeLogicalVertexGroups} from './meshTopology.js';
export const MESH_HANDLES_PER_PAGE=64;
export function meshPointGroups(g){
 validateGeometry(g);
 if(g.type!=='mesh')throw Error('Not an imported mesh');
 const membership=g.pointGroups||deriveLogicalVertexGroups(g);
 return membership.map((indices,id)=>({id,indices,
  position:indices.length?g.positions.slice(indices[0]*3,indices[0]*3+3):[0,0,0]}));
}
export function meshPointPage(g,page=0){
 const groups=meshPointGroups(g),pages=Math.max(1,Math.ceil(groups.length/MESH_HANDLES_PER_PAGE));
 const current=Math.max(0,Math.min(pages-1,page));
 return {points:groups.slice(current*MESH_HANDLES_PER_PAGE,(current+1)*MESH_HANDLES_PER_PAGE)
  .map((group,index)=>({index:index+current*MESH_HANDLES_PER_PAGE,position:group.position})),
  count:groups.length,page:current,pages};
}
export function updateMeshPoint(g,index,position){
 if(!Array.isArray(position)||position.length!==3||position.some(n=>!Number.isFinite(n)||Math.abs(n)>100))
  throw Error('Invalid mesh point position');
 const groups=meshPointGroups(g),group=groups[index];
 if(!group)throw Error('Point index does not exist');
 const edited=freezeLogicalVertexGroups(g);
 for(const vertex of group.indices)for(let axis=0;axis<3;axis++)
  edited.positions[vertex*3+axis]=Number(position[axis].toFixed(5));
 // Editing a surface invalidates the original authored vertex normals.
 delete edited.normals;
 return validateGeometry(edited);
}
