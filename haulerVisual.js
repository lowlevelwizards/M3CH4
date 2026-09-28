/** k.3a.8 — Hauler H2: squat podded industrial load suspension.
 * This is deliberately NOT a widened Yardwalker. Fixed side pods dominate the
 * upper silhouette; the upper linkage is buried and the load shoes dominate
 * the ground silhouette. Preview geometry only; gameplay remains untouched.
 */
import * as THREE from 'three';
import {HAULER_LAYOUT,validateHaulerLayout} from './mobilityDefinitions.js?v=k3a8';
import {groupAt,block,disk,bearing,link,actuator,chamferBlock,taperedLink,
    wedgeSole,splitToe,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a8';
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
export function buildHaulerVisual(fixture,layout=HAULER_LAYOUT){
    const check=validateHaulerLayout(layout,fixture);
    if(!check.valid)throw new Error(`Invalid Hauler engineering sheet: ${check.errors.join(' ')}`);
    const root=new THREE.Group();root.name='fit-fixture:legs-hauler';
    root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
        singleFunctionalMobilityInput:true,restPoseOnly:true,requiresAdapter:true,
        silhouetteFamily:'podded-load-bearer'};
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
    // Wide yoke ribs visually tie the two suspension pods into one transverse carrier.
    block(carriage,'H2-front-load-rib',[0,.55,-.07],[1.78,.115,.15],'iron');
    block(carriage,'H2-rear-load-rib',[0,.55,.27],[1.78,.115,.15],'iron');
    for(const r of layout.guideReceivers){
        const word=r.side<0?'left':'right';
        block(carriage,`fixed-${word}-guide-receiver`,r.center,r.size,'charcoal');
        const cap=r.contact.map((n,i)=>i===0?n-r.side*.007:n);
        block(carriage,`${word}-guide-contact-face`,cap,[.014,.095,.20],'bright');
    }
    // The pods are fixed carriage masses, not inflated moving thighs.
    for(const pod of layout.pods){
        const side=pod.side,word=side<0?'left':'right';
        chamferBlock(carriage,`H3-${word}-giant-fixed-drive-pod`,pod.center,pod.size,.10,'olive');
        const outerX=side*(Math.abs(pod.center[0])+pod.size[0]/2-.035);
        block(carriage,`H3-${word}-outboard-sidewall`,
            [outerX,pod.center[1],pod.center[2]],[.055,.52,.50],'charcoal');
        // Dark inset makes the pod read as a serviceable industrial housing
        // while remaining entirely inside its authored solid silhouette.
        block(carriage,`H3-${word}-service-recess`,
            [outerX+side*.031,pod.center[1]+.045,pod.center[2]-.02],[.020,.27,.28],'recess');
        disk(carriage,`H5-${word}-teal-outboard-hub`,[side*1.260,.22,.10],
            .205,.018,'teal','x');
        disk(carriage,`H5-${word}-hub-pin`,[side*1.270,.22,.10],.090,.010,'recess','x');
    }
    for(const leg of layout.legs){
        const side=leg.side,word=side<0?'left':'right';
        const hip=groupAt(carriage,`${word}Hip`,leg.hip);
        bearing(hip,`H5-${word}-recessed-hip-pivot`,[0,0,0],
            layout.hip.radius,layout.hip.width,side,'teal');
        const k=minus(leg.knee,leg.hip);
        // This yoke is intentionally narrow and mostly occluded by the fixed pod.
        taperedLink(hip,`H4-${word}-recessed-short-yoke`,[0,0,0],k,
            .27,.25,.26,'charcoal');
        // Only this short cheek is meant to read below the pod; it overlaps the
        // pod bottom and terminates at the low knee hub.
        block(hip,`H4-${word}-lower-yoke-cheek`,[side*.012,-.35,.018],
            [.25,.20,.25],'cream');
        actuator(hip,`H10-${word}-short-drive-actuator`,
            minus(leg.actuatorTop,leg.hip),minus(leg.actuatorBottom,leg.hip),side,1.08);
        const knee=groupAt(hip,`${word}Knee`,k);
        bearing(knee,`H6-${word}-massive-knee-pivot`,[0,0,0],
            layout.knee.radius,layout.knee.width,side);
        disk(knee,`H6-${word}-orange-knee-ring`,[side*(layout.knee.width/2+.018),0,0],
            layout.knee.radius*.94,.024,'orange','x');
        disk(knee,`H6-${word}-steel-knee-core`,[side*(layout.knee.width/2+.033),0,0],
            layout.knee.radius*.46,.017,'charcoal','x');
        block(knee,`H6-${word}-cream-knee-guard`,[0,.00,-.17],[.28,.22,.11],'cream');
        const a=minus(leg.ankle,leg.knee);
        // Thick compression member: short-looking, structural, and visually
        // closer to a forklift suspension column than a normal shin.
        taperedLink(knee,`H7-${word}-compression-column`,[0,0,0],a,
            .44,.36,.36,'charcoal');
        const front0=[0,-.06,-.17],front1=[a[0],a[1]+.065,a[2]-.15];
        taperedLink(knee,`H7-${word}-cream-front-shock-slab`,front0,front1,
            .31,.27,.082,'cream');
        const ankle=groupAt(knee,`${word}Ankle`,a);
        bearing(ankle,`H8-${word}-massive-low-load-ankle`,[0,0,0],
            layout.ankle.radius,layout.ankle.width,side,'bright');
        const f=minus(leg.foot,leg.ankle);
        link(ankle,`H8-${word}-ankle-to-load-shoe`,[0,0,0],[f[0],f[1]+.05,f[2]],.24,.27,'iron');
        const foot=groupAt(ankle,`${word}Foot`,f);
        const [fw,fh,fd]=layout.footSize;
        // The front TWO pads own the shoe silhouette. A narrower rear bridge
        // supports them but does not turn the result back into a giant boot.
        wedgeSole(foot,`H9-${word}-structural-load-shoe`,
            [0,0,fd*.15],[fw*.78,fh*.90,fd*.70],'olive',{toeTop:.30,crestZ:.10,rearTop:-.10});
        splitToe(foot,`H9-${word}-split-front-load-pad`,layout.footSize,.15,.62,'cream',
            {toeTop:.36,crestZ:.12,rearTop:-.12});
        block(foot,`H9-${word}-rear-stabilizer-bridge`,[0,-.018,fd*.44],
            [fw*.72,fh*.64,fd*.12],'charcoal');
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
