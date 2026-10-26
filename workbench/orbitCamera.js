/**
 * Part Workbench orbit camera drag convention.
 *
 * Treat a one-finger drag as grabbing/turning the object, rather than steering
 * the camera in the direction of the gesture. Three's orbit position uses
 * +X = sin(yaw) * radius and +Y = sin(pitch) * radius.
 *
 * Rightward drag => decrease yaw; downward drag => increase pitch.
 * Keep this pure so the exact sign convention can be regression-tested.
 */
export const ORBIT_YAW_PER_PX = .009;
export const ORBIT_PITCH_PER_PX = .007;
export const ORBIT_PITCH_MIN = -1.3;
export const ORBIT_PITCH_MAX = 1.3;

export function orbitAfterDrag({yaw,pitch,distance},dx,dy){
 if(![yaw,pitch,distance,dx,dy].every(Number.isFinite))throw Error('Invalid orbit drag');
 return {
  yaw: yaw - dx * ORBIT_YAW_PER_PX,
  pitch: Math.max(ORBIT_PITCH_MIN,Math.min(ORBIT_PITCH_MAX,pitch + dy * ORBIT_PITCH_PER_PX)),
  distance
 };
}
