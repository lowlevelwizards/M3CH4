/** Real Three.js Forge model geometry and gameplay ownership smoke. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { equip,makeTestAssembly,inspectAssembly } from '../components.js';
import { buildPartVisual } from '../partVisuals.js';
import { buildExteriorRig } from '../scene.js';

export function verifyForgeModel(){
    const sample=buildPartVisual('power-forge',{mode:'gameplay'});
    sample.updateMatrixWorld(true);
    const nominal=[1.34,1.15,1.05],box=new THREE.Box3().setFromObject(sample,true);
    for(let i=0;i<3;i++){
        assert.ok(box.min.getComponent(i)>=-nominal[i]/2-.001);
        assert.ok(box.max.getComponent(i)<=nominal[i]/2+.001);
    }
    let meshes=0;sample.traverse(node=>{if(node.isMesh){meshes++;assert.ok(node.userData.fitFixtureId==='power-forge');}});
    assert.ok(meshes>=20);
    const configurations=[];
    for(const frame of ['frame-sr','frame-utility','frame-wedge']){
        const assembly=makeTestAssembly();
        equip(assembly,'structure',frame);equip(assembly,'power','power-forge');
        const check=inspectAssembly(assembly);
        if(!check.ready){configurations.push({frame,ready:false});continue;}
        const model=buildExteriorRig(assembly);
        assert.ok(model.partGroups.get('power'));
        const powerMeshes=model.pickMeshes.filter(mesh=>mesh.userData.slot==='power');
        assert.ok(powerMeshes.length>10,'Power faces must be physical pick meshes');
        const bounds=new THREE.Box3().setFromObject(model.partGroups.get('power'));
        const center=bounds.getCenter(new THREE.Vector3());
        const origin=center.clone().add(new THREE.Vector3(0,0,8));
        const raycaster=new THREE.Raycaster(origin,center.clone().sub(origin).normalize(),0,20);
        const hits=raycaster.intersectObjects(model.pickMeshes,false);
        assert.ok(hits.length>0);
        assert.ok(hits.some(hit=>hit.object.userData.slot==='power'),
            'Forge must receive real gameplay ray contacts');
        configurations.push({frame,ready:true,partMeshes:powerMeshes.length,
            firstHitSlot:hits[0].object.userData.slot});
    }
    return {modelCount:meshes,dimensions:box.getSize(new THREE.Vector3()).toArray(),configurations};
}
if(process.argv[1]?.endsWith('forgeGeometryAudit.mjs'))console.log(JSON.stringify(verifyForgeModel(),null,2));
