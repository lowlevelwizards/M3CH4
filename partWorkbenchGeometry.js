/** Three.js adapter for the shared Yardwalker casing recipe. */
import * as THREE from 'three';
import {calfMeshData,validateCalfRecipe,DEFAULT_CALF_RECIPE} from './partWorkbenchRecipe.js';
export const CALF_SHELL_TAG='yardwalker-calf-shell-v1';

export function calfGeometry(recipe,length){
  const {vertices,indices}=calfMeshData(recipe,length);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
/** Same named, joint-parented object as the production authored tapered casing. */
export function addYardwalkerCalf(parent,name,from,to,material){
  const begin=new THREE.Vector3(...from),end=new THREE.Vector3(...to);
  const direction=end.clone().sub(begin),length=direction.length();
  const mesh=new THREE.Mesh(calfGeometry(DEFAULT_CALF_RECIPE,length),material);
  mesh.name=name;
  mesh.position.copy(begin);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  mesh.userData.workbenchShape=CALF_SHELL_TAG;
  mesh.userData.workbenchLength=length;
  parent.add(mesh);
  return mesh;
}
/** Swap only visual shell vertices in the *actual production-built rig*.
 * The pivot hierarchy, transforms, sockets, physics, and attachment geometry stay put.
 * If a model isn't the expected Yardwalker there are no side effects.
 */
export function applyYardwalkerCalfRecipe(root,input){
  const recipe=validateCalfRecipe(input),targets=[];
  root?.traverse(node=>{
    if(node.isMesh&&node.userData.workbenchShape===CALF_SHELL_TAG)
      targets.push(node);
  });
  if(targets.length!==2)
    return {ok:false,count:targets.length,reason:'Expected both authored Yardwalker calf casings.'};
  // Allocate first; never leave one side edited if geometry generation fails.
  const replacements=targets.map(node=>calfGeometry(recipe,node.userData.workbenchLength));
  targets.forEach((node,index)=>{
    const previous=node.geometry;
    node.geometry=replacements[index];
    previous?.dispose?.();
  });
  return {ok:true,count:2};
}
