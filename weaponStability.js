/** k5r.3 — shared physical aiming stabilization.
 * Deterministic and independent of rendering frame rate: every 60 Hz rig
 * advances its own mount with actual motion, foot contact, bracing and damage.
 * The same yaw/pitch offsets drive the sight marker and the real shot trace.
 * Damage, spread, ammo and recoil forces remain owned by existing systems.
 */
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(n)?n:lo));
export const MAX_MOUNT_ANGLE=.028;
const profiles=Object.freeze({
  'gun-cannon':Object.freeze({response:12.5,move:.80,kick:.0082,damping:1.0}),
  'gun-short':Object.freeze({response:8.0,move:1.18,kick:.016,damping:.86}),
  'gun-light':Object.freeze({response:19.0,move:.44,kick:.0033,damping:1.12}),
  'gun-scatter':Object.freeze({response:7.2,move:1.28,kick:.019,damping:.88}),
  'gun-rivet':Object.freeze({response:13.0,move:.67,kick:.0061,damping:1.05}),
  'gun-breaker':Object.freeze({response:6.6,move:1.18,kick:.023,damping:.86}),
  'gun-rocket':Object.freeze({response:11.0,move:.85,kick:.010,damping:1}),
  'gun-arc':Object.freeze({response:19.0,move:.29,kick:0,damping:1.18}),
});
export const WEAPON_MOUNT_PROFILES=profiles;
export function weaponMountProfile(id){return profiles[id]??profiles['gun-cannon'];}
export function createWeaponStabilizer(){return {yaw:0,pitch:0,vYaw:0,vPitch:0,settled:1,shotCount:0};}
/** One mechanic, player and AI. No timers, random jitter or allocations. */
export function advanceWeaponStabilizer(mount,id,rig={},contacts=null,health={},dt=1/60){
 if(!mount||!Number.isFinite(dt)||dt<=0)return mount;
 const profile=weaponMountProfile(id),step=Math.min(.067,dt);
 const brace=clamp(rig.brace??0,0,1);
 const combat=clamp(health.combat??1,0,1);
 const command=clamp(health.command??1,0,1);
 const mobility=clamp(health.mobility??1,0,1);
 const legs=contacts?.contactFeet??contacts;
 const stance=clamp(legs?.stanceCount??2,0,2);
 const land=clamp((legs?.landings??0)*(legs?.lastLandingStrength??0),0,2);
 const load=clamp(rig.footingLoad??0,0,1);
 const accelX=clamp(rig.lateralAcceleration??0,-10,10);
 const accelZ=clamp(rig.longitudinalAcceleration??0,-10,10);
 const rate=clamp(rig.yawRate??0,-2,2);
 const shift=clamp(legs?.weightShift??0,-1.4,1.4);
 // One planted foot (or a damaged pair of supports) transmits more load.
 const massScale=clamp(Math.sqrt(2600/clamp(health.massKg??2600,900,12000)),.76,1.30);
 const wound=1-combat;
 const support=(1+.24*(2-stance)+.38*(1-mobility))*massScale*
   (1+.52*wound);
 const planted=1-.66*brace;
 const motionX=(accelX*.0028+rate*.0052+shift*.0033)*support*planted;
 const motionY=(-accelZ*.0025+load*.0041+land*.0026)*support*planted;
 const targetYaw=clamp(motionX*profile.move*(1+.45*wound),-.026,.026);
 const targetPitch=clamp(motionY*profile.move*(1+.45*wound),-.026,.026);
 // Mount damage changes how quickly its existing springs damp out; never
 // inject invisible random misses or add an extra lockout timer.
 const omega=profile.response*(.38+.62*Math.sqrt(combat))*(.78+.22*command);
 const damping=profile.damping*(.62+.38*combat)*(.83+.17*command);
 const steps=Math.max(1,Math.ceil(step/(1/120))),h=step/steps;
 for(let i=0;i<steps;i++){
  mount.vYaw+=(omega*omega*(targetYaw-mount.yaw)-2*omega*damping*mount.vYaw)*h;
  mount.vPitch+=(omega*omega*(targetPitch-mount.pitch)-2*omega*damping*mount.vPitch)*h;
  mount.yaw=clamp(mount.yaw+mount.vYaw*h,-MAX_MOUNT_ANGLE,MAX_MOUNT_ANGLE);
  mount.pitch=clamp(mount.pitch+mount.vPitch*h,-MAX_MOUNT_ANGLE,MAX_MOUNT_ANGLE);
 }
 // A directly observable settling condition, not a bonus accuracy multiplier.
 const excursion=Math.hypot(mount.yaw,mount.pitch);
 const movement=Math.hypot(mount.vYaw,mount.vPitch);
 mount.settled=clamp(1-(excursion/MAX_MOUNT_ANGLE*.70+movement*.65),0,1);
 return mount;
}
/** Trigger only AFTER a real consumed shot, so the fired shot is not moved
 * by its own impulse. Subsequent shots must follow the recovery trajectory.
 */
export function registerWeaponStabilityShot(mount,id,{brace=0,condition=1,massKg=2600}={}){
 if(!mount)return;
 const profile=weaponMountProfile(id);
 const wear=1+.85*Math.pow(1-clamp(condition,0,1),1.35);
 const firm=1-.42*clamp(brace,0,1);
 const massScale=clamp(Math.sqrt(2600/clamp(massKg,900,12000)),.76,1.30);
 const kick=profile.kick*wear*firm*massScale;
 mount.vPitch=clamp(mount.vPitch+kick*profile.response*1.8,-.85,.85);
 // Right-hand mounting applies a repeatable lateral disturbance; no RNG.
 mount.vYaw=clamp(mount.vYaw-kick*profile.response*.32,-.5,.5);
 mount.shotCount=(mount.shotCount+1)>>>0;
}
export function resetWeaponStabilizer(mount){
 if(!mount)return;
 mount.yaw=mount.pitch=mount.vYaw=mount.vPitch=0;
 mount.settled=1;mount.shotCount=0;
}
