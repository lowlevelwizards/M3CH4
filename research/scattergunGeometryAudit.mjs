/** k3v6: exact installed Three.js geometry and first-hit proof.
 * Unlike an analytic circular target, each pellet ray here runs into the
 * game's REAL hit meshes. No mock collision or damage multipliers.
 */
import * as THREE from 'three';
import { pathToFileURL } from 'node:url';
import { makeTestAssembly,equip,inspectAssembly } from '../components.js';
import { WEAPONS } from '../combat.js';
import { pelletOffsets } from '../scattergun.js';
import { buildExteriorRig } from '../scene.js';

function build(id){
    const a=makeTestAssembly();
    equip(a,'combat',id);
    if(!inspectAssembly(a).ready)throw Error('Non-deployable test '+id);
    return buildExteriorRig(a);
}
export function physicalScatterAudit(){
    const gun=build('gun-scatter');
    gun.root.updateMatrixWorld(true);
    const weapon=gun.partGroups.get('combat');
    const meshes=gun.partMeshes.get('combat');
    if(!weapon||meshes.length<14)throw Error('Scattergun must have unique authored 3D steelwork');
    if(!gun.pickMeshes.includes(meshes[0]))throw Error('Weapon is not physically hittable');
    const bounds=new THREE.Box3().setFromObject(weapon);
    const size=bounds.getSize(new THREE.Vector3());
    if(!(size.z>.85 && size.x>.8))throw Error('Scatter gun geometry lacks wide, short muzzle envelope');
    const target=build('gun-cannon');
    const shooterMuzzle=new THREE.Vector3(0,2.03,0);
    const ray=new THREE.Raycaster();ray.far=100;
    function sample(range){
        target.root.position.z=-range;
        target.root.updateMatrixWorld(true);
        const point=target.partGroups.get('command').getWorldPosition(new THREE.Vector3());
        const forward=point.sub(shooterMuzzle).normalize();
        const upAxis=new THREE.Vector3(0,1,0);
        const right=new THREE.Vector3().crossVectors(forward,upAxis).normalize();
        const up=new THREE.Vector3().crossVectors(right,forward).normalize();
        let direct=0,miss=0,armorFirst=0;
        for(let shot=1;shot<=16;shot++){
            for(const [x,y] of pelletOffsets(shot,WEAPONS['gun-scatter'])){
                const bore=forward.clone().addScaledVector(right,x).addScaledVector(up,y).normalize();
                ray.set(shooterMuzzle,bore);
                // Actual physically first hit. Can be armor from ANY station,
                // so front frame shielding is not ignored.
                const contact=ray.intersectObjects(target.pickMeshes,false)[0];
                if(contact){
                    direct++;
                    if(contact.object.userData.slot==='structure')armorFirst++;
                }else miss++;
            }
        }
        return {distanceMeters:range,pelletRays:96,physicalHits:direct,misses:miss,frameFirst:armorFirst};
    }
    const near=sample(5),far=sample(25);
    if(!(near.physicalHits>far.physicalHits))
        throw Error('Physically traced scatter must land more pellets close than far: '+JSON.stringify({near,far}));
    if(!(near.physicalHits>0&&far.physicalHits>0))throw Error('Bore cannot reach real target');
    const disposeModel=root=>root.traverse(node=>{
        if(!node.isMesh)return;
        node.geometry?.dispose();
        const materials=Array.isArray(node.material)?node.material:[node.material];
        for(const material of materials)if(typeof material?.dispose==='function')material.dispose();
    });
    disposeModel(gun.root);
    disposeModel(target.root);
    return {gun:{pickableWeaponMeshes:meshes.length,widthM:+size.x.toFixed(2),lengthM:+size.z.toFixed(2)},near,far};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
    process.stdout.write(JSON.stringify(physicalScatterAudit(),null,2)+'\n');
