/** k.3a.8 preview geometry grammar. Reusable primitives, NEVER a generic biped.
 * All dimensions are metres; every mesh is independently measured in its
 * own named limb's full world transform before an assembly is accepted.
 */
import * as THREE from 'three';
import {CHASSIS_MATERIALS} from './chassisConceptBuilder.js';
const material=(color,metalness=.19)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.78,flatShading:true});
export const MOBILITY_MATERIALS=Object.freeze({
    iron:CHASSIS_MATERIALS.iron,bright:CHASSIS_MATERIALS.machined,
    ochre:CHASSIS_MATERIALS.paint,recess:CHASSIS_MATERIALS.recess,
    olive:material(0x78866b),cream:material(0xc5c4b0),
    charcoal:material(0x535d56,.28),orange:material(0xb9684c,.2),
    teal:material(0x60999a),
});
const greyMaterial=material(0x999999,.05);
const sharedOutlineMaterial=new THREE.LineBasicMaterial({color:0xe6b249,transparent:true,opacity:.85});
const vec=p=>new THREE.Vector3(...p);
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
export const groupAt=(parent,name,xyz)=>{
    const g=new THREE.Group();g.name=name;g.position.set(...xyz);parent.add(g);return g;
};
export function block(parent,name,center,size,tone='iron'){
    const m=new THREE.Mesh(new THREE.BoxGeometry(...size),MOBILITY_MATERIALS[tone]);
    m.name=name;m.position.set(...center);parent.add(m);return m;
}
export function disk(parent,name,center,radius,thickness,tone='bright',axis='x'){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,thickness,10),MOBILITY_MATERIALS[tone]);
    m.name=name;m.position.set(...center);
    if(axis==='x')m.rotation.z=Math.PI/2;
    if(axis==='z')m.rotation.x=Math.PI/2;
    parent.add(m);return m;
}
export function bearing(parent,name,center,radius,width,side,ringTone='orange'){
    const ring=groupAt(parent,name,center);
    disk(ring,'machined-bearing',[0,0,0],radius,width,'charcoal');
    const outward=side*(width/2+.003);
    disk(ring,'exposed-race',[outward,0,0],radius*.77,.018,'bright');
    disk(ring,'recessed-hub',[outward+side*.012,0,0],radius*.48,.022,ringTone);
    disk(ring,'pivot-pin',[outward+side*.026,0,0],radius*.25,.025,'recess');
    return ring;
}
export function link(parent,name,from,to,width,depth,tone='iron'){
    const start=vec(from),end=vec(to),axis=end.clone().sub(start),len=axis.length();
    if(len<.001)throw new Error(`Zero-length structural link: ${name}`);
    const piece=new THREE.Mesh(new THREE.BoxGeometry(width,len,depth),MOBILITY_MATERIALS[tone]);
    piece.name=name;piece.position.copy(start.add(end).multiplyScalar(.5));
    piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
    parent.add(piece);return piece;
}
export function actuator(parent,name,upper,lower,side,scale=1){
    const root=groupAt(parent,name,[0,0,0]);
    const u=vec(upper),travel=vec(lower).sub(u),first=u.clone().addScaledVector(travel,.62).toArray(),
        second=u.clone().addScaledVector(travel,.53).toArray();
    link(root,'actuator-pressure-body',upper,first,.112*scale,.112*scale,'charcoal');
    link(root,'actuator-exposed-rod',second,lower,.057*scale,.057*scale,'bright');
    disk(root,'upper-pivot-lug',upper,.071*scale,.095*scale,'bright','x');
    disk(root,'lower-pivot-lug',lower,.071*scale,.095*scale,'bright','x');
    root.userData={mechanism:'hydraulic-or-electric-linear-actuator',side};
    return root;
}
/** Eight-sided chamfered XY face, exact width/height/depth outer bounds. */
export function chamferBlock(parent,name,center,size,bevel=.12,tone='olive'){
    const [w,h,d]=size,b=Math.min(w,h)*Math.max(0,Math.min(.3,bevel)),
        x=w/2,y=h/2;
    const s=new THREE.Shape();s.moveTo(-x+b,-y);s.lineTo(x-b,-y);
    s.lineTo(x,-y+b);s.lineTo(x,y-b);s.lineTo(x-b,y);
    s.lineTo(-x+b,y);s.lineTo(-x,y-b);s.lineTo(-x,-y+b);s.closePath();
    const geom=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:false,curveSegments:1});
    geom.translate(0,0,-d/2);
    const m=new THREE.Mesh(geom,MOBILITY_MATERIALS[tone]);
    m.name=name;m.position.set(...center);parent.add(m);return m;
}
/** Structural four-corner tapered beam whose centreline endpoints coincide
 * with actual named pivots. No tip-shift independent of the joint hierarchy.
 */
