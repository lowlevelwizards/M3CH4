/** k.3a.7.1 — Yardwalker: balanced, protected utility walker.
 * Preview-only assembly. This is an independent load path, not a parameterized
 * version of either the open Kestrel or the Hauler pod-and-shoe rig.
 */
import * as THREE from 'three';
import {YARDWALKER_LAYOUT,validateYardwalkerLayout} from './mobilityDefinitions.js?v=k3a71';
import {groupAt,block,disk,bearing,link,actuator,chamferBlock,taperedLink,
    wedgeSole,splitToe,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a71';
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
export function buildYardwalkerVisual(fixture,layout=YARDWALKER_LAYOUT){
    const check=validateYardwalkerLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Yardwalker engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-yard';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true};
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
        // Modest shoulder rather than a self-contained drive pod. This contacts
        // both the cross-rail and actual hip race at its authored centre.
        chamferBlock(carriage,`Y3-${word}-square-hip-load-block`,
            [side*.645,.525,.10],[.35,.34,.35],.105,'olive');
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`Y3-${word}-visible-hip-bearing`,[0,0,0],
            layout.hip.radius,layout.hip.width,side,'teal');
        const kneeOffset=sub(leg.knee,leg.hip);
        taperedLink(hip,`Y4-${word}-angled-upper-load-beam`,[0,0,0],kneeOffset,
            .29,.245,.25,'cream');
        // One useful protective facet on the *actual* angled upper beam.
        taperedLink(hip,`Y4-${word}-outer-upper-guard`,
            [side*.075,-.095,-.11],
            [kneeOffset[0]+side*.065,kneeOffset[1]+.085,kneeOffset[2]-.10],
            .125,.11,.065,'olive');
        actuator(hip,`Y6-${word}-practical-linear-drive`,
            sub(leg.actuatorTop,leg.hip),sub(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,kneeOffset);
        bearing(knee,`Y5-${word}-exposed-industrial-knee`,[0,0,0],
            layout.knee.radius,layout.knee.width,side,'orange');
        disk(knee,`Y5-${word}-joint-orange-face`,
            [side*(layout.knee.width/2+.015),0,0],.128,.016,'orange','x');
        const ankleOffset=sub(leg.ankle,leg.knee);
        taperedLink(knee,`Y7-${word}-structural-shin`,[0,0,0],ankleOffset,
            .29,.215,.24,'iron');
        // Characteristic asymmetric, FULLER upper calf tapering to the ankle.
        // The two faceted plates touch the actual shin core, not a parallel pole.
        taperedLink(knee,`Y7-${word}-shaped-olive-calf`,
            [side*.095,-.045,-.01],
            [ankleOffset[0]+side*.065,ankleOffset[1]+.07,ankleOffset[2]-.005],
            .255,.155,.155,'olive');
        taperedLink(knee,`Y7-${word}-cream-front-load-face`,
            [0,-.085,-.145],
            [ankleOffset[0],ankleOffset[1]+.07,ankleOffset[2]-.105],
            .20,.135,.058,'cream');
        const ankle=groupAt(knee,`${word}Ankle`,ankleOffset);
        bearing(ankle,`Y8-${word}-plain-machined-ankle`,[0,0,0],
            layout.ankle.radius,layout.ankle.width,side,'bright');
        const footOffset=sub(leg.foot,leg.ankle);
        link(ankle,`Y8-${word}-ankle-to-sole-shank`,[0,0,0],footOffset,.15,.18,'iron');
        const foot=groupAt(ankle,`${word}Foot`,footOffset);
        const [w,h,d]=layout.footSize;
        wedgeSole(foot,`Y9-${word}-continuous-work-boot-sole`,
            [0,0,d*.14],[w,h,d*.72],'charcoal');
        splitToe(foot,`Y9-${word}-two-squared-work-toes`,layout.footSize,.065,.53,'cream');
        block(foot,`Y9-${word}-steel-heel-cap`,[0,-.013,d*.34],
            [w*.72,h*.73,d*.25],'iron');
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
