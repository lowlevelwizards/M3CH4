/** k.3a.3: preview-only mechanical layout of one existing OWNED paired-leg part.
 * Local axes match chassis: +X right, +Y up, -Z forward. All points in metres.
 * Its catalogue envelope, mass, power, speed and actual mounting authority are
 * STILL obtained from components.js. These are visual REST-POSE anchors only.
 * They do not create independent left/right owned equipment or a new gait solver.
 */
export const YARDWALKER_LAYOUT = Object.freeze({
    catalogId: 'legs-yard',
    mountingStandard: 'medium',
    mountingFace: [0, 0.825, 0],
    mountingNormal: [0, 1, 0],
    // One actual graph input. Two *fixed* lateral stabilizer receivers are visual
    // alignment surfaces; they are NOT additional inventory or locomotion slots.
    primaryMounts: 1,
    saddle: { center: [0, 0.655, 0.10], size: [1.54, 0.20, 0.36] },
    pedestal: { center: [0, 0.765, 0], size: [0.37, 0.115, 0.29] },
    pad: { center: [0, 0.8075, 0], size: [0.42, 0.035, 0.32] },
    guideReceivers: [
        {side: -1, center: [-0.76, 0.72, 0.10], size: [0.10, 0.095, 0.22], contact: [-0.81, 0.72, 0.10]},
        {side: +1, center: [+0.76, 0.72, 0.10], size: [0.10, 0.095, 0.22], contact: [+0.81, 0.72, 0.10]},
    ],
    legs: [-1, 1].map(side => ({
        side, hip: [side * 0.65, 0.405, 0.10],
        knee: [side * 0.65, -0.09, 0.14],
        ankle: [side * 0.65, -0.59, 0.13],
        foot: [side * 0.65, -0.745, -0.13],
        actuatorTop: [side * 0.835, 0.335, 0.23],
        actuatorBottom: [side * 0.835, -0.045, 0.25],
    })),
    hip: {radius: 0.205, width: 0.26},
    knee: {radius: 0.185, width: 0.24},
    ankle: {radius: 0.115, width: 0.20},
    thighWidth: 0.315, shinWidth: 0.28,
    footSize: [0.60, 0.155, 0.79],
    // Single upper link cover per leg: no scattered decorative armor fragments.
    coverSize: [0.29, 0.37, 0.115],
    intent: 'Balanced compact industrial paired walker, readable load path and broad feet.',
});

const vec3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const inside=(p,envelope,epsilon=1e-6)=>p.every((n,i)=>Math.abs(n)<=envelope[i]/2+epsilon);
/** Conservative authored-rest-pose checks. Not an actual polygon collision test. */
export function validateYardwalkerLayout(layout,fixture){
    const errors=[];
    if(layout?.catalogId!=='legs-yard'||fixture?.id!=='legs-yard')errors.push('Wrong catalogue component.');
    if(layout?.primaryMounts!==1||layout?.mountingStandard!==fixture?.standard)errors.push('Invalid single U1 mobility interface.');
    const env=fixture?.envelope;
    if(!vec3(env)||env.some(n=>n<=0))return {valid:false,errors:[...errors,'Missing source envelope.']};
    if(!vec3(layout.mountingFace)||!inside(layout.mountingFace,env)||
       Math.abs(layout.mountingFace[1]-env[1]/2)>1e-8)errors.push('Top mating face must coincide with source envelope top.');
    if(!layout.mountingFace.every((n,i)=>Math.abs(n-fixture.mountPoint[i])<1e-8))errors.push('Mating point differs from fixture contact.');
    if(!Array.isArray(layout.legs)||layout.legs.length!==2||layout.legs[0].side!==-1||layout.legs[1].side!==1)
        errors.push('Exactly one mirrored pair is required.');
    if(!Array.isArray(layout.guideReceivers)||layout.guideReceivers.length!==2)errors.push('Two fixed guide receiver faces required.');
    for(const part of [layout.saddle,layout.pedestal,layout.pad,...(layout.guideReceivers||[])]){
        if(!vec3(part.center)||!vec3(part.size)||!part.size.every(n=>n>0)||
            !part.center.every((v,i)=>Math.abs(v)+part.size[i]/2<=env[i]/2+.001))errors.push('Saddle, mount or receiver exceeds source envelope.');
    }
    for(const leg of layout.legs||[]){
        for(const tag of ['hip','knee','ankle','foot','actuatorTop','actuatorBottom'])
            if(!vec3(leg[tag])||!inside(leg[tag],env))errors.push(`Bad ${leg.side} ${tag} anchor.`);
        // Upper and lower load paths are separate, finite spans.
        const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
        if(dist(leg.hip,leg.knee)<.3||dist(leg.knee,leg.ankle)<.3||
           dist(leg.actuatorTop,leg.actuatorBottom)<.25)errors.push(`Collapsed ${leg.side} leg linkage.`);
        if(Math.abs(leg.foot[0])+layout.footSize[0]/2>env[0]/2+.001||
           Math.abs(leg.foot[2])+layout.footSize[2]/2>env[2]/2+.001||
           leg.foot[1]-layout.footSize[1]/2 < -env[1]/2-.001)
            errors.push(`Foot exceeds source envelope for side ${leg.side}.`);
    }
    for(const guide of layout.guideReceivers||[]){
        if(!vec3(guide.contact)||!inside(guide.contact,env))errors.push('Guide contact outside source envelope.');
        if(Math.abs(guide.contact[0]-guide.center[0]-guide.side*guide.size[0]/2)>1e-8)
            errors.push('Guide contact must lie on actual outboard receiver face.');
    }
    return {valid:errors.length===0,errors};
}
