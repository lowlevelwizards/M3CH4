/** k4w.1 — shared optional weapon-action state for mechanically different trigger modes.
 * The existing combat.js ammunition and cooldown are still authoritative.
 * Only consumed automatic rounds build the (temporary) mounting disturbance.
 * No timers, hidden hits, or per-enemy pilot accuracy overrides.
 */
const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number.isFinite(x)?x:min));
export function createWeaponActionState(spec) {
    return spec.fireMode === 'automatic'
        ? { sustainedSeconds:0, sinceLastEmission:99 }
        : null;
}
export function advanceWeaponAction(state,spec,dt) {
    if (!state?.action || spec.fireMode !== 'automatic' || !Number.isFinite(dt) || dt<=0) return;
    state.action.sinceLastEmission+=dt;
    const gap=1/Math.max(.01,spec.roundsPerSecond);
    if (state.action.sinceLastEmission>gap*1.5) {
        state.action.sustainedSeconds=Math.max(0,state.action.sustainedSeconds-dt*2.2);
    }
}
export function recordWeaponEmission(state,spec) {
    if (!state?.action || spec.fireMode !== 'automatic') return;
    const a=state.action;
    // A long interruption breaks the firing string instead of preserving free accuracy debt.
    if (a.sinceLastEmission>1.1) a.sustainedSeconds=0;
    a.sustainedSeconds=clamp(a.sustainedSeconds+1/Math.max(.01,spec.roundsPerSecond),0,1.45);
    a.sinceLastEmission=0;
}
/** Measured at the bore, never a post-hit damage multiplier.
 * Planting the feet reduces mechanical wander, never the pilot's independent impairment.
 */
export function weaponActionSpreadRadians(spec,state,brace=0) {
    const basic=Math.max(0,Number(spec.spread)||0);
    if (spec.fireMode!=='automatic') return basic;
    const progress=clamp((state?.action?.sustainedSeconds??0)/1.45,0,1);
    const correction=1-clamp(brace,0,1)*.48;
    return basic + Math.max(0,Number(spec.sustainedSpread)||0)*progress*correction;
}
