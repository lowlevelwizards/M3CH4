/** Small candidate-position evaluator for physical rigs. This is geometry
 * advice, not a new steering system. Works for all arena objective modes.
 */
import { tacticalLineOfSight } from '../tacticalAwareness.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const passable=(p,world,pad=1.4)=>
    p.x>world.minX+pad&&p.x<world.maxX-pad&&
    p.z>world.minZ+pad&&p.z<world.maxZ-pad&&
    !(world.obstacles??[]).some(o=>!o.dynamic&&
        p.x>o.minX-pad&&p.x<o.maxX+pad&&p.z>o.minZ-pad&&p.z<o.maxZ+pad);
export function chooseFightPosition(world,self,target,desiredRange=6,style='pressure') {
    if(!target||!world)return self;
    let choice=null,best=-Infinity;
    const radius=Math.max(3,Math.min(11,desiredRange));
    for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        const p={x:target.x+Math.cos(a)*radius,z:target.z+Math.sin(a)*radius};
        if(!passable(p,world))continue;
        const sight=tacticalLineOfSight(p,target,world);
        const travel=dist(p,self);
        // A usable firing lane and affordable movement matter more than a
        // perfect theoretical flank. Skirmishers value angular separation.
        const sideways=style==='skirmisher'?Math.abs(Math.sin(a))*.11:0;
        const utility=(sight?1:0)+sideways-Math.min(.65,travel*.024)-
            Math.abs(dist(p,target)-radius)*.015;
        if(utility>best){best=utility;choice=p;}
    }
    return choice??{...self};
}
export function chooseDefendPosition(world,self,zone,radius=3.0,threat=null,
    style='pressure',collisionRadius=1.4,allies=[],underFire=0){
    if(!zone||!world)return zone??self;
    // Existing safe scoring ground is more valuable than another speculative
    // firing angle. Threat movement can still dislodge a defender under fire.
    const margin=Math.max(.85,radius*.82);
    const crowd=allies.some(ally=>dist(self,ally.position??ally.rig??ally)<collisionRadius*1.65);
    if(dist(self,zone)<=margin&&passable(self,world,collisionRadius)&&
       underFire<1.1&&!crowd)return {...self};
    let best=null,score=-Infinity;
    // Every candidate is INSIDE the scoring zone. Facing a threat is useful,
    // but occupying the point is non-negotiable for an anchoring machine.
    for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        const p={x:zone.x+Math.cos(a)*radius*.70,z:zone.z+Math.sin(a)*radius*.70};
        if(!passable(p,world,collisionRadius))continue;
        const firing=threat?tacticalLineOfSight(p,threat,world):null;
        const priority=style==='bruiser'?.09:.13;
        const crowd=allies.reduce((sum,friend)=>{
            const q=friend.position??friend.rig??friend;
            const d=dist(p,q),spacing=collisionRadius*2.5;
            return sum+(d<spacing?.42*(1-d/spacing):0);
        },0);
        const protectedLane=threat&&!firing&&style==='bruiser'?.16:0;
        const value=-dist(self,p)*.018+(firing?.21:0)+protectedLane+
            Math.min(.10,(radius-dist(zone,p))*.04)+priority-crowd;
        if(value>score){best=p;score=value;}
    }
    return best??{...zone};
}
