/** Experimental assisted walking intent. Force requests only: the integrator
 * remains the single authority for momentum, collisions and traction.
 * Neutral stick commands a settling gait; brake remains the emergency stop.
 * The assistance disappears as drive power/leg function is lost.
 */
export const WALK_ASSIST=Object.freeze({
  intentDeadzone:.12,
  settleGainPerSecond:2.0,
  brakeShare:.58,
  driveShare:1.0,
  settleVelocityMps:.015,
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function walkingLongitudinalIntent(state,{throttle=0,brake=0}={},config={},dt=1/60){
  const forward=Number(state?.forwardVelocity) || 0;
  const powered=Math.max(0,Number(config.driveForceN)||0);
  const backwards=Math.max(0,Number(config.reverseForceN)||0);
  const braking=Math.max(0,Number(config.brakeForceN)||0);
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(forward))
    return {forceN:0,mode:'FAULT'};
  if(Math.abs(throttle)>WALK_ASSIST.intentDeadzone||brake>.05)
    return {forceN:0,mode:brake>.05?'BRAKE':'WALK'};
  if(Math.abs(forward)<WALK_ASSIST.settleVelocityMps)
    return {forceN:0,mode:'PLANTED'};
  // Both directions require working actuators. Avoid granting phantom braking
  // to a destroyed drive, low-power bus or one-sided immobilized mechanism.
  const available=Math.min(braking*WALK_ASSIST.brakeShare,
    Math.max(0,Math.min(powered,backwards))*WALK_ASSIST.driveShare);
  if(available<=0)return {forceN:0,mode:'COAST'};
  const target=-forward*Math.max(0,Number(config.massKg)||0)*WALK_ASSIST.settleGainPerSecond;
  const noOvershoot=-forward*Math.max(0,Number(config.massKg)||0)/dt;
  const forceN=clamp(target,-available,available);
  return {forceN:Math.abs(forceN)>Math.abs(noOvershoot)?noOvershoot:forceN,
    mode:'SETTLING'};
}
