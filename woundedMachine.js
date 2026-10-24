/** k5s3 — continuous, deterministic wounded-machine anatomy.
 * Source data is actual module integrity plus the existing paired drive state.
 * These outputs are pose/feedback instructions, never fictitious health,
 * collision impulses, RNG, or changes to authored foot anchoring.
 */
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,Number.isFinite(v)?v:lo));
const families=Object.freeze({
  'legs-yard':Object.freeze({sag:.060,roll:.070,pitch:.044,footLift:.72,swingDelay:.60,frameDrop:.060}),
  'legs-compact':Object.freeze({sag:.085,roll:.110,pitch:.075,footLift:.85,swingDelay:.75,frameDrop:.085}),
  'legs-hauler':Object.freeze({sag:.052,roll:.045,pitch:.027,footLift:.48,swingDelay:.90,frameDrop:.047}),
});
const familyFor=id=>families[id]??families['legs-yard'];
export const damageFraction=(part,defaultValue=1)=>!part?defaultValue:
    part.destroyed?0:clamp(part.integrity/Math.max(1,part.maxIntegrity));
export function legImpairment(health,load=0,family='legs-yard'){
  const f=familyFor(family),h=clamp(health),weak=1-h;
  const severity=weak*weak*(.7+.3*clamp(load));
  return Object.freeze({
    health:h,weakness:weak,severity,
    swingTime:1+f.swingDelay*severity,
    swingLift:1-f.footLift*severity,
    reach:1-.32*severity,
    kneeCompression:f.sag*severity,
    ankleSupport:.50*f.sag*severity,
    hipRoll:f.roll*severity,
  });
}
export function machineWoundPose({
    family='legs-yard',left=1,right=1,structure=1,command=1,
    loadLeft=.5,loadRight=.5,driveLoad=0
}={}){
    const f=familyFor(family);
    const l=legImpairment(left,loadLeft,family),r=legImpairment(right,loadRight,family);
    const frameWeak=1-clamp(structure);
    const differential=r.severity-l.severity;
    const effort=clamp(driveLoad);
    return Object.freeze({
       left:l,right:r,
       // Always favor the actually weaker side rather than an arbitrary
       // oscillation. Load transfer and authored contacts remain authoritative.
       bodyRoll:clamp(differential*f.roll*1.15+frameWeak*.027,-.15,.15),
       bodyPitch:clamp((l.severity+r.severity)*f.pitch*.42+frameWeak*.062,0,.16),
       bodyDrop:clamp((l.severity*clamp(loadLeft)+r.severity*clamp(loadRight))*f.sag+
           frameWeak*f.frameDrop*.54,0,.12),
       strideHealth:clamp((clamp(left)+clamp(right))/2),
       commandSag:(1-clamp(command))*.055,
       demandStrain:effort*(l.severity+r.severity)*.5,
    });
}
export function recoveryMotion(elapsed,slot='mobility',family='legs-yard'){
    const t=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
    const f=familyFor(family);
    const active=t<2.4;
    // Inertia-rich hydraulic lift: short initial downward loading, then
    // settling through existing sprung foot contacts.
    const lift=Math.sin(Math.PI*Math.min(1,t/.8))*Math.exp(-t*2.1);
    const shock=Math.exp(-t*3)*Math.sin(t*14);
    const mobility=slot==='mobility', frame=slot==='structure';
    return Object.freeze({
       active,
       compression:active?(mobility?f.sag*1.8:frame?f.frameDrop*.75:.018)*lift:0,
       knee:active&&mobility?lift*.16:0,
       pitch:active?(mobility?.045:.023)*shock:0,
       roll:active?(mobility?.030:.013)*shock:0,
       bolt:active?(slot==='combat'?.09:0)*lift:0,
    });
}
export function damageLabCondition(parts,slot,percent){
    // Pure sandbox mutation of one existing physical module, never a new
    // inventory item; armor is stripped below full health to expose internals.
    if(!parts||!Object.prototype.hasOwnProperty.call(parts,slot))return null;
    const part=parts[slot],ratio=clamp(Number(percent)/100);
    part.integrity=part.maxIntegrity*ratio;
    part.armor=ratio===1?part.maxArmor:0;
    part.destroyed=false;
    part.destruction=0;
    return ratio;
}
