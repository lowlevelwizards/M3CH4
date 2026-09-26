/** k.3a.3 first engineered PREVIEW assembly: the existing Yardwalker.
 * No new owned items, no physics or graph writes; exactly ONE U1 input.
 * Joint groups are named/pivoted for a future pose test, but remain at REST.
 */
import * as THREE from 'three';
import {YARDWALKER_LAYOUT,validateYardwalkerLayout} from './mobilityDefinitions.js';
import {groupAt,block,disk,bearing,link,actuator} from './mobilityVisualKit.js';
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const outlineMaterial=new THREE.LineBasicMaterial({color:0xe6b249,transparent:true,opacity:.85});

export function buildYardwalkerVisual(fixture,layout=YARDWALKER_LAYOUT){
    const check=validateYardwalkerLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Yardwalker engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-yard';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true};
    const carriage=groupAt(root,'YARDWALKER / transverse-carriage',[0,0,0]);
    block(carriage,'Y2-through-saddle',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'Y1-central-pedestal',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'Y1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(carriage,'U1-open-central-index', [0,.819,0],.105,.008,'recess','y');
    for(const receiver of layout.guideReceivers){
        const sideName=receiver.side<0?'left':'right';
        block(carriage,`fixed-${sideName}-guide-receiver`,receiver.center,receiver.size,'charcoal');
        // Small machined outboard face EXACTLY at the authored contact plane.
        const cap=receiver.contact.map((v,i)=>i===0?v-receiver.side*.006:v);
        block(carriage,`${sideName}-guide-contact-face`,cap,[.012,.086,.19],'bright');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        // The upper carriage physically intersects the shoulder, and the
        // hip pivot is inside that shoulder: no unattached side discs.
        block(carriage,`Y3-${word}-load-node`,[side*.66,.53,.10],[.41,.27,.34],'iron');
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`Y3-${word}-hip-pivot`,[0,0,0],layout.hip.radius,layout.hip.width,side,'teal');
        const kneeRel=minus(leg.knee,leg.hip);
        link(hip,`Y4-${word}-upper-load-link`,[0,0,0],kneeRel,layout.thighWidth,.31,'cream');
        // One structural protective plate per upper link, physically overlapping
        // its front face. The dark joint remains exposed at both ends.
        block(hip,`Y10-${word}-upper-cover`,[0,-.235,-.12],layout.coverSize,'olive');
        actuator(hip,`Y6-${word}-drive-actuator`,minus(leg.actuatorTop,leg.hip),minus(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,kneeRel);
        bearing(knee,`Y5-${word}-knee-pivot`,[0,0,0],layout.knee.radius,layout.knee.width,side);
        const ankleRel=minus(leg.ankle,leg.knee);
        link(knee,`Y7-${word}-lower-load-link`,[0,0,0],ankleRel,layout.shinWidth,.29,'iron');
        const ankle=groupAt(knee,`${word}Ankle`,ankleRel);
        bearing(ankle,`Y8-${word}-ankle-pivot`,[0,0,0],layout.ankle.radius,layout.ankle.width,side,'bright');
        const foot=groupAt(ankle,`${word}Foot`,minus(leg.foot,leg.ankle));
        block(foot,`Y9-${word}-footbed`,[0,0,0],layout.footSize,'charcoal');
        // Single forward steel toe shoe. Main footprint remains unchanged.
        block(foot,`Y9-${word}-toe-cap`,[0,.085,-.245],[.43,.05,.29],'cream');
        hip.userData={joint:'hip',side,restPose:0};
        knee.userData={joint:'knee',side,restPose:0};
        ankle.userData={joint:'ankle',side,restPose:0};
        foot.userData={joint:'foot',side};
    }
    // Preserve previous fit controller contract for touch selection and
    // selected conservative source envelope. Shared line material owned here.
    root.traverse(o=>{if(o.isMesh)o.userData.fitFixtureId=fixture.id;});
    const [w,h,d]=fixture.envelope;
    const bounds=new THREE.BoxGeometry(w,h,d);
    const edgesGeom=new THREE.EdgesGeometry(bounds);bounds.dispose();
    const edges=new THREE.LineSegments(edgesGeom,outlineMaterial);
    edges.name='selected-conservative-envelope';edges.visible=false;edges.userData.fitFixtureId=fixture.id;
    root.add(edges);root.userData.outline=edges;
    // The top contact marker is an actual metal face, not an off-envelope blob.
    root.userData.matingFace=layout.mountingFace.slice();
    root.userData.guideReceivers=layout.guideReceivers.map(g=>g.contact.slice());
    return root;
}

/** Geometry-only frame-side fittings: generated exclusively from a VALIDATED
 * guide plan. They do not mutate the frame or the owned leg module. */
export function buildYardwalkerGuideVisuals(plan){
    if(!plan?.ok||plan.bridges.length!==2)throw new Error('Invalid guide bridge plan.');
    const root=new THREE.Group();root.name='UNRATED preview-only frame-side guide brackets';
    root.userData={previewOnly:true,unrated:true,notGameplay:true};
    for(const bridge of plan.bridges){
        const word=bridge.side<0?'left':'right';
        // A small clamp on the ACTUAL outboard face of the existing hip boss.
        const collarCenter=bridge.clamp.map((v,i)=>i===0?v+bridge.side*.012:v);
        disk(root,`${word}-boss-clamp`,collarCenter,bridge.clampRadius,.025,'bright','x');
        const start=bridge.clamp.map((v,i)=>i===0?v+bridge.side*.025:v);
        link(root,`${word}-fixed-drop-guide`,start,bridge.receiver,.088,.105,'charcoal');
        // Receiver itself belongs to Yardwalker, and is not duplicated here.
    }
    return root;
}
