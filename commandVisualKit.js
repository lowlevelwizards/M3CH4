/** M3CH4 k.3y — tiny shared vocabulary for three independently authored command cabs.
 * Coordinates: +X right, +Y up, -Z forward. Dimensions are metres.
 * Every solid is real pickable Three geometry; no invisible hit shells.
 */
import * as THREE from 'three';
import {partMaterial,materialRoleOf} from './partMaterialPalette.js';

export const COMMAND_MATERIALS=Object.freeze({
    ochre:partMaterial('mustard'),wornOchre:partMaterial('wornMustard'),
    teal:partMaterial('teal'),iron:partMaterial('structure'),
    loadSteel:partMaterial('loadSteel'),bright:partMaterial('machined'),
    raw:partMaterial('rawSteel'),heat:partMaterial('heatSteel'),
    cream:partMaterial('cream'),olive:partMaterial('olive'),
    glass:partMaterial('glazing'),optic:partMaterial('optic'),
    rust:partMaterial('oxide'),recess:partMaterial('mechanicalRecess'),
    opticRecess:partMaterial('opticalRecess'),
});
const gray=new THREE.MeshStandardMaterial({color:0x999999,metalness:.02,roughness:.95,flatShading:true});
const outlineMaterial=new THREE.LineBasicMaterial({color:0xe6b249,opacity:.85,transparent:true});

export function groupAt(parent,name){
    const group=new THREE.Group();group.name=name;parent.add(group);return group;
}
function put(parent,name,geometry,tone,xyz){
    const mesh=new THREE.Mesh(geometry,COMMAND_MATERIALS[tone]);
    mesh.name=name;mesh.position.set(...xyz);
    mesh.userData.materialRole=materialRoleOf(mesh.material);
    parent.add(mesh);return mesh;
}
export function block(parent,name,xyz,size,tone='iron'){
    if(size.some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid block dimensions '+name);
    return put(parent,name,new THREE.BoxGeometry(...size),tone,xyz);
}
/** Chamfer only the four XY corners. Exact external W/H/D bounds. */
export function chamferBlock(parent,name,xyz,size,tone='cream',fraction=.11){
    const [w,h,d]=size,b=Math.min(w,h)*Math.min(.30,Math.max(0,fraction));
    const s=new THREE.Shape();
    s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);
    s.lineTo(w/2,-h/2+b);s.lineTo(w/2,h/2-b);
    s.lineTo(w/2-b,h/2);s.lineTo(-w/2+b,h/2);
    s.lineTo(-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,steps:1,curveSegments:1});
    g.translate(0,0,-d/2);return put(parent,name,g,tone,xyz);
}
export function disk(parent,name,xyz,radius,depth,tone='bright',axis='z',segments=12){
    if(!(radius>0&&depth>0))throw Error('Invalid disk dimensions '+name);
    const mesh=put(parent,name,new THREE.CylinderGeometry(radius,radius,depth,segments),tone,xyz);
    if(axis==='z')mesh.rotation.x=Math.PI/2;
    else if(axis==='x')mesh.rotation.z=Math.PI/2;
    return mesh;
}
/** An angled opaque rectangular pane / structural pillar, tipped about X. */
export function pitchedBlock(parent,name,xyz,size,pitch,tone){
    const mesh=block(parent,name,xyz,size,tone);mesh.rotation.x=pitch;return mesh;
}
/** A fully closed, sloped six-face solid with explicit front/rear roof heights.
 * All Y coordinates are relative to the supplied center; Z=-depth/2 is front.
 * This keeps Hearth's armor slopes physically real, including side raycasts.
 */
