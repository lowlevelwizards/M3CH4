/** B.4 constrained loading-dock *trial* for the isolated Piloting Lab.
 * Four survey points form an authored walkable low industrial ramp.
 * Chassis elevation is time-limited by installed actuator authority. Normal
 * campaign planar collisions/save schema are deliberately unchanged.
 */
export const LOADING_DOCK=Object.freeze({
 halfWidth:2.65,northZ:19,upperNorthZ:14,upperSouthZ:10,
 southZ:7,heightM:.42,maxRiseM:.46,
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function loadingDockHeight(x,z){
 const d=LOADING_DOCK;
 if(Math.abs(Number(x)||0)>d.halfWidth||z<d.southZ||z>d.northZ)return 0;
 if(z>=d.upperNorthZ)return d.heightM*(d.northZ-z)/(d.northZ-d.upperNorthZ);
 if(z>=d.upperSouthZ)return d.heightM;
 return d.heightM*(z-d.southZ)/(d.upperSouthZ-d.southZ);
}
export function advanceLabElevation(rig,config,dt,enabled=true){
 if(!rig)return 0;
 const current=Number.isFinite(rig.groundHeightM)?rig.groundHeightM:0;
 const target=enabled?loadingDockHeight(rig.x,rig.z):0;
 const mass=Math.max(1,Number(config?.massKg)||4200);
 const force=Math.max(0,Number(config?.driveForceN)||0);
 const authority=force>0?clamp((force/mass)*.16,.08,.72):0;
 const time=clamp(Number(dt)||0,0,.1);
 const rise=clamp(target-current,-Math.max(.25,authority)*time,authority*time);
 rig.groundHeightM=clamp(current+rise,0,LOADING_DOCK.maxRiseM);
 rig.verticalSpeedMps=rise/Math.max(time,.001);
 rig.verticalDemand=clamp(Math.abs(rise)/Math.max(.001,time)/Math.max(.1,authority),0,1);
 // Output is descriptive; no free drive force, instantaneous vertical snap,
 // or world collision alteration. Energy demand informs presentation only.
 return rig.groundHeightM;
}
