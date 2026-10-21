/** k.3z -- authored live structural anatomy.
 * Shared drawing vocabulary only; sockets/mass/load ratings come from components.js.
 * Solids are the actual raycast bodies, never invisible shields.
 */
import * as THREE from 'three';
import {groupAt,block,chamferBlock,disk,beamBetween,wedge} from './commandVisualKit.js';
export {groupAt};
export const blockAt=block, chamfer=chamferBlock, bearing=disk, beam=beamBetween;

/** Every named interface is read from the catalogue-backed fixture. */
export function socket(fixture,id){
    const match=fixture.sockets.find(s=>s.id===id);
    if(!match)throw Error('Frame '+fixture.id+' has no '+id+' socket');
    return match.position.slice();
}
export function frameRoot(fixture,family){
    if(fixture?.slot!=='structure'||!Array.isArray(fixture.sockets)||
        !fixture.envelope?.every(n=>Number.isFinite(n)&&n>0))
        throw Error('Expected source-backed structure fixture');
    const root=new THREE.Group();
    root.name='live-frame:'+fixture.id;
    root.userData.frameFamily=family;
    return root;
}
/** Sloped enclosed real steel. All six faces have outward winding and hard normals. */
export function shell(parent,name,at,sections,tone){
    const solid=wedge(parent,name,at,sections,tone);
    const indexed=solid.geometry;
    solid.geometry=indexed.toNonIndexed();
    solid.geometry.computeVertexNormals();
    indexed.dispose();
    return solid;
}
/** An attachment ring is not a new socket; it is only a visible landing face. */
export function contact(parent,name,at,radius=.18,depth=.09,axis='y'){
    const g=groupAt(parent,name);
    bearing(g,'machined contact face',at,radius,depth,'bright',axis,10);
    return g;
}
export function finishFrameVisual(root,fixture){
    let count=0;
    root.traverse(n=>{
        if(!n.isMesh)return;
        count++;
        n.userData.fitFixtureId=fixture.id;
        n.castShadow=true;n.receiveShadow=true;
        if(!n.geometry?.getAttribute('position'))throw Error('Missing frame vertices: '+n.name);
    });
    if(count<10)throw Error('Frame anatomy incomplete: '+fixture.id);
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root,true);
    const min=bounds.min.toArray(),max=bounds.max.toArray();
    if([...min,...max].some(v=>!Number.isFinite(v)))throw Error('Invalid frame bounds');
    root.userData={
        ...root.userData,fitFixtureId:fixture.id,previewOnly:true,
        sockets:fixture.sockets.map(s=>({id:s.id,position:s.position.slice(),
            standard:s.standard,rotation:s.rotation.slice()})),
        visibleBounds:{min,max},
        nominalEnvelope:fixture.envelope.slice(),
    };
    // Same nonphysical outline mechanism as the existing authored part builders.
    const edges=new THREE.EdgesGeometry(new THREE.BoxGeometry(...fixture.envelope));
    const outline=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xe6b249}));
    outline.visible=false;outline.name='nominal-frame-envelope';
    root.add(outline);root.userData.outline=outline;
    return root;
}
