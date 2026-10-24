/** k.3v.5 — three presentations of ONE authoritative set of machine telemetry.
 * No sensor bonuses, altered physics, new component IDs or information suppression.
 * Positions are combiner-camera local units, not invented physical screen raycasts.
 */
import {electricalDistress} from './woundResponse.js';
export const SCREEN_DIMENSIONS = Object.freeze({
    systems: [88, 220],
    weapon: [180, 78],
    team: [200, 44],
    motion: [220, 82],
    drive: [180, 82],
});
const profile = (id, name, theme, priority, layout) => Object.freeze({
    id, name, theme, priority,
    layout: Object.freeze(Object.fromEntries(Object.entries(layout).map(([key,slot]) =>
        [key,Object.freeze({position:Object.freeze(slot.slice(0,3)),scale:slot[3]})]))),
});
export const COCKPIT_PROFILES = Object.freeze({
    'cab-cyclops':profile('cab-cyclops','CYCLOPS','workhorse','drive',{
        systems:[-.094,.004,-.105,.073],
        weapon:[.093,-.003,-.105,.064],
        team:[0,.059,-.105,.052],
        motion:[-.056,-.053,-.105,.050],
        drive:[.027,-.053,-.105,.051],
    }),
    'cab-utility':profile('cab-utility','VISTA','observation','motion',{
        systems:[-.095,.002,-.105,.059],
        weapon:[.092,-.003,-.105,.059],
        team:[0,.059,-.105,.051],
        motion:[-.057,-.052,-.105,.058],
        drive:[.028,-.053,-.105,.054],
    }),
    'cab-armored':profile('cab-armored','HEARTH','armored','condition',{
        systems:[-.094,.005,-.105,.076],
        weapon:[.092,-.004,-.105,.066],
        team:[0,.059,-.105,.055],
        motion:[-.058,-.052,-.105,.051],
        drive:[.027,-.053,-.105,.050],
    }),
});
export function resolveCockpitProfile(commandId) {
    return COCKPIT_PROFILES[commandId] ?? COCKPIT_PROFILES['cab-cyclops'];
}
export function instrumentRect(slot,layout) {
    const [width,height]=SCREEN_DIMENSIONS[slot];
    return { left:layout.position[0]-width/250*layout.scale/2,
        right:layout.position[0]+width/250*layout.scale/2,
        bottom:layout.position[1]-height/250*layout.scale/2,
        top:layout.position[1]+height/250*layout.scale/2 };
}
/** Projection envelope of the existing 68° camera's combiner at 16:9.
 * All layouts must preserve the middle target-recognition area and stay within
 * landscape screen bounds before ANY mobile visual QA.
 */
export function auditCockpitLayouts() {
    const results=[];
    const keys=Object.keys(SCREEN_DIMENSIONS);
    for(const p of Object.values(COCKPIT_PROFILES)){
        const rects=Object.fromEntries(keys.map(key=>[key,instrumentRect(key,p.layout[key])]));
        const violations=[];
        for(const [key,rect] of Object.entries(rects)){
            if(rect.left<-.125||rect.right>.125||rect.bottom<-.067||rect.top>.067)
                violations.push(key+':off-screen');
            if(key!=='team' && rect.left<.021&&rect.right>-.021 && rect.bottom<.024 && rect.top>-.024)
                violations.push(key+':aim-center');
        }
        for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
            const a=rects[keys[i]],b=rects[keys[j]];
            if(a.left<b.right&&a.right>b.left&&a.bottom<b.top&&a.top>b.bottom)
                violations.push(keys[i]+' overlaps '+keys[j]);
        }
        results.push({id:p.id,rects,violations});
    }
    return results;
}
/** Cosmetic command damage belongs to the existing real condition, not a
 * per-cab damage buff/debuff. Mandatory DOM failure alarms remain untouched. */
/** Secondary displays have different real service tolerances; critical
 * alarms, driving instruments, weapon state and underlying telemetry never
 * disappear. No additional condition pool or fictional sensor bonuses. */
export const CAB_SERVICE_POLICY=Object.freeze({
    'cab-cyclops':Object.freeze({secondaryFloor:.38,signal:'SIMPLE / RUGGED'}),
    'cab-utility':Object.freeze({secondaryFloor:.58,signal:'SURVEY / LIGHT'}),
    'cab-armored':Object.freeze({secondaryFloor:.20,signal:'REDUNDANT / ARMORED'}),
});
export function cockpitFailurePresentation(commandHealth=1,powerHealth=1,busRatio=1,commandId='cab-cyclops'){
    const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
    const command=clamp(commandHealth),power=clamp(powerHealth),bus=clamp(busRatio);
    const policy=CAB_SERVICE_POLICY[commandId]??CAB_SERVICE_POLICY['cab-cyclops'];
    const diagnosticsAvailable=command>=policy.secondaryFloor && bus>=.72;
    const electrical=electricalDistress(bus,power);
    return { staticStrength:clamp((.76-command)/.76),
        powerDim:electrical.dim,
        commandSevere:command<.38,
        busSag:bus<.95,
        diagnosticsAvailable,
        diagnosticsStatus:diagnosticsAvailable?'AVAILABLE':'SERVICE REQUIRED',
        commandHealth:command,
    };
}
