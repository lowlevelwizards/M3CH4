/** k.3a.4 second engineered PREVIEW assembly: Kestrel compact articulated legs.
 * One real U1 mobility input, two fixed side-guide receivers and a distinct
 * lighter reverse-knee silhouette. No new gameplay mounts or save mutations.
 */
import * as THREE from 'three';
import { KESTREL_LAYOUT, validateKestrelLayout } from './mobilityDefinitions.js';
import { groupAt, block, disk, bearing, link, actuator } from './mobilityVisualKit.js';
import { buildYardwalkerGuideVisuals as buildKestrelGuideVisuals } from './yardwalkerVisual.js';
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const outlineMaterial=new THREE.LineBasicMaterial({color:0xe6b249,transparent:true,opacity:.85});

export function buildKestrelVisual(fixture,layout=KESTREL_LAYOUT){
    const check=validateKestrelLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Kestrel engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-compact';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true};
    const carriage=groupAt(root,'KESTREL / saddle-carriage',[0,0,0]);
    block(carriage,'K2-light-saddle',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'K1-central-pedestal',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'K1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(carriage,'U1-open-central-index',[0,layout.mountingFace[1]-.006,0],.09,.008,'recess','y');
    block(carriage,'K3-hip-crossmember',[0,.50,.09],[1.00,.11,.20],'iron');
    block(carriage,'K4-center-keel',[0,.44,.13],[.30,.12,.30],'charcoal');
    for(const receiver of layout.guideReceivers){
        const sideName=receiver.side<0?'left':'right';
        block(carriage,`fixed-${sideName}-guide-receiver`,receiver.center,receiver.size,'charcoal');
        const cap=receiver.contact.map((v,i)=>i===0?v-receiver.side*.006:v);
        block(carriage,`${sideName}-guide-contact-face`,cap,[.012,.070,.15],'bright');
        block(carriage,`K3-${sideName}-hip-node`,[receiver.side*.49,.49,.08],[.22,.20,.25],'iron');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`K5-${word}-hip-pivot`,[0,0,0],layout.hip.radius,layout.hip.width,side,'teal');
        const kneeRel=minus(leg.knee,leg.hip);
        link(hip,`K6-${word}-upper-link`,[0,0,0],kneeRel,layout.thighWidth,.20,'cream');
        block(hip,`K7-${word}-upper-fairing`,[side*.02,-.17,.10],layout.coverSize,'olive');
        actuator(hip,`K8-${word}-drive-actuator`,minus(leg.actuatorTop,leg.hip),minus(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,kneeRel);
        bearing(knee,`K9-${word}-knee-pivot`,[0,0,0],layout.knee.radius,layout.knee.width,side);
        const ankleRel=minus(leg.ankle,leg.knee);
        link(knee,`K10-${word}-lower-link`,[0,0,0],ankleRel,layout.shinWidth,.18,'iron');
        block(knee,`K11-${word}-calf-plate`,[0,-.22,-.05],[.14,.22,.10],'charcoal');
        const ankle=groupAt(knee,`${word}Ankle`,ankleRel);
        bearing(ankle,`K12-${word}-ankle-pivot`,[0,0,0],layout.ankle.radius,layout.ankle.width,side,'bright');
        const foot=groupAt(ankle,`${word}Foot`,minus(leg.foot,leg.ankle));
        block(foot,`K13-${word}-footbed`,[0,0,0],layout.footSize,'charcoal');
        block(foot,`K13-${word}-toe-shoe`,[0,.055,-.14],[.28,.04,.22],'cream');
        block(foot,`K13-${word}-heel-block`,[0,.025,.15],[.14,.045,.14],'iron');
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

export { buildKestrelGuideVisuals };
