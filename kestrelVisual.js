/** k.3a.7.1 — Kestrel: open reverse-knee spring runner, preview-only.
 * Narrow forked hip, long opposing diagonals and independently exposed toe
 * prongs. Its moving graph is intentionally unlike a shelled work walker.
 */
import * as THREE from 'three';
import {KESTREL_LAYOUT,validateKestrelLayout} from './mobilityDefinitions.js?v=k3a71';
import {groupAt,block,disk,bearing,link,actuator,forkBracket,taperedLink,
    wedgeSole,splitToe,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a71';
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
export function buildKestrelVisual(fixture,layout=KESTREL_LAYOUT){
    const check=validateKestrelLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Kestrel engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-compact';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true};
    const carriage=groupAt(root,'KESTREL / OPEN-RUNNER SADDLE',[0,0,0]);
    block(carriage,'K2-narrow-saddle',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'K1-central-pedestal',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'K1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(carriage,'U1-open-central-index',[0,layout.mountingFace[1]-.006,0],.09,.008,'recess','y');
    block(carriage,'K2-centre-keel',[0,.545,.08],[.26,.125,.21],'charcoal');
    for(const r of layout.guideReceivers){
        const word=r.side<0?'left':'right';
        block(carriage,`fixed-${word}-guide-receiver`,r.center,r.size,'charcoal');
        const cap=r.contact.map((v,i)=>i===0?v-r.side*.006:v);
        block(carriage,`${word}-guide-contact-face`,cap,[.012,.07,.15],'bright');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        const forkTop=[side*.49,.59,.055];
        forkBracket(carriage,`K3-${word}-open-hip-fork`,
            forkTop,leg.hip,.085,.050,.085,'iron');
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`K4-${word}-small-outboard-hip`,[0,0,0],
            layout.hip.radius,layout.hip.width,side,'teal');
        const kneeOffset=sub(leg.knee,leg.hip);
        taperedLink(hip,`K5-${word}-rearward-swept-cream-upper-spar`,
            [0,0,0],kneeOffset,.14,.11,.105,'cream');
        // Tiny triangular stay leaves the main hip-to-knee negative space open.
        link(hip,`K5-${word}-short-triangulation-stay`,
            [side*.085,-.075,-.04],
            [kneeOffset[0]+side*.067,kneeOffset[1]+.075,kneeOffset[2]-.035],
            .038,.045,'charcoal');
        actuator(hip,`K6-${word}-short-knee-spring`,
            sub(leg.actuatorTop,leg.hip),sub(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,kneeOffset);
        bearing(knee,`K6-${word}-small-rearward-knee`,[0,0,0],
            layout.knee.radius,layout.knee.width,side,'orange');
        const ankleOffset=sub(leg.ankle,leg.knee);
        taperedLink(knee,`K7-${word}-long-forward-cream-shin`,
            [0,0,0],ankleOffset,.133,.094,.105,'cream');
        taperedLink(knee,`K7-${word}-exposed-dark-rear-spine`,
            [0,-.06,.064],
            [ankleOffset[0],ankleOffset[1]+.055,ankleOffset[2]+.040],
            .055,.044,.05,'charcoal');
        const ankle=groupAt(knee,`${word}Ankle`,ankleOffset);
        bearing(ankle,`K8-${word}-small-active-hock`,[0,0,0],
            layout.ankle.radius,layout.ankle.width,side,'teal');
        const footOffset=sub(leg.foot,leg.ankle);
        link(ankle,`K8-${word}-short-hock-rocker`,
            [0,0,.025],
            [footOffset[0],footOffset[1],footOffset[2]+.09],
            .072,.09,'iron');
        const foot=groupAt(ankle,`${word}Foot`,footOffset);
        const [w,h,d]=layout.footSize;
        wedgeSole(foot,`K9-${word}-minimal-supported-runner-sole`,
            [0,0,d*.18],[w*.87,h,d*.64],'charcoal');
        splitToe(foot,`K9-${word}-open-two-prong-runner-toes`,layout.footSize,.09,.53,'cream');
        block(foot,`K9-${word}-short-rear-heel`,[0,-.012,d*.35],
            [w*.58,h*.47,d*.20],'iron');
        hip.userData={joint:'hip',side,restPose:0};
        knee.userData={joint:'knee',side,restPose:0};
        ankle.userData={joint:'ankle',side,restPose:0};
        foot.userData={joint:'foot',side};
    }
    return finishMobilityVisual(root,fixture,layout);
}
/** Exactly the same fixed-plan interface; not a shared family constructor. */
export function buildKestrelGuideVisuals(plan){
    if(!plan?.ok||plan.bridges.length!==2)throw new Error('Invalid Kestrel guide bridge plan.');
    const root=new THREE.Group();root.name='UNRATED preview-only lightweight guide brackets';
    root.userData={previewOnly:true,unrated:true,notGameplay:true};
    for(const bridge of plan.bridges){
        const word=bridge.side<0?'left':'right',
            cap=bridge.clamp.map((n,i)=>i===0?n+bridge.side*.012:n),
            start=bridge.clamp.map((n,i)=>i===0?n+bridge.side*.025:n);
        disk(root,`${word}-boss-clamp`,cap,bridge.clampRadius,.024,'bright','x');
        link(root,`${word}-fixed-drop-guide`,start,bridge.receiver,.072,.088,'charcoal');
    }
    return root;
}
