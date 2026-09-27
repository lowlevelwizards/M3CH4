/** k.3a.7: preview-only authored rest poses for the three existing mobility IDs.
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
        side, hip:[side*.64,.39,.10], knee:[side*.68,-.12,.20],
        ankle:[side*.64,-.585,.10], foot:[side*.65,-.745,-.12],
        actuatorTop:[side*.82,.285,.22],actuatorBottom:[side*.82,-.055,.25],
    })),
    hip:{radius:.20,width:.25},knee:{radius:.18,width:.23},ankle:{radius:.105,width:.19},
    thighWidth:.29,shinWidth:.30,footSize:[.58,.155,.78],coverSize:[.29,.37,.115],
    intent:'Balanced compact industrial paired walker, readable load path and broad feet.',
});
export const KESTREL_LAYOUT = Object.freeze({
    catalogId:'legs-compact',mountingStandard:'medium',
    mountingFace:[0,.775,0],mountingNormal:[0,1,0],primaryMounts:1,
    saddle:{center:[0,.615,.06],size:[1.18,.17,.26]},
    pedestal:{center:[0,.71,0],size:[.31,.10,.24]},
    pad:{center:[0,.7575,0],size:[.36,.035,.26]},
    guideReceivers:[
        {side:-1,center:[-.56,.665,.09],size:[.09,.08,.18],contact:[-.605,.665,.09]},
        {side:+1,center:[+.56,.665,.09],size:[.09,.08,.18],contact:[+.605,.665,.09]},
    ],
    legs:[-1,1].map(side=>({
        side,hip:[side*.46,.36,.04],knee:[side*.40,-.02,.25],
        ankle:[side*.50,-.54,-.05],foot:[side*.51,-.704,-.16],
        actuatorTop:[side*.49,.22,.15],actuatorBottom:[side*.43,-.12,.16],
    })),
    hip:{radius:.16,width:.18},knee:{radius:.13,width:.15},ankle:{radius:.088,width:.13},
    thighWidth:.155,shinWidth:.135,footSize:[.38,.13,.58],coverSize:[.16,.24,.085],
    intent:'Lighter, narrower reverse-knee runner with compact feet and tighter hip spacing.',
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
    saddle:{center:[0,.60,.10],size:[1.92,.18,.48]},
    pedestal:{center:[0,.655,.08],size:[.52,.12,.32]},
    // Fix: physical top .8225 + .035/2 === declared +.840 U1 face.
    // Bottom .805 overlaps the adapter crown, whose top is .822.
    pad:{center:[0,.8225,0],size:[.46,.035,.28]},
    guideReceivers:[
        {side:-1,center:[-.89,.685,.10],size:[.12,.11,.24],contact:[-.95,.685,.10]},
        {side:+1,center:[+.89,.685,.10],size:[.12,.11,.24],contact:[+.95,.685,.10]},
    ],
    // Independent carriage-fixed drive pods, not inflated upper-leg links.
    pods:[-1,1].map(side=>({side,center:[side*.96,.29,.10],size:[.55,.62,.58]})),
    legs:[-1,1].map(side=>({
        side,hip:[side*.90,.24,.10],knee:[side*.90,-.20,.17],
        ankle:[side*.85,-.61,.08],foot:[side*.84,-.75,-.08],
        actuatorTop:[side*1.05,.115,.23],actuatorBottom:[side*1.04,-.285,.23],
    })),
    hip:{radius:.24,width:.29},knee:{radius:.25,width:.29},ankle:{radius:.15,width:.22},
    thighWidth:.35,shinWidth:.38,footSize:[.77,.17,1.04],coverSize:[.34,.42,.14],
    intent:'Heavy wider industrial paired walker with visible H2/U1 adapter and thicker load path.',
});
const vec3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const inside=(p,envelope,epsilon=1e-6)=>p.every((n,i)=>Math.abs(n)<=envelope[i]/2+epsilon);
const span=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
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
export function validateYardwalkerLayout(layout,fixture){return validatePairedMobilityLayout(layout,fixture);}
export function validateKestrelLayout(layout,fixture){return validatePairedMobilityLayout(layout,fixture);}
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
    return {valid:errors.length===0,errors};
}
export const MOBILITY_LAYOUTS=Object.freeze({
    'legs-yard':YARDWALKER_LAYOUT,'legs-compact':KESTREL_LAYOUT,'legs-hauler':HAULER_LAYOUT,
});
