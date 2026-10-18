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
export function chooseDefendPosition(world,self,zone,radius=3.0){
    if(!zone||!world)return zone??self;
    let best=null,score=-Infinity;
    for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        const p={x:zone.x+Math.cos(a)*radius*.72,z:zone.z+Math.sin(a)*radius*.72};
        if(!passable(p,world))continue;
        const value=-dist(self,p)*.03+ (i%2===0?.04:0);
        if(value>score){best=p;score=value;}
    }
    return best??{...zone};
}