export function wedge(parent,name,xyz,{
    frontWidth,rearWidth,depth,frontBottom,frontTop,rearBottom,rearTop,
},tone='cream'){
    const values=[frontWidth,rearWidth,depth,frontBottom,frontTop,rearBottom,rearTop];
    if(values.some(v=>!Number.isFinite(v))||frontWidth<=0||rearWidth<=0||depth<=0||
        frontTop<=frontBottom||rearTop<=rearBottom)throw Error('Invalid wedge '+name);
    const f=-depth/2,b=depth/2;
    const pos=new Float32Array([
        -frontWidth/2,frontBottom,f, frontWidth/2,frontBottom,f,
        frontWidth/2,frontTop,f,-frontWidth/2,frontTop,f,
        -rearWidth/2,rearBottom,b,rearWidth/2,rearBottom,b,
        rearWidth/2,rearTop,b,-rearWidth/2,rearTop,b,
    ]);
    const idx=[
        0,2,1,0,3,2, 4,5,6,4,6,7,
        0,4,7,0,7,3, 1,2,6,1,6,5,
        3,7,6,3,6,2, 0,1,5,0,5,4,
    ];
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geometry.setIndex(idx);geometry.computeVertexNormals();
    return put(parent,name,geometry,tone,xyz);
}
export function beamBetween(parent,name,start,end,width,depth,tone='iron'){
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
    const axis=b.clone().sub(a),height=axis.length();
    if(height<.001||width<=0||depth<=0)throw Error('Invalid beam '+name);
    const mesh=block(parent,name,a.add(b).multiplyScalar(.5).toArray(),[width,height,depth],tone);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
    return mesh;
}
/** The command interface is a short contact collar, NOT a display pedestal.
 * The lowest surface is exactly the catalogue underside plane.
 */
export function mountCollar(parent,height,width=.27){
    const base=-height/2,root=groupAt(parent,'U1 UNDERSIDE MOUNT');
    disk(root,'U1 steel contact ring',[0,base+.025,.045],width,.05,'bright','y');
    disk(root,'U1 index boss',[0,base+.055,.045],width*.60,.032,'iron','y');
    for(const sign of [-1,1]){
        beamBetween(root,sign<0?'left load gusset':'right load gusset',
            [sign*.27,base+.19,.05],[sign*.12,base+.06,.045],.09,.13,'iron');
    }
    return root;
}
export function assertCommandEnvelope(root,envelope,tolerance=.0006){
    if(!Array.isArray(envelope)||envelope.length!==3||
        envelope.some(n=>!(n>0)))throw Error('Missing command catalogue envelope');
    root.updateMatrixWorld(true);
    const faults=[];
    root.traverse(node=>{
        if(!node.isMesh)return;
        const aabb=new THREE.Box3().setFromObject(node,true);
        for(let i=0;i<3;i++){
            const lower=-envelope[i]/2,upper=envelope[i]/2;
            const over=Math.max(lower-aabb.min.getComponent(i),
                aabb.max.getComponent(i)-upper);
            if(!Number.isFinite(over)||over>tolerance)
                faults.push(node.name+' '+['X','Y','Z'][i]+' '+(over*1000).toFixed(1)+'mm');
        }
    });
    if(faults.length)throw Error('Command geometry outside catalogue envelope: '+faults.join('; '));
}
export function finishCommandVisual(root,fixture,family){
    if(fixture.slot!=='command')throw Error('Not a command fixture: '+fixture.id);
    assertCommandEnvelope(root,fixture.envelope);
    root.userData={fitFixtureId:fixture.id,previewOnly:true,commandFamily:family,
        matingFace:fixture.mountPoint.slice(),mountNormal:fixture.mountNormal.slice()};
    root.traverse(node=>{if(node.isMesh)node.userData.fitFixtureId=fixture.id;});
    const edges=new THREE.EdgesGeometry(new THREE.BoxGeometry(...fixture.envelope));
    const outline=new THREE.LineSegments(edges,outlineMaterial);
    outline.name='selected-conservative-envelope';outline.visible=false;
    root.add(outline);root.userData.outline=outline;
    return root;
}
export function setCommandGraybox(root,enabled){
    root.traverse(node=>{
        if(!node.isMesh)return;
        if(!node.userData.commandColorMaterial)node.userData.commandColorMaterial=node.material;
        node.material=enabled?gray:node.userData.commandColorMaterial;
    });
}
