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
