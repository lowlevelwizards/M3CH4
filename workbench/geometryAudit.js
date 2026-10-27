/** Advisory Workbench design audit; do not mistake bounds tests for physical certification. */
export function inspectBlueprint(document){
 const nodes=document.nodes.filter(n=>n.id!=='root'),shapeNodes=nodes.filter(n=>n.kind==='shape');
 const meshes=shapeNodes.filter(n=>n.geometry?.type==='mesh');
 const triangles=meshes.reduce((s,n)=>s+n.geometry.indices.length/3,0);
 const vertices=meshes.reduce((s,n)=>s+n.geometry.positions.length/3,0);
 const missingNames=nodes.filter(n=>!/[^\s]/.test(n.name)).length;
 const locked=nodes.filter(n=>n.locked).length,hidden=nodes.filter(n=>!n.visible).length;
 const byType={};
 for(const n of shapeNodes)byType[n.geometry.type]=(byType[n.geometry.type]||0)+1;
 const warnings=[];
 if(nodes.length>150)warnings.push('Large object hierarchy: review redundant individual meshes.');
 if(vertices>12000)warnings.push('Dense imported geometry: consider isolating subassemblies while editing.');
 if(missingNames)warnings.push('Some subassemblies have no descriptive names.');
 if(hidden)warnings.push(hidden+' hidden components: inspect before publishing.');
 return {nodes:nodes.length,shapes:shapeNodes.length,meshes:meshes.length,vertices,triangles,locked,hidden,byType,warnings,
  note:'Advisory geometry metrics only. Mating faces, collision and moving clearances require real-machine checks.'};
}


/** On-demand mesh diagnostic; boundaries/islands are advisory because hard-edge
 * render-vertex splits can represent intentional visual seams.
 */
export function deepMeshAudit(geometry){
 if(geometry?.type!=='mesh')throw Error('Select an imported mesh for topology diagnostics.');
 const {positions,indices}=geometry;
 const edges=new Map(),byVertex=new Map();
 let degenerate=0;
 for(let t=0;t<indices.length;t+=3){
  const tri=indices.slice(t,t+3),coords=tri.map(i=>positions.slice(i*3,i*3+3));
  const a=coords[0],b=coords[1],c=coords[2];
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
  const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  if(new Set(tri).size<3||cross.reduce((s,v)=>s+v*v,0)<1e-14)degenerate++;
  for(const i of tri){
   if(!byVertex.has(i))byVertex.set(i,new Set());
   byVertex.get(i).add(t/3);
  }
  for(let j=0;j<3;j++){
   const x=tri[j],y=tri[(j+1)%3],key=x<y?x+':'+y:y+':'+x;
   edges.set(key,(edges.get(key)||0)+1);
  }
 }
 let boundaries=0,nonManifold=0;
 for(const count of edges.values()){if(count===1)boundaries++;else if(count>2)nonManifold++;}
 const visited=new Set(),faces=indices.length/3;
 let renderIslands=0;
 for(let seed=0;seed<faces;seed++){
  if(visited.has(seed))continue;renderIslands++;const queue=[seed];visited.add(seed);
  for(let q=0;q<queue.length;q++){
   const t=queue[q];
   for(const vertex of indices.slice(t*3,t*3+3))
    for(const neighbor of byVertex.get(vertex)||[])if(!visited.has(neighbor)){
     visited.add(neighbor);queue.push(neighbor);
    }
  }
 }
 return {triangles:faces,renderVertices:positions.length/3,degenerateTriangles:degenerate,
  boundaryEdges:boundaries,nonManifoldEdges:nonManifold,renderIslands,
  note:'Advisory raw render topology. UV/hard-edge seams can appear as boundaries or islands. Not a collision certification.'};
}
