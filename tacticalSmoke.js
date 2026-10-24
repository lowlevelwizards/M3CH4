/** Finite smoke obscures optical sight in both directions but never stops bullets.
 * Only create known smoke from actual discharges, not imagined cover.
 */
export const SMOKE_DURATION=9;
export const SMOKE_CHARGES=2;
export const SMOKE_RADIUS=3.5;
export function createSmokeState(){return {charges:SMOKE_CHARGES,clouds:[],serial:0};}
export function deploySmoke(state,rig){
  if(!state||state.charges<=0||!rig)return false;
  state.charges--;
  state.clouds.push({id:++state.serial,x:rig.x,z:rig.z,radius:SMOKE_RADIUS,life:SMOKE_DURATION,age:0});
  return true;
}
export function stepSmoke(state,dt){
  if(!state||!Number.isFinite(dt)||dt<=0)return;
  for(const c of state.clouds){c.life=Math.max(0,c.life-dt);c.age+=dt;}
  state.clouds=state.clouds.filter(c=>c.life>0);
}
export function smokeRadius(cloud) {
  if(!cloud||cloud.life<=0)return 0;
  return cloud.radius*Math.min(1,Math.max(.2,cloud.age/.85))*Math.min(1,cloud.life/1.5);
}
/** Segment/disk intersection: only the finite ray BETWEEN rigs counts.
 * Both friendly and enemy optics receive identical denial.
 */
export function smokeObscures(start,end,clouds=[]){
  if(!start||!end)return false;
  const dx=end.x-start.x,dz=end.z-start.z;
  const dist2=dx*dx+dz*dz;
  if(dist2<.0001)return false;
  return clouds.some(c=>{
    const r=smokeRadius(c);if(r<=0)return false;
    const t=Math.min(1,Math.max(0,((c.x-start.x)*dx+(c.z-start.z)*dz)/dist2));
    const x=start.x+t*dx,z=start.z+t*dz;
    return (x-c.x)**2+(z-c.z)**2<r*r;
  });
}
