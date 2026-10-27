/** Non-destructive stable logical weld groups and simple triangle adjacency. */
import {clone,validateGeometry} from './blueprint.js';
const positionKey=(x,y,z)=>[x,y,z].map(v=>Math.round(v*1e4)).join(',');
export function deriveLogicalVertexGroups(g){
 validateGeometry(g);
 if(g.type!=='mesh')throw Error('Not a mesh');
 const groups=[],lookup=new Map();
 for(let i=0;i<g.positions.length;i+=3){
  const key=positionKey(...g.positions.slice(i,i+3));
  if(!lookup.has(key)){lookup.set(key,groups.length);groups.push([]);}
  groups[lookup.get(key)].push(i/3);
 }
 return groups;
}
export function freezeLogicalVertexGroups(g){
 if(g.type!=='mesh')throw Error('Not a mesh');
 const out=clone(g);
 if(!out.pointGroups)out.pointGroups=deriveLogicalVertexGroups(g);
 return validateGeometry(out);
}
export function meshAdjacency(g){
 if(g.type!=='mesh')throw Error('Not a mesh');
 const byVertex=new Map(),edges=new Map(),faces=[];
 const sortedKey=(a,b)=>a<b?a+':'+b:b+':'+a;
 for(let f=0;f<g.indices.length;f+=3){
  const verts=g.indices.slice(f,f+3),fi=faces.length;
  faces.push({id:fi,vertices:verts});
  for(const v of verts){if(!byVertex.has(v))byVertex.set(v,new Set());byVertex.get(v).add(fi);}
  for(let i=0;i<3;i++){
   const a=verts[i],b=verts[(i+1)%3],key=sortedKey(a,b);
   if(!edges.has(key))edges.set(key,{id:key,vertices:[Math.min(a,b),Math.max(a,b)],faces:[]});
   edges.get(key).faces.push(fi);
  }
 }
 return {vertices:byVertex,edges:[...edges.values()],faces};
}
/** Polygon profile insertion on a particular edge, preserving its winding. */
export function insertProfilePoint(g,edgeIndex,fraction=.5){
 if(!Array.isArray(g?.profile))throw Error('Choose a profile shape');
 if(!Number.isInteger(edgeIndex)||edgeIndex<0||edgeIndex>=g.profile.length||!Number.isFinite(fraction)||fraction<=0||fraction>=1)throw Error('Invalid edge insertion');
 const out=clone(g),a=g.profile[edgeIndex],b=g.profile[(edgeIndex+1)%g.profile.length];
 out.profile.splice(edgeIndex+1,0,a.map((v,i)=>Number((v+(b[i]-v)*fraction).toFixed(5))));
 return validateGeometry(out);
}
export function insertLoftSection(g,sectionIndex,fraction=.5){
 if(g?.type!=='loft'||!Number.isInteger(sectionIndex)||sectionIndex<0||sectionIndex>=g.sections.length-1||fraction<=0||fraction>=1)throw Error('Invalid loft interval');
 const out=clone(g),a=g.sections[sectionIndex],b=g.sections[sectionIndex+1],mid={};
 for(const key of ['y','width','front','back'])mid[key]=Number((a[key]+(b[key]-a[key])*fraction).toFixed(5));
 out.sections.splice(sectionIndex+1,0,mid);
 return validateGeometry(out);
}
