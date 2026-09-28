/** k.3a.8 — Yardwalker: neutral industrial utility walker.
 * Preview-only assembly. It deliberately stays between Kestrel's open runner
 * anatomy and Hauler's fixed-pod load suspension rather than sharing either.
 */
import * as THREE from 'three';
import {YARDWALKER_LAYOUT,validateYardwalkerLayout} from './mobilityDefinitions.js?v=k3a8';
import {groupAt,block,disk,bearing,link,actuator,chamferBlock,taperedLink,
    wedgeSole,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a8';
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
export function buildYardwalkerVisual(fixture,layout=YARDWALKER_LAYOUT){
    const check=validateYardwalkerLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Yardwalker engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-yard';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true,silhouetteFamily:'utility-walker'};
    const carriage=groupAt(root,'YARDWALKER / WORK-CARRIAGE',[0,0,0]);
    block(carriage,'Y2-cross-rail',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'Y1-central-pedestal',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'Y1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(carriage,'U1-open-central-index',[0,layout.mountingFace[1]-.006,0],.105,.008,'recess','y');
    for(const r of layout.guideReceivers){
        const word=r.side<0?'left':'right';
        block(carriage,`fixed-${word}-guide-receiver`,r.center,r.size,'charcoal');
        const cap=r.contact.map((v,i)=>i===0?v-r.side*.006:v);
        block(carriage,`${word}-guide-contact-face`,cap,[.012,.086,.19],'bright');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        // A moderate load block and visible bearing: recognizably conventional,
        // but nowhere near the volume of Hauler's fixed suspension pods.
        chamferBlock(carriage,`Y3-${word}-square-hip-load-block`,
            [side*.645,.525,.08],[.35,.34,.34],.105,'olive');
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`Y3-${word}-visible-hip-bearing`,[0,0,0],
            layout.hip.radius,layout.hip.width,side,'teal');
        const kneeOffset=sub(leg.knee,leg.hip);
        taperedLink(hip,`Y4-${word}-angled-upper-load-beam`,[0,0,0],kneeOffset,
            .29,.245,.24,'cream');
        taperedLink(hip,`Y4-${word}-outer-upper-guard`,
            [side*.075,-.095,-.10],
            [kneeOffset[0]+side*.065,kneeOffset[1]+.085,kneeOffset[2]-.09],
            .125,.11,.06,'olive');
        actuator(hip,`Y6-${word}-practical-linear-drive`,
            sub(leg.actuatorTop,leg.hip),sub(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,kneeOffset);
        bearing(knee,`Y5-${word}-exposed-industrial-knee`,[0,0,0],
            layout.knee.radius,layout.knee.width,side,'orange');
        disk(knee,`Y5-${word}-joint-orange-face`,
            [side*(layout.knee.width/2+.015),0,0],.128,.016,'orange','x');
        const ankleOffset=sub(leg.ankle,leg.knee);
        taperedLink(knee,`Y7-${word}-structural-shin`,[0,0,0],ankleOffset,
            .30,.215,.24,'iron');
        // k.3a.8: the calf owns the Yardwalker silhouette. It is full around the
        // upper/mid shin, then visibly pinches toward the serviceable ankle.
        taperedLink(knee,`Y7-${word}-shaped-olive-calf`,
            [side*.10,-.035,-.005],
            [ankleOffset[0]+side*.06,ankleOffset[1]+.065,ankleOffset[2]-.005],
            .29,.155,.17,'olive');
        taperedLink(knee,`Y7-${word}-cream-front-load-face`,
            [0,-.075,-.135],
            [ankleOffset[0],ankleOffset[1]+.07,ankleOffset[2]-.095],
            .205,.13,.055,'cream');
        const ankle=groupAt(knee,`${word}Ankle`,ankleOffset);
        bearing(ankle,`Y8-${word}-plain-machined-ankle`,[0,0,0],
            layout.ankle.radius,layout.ankle.width,side,'bright');
        const footOffset=sub(leg.foot,leg.ankle);
        link(ankle,`Y8-${word}-ankle-to-sole-shank`,[0,0,0],footOffset,.15,.18,'iron');
        const foot=groupAt(ankle,`${word}Foot`,footOffset);
        const [w,h,d]=layout.footSize;
        // A continuous work-boot sole carries the silhouette; the two toe pads
        // are squared wear blocks, not claws or runner prongs.
        wedgeSole(foot,`Y9-${word}-continuous-work-boot-sole`,
            [0,0,d*.10],[w,h*.88,d*.80],'charcoal',{toeTop:.16,crestZ:.02,rearTop:-.04});
        const gap=.07,each=(w-gap)/2,toeDepth=d*.26,toeZ=-d*.37;
        for(const toeSide of [-1,1]){
            const xc=toeSide*(gap/2+each/2);
            block(foot,`Y9-${word}-${toeSide<0?'inner':'outer'}-square-toe-pad`,
                [xc,.012,toeZ],[each,h*.64,toeDepth],'cream');
        }
        block(foot,`Y9-${word}-steel-heel-cap`,[0,-.008,d*.38],
            [w*.76,h*.70,d*.24],'iron');
        hip.userData={joint:'hip',side,restPose:0};
        knee.userData={joint:'knee',side,restPose:0};
        ankle.userData={joint:'ankle',side,restPose:0};
        foot.userData={joint:'foot',side};
    }
    return finishMobilityVisual(root,fixture,layout);
}
/** Unrated fixed guides, never second independent mounting sockets. */
export function buildYardwalkerGuideVisuals(plan){
    if(!plan?.ok||plan.bridges.length!==2)throw new Error('Invalid Yardwalker guide bridge plan.');
    const root=new THREE.Group();root.name='UNRATED preview-only frame-side guide brackets';
    root.userData={previewOnly:true,unrated:true,notGameplay:true};
    for(const bridge of plan.bridges){
        const word=bridge.side<0?'left':'right',
            cap=bridge.clamp.map((n,i)=>i===0?n+bridge.side*.012:n),
            start=bridge.clamp.map((n,i)=>i===0?n+bridge.side*.025:n);
        disk(root,`${word}-boss-clamp`,cap,bridge.clampRadius,.025,'bright','x');
        link(root,`${word}-fixed-drop-guide`,start,bridge.receiver,.088,.105,'charcoal');
    }
    return root;
}
