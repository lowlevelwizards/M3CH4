/** k.3a.7 Hauler H2: an independent transverse pod-and-strut load carrier.
 * This is NOT a widened Yardwalker. Preview geometry only; native H2 conversion
 * is one visible 110 kg adapter on the original catalogue part.
 */
import * as THREE from 'three';
import {HAULER_LAYOUT,validateHaulerLayout} from './mobilityDefinitions.js?v=k3a71';
import {groupAt,block,disk,bearing,link,actuator,chamferBlock,taperedLink,
    wedgeSole,splitToe,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a71';
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
export function buildHaulerVisual(fixture,layout=HAULER_LAYOUT){
    const check=validateHaulerLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Hauler engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-hauler';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true,requiresAdapter:true};
    // Explicit conversion stack, physically overlapping every adjoining solid.
    const adapter=groupAt(root,'HAULER / H2-U1 ADAPTER',[0,0,0]);
    block(adapter,'H1-upper-crown',layout.adapter.crown.center,layout.adapter.crown.size,'bright');
    block(adapter,'H1-lowering-collar',layout.adapter.collar.center,layout.adapter.collar.size,'iron');
    block(adapter,'H1-load-skirt',layout.adapter.skirt.center,layout.adapter.skirt.size,'charcoal');
    block(adapter,'H1-U1-contact-pad',layout.pad.center,layout.pad.size,'bright');
    disk(adapter,'U1-open-central-index',[0,layout.mountingFace[1]-.006,0],.115,.008,'recess','y');
    for(const lug of layout.adapter.sideLugs){
        block(adapter,`H1-${lug.side<0?'left':'right'}-lug`,lug.center,lug.size,'iron');
    }
    const carriage=groupAt(root,'HAULER / POD YOKE',[0,0,0]);
    block(carriage,'H2-through-saddle',layout.saddle.center,layout.saddle.size,'ochre');
    block(carriage,'H2-central-keel',layout.pedestal.center,layout.pedestal.size,'iron');
    block(carriage,'H2-front-load-rib',[0,.56,-.045],[1.63,.105,.15],'iron');
    block(carriage,'H2-rear-load-rib',[0,.56,.25],[1.63,.105,.15],'iron');
    for(const r of layout.guideReceivers){
        const word=r.side<0?'left':'right';
        block(carriage,`fixed-${word}-guide-receiver`,r.center,r.size,'charcoal');
        const cap=r.contact.map((n,i)=>i===0?n-r.side*.007:n);
        block(carriage,`${word}-guide-contact-face`,cap,[.014,.095,.20],'bright');
    }
    // Pods stay fixed on the carriage; actual short upper yokes pivot INSIDE them.
    for(const pod of layout.pods){
        const side=pod.side,word=side<0?'left':'right';
        chamferBlock(carriage,`H3-${word}-giant-fixed-drive-pod`,pod.center,pod.size,.14,'olive');
        block(carriage,`H3-${word}-outboard-sidewall`,
            [side*1.204,pod.center[1],pod.center[2]],[.058,.45,.45],'charcoal');
        // Visible outer hub and the actual internal hip bearing share a true axis.
        disk(carriage,`H5-${word}-teal-outboard-hub`,[side*1.239,.24,.10],
            .188,.020,'teal','x');
        disk(carriage,`H5-${word}-hub-pin`,[side*1.251,.24,.10],.085,.018,'recess','x');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`H5-${word}-recessed-hip-pivot`,[0,0,0],
            layout.hip.radius,layout.hip.width,side,'teal');
        const k=minus(leg.knee,leg.hip);
        taperedLink(hip,`H4-${word}-recessed-short-yoke`,[0,0,0],k,
            .37,.315,.34,'iron');
        // Exposed only below the pod: a squared compression lug, not thigh armour.
        block(hip,`H4-${word}-lower-yoke-cheek`,[side*.015,-.335,.02],
            [.27,.18,.29],'cream');
        actuator(hip,`H10-${word}-short-drive-actuator`,
            minus(leg.actuatorTop,leg.hip),minus(leg.actuatorBottom,leg.hip),side);
        const knee=groupAt(hip,`${word}Knee`,k);
        bearing(knee,`H6-${word}-massive-knee-pivot`,[0,0,0],
            layout.knee.radius,layout.knee.width,side);
        disk(knee,`H6-${word}-orange-knee-ring`,[side*(layout.knee.width/2+.018),0,0],
            layout.knee.radius*.94,.024,'orange','x');
        disk(knee,`H6-${word}-steel-knee-core`,[side*(layout.knee.width/2+.033),0,0],
            layout.knee.radius*.46,.017,'charcoal','x');
        block(knee,`H6-${word}-cream-knee-guard`,[0,.01,-.155],[.245,.21,.105],'cream');
        const a=minus(leg.ankle,leg.knee);
        taperedLink(knee,`H7-${word}-compression-column`,[0,0,0],a,
            .40,.31,.34,'charcoal');
        const front0=[0,-.08,-.155],front1=[a[0],a[1]+.07,a[2]-.145];
        taperedLink(knee,`H7-${word}-cream-front-shock-slab`,front0,front1,
            .28,.25,.078,'cream');
        const ankle=groupAt(knee,`${word}Ankle`,a);
        bearing(ankle,`H8-${word}-low-load-ankle`,[0,0,0],
            layout.ankle.radius,layout.ankle.width,side,'bright');
        const f=minus(leg.foot,leg.ankle);
        link(ankle,`H8-${word}-ankle-to-sole-shank`,[0,0,0],[f[0],f[1]+.055,f[2]],.22,.24,'iron');
        const foot=groupAt(ankle,`${word}Foot`,f);
        const [fw,fh,fd]=layout.footSize;
        // Continuous rear sole and TWO separate overlapping forward load wedges.
        wedgeSole(foot,`H9-${word}-structural-load-shoe`,
            [0,0,fd*.165],[fw,fh,fd*.67],'olive');
        splitToe(foot,`H9-${word}-split-front-load-pad`,layout.footSize,.12,.52,'cream');
        block(foot,`H9-${word}-dark-rear-heel`,[0,-.021,fd*.38],
            [fw*.78,fh*.68,fd*.20],'charcoal');
        hip.userData={joint:'hip',side,restPose:0};
        knee.userData={joint:'knee',side,restPose:0};
        ankle.userData={joint:'ankle',side,restPose:0};
        foot.userData={joint:'foot',side};
    }
    return finishMobilityVisual(root,fixture,layout);
}
export function buildHaulerGuideVisuals(plan){
    if(!plan?.ok||plan.bridges.length!==2)throw new Error('Invalid Hauler guide bridge plan.');
    const root=new THREE.Group();root.name='UNRATED preview-only heavy guide brackets';
    root.userData={previewOnly:true,unrated:true,notGameplay:true};
    for(const bridge of plan.bridges){
        const word=bridge.side<0?'left':'right',
            collarCenter=bridge.clamp.map((v,i)=>i===0?v+bridge.side*.015:v),
            start=bridge.clamp.map((v,i)=>i===0?v+bridge.side*.03:v);
        disk(root,`${word}-boss-clamp`,collarCenter,bridge.clampRadius*.95,.03,'bright','x');
        link(root,`${word}-fixed-drop-guide`,start,bridge.receiver,.105,.13,'charcoal');
    }
    return root;
}
