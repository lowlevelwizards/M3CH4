/** Forge H-4: one physically pickable welded industrial power module.
 * Simple low-poly fabrication. Same visible geometry in bay and combat raycasts.
 */
import * as THREE from 'three';
import { groupAt,block,chamferBlock,disk,beamBetween } from './commandVisualKit.js';

export function buildForgePowerVisual(fixture){
    if(fixture?.id!=='power-forge'||fixture.slot!=='power')throw Error('Forge fixture required');
    const root=new THREE.Group();root.name='live-power:forge-h4';
    const cradle=groupAt(root,'FORGE / WELDED MOUNTING CRADLE');
    block(cradle,'lower cross-rail',[0,-.46,.0],[1.16,.115,.89],'iron');
    for(const side of [-1,1]){
        block(cradle,(side<0?'left':'right')+' longitudinal bearer',
            [side*.55,-.39,-.015],[.15,.18,.92],'loadSteel');
        beamBetween(cradle,(side<0?'left':'right')+' diagonal load stay',
            [side*.55,-.38,-.28],[side*.42,-.03,.32],.09,.11,'bright');
    }
    const casework=groupAt(root,'FORGE / CAST GENERATOR CASING');
    chamferBlock(casework,'fat mustard industrial generator shell',
        [0,-.015,-.015],[1.07,.79,.69],'ochre',.13);
    block(casework,'central dark armature band',[0,.005,.005],[1.115,.155,.71],'iron');
    block(casework,'upper steel generator bridge',[0,.37,.075],[.68,.12,.63],'raw');
    for(const side of [-1,1]){
        block(casework,(side<0?'left':'right')+' teal service panel',
            [side*.548,.075,-.055],[.035,.36,.45],'teal');
        disk(casework,(side<0?'left':'right')+' side drive inspection cover',
            [side*.587,-.085,.16],.155,.025,'bright','x',10);
    }
    const exchanger=groupAt(root,'FORGE / EXPOSED REAR HEAT EXCHANGERS');
    block(exchanger,'dark rear radiator block',[0,.075,.412],[.94,.69,.14],'iron');
    for(let i=-4;i<=4;i++){
        block(exchanger,'single steel radiator plate '+i,[i*.099,.13,.496],
            [.052,.59,.045],'raw');
    }
    const fan=groupAt(root,'FORGE / INDUSTRIAL AXIAL FAN');
    disk(fan,'dark axial fan barrel',[0,.08,.472],.245,.075,'recess','z',10);
    disk(fan,'teal fan shaft face',[0,.08,.511],.065,.016,'teal','z',10);
    for(let i=0;i<6;i++){
        const a=i*Math.PI/3;
        const vane=block(fan,'fixed rotor vane '+i,
            [Math.cos(a)*.155,.08+Math.sin(a)*.155,.511],
            [.14,.043,.015],'bright');
        vane.rotation.z=a+.25;
    }
    const wiring=groupAt(root,'FORGE / HEAVY POWER INTERFACES');
    block(wiring,'forward U1 welded mounting shoe',[0,-.13,-.472],
        [.57,.40,.08],'loadSteel');
    block(wiring,'forward contact rail',[0,-.13,-.513],
        [.36,.26,.018],'bright');
    for(const side of [-1,1]){
        block(wiring,(side<0?'left':'right')+' thick conduit termination',
            [side*.37,.41,-.10],[.155,.17,.35],'teal');
    }
    block(wiring,'worn yellow access hatch',[0,.491,-.17],[.47,.048,.34],'wornOchre');
    root.traverse(n=>{
        if(!n.isMesh)return;
        n.userData.fitFixtureId='power-forge';
        n.castShadow=true;n.receiveShadow=true;
    });
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root,true);
    for(let axis=0;axis<3;axis++){
        const half=fixture.envelope[axis]/2;
        if(bounds.min.getComponent(axis)<-half-.001||bounds.max.getComponent(axis)>half+.001)
            throw Error('Forge geometry out of physical envelope on axis '+axis);
    }
    root.userData={fitFixtureId:'power-forge',previewOnly:true,category:'power',
        nominalEnvelope:fixture.envelope.slice()};
    const edges=new THREE.EdgesGeometry(new THREE.BoxGeometry(...fixture.envelope));
    const outline=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xe6b249}));
    outline.visible=false;outline.name='forge-nominal-envelope';
    root.add(outline);root.userData.outline=outline;
    return root;
}
