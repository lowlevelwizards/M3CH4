/** k.3a.8: preview-only authored rest poses for the three existing mobility IDs.
 * The component catalogue owns physical dimensions, masses and gameplay values.
 * Positive Z is rearward; negative Z is the forward direction.
 */
export const YARDWALKER_LAYOUT = Object.freeze({
    catalogId:'legs-yard', mountingStandard:'medium',
    mountingFace:[0,.825,0], mountingNormal:[0,1,0], primaryMounts:1,
    saddle:{center:[0,.655,.10],size:[1.54,.20,.36]},
    pedestal:{center:[0,.765,0],size:[.37,.115,.29]},
    pad:{center:[0,.8075,0],size:[.42,.035,.32]},
    guideReceivers:[
        {side:-1,center:[-.76,.72,.10],size:[.10,.095,.22],contact:[-.81,.72,.10]},
        {side:+1,center:[+.76,.72,.10],size:[.10,.095,.22],contact:[+.81,.72,.10]},
    ],
    legs:[-1,1].map(side=>({
        side, hip:[side*.64,.39,.08], knee:[side*.67,-.13,.18],
        ankle:[side*.63,-.575,.08], foot:[side*.64,-.742,-.10],
        actuatorTop:[side*.82,.285,.20],actuatorBottom:[side*.81,-.065,.23],
    })),
    hip:{radius:.20,width:.25},knee:{radius:.18,width:.23},ankle:{radius:.105,width:.19},
    thighWidth:.29,shinWidth:.31,footSize:[.60,.16,.76],coverSize:[.31,.39,.125],
    intent:'Neutral middle family: balanced industrial utility walker with protected calves and continuous work boots.',
});
export const KESTREL_LAYOUT = Object.freeze({
    catalogId:'legs-compact',mountingStandard:'medium',
    mountingFace:[0,.775,0],mountingNormal:[0,1,0],primaryMounts:1,
    saddle:{center:[0,.615,.05],size:[1.10,.16,.24]},
    pedestal:{center:[0,.71,0],size:[.29,.10,.22]},
    pad:{center:[0,.7575,0],size:[.34,.035,.24]},
    guideReceivers:[
        {side:-1,center:[-.52,.665,.07],size:[.085,.08,.17],contact:[-.5625,.665,.07]},
        {side:+1,center:[+.52,.665,.07],size:[.085,.08,.17],contact:[+.5625,.665,.07]},
    ],
    legs:[-1,1].map(side=>({
        side,hip:[side*.43,.36,.00],knee:[side*.36,-.045,.33],
        ankle:[side*.47,-.53,-.12],foot:[side*.48,-.708,-.20],
        actuatorTop:[side*.46,.20,.13],actuatorBottom:[side*.39,-.10,.23],
    })),
    hip:{radius:.145,width:.16},knee:{radius:.115,width:.13},ankle:{radius:.078,width:.11},
    thighWidth:.13,shinWidth:.11,footSize:[.34,.12,.54],coverSize:[.14,.21,.075],
    intent:'Narrow reverse-knee runner: rearward knee, long forward shin, maximum open negative space and tiny split toes.',
});
export const HAULER_LAYOUT = Object.freeze({
    catalogId:'legs-hauler',mountingStandard:'medium',nativeMobilityStandard:'heavy',
    requiresAdapter:true,mountingFace:[0,.84,0],mountingNormal:[0,1,0],primaryMounts:1,
    adapter:{
        massKg:110,name:'H2/U1 hip conversion ring',
        // Small overlaps between crown/collar/skirt replace tangent-only seams;
        // dimensions remain entirely inside the unchanged catalogue envelope.
        crown:{center:[0,.795,0],size:[.58,.054,.36]},
        collar:{center:[0,.7425,0],size:[.42,.059,.30]},
        skirt:{center:[0,.69,0],size:[.78,.054,.46]},
        sideLugs:[
            {side:-1,center:[-.42,.735,.05],size:[.11,.10,.16]},
            {side:+1,center:[+.42,.735,.05],size:[.11,.10,.16]},
        ],
    },
    saddle:{center:[0,.59,.10],size:[2.05,.19,.50]},
    pedestal:{center:[0,.655,.08],size:[.52,.12,.32]},
    // Physical top .840 m remains exactly coincident with the declared U1 face.
    pad:{center:[0,.8225,0],size:[.46,.035,.28]},
    guideReceivers:[
        {side:-1,center:[-.89,.685,.10],size:[.12,.11,.24],contact:[-.95,.685,.10]},
        {side:+1,center:[+.89,.685,.10],size:[.12,.11,.24],contact:[+.95,.685,.10]},
    ],
    // Carriage-fixed suspension pods now occupy almost the full legal width.
    pods:[-1,1].map(side=>({side,center:[side*.955,.29,.11],size:[.61,.70,.64]})),
    legs:[-1,1].map(side=>({
        side,hip:[side*.91,.22,.10],knee:[side*.91,-.23,.15],
        ankle:[side*.86,-.60,.05],foot:[side*.84,-.744,-.07],
        actuatorTop:[side*1.05,.08,.22],actuatorBottom:[side*1.04,-.305,.21],
    })),
    hip:{radius:.245,width:.29},knee:{radius:.27,width:.31},ankle:{radius:.17,width:.24},
    thighWidth:.34,shinWidth:.43,footSize:[.86,.18,1.16],coverSize:[.35,.40,.15],
    intent:'Squat podded load-bearer: dominant fixed side pods, buried upper linkage, low heavy knee and enormous split load shoes.',
});
const vec3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const inside=(p,envelope,epsilon=1e-6)=>p.every((n,i)=>Math.abs(n)<=envelope[i]/2+epsilon);
const span=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const approx=(a,b,eps=.0001)=>Math.abs(a-b)<=eps;

