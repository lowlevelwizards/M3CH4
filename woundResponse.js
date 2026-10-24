/** k5s4 - Shared, deterministic mechanical distress.
 * Actual physical integrity and bus voltage are the ONLY inputs: no dice-roll
 * jams, invisible accuracy nerfs, second health bars or new service states.
 * Every pilot and every weapon uses the same performance envelope.
 */
const clamp=(v)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export const woundAmount=health=>Math.pow(1-clamp(health),1.3);
export function weaponDamageResponse(health=1,busRatio=1){
  const wound=woundAmount(health);
  const shortage=Math.max(0,0.98-clamp(busRatio))/0.98;
  return Object.freeze({
    // An injured breech takes longer to cycle and physically reload.
    cycleMultiplier:1+.72*wound+.16*shortage,
    reloadMultiplier:1+.80*wound+.34*shortage,
    // Actual muzzle/spring excursion is handled by weaponStability; limit
    // additional mechanical bore dispersion so the penalties never multiply
    // into a meaningless cloud of misses.
    spreadMultiplier:1+1.20*wound,
    mountStress:wound,
    actionRate:1/(1+.72*wound+.16*shortage),
  });
}
/** Sensor distress is voltage-dependent, but critical driving, ammo and
 * service warnings must remain readable, including during hard brownouts.
 */
export function electricalDistress(busRatio=1,powerHealth=1){
  const bus=clamp(busRatio),generator=clamp(powerHealth);
  const sag=clamp((.98-bus)/.35);
  return Object.freeze({
    sag,
    dim:Math.min(.48,sag*.38+(1-generator)*.08),
    stutter:sag>.36,
    loadStrain:clamp((1-generator)*.55+sag*.65),
  });
}
export function frameDistress(frameHealth=1,driveLoad=0,loadShift=0){
  const wound=woundAmount(frameHealth);
  const load=clamp(driveLoad);
  return Object.freeze({
    creak:wound*load,
    sag:.028*wound*(.3+.7*load),
    twist:Math.max(-.023,Math.min(.023,loadShift*.016*wound)),
  });
}
