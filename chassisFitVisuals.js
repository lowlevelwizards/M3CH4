/** k.3a.2 -- low-detail, source-envelope-accurate equipment fit maquettes.
 * These are not original scene.js gameplay models. All geometry stays inside
 * its source catalogue envelope; attachment pads coincide with mountPoint.
 */
import * as THREE from 'three';
import { CHASSIS_MATERIALS } from './chassisConceptBuilder.js';

const steel=CHASSIS_MATERIALS.iron;
const bright=CHASSIS_MATERIALS.machined;
const shell=CHASSIS_MATERIALS.shell;
const ochre=CHASSIS_MATERIALS.paint;
const recess=CHASSIS_MATERIALS.recess;
const glass=new THREE.MeshStandardMaterial({color:0x243b3d,metalness:.2,roughness:.30,flatShading:true});
const optic=new THREE.MeshStandardMaterial({color:0x67a7a1,metalness:.14,roughness:.35,flatShading:true});
const dark=new THREE.MeshStandardMaterial({color:0x535d56,metalness:.26,roughness:.88,flatShading:true});
const outlineMaterial=new THREE.LineBasicMaterial({color:0xe6b249,depthTest:true,transparent:true,opacity:.85});

const addBox=(root,size,position,material,name)=>{
    const object=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
    object.position.set(...position);object.name=name;root.add(object);return object;
};
const addCylinder=(root,radius,length,position,axis,material,name)=>{
    const object=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,10),material);
    object.position.set(...position);
    if(axis==='x')object.rotation.z=Math.PI/2;
    if(axis==='z')object.rotation.x=Math.PI/2;
    object.name=name;root.add(object);return object;
};
function addMountFace(root,fixture){
    const p=fixture.mountPoint, n=fixture.mountNormal;
    const normalAxis=n.findIndex(v=>v!==0);
    const maxRadius=Math.min(...fixture.envelope.filter((_,i)=>i!==normalAxis))*.22;
    const r=Math.min(.20,maxRadius);
    const point=p.map((v,i)=>v-n[i]*.014);
    const axis=['x','y','z'][normalAxis];
    addCylinder(root,r,.025,point,axis,bright,'real-empty-mating-flange');
    const inner=point.map((v,i)=>v+n[i]*.013);
    addCylinder(root,r*.55,.007,inner,axis,recess,'mating-interface-recess');
}

/** Return an unpositioned part: (0,0,0) is the component envelope center. */
export function buildFitFixture(fixture){
    if(!fixture?.envelope?.every(n=>Number.isFinite(n)&&n>0))
        throw new Error('An authored physical component envelope is required.');
    const [w,h,d]=fixture.envelope;
    const root=new THREE.Group();root.name=`fit-fixture:${fixture.id}`;
    root.userData={fitFixtureId:fixture.id,previewOnly:true};
    if(fixture.id==='legs-yard'){
        // One mechanical module: single top saddle, one paired transverse drive
        // beam, then two visibly connected limbs; no independent install slots.
        addBox(root,[w*.60,h*.11,d*.50],[0,h*.41,0],bright,'single-top-drive-saddle');
        addBox(root,[w*.33,h*.10,d*.34],[0,h*.45,0],steel,'central-mating-neck');
        addBox(root,[w*.68,h*.11,d*.38],[0,h*.31,.025],steel,'through-axle');
        for(const side of [-1,1]){
            const x=side*w*.30;
            addCylinder(root,h*.13,w*.12,[x,h*.29,0],'x',bright,`paired-hip-housing-${side}`);
            addBox(root,[w*.17,h*.43,d*.33],[x,h*.018,-d*.025],ochre,`upper-leg-link-${side}`);
            addCylinder(root,h*.095,w*.12,[x,-h*.205,0],'x',dark,`paired-knee-${side}`);
            addBox(root,[w*.15,h*.26,d*.25],[x,-h*.33,d*.06],shell,`lower-leg-link-${side}`);
            addBox(root,[w*.235,h*.075,d*.48],[x,-h*.458,-d*.05],steel,`ground-foot-${side}`);
        }
    }else if(fixture.id==='cab-cyclops'){
        // Single protected optic, not a humanoid head or completed mech torso.
        addBox(root,[w*.85,h*.74,d*.79],[0,h*.035,d*.055],shell,'cab-primary-occupied-volume');
        addBox(root,[w*.56,h*.34,d*.48],[0,-h*.29,0],steel,'cab-underbody-mount-pedestal');
        addBox(root,[w*.70,h*.20,d*.33],[0,h*.37,-d*.13],ochre,'cab-roof-lip');
        addBox(root,[w*.44,h*.32,d*.055],[0,h*.04,-d*.363],steel,'reinforced-optic-carrier');
        addCylinder(root,Math.min(w,h)*.12,d*.060,[0,h*.04,-d*.421],'z',glass,'single-protected-optic');
        addCylinder(root,Math.min(w,h)*.052,d*.007,[0,h*.04,-d*.451],'z',optic,'single-optic-glass');
    }else if(fixture.id==='power-dynamo'){
        addBox(root,[w*.84,h*.71,d*.73],[0,-h*.05,d*.08],dark,'generator-serviceable-housing');
        addBox(root,[w*.55,h*.44,d*.32],[0,0,-d*.31],steel,'generator-forward-mount-carriage');
        addBox(root,[w*.70,h*.17,d*.70],[0,h*.35,d*.05],ochre,'generator-top-cover');
        for(let i=0;i<4;i++){
            const x=(i-1.5)*w*.16;
            addBox(root,[w*.055,h*.22,d*.38],[x,h*.345,d*.15],steel,`cooling-fin-${i}`);
        }
    }else if(fixture.id==='gun-cannon'){
        addBox(root,[w*.78,h*.72,d*.36],[0,0,d*.25],ochre,'gun-heavy-breech');
        addBox(root,[w*.20,h*.37,d*.31],[-w*.400,0,d*.25],steel,'trunnion-to-breech-carriage');
        addBox(root,[w*.78,h*.25,d*.23],[0,-h*.25,d*.21],steel,'gun-recoil-cradle');
        addCylinder(root,h*.16,d*.64,[0,h*.03,-d*.175],'z',steel,'front-pointing-gun-barrel');
        addCylinder(root,h*.18,d*.035,[0,h*.03,-d*.47],'z',bright,'muzzle-reinforcement');
    }else throw new Error(`Unsupported fit-test equipment: ${fixture.id}`);
    addMountFace(root,fixture);
    root.traverse(o=>{if(o.isMesh)o.userData.fitFixtureId=fixture.id;});
    const boundsGeometry=new THREE.BoxGeometry(w,h,d);
    const edgeGeometry=new THREE.EdgesGeometry(boundsGeometry);
    boundsGeometry.dispose?.();
    const edges=new THREE.LineSegments(edgeGeometry,outlineMaterial);
    edges.name='selected-conservative-envelope';edges.visible=false;edges.userData.fitFixtureId=fixture.id;
    root.add(edges);
    root.userData.outline=edges;
    return root;
}
/** The geometric primitives are unique to the temporary fixture, but all
 * shared material identities belong to their modules and must not be disposed.
 */
export function disposeFitGeometry(root){
    if(!root)return;
    root.traverse(o=>o.geometry?.dispose());
}
