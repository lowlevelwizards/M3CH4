/** Campaign-specific physical weapon fits and AI positioning preferences.
 * All arms use the same real combat authority, parts and ammunition.
 */
const WINGS=Object.freeze({
 'yard-dog': ['gun-cannon','gun-short'],
 'recovery-run': ['gun-cannon'],
 cutter: ['gun-rivet','gun-light'],
 domination: ['gun-light','gun-scatter'],
 mule: ['gun-arc','gun-light'],
 'circuit-final': ['gun-rivet','gun-breaker'],
});
export function encounterWingArms(contractId) {
 return [...(WINGS[contractId] ?? WINGS['yard-dog'])];
}
const DOCTRINES=Object.freeze({
 'gun-rivet': {label:'LANE CONTROL',preferredRangeM:8,rangeBandM:1.6,approachStrafe:.26,
    strafeThrottle:.8,strafeSeconds:3,braceSeconds:1.1,
    aimPriority:['combat','mobility','combat','power','structure']},
 'gun-scatter': {label:'CLOSE GUARD',preferredRangeM:3.8,rangeBandM:.7,
    approachThrottle:.88,retreatThrottle:.35,strafeThrottle:.36,
    closeAction:'brace',closeRetreatM:1.2,braceSeconds:1.3,
    aimPriority:['combat','mobility','command','structure']},
 'gun-arc': {label:'ARC WELDER',preferredRangeM:3.3,rangeBandM:.6,
    approachThrottle:1,approachStrafe:.1,retreatThrottle:.25,
    strafeThrottle:.4,closeAction:'brace',closeRetreatM:1.1,
    braceSeconds:.45,aimPriority:['power','combat','mobility','power']},
 'gun-breaker': {label:'ARMOR BREAKER',preferredRangeM:9.5,rangeBandM:1.3,
    approachThrottle:.6,approachStrafe:0,strafeThrottle:.23,
    braceSeconds:2.4,aimPriority:['structure','power','command','structure']},
 'gun-rocket': {label:'LONG-RANGE ROCKETER',preferredRangeM:15,rangeBandM:2.2,
    approachThrottle:.56,retreatThrottle:.92,strafeThrottle:.67,
    braceSeconds:.4,closeAction:'retreat',
    aimPriority:['mobility','power','structure','combat']},
});
export function weaponDoctrine(base,weaponId) {
 const profile=DOCTRINES[weaponId];
 return profile ? Object.freeze({...base,...profile}) : base;
}
