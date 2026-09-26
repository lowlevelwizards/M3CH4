/** k.3a.1 procedural, chassis-ONLY reconstruction from the authored build
 * sheets in chassisConcepts.js. No imports of game scene or mechanical state.
 * Not a pile of arbitrary decals: each mesh is one named structural member.
 */
import * as THREE from 'three';

const mk = (color,metalness=.17)=>new THREE.MeshStandardMaterial({
    color,metalness,roughness:.81,flatShading:true,
});
// Exactly one set of material identities across all three: no one-off hues.
export const CHASSIS_MATERIALS = Object.freeze({
    iron:mk(0x3b4644,.33),machined:mk(0x899189,.35),
    paint:mk(0xb39347,.16),shell:mk(0x66817b,.16),
    recess:mk(0x212927,.12),
});
const mesh = (parent,geom,mat,position,id,purpose)=>{
    const object=new THREE.Mesh(geom,mat);
    object.name=id;
    object.position.set(...position);
    object.userData={structuralPiece:id,structuralPurpose:purpose};
    parent.add(object);
    return object;
};
function chamferBox([w,h,d]){
    // Single-bevel, eight-sided outline. This is a bounding structural member,
    // not visual noise, and retains the same nominal local box footprint.
    const c=Math.min(.045,w*.09,h*.10);
    const s=new THREE.Shape();
    s.moveTo(-w/2+c,-h/2);s.lineTo(w/2-c,-h/2);
    s.lineTo(w/2,-h/2+c);s.lineTo(w/2,h/2-c);
    s.lineTo(w/2-c,h/2);s.lineTo(-w/2+c,h/2);
    s.lineTo(-w/2,h/2-c);s.lineTo(-w/2,-h/2+c);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{
        depth:d,bevelEnabled:false,curveSegments:1,steps:1,
    });
    g.translate(0,0,-d/2);
    return g;
}
function shellSide(size,side){
    const g=new THREE.BoxGeometry(...size);
    // The forward upper corner slopes back by 7 cm; no simulated armor layer.
    const p=g.getAttribute('position');
    for(let i=0;i<p.count;i++){
        if(p.getZ(i)<0 && p.getY(i)>0){
            p.setZ(i,p.getZ(i)+.07);
            p.setX(i,p.getX(i)-side*.013);
        }
    }
    p.needsUpdate=true;g.computeVertexNormals();
    return g;
}
function createPiece(group,p){
    const mat=CHASSIS_MATERIALS[p.tone]||CHASSIS_MATERIALS.iron;
    if(p.kind==='block'||p.kind==='chamfer-block'||p.kind==='shell-side'||p.kind==='sloped-bulkhead'){
        const geom=p.kind==='chamfer-block'?chamferBox(p.size):
            p.kind==='shell-side'?shellSide(p.size,p.side):new THREE.BoxGeometry(...p.size);
        const body=mesh(group,geom,mat,p.center,p.id,p.purpose);
        if(p.kind==='sloped-bulkhead')body.rotation.x=.12;
        return body;
    }
    if(p.kind==='hip-boss'){
        if(p.axis!=='x')throw new Error(`Only paired-X hip visuals implemented: ${p.id}`);
        const [r,,length]=p.size;
        const body=mesh(group,new THREE.CylinderGeometry(r,r,length,10),mat,p.center,p.id,p.purpose);
        body.rotation.z=Math.PI/2;
        // Recess is the EMPTY bearing interface, not a pre-installed leg.
        const inset=new THREE.Mesh(new THREE.CylinderGeometry(r*.59,r*.59,.008,10),CHASSIS_MATERIALS.recess);
        inset.name=`${p.id}:open-bearing-face`;
        inset.rotation.z=Math.PI/2;
        // Both outward facing visible side bosses are built from the same part.
        inset.position.set(p.center[0]+Math.sign(p.center[0])*(length/2+.005),p.center[1],p.center[2]);
        inset.userData={structuralPiece:p.id,structuralPurpose:'Open bearing bore; paired legs NOT installed.'};
        group.add(inset);
        return body;
    }
    throw new Error(`Unknown structural primitive: ${p.id} (${p.kind})`);
}
export function buildConceptChassis(frame){
    if(frame?.implementation!=='isolated-design-study')throw new Error('Not a bare design-study chassis.');
    const root=new THREE.Group();root.name=`bare-chassis:${frame.id}`;
    const structure=new THREE.Group();structure.name='physical-load-bearing-members';
    const hardware=new THREE.Group();hardware.name='physical-empty-mount-faces';
    root.add(structure,hardware);
    for(const p of frame.pieces)createPiece(structure,p);
    // Each empty interface has a slim REAL metal ring inset into its *authored
    // supporting face*. Toggling debug markers never removes these fittings.
    for(const s of frame.sockets){
        const n=new THREE.Vector3(...s.normal);
        const mount=new THREE.Group();mount.name=`empty-mount:${s.id}`;
        mount.position.set(...s.position);
        mount.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);
        mount.userData={socketId:s.id,supportId:s.supportId,physicalMount:true};
        const r=s.standard==='light'?.069:s.standard==='heavy'?.14:.108;
        const seat=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.015,12),CHASSIS_MATERIALS.machined);
        seat.name='metal-face';seat.rotation.x=Math.PI/2;seat.position.z=.004;
        const opening=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r*.55,.007,12),CHASSIS_MATERIALS.recess);
        opening.name='unoccupied-opening';opening.rotation.x=Math.PI/2;opening.position.z=.014;
        mount.add(seat,opening);hardware.add(mount);
    }
    root.userData={kind:'bare-design-study',family:frame.family,
        structuralPieces:frame.pieces.length,functionalMobilitySockets:1,
        hasInstalledLegs:false,hasInstalledEquipment:false};
    return root;
}
