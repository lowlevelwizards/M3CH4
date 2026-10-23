/** Tactical firing-lane advice only. A true clear shot comes exclusively
 * from scene.traceCombatantShot() at the current muzzle. Candidate positions
 * here are provisional movement goals, never permission to fire. */
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const passable=(point,world,pad)=>{
    if(!world||!point||point.x<world.minX+pad||point.x>world.maxX-pad||
        point.z<world.minZ+pad||point.z>world.maxZ-pad)return false;
    return !(world.obstacles??[]).some(o=>point.x>=o.minX-pad&&point.x<=o.maxX+pad&&
        point.z>=o.minZ-pad&&point.z<=o.maxZ+pad);
};
/** 2D slab ray. Wrecks and dynamic rigs are deliberately included.
 * Only the designated target is exempted, so an intervening ally/wreck
 * cannot magically become a clear corridor. */
export function firingLaneBlocker(from,to,world,targetId=null){
    if(!from||!to||!world)return null;
    const dx=to.x-from.x,dz=to.z-from.z;
    let nearest=1,found=null;
    for(const o of world.obstacles??[]){
        if(o.id===targetId)continue;
        let lo=0,hi=1;
        for(const [p,dir,min,max] of [[from.x,dx,o.minX,o.maxX],[from.z,dz,o.minZ,o.maxZ]]){
            if(Math.abs(dir)<1e-8){if(p<min||p>max){lo=2;break;}continue;}
            const a=(min-p)/dir,b=(max-p)/dir;
            lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
        }
        if(lo<=hi&&lo>=0&&lo<nearest&&lo<.97){
            nearest=lo;found=o;
        }
    }
    return found;
}
export function chooseClearFiringPoint(self,target,world,{
    radius=1.3,side=1,targetId=null,allies=[],
}={}){
    if(!self||!target||!world)return null;
    const length=distance(self,target);if(length<.8)return null;
    const dx=(target.x-self.x)/length,dz=(target.z-self.z)/length;
    let best=null,bestScore=Infinity;
    for(const lateral of [2.8,4.4,6]){
        for(const sign of [side,-side]){
            for(const retreat of [0,1.8]){
                const point={x:self.x-dz*lateral*sign-dx*retreat,
                    z:self.z+dx*lateral*sign-dz*retreat};
                if(!passable(point,world,radius+.5))continue;
                if(firingLaneBlocker(point,target,world,targetId))continue;
                const crowd=allies.some(a=>distance(point,a.position??a.rig??a)<radius*2.5);
                if(crowd)continue;
                const cost=distance(self,point)+retreat*.2+(sign===side?0:.18);
                if(cost<bestScore){bestScore=cost;best=point;}
            }
        }
    }
    return best;
}
/** Real contact chosen from a no-spread, no-damage fire trace. */
export function assessPhysicalFireLane(contact,targetId){
    if(!targetId||!contact)return {clear:false,reason:'NO TRACE'};
    return {
        clear:contact.actorId===targetId&&!!contact.slot,
        reason:contact.actorId===targetId&&contact.slot?'TARGET FIRST':
            contact.blockedBy?'COVER':contact.actorId?'INTERVENING RIG':'BARREL / TERRAIN',
        blocker:contact.blockedBy??(contact.actorId!==targetId?contact.actorId:null),
    };
}
