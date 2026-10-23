/** A.8 lightweight 2D momentum-conserving movable scrap for the DEV yard.
 * This is explicitly independent of the contract economy, authoritative
 * warehouse AABBs, vehicle damage and serialized ownership.
 * A few props, flat ground, no heavy rigid-body dependencies.
 */
export const LAB_PROP_DEFINITIONS=Object.freeze([
  Object.freeze({id:'rust-drum',kind:'barrel',x:0,z:19,massKg:72,radius:.45,friction:2.3,restitution:.10}),
  Object.freeze({id:'shipping-crate',kind:'crate',x:-3.2,z:16.7,massKg:245,radius:.64,friction:3.4,restitution:.035}),
  Object.freeze({id:'blue-drum',kind:'barrel',x:3.4,z:15.1,massKg:85,radius:.48,friction:2.7,restitution:.07}),
  Object.freeze({id:'tool-chest',kind:'crate',x:0,z:11.5,massKg:370,radius:.70,friction:4.0,restitution:.02}),
]);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createLabProps(){
 return LAB_PROP_DEFINITIONS.map(d=>({...d,vx:0,vz:0,spin:0,contactCount:0,cooldown:0,lastImpact:0}));
}
export function resetLabProps(props){
 for(let i=0;i<props.length;i++)Object.assign(props[i],{
  x:LAB_PROP_DEFINITIONS[i].x,z:LAB_PROP_DEFINITIONS[i].z,
  vx:0,vz:0,spin:0,contactCount:0,cooldown:0,lastImpact:0,
 });
}
export function stepLabProps(props,rig,{massKg=4200,radiusM=.95}={},dt=1/60){
 const events=[];
 const safeDt=clamp(Number.isFinite(dt)?dt:0,0,.1);
 if(!safeDt)return events;
 const rigMass=Math.max(250,Number(massKg)||4200);
 const collisionRadius=Math.max(.1,Number(radiusM)||.95);
 for(const prop of props){
  prop.cooldown=Math.max(0,prop.cooldown-safeDt);
  prop.lastImpact=Math.max(0,prop.lastImpact-safeDt*3);
  const drag=Math.exp(-safeDt*prop.friction);
  prop.vx*=drag;prop.vz*=drag;
  const preX=prop.x,preZ=prop.z;
  prop.x+=prop.vx*safeDt;prop.z+=prop.vz*safeDt;
  const dx=prop.x-(rig.x??0),dz=prop.z-(rig.z??0);
  const distance=Math.hypot(dx,dz),minimum=collisionRadius+prop.radius;
  if(distance>=minimum){
    prop.spin+=(prop.z-preZ)/prop.radius;
    continue;
  }
  let nx,nz;
  if(distance>1e-6){nx=dx/distance;nz=dz/distance;}
  else{
    const velocity=Math.hypot(rig.vx??0,rig.vz??0);
    nx=velocity>1e-5?(rig.vx/velocity):1;
    nz=velocity>1e-5?(rig.vz/velocity):0;
  }
  // Mass-weighted penetration correction conserves the relative position of
  // a heavy rig and light barrel: the barrel moves farther than the machine.
  const overlap=minimum-distance+.0001,total=rigMass+prop.massKg;
  const rigShare=prop.massKg/total,propShare=rigMass/total;
  rig.x-=nx*overlap*rigShare;rig.z-=nz*overlap*rigShare;
  prop.x+=nx*overlap*propShare;prop.z+=nz*overlap*propShare;
  const approaching=((rig.vx??0)-prop.vx)*nx+((rig.vz??0)-prop.vz)*nz;
  if(approaching>0){
    // Conservation of linear impulse along the collision normal. Both rig and
    // scrap are affected; restitution remains low for greasy industrial steel.
    const j=(1+prop.restitution)*approaching/(1/rigMass+1/prop.massKg);
    rig.vx-=nx*j/rigMass;rig.vz-=nz*j/rigMass;
    prop.vx+=nx*j/prop.massKg;prop.vz+=nz*j/prop.massKg;
    prop.lastImpact=clamp(j/(rigMass*2),0,1);
    rig.impact=Math.max(rig.impact??0,clamp(approaching/6,0,1));
    if(prop.cooldown<=0&&approaching>.22){
      prop.contactCount++;
      events.push({id:prop.id,strength:clamp(approaching/4,.10,.85),impulse:j});
      prop.cooldown=.24;
    }
  }
  prop.spin+=(prop.z-preZ)/prop.radius;
 }
 // StepRig already integrated motion this tick. Collision response updates
 // the derived readouts immediately rather than leaving a stale frame.
 if(Number.isFinite(rig.forwardSpeed)||Number.isFinite(rig.lateralSpeed)){
   const yaw=rig.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
   rig.forwardSpeed=(rig.vx??0)*s-(rig.vz??0)*c;
   rig.lateralSpeed=(rig.vx??0)*c+(rig.vz??0)*s;
 }
 return events;
}
