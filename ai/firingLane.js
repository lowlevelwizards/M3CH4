/** Target acquisition is an optical question; firing is a physical one.
 * Predicted positions are provisional. Only scene.traceCombatantShot(), at the
 * actual muzzle, may grant permission to shoot. */
import { firstCoverHit } from '../coverTruth.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const passable=(point,world,pad)=>{
    if(!world||!point||point.x<world.minX+pad||point.x>world.maxX-pad||
        point.z<world.minZ+pad||point.z>world.maxZ-pad)return false;
    return !(world.obstacles??[]).some(o=>point.x>=o.minX-pad&&point.x<=o.maxX+pad&&
        point.z>=o.minZ-pad&&point.z<=o.maxZ+pad);
};

/** Height-aware *provisional* firing corridor. Low barricades can be shot
 * over; tall boxes still interrupt the shot. Includes allies and wrecks. */
export function firingLaneBlocker(from,to,world,targetId=null,{
    muzzleHeight=2.06,targetHeight=2.4,
}={}){
    if(!from||!to||!world)return null;
    const dx=to.x-from.x,dz=to.z-from.z,dy=targetHeight-muzzleHeight;
    const length=Math.hypot(dx,dy,dz);
    if(length<.15)return null;
    // Moving rigs/wrecks are represented by 2D collision boxes. Give those
    // boxes an upper body here; coverTruth's default 1.1m would otherwise
    // make intervening allies invisible to provisional height-aware rays.
    const obstacles=(world.obstacles??[]).filter(o=>o.id!==targetId)
        .map(o=>o.dynamic&&o.height==null&&o.maxY==null
            ? {...o,maxY:3.25}:o);
    const hit=firstCoverHit(
        [from.x,muzzleHeight,from.z],[dx/length,dy/length,dz/length],
        obstacles,Math.max(0,length-.18),.06);
    return hit?.obstacle??null;
}

const VISIBLE_AIM_HEIGHTS=[2.45,2.08,1.82];
/** Scan successive real alternative routes, not a single endlessly repeated
 * sidestep. A later physical muzzle check still decides whether to fire. */
export function chooseClearFiringPoint(self,target,world,{
    radius=1.3,side=1,targetId=null,allies=[],excludePoints=[],
}={}){
    if(!self||!target||!world)return null;
    const length=distance(self,target);if(length<.8)return null;
    const dx=(target.x-self.x)/length,dz=(target.z-self.z)/length;
    let bestClear=null,bestClearScore=Infinity;
    let bestFlank=null,bestFlankScore=Infinity;
    const consider=(point,bias=0)=>{
        if(distance(point,self)<1.9||distance(point,target)<radius+1.2||
            !passable(point,world,radius+.45))return;
        if(excludePoints.some(p=>distance(point,p)<2.3))return;
        if(allies.some(a=>distance(point,a.position??a.rig??a)<radius*2.5))return;
        const travel=distance(self,point);
        const range=distance(point,target);
        const cost=travel+Math.max(0,range-14)*.14+bias;
        const clear=VISIBLE_AIM_HEIGHTS.some(height=>!firingLaneBlocker(
            point,target,world,targetId,{targetHeight:height}));
        if(clear&&cost<bestClearScore){bestClear=point;bestClearScore=cost;}
        // If every sampled muzzle corridor is blocked, commit to a longer
        // flank around the barricade rather than freeze at the old lane.
        if(!clear&&cost<bestFlankScore){bestFlank=point;bestFlankScore=cost;}
    };
    // Start with modest left/right moves, then expand to sweeping angles.
    for(const lateral of [3.0,5.0,7.5,10.0,13.0]){
        for(const sign of [side,-side]){
            for(const forward of [0,2.5,5,-2]){
                consider({x:self.x-dz*lateral*sign+dx*forward,
                    z:self.z+dx*lateral*sign+dz*forward},
                    forward<0?.5:0);
            }
        }
    }
    // A long uninterrupted wall may demand getting around its *end*, not
    // another parallel strafe in front of it.
    const range=Math.max(4.7,Math.min(11,length*.65));
    for(let i=0;i<20;i++){
        const angle=(i+.5)*Math.PI/10;
        consider({x:target.x+Math.cos(angle)*range,
            z:target.z+Math.sin(angle)*range},.5);
    }
    return bestClear??bestFlank;
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

export const TARGET_AIM_SLOTS=Object.freeze([
    'structure','combat','command','power','mobility',
]);

/** A partly exposed mech is a valid target even if its center-frame is
 * shielded by a barricade. Choose a real hit on any module (favoring the
 * pilot's desired module where possible), without shooting through cover. */
export function assessTargetFireLanes(trace,targetId,preferredSlot='structure'){
    if(typeof trace!=='function'||!targetId)
        return {clear:false,reason:'NO TRACE',aimSlot:null};
    let blocked=null;
    const slots=[preferredSlot,...TARGET_AIM_SLOTS]
        .filter((slot,index,array)=>TARGET_AIM_SLOTS.includes(slot)&&
            array.indexOf(slot)===index);
    for(const slot of slots){
        const assessment=assessPhysicalFireLane(trace(slot),targetId);
        if(assessment.clear)return {...assessment,aimSlot:slot};
        if(!blocked||(!blocked.blocker&&assessment.blocker))blocked=assessment;
    }
    return {...(blocked??{clear:false,reason:'NO TRACE'}),aimSlot:null};
}
