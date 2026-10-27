/** Atomic multi-vertex transforms. Always read from the gesture's original geometry. */
import {clone,validateGeometry} from './blueprint.js';
import {meshPointGroups} from './editableMesh.js';
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function transformMeshGroups(geometry,groupIndices,{delta=[0,0,0],scale=[1,1,1],pivot=null}={}){
 if(geometry?.type!=='mesh')throw Error('Select an imported mesh');
 if(!finite3(delta)||!finite3(scale)||scale.some(x=>x<=0))throw Error('Invalid group transform');
 const groups=meshPointGroups(geometry),indices=[...new Set(groupIndices)];
 if(indices.some(i=>!Number.isInteger(i)||i<0||i>=groups.length))throw Error('Invalid selected point');
 if(!indices.length)return clone(geometry);
 const center=pivot||[0,1,2].map(axis=>indices.reduce((sum,i)=>sum+groups[i].position[axis],0)/indices.length);
 if(!finite3(center))throw Error('Invalid pivot');
 const result=clone(geometry);
 for(const i of indices){
  const g=groups[i],next=g.position.map((v,axis)=>Number((center[axis]+(v-center[axis])*scale[axis]+delta[axis]).toFixed(5)));
  if(next.some(n=>Math.abs(n)>100))throw Error('Vertex outside editing bounds');
  for(const vertex of g.indices)for(let axis=0;axis<3;axis++)result.positions[vertex*3+axis]=next[axis];
 }
 delete result.normals;
 return validateGeometry(result);
}
export function transformProfilePoints(geometry,pointIndices,{delta=[0,0,0],scale=[1,1,1],pivot=null}={}){
 if(!Array.isArray(geometry?.profile))throw Error('Select a profile-based shape');
 if(!finite3(delta)||!finite3(scale)||scale.some(x=>x<=0))throw Error('Invalid group transform');
 const indices=[...new Set(pointIndices)];
 if(indices.some(i=>!Number.isInteger(i)||i<0||i>=geometry.profile.length))throw Error('Invalid profile vertex');
 const result=clone(geometry);
 if(!indices.length)return result;
 const center=pivot||[0,1].map(axis=>indices.reduce((sum,i)=>sum+geometry.profile[i][axis],0)/indices.length);
 for(const i of indices)for(let axis=0;axis<2;axis++)
  result.profile[i][axis]=Number((center[axis]+(geometry.profile[i][axis]-center[axis])*scale[axis]+delta[axis]).toFixed(5));
 return validateGeometry(result);
}
