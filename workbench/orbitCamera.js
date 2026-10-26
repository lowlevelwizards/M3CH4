/** Canonical M3CH4 Workbench camera: FRONT is the mech nose at -Z,
 * RIGHT is +X and UP is +Y. Keep the world right-handed, no reflected views.
 *
 * Direct-manipulation: drag RIGHT moves front-facing detail to the right,
 * drag DOWN moves front-facing detail down. The camera therefore changes
 * azimuth/elevation by the same signed drag delta in this -Z-front system.
 */
export const ORBIT_YAW_PER_PX=.009;
export const ORBIT_PITCH_PER_PX=.007;
export const ORBIT_PITCH_MIN=-Math.PI/2+.08;
export const ORBIT_PITCH_MAX=Math.PI/2-.08;
export const TAU=2*Math.PI;
const bounded=(value,min,max)=>Math.min(max,Math.max(min,value));
export function normalizeYaw(radians){
 if(!Number.isFinite(radians))throw Error('Invalid azimuth');
 return ((radians%TAU)+TAU)%TAU;
}
export function orbitAfterDrag({yaw,pitch,distance},dx,dy){
 if(![yaw,pitch,distance,dx,dy].every(Number.isFinite))throw Error('Invalid orbit drag');
 return {
  yaw: normalizeYaw(yaw+dx*ORBIT_YAW_PER_PX),
  pitch: bounded(pitch+dy*ORBIT_PITCH_PER_PX,ORBIT_PITCH_MIN,ORBIT_PITCH_MAX),
  distance
 };
}
/** View positions are offsets from the current focus, in game-world units.
 * Side/right is camera +X; front is camera -Z; rear camera +Z.
 * All axes remain unmirrored and honor Three.js's right-handed coordinates.
 */
export function cameraPose(view,orbit={yaw:0,pitch:0,distance:4},distance=20){
 if(view==='quarter'){
  const {yaw,pitch}=orbit,d=orbit.distance;
  return {position:[Math.sin(yaw)*Math.cos(pitch)*d,Math.sin(pitch)*d,
     -Math.cos(yaw)*Math.cos(pitch)*d],up:[0,1,0]};
 }
 switch(view){
  case 'front':return {position:[0,0,-distance],up:[0,1,0]};
  case 'side':return {position:[distance,0,0],up:[0,1,0]};
  case 'rear':return {position:[0,0,distance],up:[0,1,0]};
  case 'left':return {position:[-distance,0,0],up:[0,1,0]};
  case 'top':return {position:[0,distance,0],up:[0,0,-1]};
  default:throw Error('Unknown camera view '+view);
 }
}
export function cameraFacing(view,yaw=0){
 if(view==='front')return 'FRONT  -Z';
 if(view==='side')return 'RIGHT  +X';
 if(view==='rear')return 'REAR  +Z';
 if(view==='left')return 'LEFT  -X';
 if(view==='top')return 'TOP  +Y';
 const orientations=['FRONT  -Z','RIGHT  +X','REAR  +Z','LEFT  -X'];
 return orientations[Math.floor((normalizeYaw(yaw)+Math.PI/4)/(Math.PI/2))%4];
}
