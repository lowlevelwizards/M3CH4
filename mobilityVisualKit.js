/** Shared low-poly mechanical construction language for mobility PREVIEW models.
 * Deliberately few members/materials; this is NOT a live gait/physics renderer.
 */
import * as THREE from 'three';
import { CHASSIS_MATERIALS } from './chassisConceptBuilder.js';
const material=(color,metalness=.19)=>new THREE.MeshStandardMaterial({
    color,metalness,roughness:.78,flatShading:true,
});
export const MOBILITY_MATERIALS=Object.freeze({
    iron:CHASSIS_MATERIALS.iron,
    bright:CHASSIS_MATERIALS.machined,
    ochre:CHASSIS_MATERIALS.paint,
    recess:CHASSIS_MATERIALS.recess,
    olive:material(0x78866b),
    cream:material(0xc5c4b0),
    charcoal:material(0x535d56,.28),
    orange:material(0xb9684c,.2),
    teal:material(0x60999a),
});
export const groupAt=(parent,name,xyz)=>{
    const group=new THREE.Group();group.name=name;group.position.set(...xyz);parent.add(group);return group;
};
export function block(parent,name,center,size,tone='iron'){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),MOBILITY_MATERIALS[tone]);
    mesh.name=name;mesh.position.set(...center);parent.add(mesh);return mesh;
}
export function disk(parent,name,center,radius,thickness,tone='bright',axis='x'){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,thickness,10),MOBILITY_MATERIALS[tone]);
    mesh.name=name;mesh.position.set(...center);
    if(axis==='x')mesh.rotation.z=Math.PI/2;
    if(axis==='z')mesh.rotation.x=Math.PI/2;
    parent.add(mesh);return mesh;
}
export function bearing(parent,name,center,radius,width,side,ringTone='orange'){
    const outer=groupAt(parent,name,center);
    disk(outer,'machined-bearing', [0,0,0],radius,width,'charcoal');
    const outward=side*(width/2+.003);
    disk(outer,'exposed-race', [outward,0,0],radius*.77,.018,'bright');
    disk(outer,'recessed-hub', [outward+side*.012,0,0],radius*.48,.022,ringTone);
    disk(outer,'pivot-pin', [outward+side*.026,0,0],radius*.25,.025,'recess');
    return outer;
}
const v=p=>new THREE.Vector3(...p);
export function link(parent,name,from,to,width,depth,tone='iron'){
    const start=v(from),end=v(to),axis=end.clone().sub(start);
    const length=axis.length();
    if(length<.001)throw new Error(`Zero-length structural link: ${name}`);
    const piece=new THREE.Mesh(new THREE.BoxGeometry(width,length,depth),MOBILITY_MATERIALS[tone]);
    piece.name=name;piece.position.copy(start.add(end).multiplyScalar(.5));
    piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
    parent.add(piece);return piece;
}
/** Endpoints belong to named joint anchors; rod truly meets both lugs. */
export function actuator(parent,name,upper,lower,side){
    const root=groupAt(parent,name,[0,0,0]);
    const upperV=v(upper),lowerV=v(lower),travel=lowerV.clone().sub(upperV);
    const first=upperV.clone().addScaledVector(travel,.62).toArray();
    const second=upperV.clone().addScaledVector(travel,.53).toArray();
    link(root,'actuator-pressure-body',upper,first,.112,.112,'charcoal');
    link(root,'actuator-exposed-rod',second,lower,.057,.057,'bright');
    // Real short mounting lugs; no extra cosmetic struts.
    disk(root,'upper-pivot-lug',upper,.071,.095,'bright','x');
    disk(root,'lower-pivot-lug',lower,.071,.095,'bright','x');
    root.userData={mechanism:'hydraulic-or-electric-linear-actuator',side};
    return root;
}
export function disposeMobilityGeometry(root){
    root?.traverse(node=>node.geometry?.dispose()); // NEVER dispose shared materials.
}
