/** k.3a.8 — Kestrel: exaggerated open reverse-knee runner, preview-only.
 * Narrow forked hip, long opposing diagonals and independently exposed toe
 * prongs. Its moving graph is intentionally unlike a conventional work leg.
 */
import * as THREE from 'three';
import {KESTREL_LAYOUT,validateKestrelLayout} from './mobilityDefinitions.js?v=k3a8';
import {groupAt,block,disk,bearing,link,actuator,forkBracket,taperedLink,
    wedgeSole,splitToe,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a8';
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const scale=(a,n)=>a.map(v=>v*n);
export function buildKestrelVisual(fixture,layout=KESTREL_LAYOUT){
    const check=validateKestrelLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Kestrel engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-compact';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true,silhouetteFamily:'reverse-knee-runner'};
    const carriage=groupAt(root,'KESTREL / OPEN-RUNNER SADDLE',[0,0,0]);
    block(carriage,'K2-narrow-saddle',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'K1-central-pedestal',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'K1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(carriage,'U1-open-central-index',[0,layout.mountingFace[1]-.006,0],.085,.008,'recess','y');
    block(carriage,'K2-centre-keel',[0,.545,.055],[.22,.12,.18],'charcoal');
    for(const r of layout.guideReceivers){
        const word=r.side<0?'left':'right';
        block(carriage,`fixed-${word}-guide-receiver`,r.center,r.size,'charcoal');
        const cap=r.contact.map((v,i)=>i===0?v-r.side*.006:v);
        block(carriage,`${word}-guide-contact-face`,cap,[.012,.07,.14],'bright');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        const forkTop=[side*.445,.585,.025];
        forkBracket(carriage,`K3-${word}-open-hip-fork`,
            forkTop,leg.hip,.07,.042,.072,'iron');
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`K4-${word}-small-outboard-hip`,[0,0,0],
            layout.hip.radius,layout.hip.width,side,'teal');
        const kneeOffset=sub(leg.knee,leg.hip);
        // The upper spar deliberately retreats rearward (+Z) before the shin
        // reverses direction. Long clean diagonals are the family signature.
        taperedLink(hip,`K5-${word}-rearward-swept-cream-upper-spar`,
            [0,0,0],kneeOffset,.118,.088,.082,'cream');
        // Only a short root brace remains; it no longer fills the signature
        // side-view triangle from hip to rearward knee.
        const braceEnd=scale(kneeOffset,.43);
        link(hip,`K5-${word}-short-triangulation-stay`,
            [side*.06,-.055,-.025],
            [braceEnd[0]+side*.045,braceEnd[1],braceEnd[2]-.015],
            .032,.038,'charcoal');
        actuator(hip,`K6-${word}-exposed-knee-spring`,
            sub(leg.actuatorTop,leg.hip),sub(leg.actuatorBottom,leg.hip),side,.76);
        const knee=groupAt(hip,`${word}Knee`,kneeOffset);
        bearing(knee,`K6-${word}-small-rearward-knee`,[0,0,0],
            layout.knee.radius,layout.knee.width,side,'orange');
        const ankleOffset=sub(leg.ankle,leg.knee);
        taperedLink(knee,`K7-${word}-long-forward-cream-shin`,
            [0,0,0],ankleOffset,.108,.072,.080,'cream');
        taperedLink(knee,`K7-${word}-exposed-dark-rear-spine`,
            [0,-.055,.048],
            [ankleOffset[0],ankleOffset[1]+.05,ankleOffset[2]+.032],
            .041,.031,.038,'charcoal');
        const ankle=groupAt(knee,`${word}Ankle`,ankleOffset);
        bearing(ankle,`K8-${word}-tiny-active-hock`,[0,0,0],
            layout.ankle.radius,layout.ankle.width,side,'teal');
        const footOffset=sub(leg.foot,leg.ankle);
        link(ankle,`K8-${word}-short-hock-rocker`,
            [0,0,.018],
            [footOffset[0],footOffset[1],footOffset[2]+.07],
            .058,.068,'iron');
        const foot=groupAt(ankle,`${word}Foot`,footOffset);
        const [w,h,d]=layout.footSize;
        wedgeSole(foot,`K9-${word}-minimal-supported-runner-sole`,
            [0,0,d*.19],[w*.78,h*.88,d*.62],'charcoal',{toeTop:.28,crestZ:.02,rearTop:-.12});
        splitToe(foot,`K9-${word}-open-two-prong-runner-toes`,layout.footSize,.10,.58,'cream',
            {toeTop:.38,crestZ:-.03,rearTop:-.10});
        block(foot,`K9-${word}-tiny-rear-heel`,[0,-.008,d*.39],
            [w*.44,h*.40,d*.16],'iron');
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
        link(root,`${word}-fixed-drop-guide`,start,bridge.receiver,.066,.078,'charcoal');
    }
    return root;
}
