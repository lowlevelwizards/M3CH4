/** k.4f-g — Contract crews and friendly-team liveries.
 * Generated combatants are ephemeral copies; paint on player serials is NEVER
 * rewritten by this module. Salvage retains an opponent's applied finish.
 */
import { SLOTS, installedPart } from './components.js';
import { factoryFinishFor, normalizePaint, paintVariant } from './factoryPaint.js';

export const TEAM_LIVERY_KEY='m3ch4-team-livery-v1';
const crew=(name,primary,secondary,armor,accent)=>Object.freeze({
    name,colors:Object.freeze({primary,secondary,armor,accent}),
});
export const CONTRACT_CREWS=Object.freeze({
    'yard-dog':crew('BACKLOT SCRAPPERS','#b39a52','#534d44','#bcb29b','#a75d39'),
    'recovery-run':crew('RECOVERY HANDS','#8c9683','#5e6763','#b3afa0','#a5875c'),
    'cutter':crew('LIGHTWEIGHTS','#628489','#b8bcb2','#737d7a','#384b54'),
    'domination':crew('TERRITORY CREW','#9b633e','#454543','#c2b3a0','#b98d58'),
    'mule':crew('HEAVY CREW','#737963','#353b36','#b9a78a','#8d744b'),
    'circuit-final':crew('CIRCUIT WORKS','#793e39','#474447','#c1afa0','#a88f65'),
});
export function contractCrew(id) {
    return CONTRACT_CREWS[id] || CONTRACT_CREWS['yard-dog'];
}
export function readTeamLivery(storage){
    try {return normalizePaint(JSON.parse(storage?.getItem(TEAM_LIVERY_KEY) || 'null'));}
    catch {return null;}
}
export function storeTeamLivery(storage,palette){
    const colors=normalizePaint(palette);
    if(!storage||!colors)return false;
    try{storage.setItem(TEAM_LIVERY_KEY,JSON.stringify(colors));return true;}
    catch{return false;}
}
export function clearTeamLivery(storage){
    if(!storage)return false;
    try{storage.removeItem(TEAM_LIVERY_KEY);return true;}
    catch{return false;}
}
/** An explicit team palette wins. Otherwise borrow the owner's first painted
 * installed component, preferring the frame, and finally the baseline palette. */
export function friendlyPalette(storage,playerAssembly){
    const selected=readTeamLivery(storage);
    if(selected)return selected;
    for(const slot of SLOTS){
        const paint=normalizePaint(installedPart(playerAssembly,slot)?.instance?.paint);
        if(paint)return paint;
    }
    return factoryFinishFor(installedPart(playerAssembly,'structure')?.definition?.id);
}
/** Each contract fields one recognizable team, not one paint job for each
 * loadout recipe. 0/1/2 are the lead and two support positions, repeatably. */
export function applyCrewPaint(assembly,palette,variant=0){
    const colors=paintVariant(palette,variant);
    if(!assembly||!colors)return assembly;
    for(const slot of SLOTS){
        const installed=installedPart(assembly,slot);
        if(installed)installed.instance.paint={...colors};
    }
    return assembly;
}
export function applyEnemyCrewPaint(assembly,contractId,rosterIndex=0){
    return applyCrewPaint(assembly,contractCrew(contractId).colors,rosterIndex%3);
}
export function applyFriendlyCrewPaint(assembly,storage,playerAssembly,rosterIndex=1){
    return applyCrewPaint(assembly,friendlyPalette(storage,playerAssembly),rosterIndex%3);
}
