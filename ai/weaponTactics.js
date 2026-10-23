/** Physical AI weapon envelopes. These are firing *decisions*, never accuracy,
 * cooldown, ammo, heat, penetration, or damage overrides. A target must still
 * be visibly observed and satisfy the shared simulation's firing arc/LOS.
 * Deterministic for browser and headless tournament parity.
 */
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
export function aiWeaponEngagement(spec,{distance=Infinity,rigSpeed=0,yawError=0,brace=0}={}){
    if(!spec||!Number.isFinite(distance)||distance<0)
        return {fire:false,reason:'INVALID TARGET'};
    const mode=spec.fireMode||'single';
    const id=spec.id||'';
    const maxDistance=mode==='continuous'?Math.max(0,(spec.rangeMeters??6)-.3):
        id==='gun-scatter'?9:
        id==='gun-short'?15:
        id==='gun-cannon'?24:
        id==='gun-light'?27:
        mode==='automatic'?19:
        mode==='charged'?25:
        mode==='projectile'?33:23;
    if(distance>maxDistance)return {fire:false,reason:'OUT OF EFFECTIVE RANGE',maxDistance};
    if(mode==='projectile' && distance<Math.max(4.8,(spec.blastRadius??3.5)+1.1))
        return {fire:false,reason:'FRIENDLY BLAST RISK',maxDistance};
    // Charged penetrators reward setting feet instead of attempting an
    // unrealistic drive-by charge; do not grant extra accuracy when braced.
    if(mode==='charged' && (rigSpeed>1.7||Math.abs(yawError)>.38))
        return {fire:false,reason:'SETTLE FOR CHARGE',maxDistance};
    return {fire:true,reason:mode==='continuous'?'THERMAL CONTACT':
        mode==='projectile'?'ROCKET RELEASE':
        mode==='automatic'?'LANE SUPPRESSION':
        mode==='charged'?'CHARGED PENETRATION':'DIRECT FIRE',maxDistance};
}
