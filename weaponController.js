/** k4w.1 — shared optional weapon-action state for mechanically different trigger modes.
 * The existing combat.js ammunition and cooldown are still authoritative.
 * Only consumed automatic rounds build the (temporary) mounting disturbance.
 * No timers, hidden hits, or per-enemy pilot accuracy overrides.
 */
const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number.isFinite(x)?x:min));
export function createWeaponActionState(spec) {
    return spec.fireMode === 'automatic'
        ? { sustainedSeconds:0, sinceLastEmission:99 }
        : spec.fireMode === 'charged' ? { charge:0, ready:false, latched:false }
        : spec.fireMode === 'projectile' ? { latched:false }
        : spec.fireMode === 'continuous' ? { headHeat:0,ventLeft:0 } : null;
}
export function advanceWeaponAction(state,spec,dt) {
    if (!state?.action || !Number.isFinite(dt) || dt<=0) return;
    if(spec.fireMode==='continuous') {
        const a=state.action;
        a.ventLeft=Math.max(0,a.ventLeft-dt);
        a.headHeat=Math.max(0,a.headHeat-dt*(a.ventLeft>0?.36:.12));
        return;
    }
    if(spec.fireMode !== 'automatic')return;
    state.action.sinceLastEmission+=dt;
    const gap=1/Math.max(.01,spec.roundsPerSecond);
    if (state.action.sinceLastEmission>gap*1.5) {
        state.action.sustainedSeconds=Math.max(0,state.action.sustainedSeconds-dt*2.2);
    }
}
export function recordWeaponEmission(state,spec) {
    if(!state?.action)return;
    if(spec.fireMode==='continuous') {
        const a=state.action;
        a.headHeat=Math.min(1.05,a.headHeat+Math.max(.001,spec.heatPerTick??.027));
        if(a.headHeat>=1)a.ventLeft=Math.max(a.ventLeft,spec.ventSeconds??1.8);
        return;
    }
    if (spec.fireMode !== 'automatic')return;
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

/** One deliberate held trigger fires one charged shot. Release cancels and rearms;
 * a release while empty or reloading cannot create a free round.
 */
export function advanceChargedTrigger(state,spec,held,dt) {
    if (spec.fireMode !== 'charged' || !state?.action) return false;
    const a=state.action;
    if (!held) { a.charge=0; a.ready=false; a.latched=false; return false; }
    if (a.latched || state.cooldown>0 || state.reloadLeft>0 || state.loaded<=0 ||
        !Number.isFinite(dt) || dt<=0) return false;
    a.charge=Math.min(Math.max(.01,spec.chargeSeconds??.7),a.charge+dt);
    a.ready=a.charge>=Math.max(.01,spec.chargeSeconds??.7);
    return a.ready;
}

/** Press-to-launch: never repeat on an unbroken player hold after cooldown.
 * AI supplies separate decisions through the existing real cooldown authority.
 */
export function advanceProjectileTrigger(state,spec,held) {
    if(spec.fireMode!=='projectile'||!state?.action)return !!held;
    if(!held){state.action.latched=false;return false;}
    if(state.action.latched)return false;
    state.action.latched=true;return true;
}
