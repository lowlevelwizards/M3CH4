/** Point-set operations for intentional edge/face editing. Geometry remains V2-compatible. */
import {meshPointGroups} from './editableMesh.js';
import {meshAdjacency} from './meshTopology.js';
const mean=points=>[0,1,2].map(a=>points.reduce((s,p)=>s+p[a],0)/points.length);
export function selectableElements(g,level){
 if(!['edge','face'].includes(level))throw Error('Select Edge or Face mode');
 if(g.type==='mesh'){
  const groups=meshPointGroups(g),byIndex=new Map();
  groups.forEach((group,i)=>group.indices.forEach(v=>byIndex.set(v,i)));
  const top=meshAdjacency(g);
  const items=level==='edge'?top.edges:top.faces;
  const seen=new Set(),result=[];
  for(const item of items){
   const idx=[...new Set(item.vertices.map(v=>byIndex.get(v)))];
   if(idx.length<(level==='edge'?2:3))continue;
   const id=idx.slice().sort((a,b)=>a-b).join(':');
   if(seen.has(id))continue;
   seen.add(id);
   const points=item.vertices.map(i=>g.positions.slice(i*3,i*3+3));
   result.push({id:level+':'+id,points,center:mean(points),
    members:idx.map(i=>'factory-mesh:'+i)});
  }
  return result;
 }
 if(g.profile){
  if(level==='face'){
   const points=g.profile.map(p=>[p[0],p[1],g.depth/2]);
   return [{id:'face:profile',points,center:mean(points),
    members:g.profile.map((_,i)=>'profile:'+i)}];
  }
  return g.profile.map((p,i)=>{
   const j=(i+1)%g.profile.length;
   const points=[[p[0],p[1],g.depth/2],[...g.profile[j],g.depth/2]];
   return {id:'edge:'+i,points,center:mean(points),
    members:['profile:'+i,'profile:'+j]};
  });
 }
 throw Error('Edge/Face selection supports imported mesh and polygon shells. Use Points for loft parameters.');
}
export function modifyElementVertexSelection(previous,elements,{operation='replace'}={}){
 const selection=operation==='replace'?new Set():new Set(previous);
 for(const element of elements){
  for(const vertex of element.members){
   if(operation==='subtract')selection.delete(vertex);
   else selection.add(vertex);
  }
 }
 return selection;
}