/** Shape-only metrics used by preview diagnostics. They are not gameplay stats. */
export function mobilitySilhouetteMetrics(layout){
    const xs=layout.legs.map(l=>Math.abs(l.hip[0]));
    const footXs=layout.legs.map(l=>Math.abs(l.foot[0]));
    const first=layout.legs[0];
    const podOuter=layout.pods?.length ? Math.max(...layout.pods.map(p=>Math.abs(p.center[0])+p.size[0]/2))*2 : 0;
    const podBottom=layout.pods?.length ? Math.min(...layout.pods.map(p=>p.center[1]-p.size[1]/2)) : null;
    return Object.freeze({
        hipCentreSpanM:2*Math.max(...xs),
        upperMassWidthM:podOuter||layout.saddle.size[0],
        footCentreSpanM:2*Math.max(...footXs),
        footprintWidthM:2*Math.max(...footXs)+layout.footSize[0],
        footprintDepthM:layout.footSize[2],
        footprintAreaM2:(2*Math.max(...footXs)+layout.footSize[0])*layout.footSize[2],
        kneeRearOffsetM:first.knee[2]-first.hip[2],
        ankleForwardSweepM:first.knee[2]-first.ankle[2],
        exposedUpperBelowPodM:podBottom==null?null:podBottom-first.knee[1],
    });
}
/** Conservative authored-rest checks; not proof of actual polygon or swept-gait clearance. */
export function validatePairedMobilityLayout(layout,fixture){
    const errors=[];
    if(layout?.catalogId!==fixture?.id)errors.push('Wrong catalogue component.');
    if(layout?.primaryMounts!==1||layout?.mountingStandard!==fixture?.standard)
        errors.push('Invalid single U1 mobility interface.');
    const env=fixture?.envelope;
    if(!vec3(env)||env.some(n=>n<=0))return {valid:false,errors:[...errors,'Missing source envelope.']};
    if(!vec3(layout.mountingFace)||!inside(layout.mountingFace,env)||
       Math.abs(layout.mountingFace[1]-env[1]/2)>1e-8)
        errors.push('Top mating face must coincide with source envelope top.');
    if(!layout.mountingFace.every((n,i)=>Math.abs(n-fixture.mountPoint[i])<1e-8))
        errors.push('Mating point differs from fixture contact.');
    if(!layout.pad||!vec3(layout.pad.center)||!vec3(layout.pad.size)||
       Math.abs(layout.pad.center[1]+layout.pad.size[1]/2-layout.mountingFace[1])>.001)
        errors.push('Physical top pad does not reach declared top mating plane.');
    if(!Array.isArray(layout.legs)||layout.legs.length!==2||
       layout.legs[0].side!==-1||layout.legs[1].side!==1)
        errors.push('Exactly one mirrored pair is required.');
    if(!Array.isArray(layout.guideReceivers)||layout.guideReceivers.length!==2)
        errors.push('Two fixed guide receiver faces required.');
    for(const part of [layout.saddle,layout.pedestal,layout.pad,...(layout.guideReceivers||[])]){
        if(!vec3(part.center)||!vec3(part.size)||!part.size.every(n=>n>0)||
           !part.center.every((v,i)=>Math.abs(v)+part.size[i]/2<=env[i]/2+.001))
            errors.push('Saddle, mount or receiver exceeds source envelope.');
    }
    for(const leg of layout.legs||[]){
        for(const tag of ['hip','knee','ankle','foot','actuatorTop','actuatorBottom'])
            if(!vec3(leg[tag])||!inside(leg[tag],env))errors.push(`Bad ${leg.side} ${tag} anchor.`);
        if(span(leg.hip,leg.knee)<.24||span(leg.knee,leg.ankle)<.28||
           span(leg.actuatorTop,leg.actuatorBottom)<.18)
            errors.push(`Collapsed ${leg.side} leg linkage.`);
        if(Math.abs(leg.foot[0])+layout.footSize[0]/2>env[0]/2+.001||
           Math.abs(leg.foot[2])+layout.footSize[2]/2>env[2]/2+.001||
           leg.foot[1]-layout.footSize[1]/2 < -env[1]/2-.001)
            errors.push(`Foot exceeds source envelope for side ${leg.side}.`);
    }
    const [left,right]=layout.legs||[];
    if(left&&right){
        for(const tag of ['hip','knee','ankle','foot','actuatorTop','actuatorBottom']){
            if(Math.abs(left[tag][0]+right[tag][0])>.0001||
               Math.abs(left[tag][1]-right[tag][1])>.0001||
               Math.abs(left[tag][2]-right[tag][2])>.0001)
                errors.push(`Legs are not mirrored at ${tag}.`);
        }
    }
    if(layout.pods){
        if(layout.pods.length!==2||layout.pods[0].side!==-1||layout.pods[1].side!==1)
            errors.push('Hauler requires two distinct mirrored fixed drive pods.');
        const [leftPod,rightPod]=layout.pods;
        if(leftPod&&rightPod&&(!leftPod.center.every((n,i)=>
           Math.abs(n-(i===0?-rightPod.center[i]:rightPod.center[i]))<.0001)||
           leftPod.size.some((n,i)=>Math.abs(n-rightPod.size[i])>.0001)))
            errors.push('Drive pods are not reflected counterparts.');
    }
    for(const pod of layout.pods||[]){
        if(!vec3(pod.center)||!vec3(pod.size)||!pod.size.every(n=>n>0)||
           !pod.center.every((v,i)=>Math.abs(v)+pod.size[i]/2<=env[i]/2+.001))
            errors.push('Fixed drive pod exceeds source envelope.');
    }
    for(const guide of layout.guideReceivers||[]){
        if(!vec3(guide.contact)||!inside(guide.contact,env))
            errors.push('Guide contact outside source envelope.');
        if(Math.abs(guide.contact[0]-guide.center[0]-guide.side*guide.size[0]/2)>1e-8)
            errors.push('Guide contact must lie on actual outboard receiver face.');
    }
    return {valid:errors.length===0,errors};
}
export function validateYardwalkerLayout(layout,fixture){
    const base=validatePairedMobilityLayout(layout,fixture),errors=[...base.errors];
    const m=mobilitySilhouetteMetrics(layout),k=mobilitySilhouetteMetrics(KESTREL_LAYOUT),h=mobilitySilhouetteMetrics(HAULER_LAYOUT);
    if(!(m.hipCentreSpanM>k.hipCentreSpanM+.20&&m.hipCentreSpanM<h.hipCentreSpanM-.20))
        errors.push('Yardwalker hip spacing must remain the intermediate family.');
    if(!(m.footprintWidthM>k.footprintWidthM+.30&&m.footprintWidthM<h.footprintWidthM-.30))
        errors.push('Yardwalker footprint width must remain the intermediate family.');
    if(!(m.footprintDepthM>k.footprintDepthM+.10&&m.footprintDepthM<h.footprintDepthM-.20))
        errors.push('Yardwalker foot depth must remain the intermediate family.');
    return {valid:errors.length===0,errors};
}
export function validateKestrelLayout(layout,fixture){
    const base=validatePairedMobilityLayout(layout,fixture),errors=[...base.errors];
    const m=mobilitySilhouetteMetrics(layout),yard=mobilitySilhouetteMetrics(YARDWALKER_LAYOUT);
    if(m.kneeRearOffsetM<.25)errors.push('Kestrel knee must sit clearly behind the hip in side profile.');
    if(m.ankleForwardSweepM<.38)errors.push('Kestrel ankle must sweep clearly forward from the rearward knee.');
    if(m.hipCentreSpanM>=yard.hipCentreSpanM-.20)errors.push('Kestrel must remain clearly narrower than Yardwalker.');
    if(m.footprintAreaM2>=yard.footprintAreaM2*.68)errors.push('Kestrel footprint must remain substantially lighter than Yardwalker.');
    return {valid:errors.length===0,errors};
}
export function validateHaulerLayout(layout,fixture){
    const base=validatePairedMobilityLayout(layout,fixture),errors=[...base.errors];
    const adapter=layout?.adapter;
    if(!layout?.requiresAdapter)errors.push('Heavy Hauler must explicitly require an adapter.');
    if(layout?.nativeMobilityStandard!=='heavy')errors.push('Hauler must record native H2 interface.');
    if(!fixture?.previewAdapter)errors.push('Fixture must have explicit conversion adapter.');
    if(!adapter||!Number.isFinite(adapter.massKg)||adapter.massKg!==fixture?.previewAdapter?.massKg)
        errors.push('Adapter mass must remain explicit 110 kg conversion ring.');
    for(const part of [adapter?.crown,adapter?.collar,adapter?.skirt,...(adapter?.sideLugs||[])]){
        if(!part||!vec3(part.center)||!vec3(part.size)||!part.size.every(n=>n>0)||
           !part.center.every((v,i)=>Math.abs(v)+part.size[i]/2<=fixture.envelope[i]/2+.001))
            errors.push('Adapter hardware exceeds source envelope or is malformed.');
    }
    if(adapter?.sideLugs?.length!==2)errors.push('Adapter must expose mirrored pair of side lugs.');
    // Validate solid X/Y/Z overlap across the conversion stack; adjacent
    // bounding solids must not merely share an idealized zero-thickness plane.
    const overlap=(a,b)=>[0,1,2].every(i=>
        Math.min(a.center[i]+a.size[i]/2,b.center[i]+b.size[i]/2)-
        Math.max(a.center[i]-a.size[i]/2,b.center[i]-b.size[i]/2)>.001);
    for(const [a,b,label] of [[layout.pad,adapter?.crown,'pad/crown'],
        [adapter?.crown,adapter?.collar,'crown/collar'],
        [adapter?.collar,adapter?.skirt,'collar/skirt'],
        [adapter?.skirt,layout.pedestal,'skirt/pedestal']]){
        if(!a||!b||!overlap(a,b))errors.push(`H2/U1 adapter ${label} must physically overlap.`);
    }
    const m=mobilitySilhouetteMetrics(layout),yard=mobilitySilhouetteMetrics(YARDWALKER_LAYOUT);
    if(!layout.pods?.length||m.upperMassWidthM<yard.upperMassWidthM+.70)
        errors.push('Hauler fixed pods must dominate the upper silhouette over Yardwalker.');
    if(m.footprintWidthM<yard.footprintWidthM+.45||m.footprintAreaM2<yard.footprintAreaM2*1.75)
        errors.push('Hauler load-shoe footprint must clearly exceed Yardwalker.');
    if(m.exposedUpperBelowPodM==null||m.exposedUpperBelowPodM>.24)
        errors.push('Hauler knee must remain close beneath the pod to suppress a normal exposed thigh silhouette.');
    return {valid:errors.length===0,errors};
}
export const MOBILITY_LAYOUTS=Object.freeze({
    'legs-yard':YARDWALKER_LAYOUT,'legs-compact':KESTREL_LAYOUT,'legs-hauler':HAULER_LAYOUT,
});
/** Cross-family k.3a.8 acceptance invariant; descriptive only, never gameplay. */
export function validateMobilityFamilySeparation(layouts=MOBILITY_LAYOUTS){
    const errors=[];
    const yard=mobilitySilhouetteMetrics(layouts['legs-yard']);
    const kestrel=mobilitySilhouetteMetrics(layouts['legs-compact']);
    const hauler=mobilitySilhouetteMetrics(layouts['legs-hauler']);
    if(!(kestrel.hipCentreSpanM<yard.hipCentreSpanM&&yard.hipCentreSpanM<hauler.hipCentreSpanM))
        errors.push('Hip widths are not ordered Kestrel < Yardwalker < Hauler.');
    if(!(kestrel.footprintWidthM<yard.footprintWidthM&&yard.footprintWidthM<hauler.footprintWidthM))
        errors.push('Footprint widths are not ordered Kestrel < Yardwalker < Hauler.');
    if(!(kestrel.footprintDepthM<yard.footprintDepthM&&yard.footprintDepthM<hauler.footprintDepthM))
        errors.push('Foot depths are not ordered Kestrel < Yardwalker < Hauler.');
    if(kestrel.kneeRearOffsetM<.25||kestrel.ankleForwardSweepM<.38)
        errors.push('Kestrel reverse-knee zigzag is below silhouette threshold.');
    if(hauler.upperMassWidthM<2.35)errors.push('Hauler pod span is below silhouette threshold.');
    if(hauler.footprintAreaM2<yard.footprintAreaM2*1.75)
        errors.push('Hauler footprint area does not sufficiently exceed Yardwalker.');
    if(!approx(layouts['legs-yard'].mountingFace[1],.825)||
       !approx(layouts['legs-compact'].mountingFace[1],.775)||
       !approx(layouts['legs-hauler'].mountingFace[1],.84))
        errors.push('A silhouette pass must not alter catalogue top mating planes.');
    return {valid:errors.length===0,errors,metrics:{yard,kestrel,hauler}};
}
