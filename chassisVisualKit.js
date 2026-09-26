/** k.3a.1: DEBUG socket overlays for isolated Chassis Lab.
 * The physical empty socket faces are part of chassisConceptBuilder.js.
 * This module no longer constructs the discarded k.3a placeholder bodies.
 */
import * as THREE from 'three';
import {SOCKET_ROLE_COLORS,SOCKET_RADII} from './chassisDefinitions.js';

/** Tiny role-colored ring exactly over the socket's physical mating face.
 * Each concept declares a surface normal. Legacy snapshots without a normal
 * still use +Z for compatibility, but are not offered in the current lab.
 */
export function buildSocketGizmos(frame){
    const root=new THREE.Group();root.name=`preview-sockets:${frame.id}`;
    for(const socket of frame.sockets){
        const marker=new THREE.Group();marker.name=`socket:${socket.id}`;
        const normal=new THREE.Vector3(...(socket.normal??[0,0,1]));
        marker.position.set(...socket.position).addScaledVector(normal,.027);
        marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
        marker.userData.socketId=socket.id;
        const color=SOCKET_ROLE_COLORS[socket.roleHint];
        const r=SOCKET_RADII[socket.standard]*.77;
        const band=new THREE.Mesh(new THREE.TorusGeometry(r,.013,4,12),
            new THREE.MeshBasicMaterial({color,depthTest:true}));
        band.name='debug-role-ring';band.userData.socketId=socket.id;
        const pick=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.17,r*1.5),9,6),
            new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
        pick.userData.socketId=socket.id;
        marker.add(band,pick);root.add(marker);
    }
    return root;
}