export function taperedLink(parent,name,from,to,fromWidth,toWidth,depth,tone='cream'){
    if(distance(from,to)<.001)throw new Error(`Zero-length taper: ${name}`);
    if([fromWidth,toWidth,depth].some(n=>!(n>0)))throw new Error(`Invalid tapered link: ${name}`);
    const length=distance(from,to),geom=new THREE.BufferGeometry();
    const pos=[
        -fromWidth/2,0,-depth/2, fromWidth/2,0,-depth/2,
        fromWidth/2,0,depth/2,-fromWidth/2,0,depth/2,
        -toWidth/2,length,-depth/2,toWidth/2,length,-depth/2,
        toWidth/2,length,depth/2,-toWidth/2,length,depth/2,
    ];
    geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const triangles=[0,2,1,0,3,2, 4,5,6,4,6,7,
        0,1,5,0,5,4, 1,2,6,1,6,5, 2,3,7,2,7,6, 3,0,4,3,4,7];
    // Listed in inside-facing order for easy edge construction; flip all
    // triangle windings so default FRONT-sided Three materials see exterior.
    for(let i=0;i<triangles.length;i+=3)[triangles[i+1],triangles[i+2]]=[triangles[i+2],triangles[i+1]];
    geom.setIndex(triangles);
    geom.computeVertexNormals();
    const start=vec(from),axis=vec(to).sub(start).normalize(),m=new THREE.Mesh(geom,MOBILITY_MATERIALS[tone]);
    m.name=name;m.position.copy(start);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    parent.add(m);return m;
}
/** Actual open fork running from a real carriage lug to an actual bearing. */
export function forkBracket(parent,name,top,bearingAnchor,spread=.11,width=.06,depth=.09,tone='iron'){
    const g=groupAt(parent,name,[0,0,0]);
    for(const s of [-1,1]){
        const a=[top[0]+s*spread/2,top[1],top[2]],
            b=[bearingAnchor[0]+s*spread/2,bearingAnchor[1],bearingAnchor[2]];
        link(g,`${s<0?'inner':'outer'}-fork`,a,b,width,depth,tone);
    }
    link(g,'top-clevis', [top[0]-spread/2,top[1],top[2]],
        [top[0]+spread/2,top[1],top[2]],width,depth,tone);
    return g;
}
/** Solid sloped shoe half with true polygon vertices contained inside size.
 * k.3a.8 adds bounded profile controls so a load shoe can be much steeper
 * without inventing a new shared leg skeleton. Values are fractions of size.
 */
export function wedgeSole(parent,name,center,size,tone='olive',profile={}){
    const [w,h,d]=size;
    const toeTop=Math.max(-.45,Math.min(.48,profile.toeTop??.26));
    const crestZ=Math.max(-.40,Math.min(.40,profile.crestZ??.045));
    const rearTop=Math.max(-.45,Math.min(.45,profile.rearTop??-.08));
    const yz=[[+d/2,-h/2],[+d/2,+h*toeTop],[+d*crestZ,+h/2],[-d/2,+h*rearTop],[-d/2,-h/2]];
    const xyz=[];for(const x of [-w/2,w/2])for(const [z,y] of yz)xyz.push(x,y,z);
    const ix=[];for(let i=1;i<yz.length-1;i++){
        ix.push(0,i,i+1);ix.push(5,5+i+1,5+i);
    }
    for(let i=0;i<yz.length;i++){
        const j=(i+1)%yz.length;ix.push(i,5+j,j,i,5+i,5+j);
    }
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
    geom.setIndex(ix);geom.computeVertexNormals();
    const m=new THREE.Mesh(geom,MOBILITY_MATERIALS[tone]);
    m.name=name;m.position.set(...center);parent.add(m);return m;
}
/** Toe pair with an honest open slot. The two pads overlap the rear parent sole
 * longitudinally; neither invents extra footprint outside the authored size.
 */
export function splitToe(parent,name,size,gap,forwardFraction=.52,tone='cream',profile={}){
    const [w,h,d]=size,usable=w,each=(usable-gap)/2;
    if(each<=0||gap<=0)throw new Error(`Invalid split-toe dimensions: ${name}`);
    const len=d*forwardFraction,zc=-d/2+len/2;
    return [-1,1].map(side=>{
        const xc=side*(gap/2+each/2);
        return wedgeSole(parent,`${name}-${side<0?'inner':'outer'}`,
            [xc,-h*.07,zc],[each,h*.86,len],tone,profile);
    });
}
/** Neutral gray, still preserving the per-mesh palette for exact restoration. */
export function setMobilityGreybox(root,enabled){
    root?.traverse(node=>{
        if(!node.isMesh)return;
        if(!node.userData.originalMobilityMaterial)node.userData.originalMobilityMaterial=node.material;
        node.material=enabled?greyMaterial:node.userData.originalMobilityMaterial;
    });
}
/** Fail-closed actual transformed-vertex bounding check. Invoke before adding
 * the intentional full-envelope wire outline. Report the actual mesh ID/axis.
 */
export function assertMobilityMeshEnvelope(root,envelope,tolerance=.0005){
    root.updateMatrixWorld(true);
    const errors=[];
    root.traverse(node=>{
        if(!node.isMesh)return;
        const bounds=new THREE.Box3().setFromObject(node,true);
        for(const [i,axis] of ['X','Y','Z'].entries()){
            const over=Math.max(-envelope[i]/2-bounds.min.getComponent(i),
                bounds.max.getComponent(i)-envelope[i]/2);
            if(over>tolerance)errors.push(`${node.name} ${axis} +${(over*1000).toFixed(1)} mm`);
        }
    });
    if(errors.length)throw new Error(`Actual mesh outside catalogue envelope: ${errors.join('; ')}`);
}
export function finishMobilityVisual(root,fixture,layout){
    assertMobilityMeshEnvelope(root,fixture.envelope);
    root.traverse(o=>{if(o.isMesh)o.userData.fitFixtureId=fixture.id;});
    const [w,h,d]=fixture.envelope,bounds=new THREE.BoxGeometry(w,h,d),
        edgesGeom=new THREE.EdgesGeometry(bounds);bounds.dispose();
    const edges=new THREE.LineSegments(edgesGeom,sharedOutlineMaterial);
    edges.name='selected-conservative-envelope';edges.visible=false;edges.userData.fitFixtureId=fixture.id;
    root.add(edges);root.userData.outline=edges;
    root.userData.matingFace=layout.mountingFace.slice();
    root.userData.guideReceivers=layout.guideReceivers.map(g=>g.contact.slice());
    return root;
}
export function disposeMobilityGeometry(root){root?.traverse(node=>node.geometry?.dispose());}
