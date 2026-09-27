/** k.3a.5 third engineered PREVIEW mobility study: Hauler H2 heavy legs.
 * Uses one real U1 frame connection through an explicit 110 kg H2/U1 adapter.
 * Broad industrial carriage, wider stance and oversized feet. Preview only.
 */
import * as THREE from 'three';
import { HAULER_LAYOUT, validateHaulerLayout } from './mobilityDefinitions.js';
import { groupAt, block, disk, bearing, link, actuator } from './mobilityVisualKit.js';
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const outlineMaterial=new THREE.LineBasicMaterial({color:0xe6b249,transparent:true,opacity:.85});

export function buildHaulerVisual(fixture,layout=HAULER_LAYOUT){
    const check=validateHaulerLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Hauler engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-hauler';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true,requiresAdapter:true};
    const adapter=groupAt(root,'HAULER / H2-U1 ADAPTER',[0,0,0]);
    block(adapter,'H1-upper-crown',layout.adapter.crown.center,layout.adapter.crown.size,'bright');
    block(adapter,'H1-lowering-collar',layout.adapter.collar.center,layout.adapter.collar.size,'iron');
    block(adapter,'H1-load-skirt',layout.adapter.skirt.center,layout.adapter.skirt.size,'charcoal');
    block(adapter,'H1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(adapter,'U1-open-central-index',[0,layout.mountingFace[1]-.006,0],.115,.008,'recess','y');
    for(const lug of layout.adapter.sideLugs){
        const word=lug.side<0?'left':'right';
        block(adapter,`H1-${word}-lug`,lug.center,lug.size,'iron');
    }
    const carriage=groupAt(root,'HAULER / TRANSVERSE CARRIAGE',[0,0,0]);
    block(carriage,'H2-through-saddle',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'H2-central-keel',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'H2-front-rib',[0,.56,-.02],[1.55,.10,.18],'iron');
    block(carriage,'H2-rear-rib',[0,.56,.24],[1.55,.10,.18],'iron');
    for(const receiver of layout.guideReceivers){
        const sideName=receiver.side<0?'left':'right';
        block(carriage,`fixed-${sideName}-guide-receiver`,receiver.center,receiver.size,'charcoal');
        const cap=receiver.contact.map((v,i)=>i===0?v-receiver.side*.007:v);
        block(carriage,`${sideName}-guide-contact-face`,cap,[.014,.095,.205],'bright');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        block(carriage,`H3-${word}-shoulder`,[side*.83,.46,.10],[.48,.30,.34],'iron');
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`H3-${word}-hip-pivot`,[0,0,0],layout.hip.radius,layout.hip.width,side,'teal');
        const kneeRel=minus(leg.knee,leg.hip);
        link(hip,`H4-${word}-upper-load-link`,[0,0,0],kneeRel,layout.thighWidth,.34,'cream');
        block(hip,`H5-${word}-thigh-cover`,[0,-.22,-.12],layout.coverSize,'olive');
        actuator(hip,`H6-${word}-drive-actuator`,minus(leg.actuatorTop,leg.hip),minus(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,kneeRel);
        bearing(knee,`H7-${word}-knee-pivot`,[0,0,0],layout.knee.radius,layout.knee.width,side);
        const ankleRel=minus(leg.ankle,leg.knee);
        link(knee,`H8-${word}-lower-load-link`,[0,0,0],ankleRel,layout.shinWidth,.32,'iron');
        block(knee,`H9-${word}-calf-plate`,[0,-.23,.02],[.22,.26,.12],'charcoal');
        const ankle=groupAt(knee,`${word}Ankle`,ankleRel);
        bearing(ankle,`H10-${word}-ankle-pivot`,[0,0,0],layout.ankle.radius,layout.ankle.width,side,'bright');
        const foot=groupAt(ankle,`${word}Foot`,minus(leg.foot,leg.ankle));
        block(foot,`H11-${word}-footbed`,[0,0,0],layout.footSize,'charcoal');
        block(foot,`H11-${word}-toe-shoe`,[0,.09,-.29],[.50,.055,.32],'cream');
        block(foot,`H11-${word}-heel-shoe`,[0,.05,.22],[.30,.055,.18],'iron');
        hip.userData={joint:'hip',side,restPose:0};
        knee.userData={joint:'knee',side,restPose:0};
        ankle.userData={joint:'ankle',side,restPose:0};
        foot.userData={joint:'foot',side};
    }
    root.traverse(o=>{if(o.isMesh)o.userData.fitFixtureId=fixture.id;});
    const [w,h,d]=fixture.envelope;
    const bounds=new THREE.BoxGeometry(w,h,d);
    const edgesGeom=new THREE.EdgesGeometry(bounds);bounds.dispose();
    const edges=new THREE.LineSegments(edgesGeom,outlineMaterial);
    edges.name='selected-conservative-envelope';edges.visible=false;edges.userData.fitFixtureId=fixture.id;
    root.add(edges);root.userData.outline=edges;
    root.userData.matingFace=layout.mountingFace.slice();
    root.userData.guideReceivers=layout.guideReceivers.map(g=>g.contact.slice());
    return root;
}

export function buildHaulerGuideVisuals(plan){
    if(!plan?.ok||plan.bridges.length!==2)throw new Error('Invalid Hauler guide bridge plan.');
    const root=new THREE.Group();root.name='UNRATED preview-only heavy guide brackets';
    root.userData={previewOnly:true,unrated:true,notGameplay:true};
    for(const bridge of plan.bridges){
        const word=bridge.side<0?'left':'right';
        const collarCenter=bridge.clamp.map((v,i)=>i===0?v+bridge.side*.015:v);
        disk(root,`${word}-boss-clamp`,collarCenter,bridge.clampRadius*.95,.03,'bright','x');
        const start=bridge.clamp.map((v,i)=>i===0?v+bridge.side*.03:v);
        link(root,`${word}-fixed-drop-guide`,start,bridge.receiver,.105,.13,'charcoal');
    }
    return root;
}
