/** k.3v.5 — no-WebGL Three.js geometry and real texture-interior audit.
 * Requires same Three.js 0.186.0 as the game; only installed for CI.
 */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { makeTestAssembly,equip,inspectAssembly } from '../components.js';
import { installCockpitIdentities } from '../cockpitIdentityScene.js';
import { auditCockpitLayouts } from '../cockpitProfiles.js';

function fakeScreen(name,width,height){
    const text=[];
    const ctx={clearRect(){},fillRect(){},strokeRect(){},
        fillText(value,x,y){text.push({value:String(value),x,y});}};
    const canvas={width,height};
    const texture={needsUpdate:false};
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width/250,height/250),
        new THREE.MeshBasicMaterial({color:0xffffff}));
    mesh.name='cockpit-screen:'+name;
    return {canvas,ctx,mesh,texture,text};
}
export function runCockpitIdentityGeometryAudit(){
    const cockpit=new THREE.Group(),camera=new THREE.PerspectiveCamera(68,16/9,.06,125);
    camera.position.set(0,2.42,0);
    const combiner=new THREE.Group();combiner.name='cockpit-combiner-hud';camera.add(combiner);
    const gunPivot=new THREE.Group();cockpit.add(gunPivot);
    const mat=new THREE.MeshStandardMaterial({color:0x434a43});
    const deco=new THREE.Mesh(new THREE.BoxGeometry(1,.2,.3),mat);cockpit.add(deco);
    const armoredCab=new THREE.Mesh(new THREE.BoxGeometry(.8,.1,.3),mat);
    const utilityCab=new THREE.Mesh(new THREE.BoxGeometry(.6,.1,.3),mat);
    cockpit.add(armoredCab,utilityCab);
    const amberMat=new THREE.MeshStandardMaterial(),redMat=new THREE.MeshStandardMaterial();
    const amber=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),amberMat);
    const red=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),redMat);
    cockpit.add(amber,red,new THREE.PointLight());
    cockpit.userData.gunPivot=gunPivot;
    cockpit.userData.armoredCab=armoredCab;
    cockpit.userData.utilityCab=utilityCab;
    cockpit.userData.warningLamps={amberLampMat:amberMat,redLampMat:redMat};
    const screens={
        systems:fakeScreen('systems',88,220),
        weapon:fakeScreen('weapon',180,78),
        team:fakeScreen('team',200,44),
        motion:fakeScreen('motion',220,56),
        drive:fakeScreen('drive',180,40),
    };
    cockpit.userData.instrumentScreens=screens;
    for(const s of Object.values(screens))combiner.add(s.mesh);
    const arena={cockpit,camera,updateCockpitInstruments(){},updateCockpitMotion(){}};
    const assembly=makeTestAssembly(),ui=installCockpitIdentities(arena,assembly);
    assert.equal(screens.drive.canvas.height,82,'Clipped power screen must grow');
    assert.equal(screens.motion.canvas.height,82,'Clipped slip screen must grow');
    const payload={
        systems:{structure:100,mobility:81,power:68,command:35,combat:79},
        team:{friendly:2,hostile:1},weapon:'NEEDLE CANNON',ammo:'15/80',weaponState:'READY',
    };
    const motion={speed:5.4,turnRate:12,direction:'FWD',footing:.8,slip:.46,recoil:.12,braced:0,
        driveLoad:.8,power:{generationKw:76,demandKw:91,reserveFraction:.3,busRatio:.835}};
    const rows=[];
    for(const id of ['cab-cyclops','cab-utility','cab-armored']){
        equip(assembly,'command',id);
        assert.equal(inspectAssembly(assembly).ready,true,id);
        ui.apply(assembly);
        arena.updateCockpitInstruments(payload);
        arena.updateCockpitMotion(motion);
        const visible=Object.entries(ui.kits).filter(([,kit])=>kit.visible).map(([name])=>name);
        assert.deepEqual(visible,[id]);
        const meshes=[];ui.kits[id].traverse(node=>{if(node.isMesh)meshes.push(node)});
        assert.ok(meshes.length>=9,id+' has too few structural meshes');
        ui.kits[id].updateWorldMatrix(true,true);
        const raycaster=new THREE.Raycaster(new THREE.Vector3(0,2.42,0),new THREE.Vector3(0,0,-1),0,10);
        const obstruction=raycaster.intersectObjects(meshes,false)[0]??null;
        assert.equal(obstruction,null,id+' obstructs central aiming ray');
        const bbox=new THREE.Box3().setFromObject(ui.kits[id]);
        const size=bbox.getSize(new THREE.Vector3());
        const text=Object.fromEntries(Object.entries(screens).map(([name,s])=>[name,s.text.map(t=>t.value).slice(-24)]));
        assert.ok(text.weapon.includes('15/80'),id);
        assert.ok(text.drive.some(t=>t.includes('76'))&&text.drive.some(t=>t.includes('91')),id);
        assert.ok(text.systems.some(t=>t.includes('35')),id);
        rows.push({id,meshes:meshes.length,size:size.toArray().map(x=>Number(x.toFixed(3))),
            blockedCentralRay:false,visible,textureHeights:Object.fromEntries(Object.entries(screens).map(([name,s])=>[name,s.canvas.height]))});
    }
    assert.deepEqual(auditCockpitLayouts().flatMap(r=>r.violations),[]);
    assert.notDeepEqual(rows[0].size,rows[1].size);
    assert.notDeepEqual(rows[1].size,rows[2].size);
    return rows;
}
if(process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href)
    process.stdout.write(JSON.stringify(runCockpitIdentityGeometryAudit(),null,2)+'\n');
