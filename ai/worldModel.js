/** Tactical knowledge only: never mutate combat actors or expose omniscient positions.
 * Objectives are public arena information; enemies enter shared squad knowledge
 * through plausible line-of-sight observation and expire after lost contact.
 */
import { tacticalRigVisible } from '../tacticalAwareness.js';
import { smokeObscures } from '../tacticalSmoke.js';
import { partHealth } from '../damageBehavior.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const MEMORY_SECONDS=13;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
/** Coarse field-visible damage cues. Do NOT give a hidden-contact planner
 * precise structure/weapon damage. Frozen at the last genuine sighting. */
const observedCondition=actor=>{
    const c=actor.capability;
    const integrity=Math.min(c.structure,c.mobility,c.command,c.power);
    return integrity<.38?'CRITICAL':integrity<.76?'DAMAGED':'WORKING';
};
export function contactSearchRadius(contact,now){
    if(!contact)return 0;
    const age=Math.max(0,now-(contact.lastSeen??now));
    // A growing *area of uncertainty*, never an invented extrapolated enemy.
    return clamp(1.2+age*1.45,1.2,20);
}
export function createWorldModel() {return { contacts:new Map(), lastTime:0 }; }
export function actorCapabilities(actor) {
    const condition=actor.condition;
    const read=slot=>condition?.parts?.[slot]?partHealth(condition,slot):1;
    const mobility=read('mobility'),power=read('power'),command=read('command'),
        structure=read('structure'),weapon=read('combat');
    return {mobility,power,command,structure,weapon,
        canMove:mobility>.05&&power>.12&&command>.05&&structure>.05,
        canFight:weapon>.12&&command>.05&&power>.12&&structure>.05,
        endurance:Math.min(structure,Math.max(.15,power),Math.max(.15,command)),
        speed:Math.max(.12,mobility)*Math.max(.30,power)};
}
export function observeBattlefield(memory,roster,objective,world,time=0,smokeClouds=[]) {
    const participants=(roster??[]).filter(a=>a?.rig).map(a=>({
        id:a.id,team:a.team,active:a.active!==false,label:a.label??a.id,
        position:{x:a.rig.x,z:a.rig.z},
        yaw:a.rig.yaw??0,
        underFireSeconds:a.motion?.awareness?.underFireSeconds??0,
        // Approximate incoming-fire sector from sensed impact/bearing.
        // This is never a new enemy sighting or an exact position.
        threatPosition:a.motion?.awareness?.underFireSeconds>.2 &&
            a.motion?.awareness?.lastThreat
            ? {...a.motion.awareness.lastThreat}:null,
        recentAttackerId:a.motion?.awareness?.recentAttackerId??null,
        behavior:a.behavior?.id??'pressure',capability:actorCapabilities(a),
    }));
    const teams=['friendly','hostile'],knowledge={};
    for(const team of teams){
        const allies=participants.filter(p=>p.team===team&&p.active);
        const enemies=participants.filter(p=>p.team!==team&&p.active);
        const previous=memory.contacts.get(team)??new Map();
        const known=new Map();
        for(const enemy of enemies) {
            const spotted=allies.some(friend=>{
                const d=distance(friend.position,enemy.position);
                if(d>=38||d<.01)return false;
                const dx=(enemy.position.x-friend.position.x)/d;
                const dz=(enemy.position.z-friend.position.z)/d;
                const fwd=dx*Math.sin(friend.yaw)+dz*(-Math.cos(friend.yaw));
                // Wide optics still have a rear blind sector. Proximity does
                // not grant exact coordinates through the chassis.
                return fwd>Math.cos(112*Math.PI/180)&&
                    tacticalRigVisible(friend.position,enemy.position,world) &&
                    !smokeObscures(friend.position,enemy.position,smokeClouds);
            });
            if(spotted){
                const report={id:enemy.id,team:enemy.team,
                    position:{...enemy.position},lastSeen:time,
                    confidence:1,visible:true,searchRadius:1.2,
                    // Only a qualitative exterior estimate while observed.
                    damageCue:observedCondition(enemy)};
                known.set(enemy.id,report);
            }else{
                const old=previous.get(enemy.id);
                const age=old?time-old.lastSeen:Infinity;
                if(old&&age<MEMORY_SECONDS)known.set(enemy.id,{
                    ...old,visible:false,
                    confidence:clamp(1-age/MEMORY_SECONDS,.02,1),
                    searchRadius:contactSearchRadius(old,time),
                    // Keep exact last SIGHTING location, not current location.
                    position:{...old.position},
                });
            }
        }
        memory.contacts.set(team,known);
        knowledge[team]={
            allies:allies.map(p=>({...p,position:{...p.position}})),
            // The caller never receives a hidden enemy's current position.
            contacts:[...known.values()],
        };
    }
    const zones=objective?.domination?.points?.map(p=>({
        id:p.id,point:{x:p.x,z:p.z},owner:p.owner,contested:!!p.contested,
        influence:p.influence??0,friendly:p.friendly??0,hostile:p.hostile??0,
    }))??[];
    // An approximate battlefield rally is publicly known even with no enemy
    // sighting. That keeps crews moving/searching behind the loading house.
    const missions={
        friendly:objective?.type==='elimination'?{x:0,z:-8}:
            objective?.type==='breakthrough'?{...objective.friendlyGoal}:
                objective?.point?{...objective.point}:{x:0,z:-8},
        hostile:objective?.type==='elimination'?{x:0,z:8}:
            objective?.type==='breakthrough'?{...objective.hostileGoal}:
                objective?.point?{...objective.point}:{x:0,z:8},
    };
    memory.lastTime=time;
    return {missions,time,kind:objective?.type??'elimination',teams,zones,
        // Number of still-fieldable roster entries is already on the squad HUD;
        // reveal no hidden enemy positions, capabilities, ammunition or parts.
        remaining:{friendly:participants.filter(p=>p.team==='friendly'&&p.active).length,
            hostile:participants.filter(p=>p.team==='hostile'&&p.active).length},
        zoneRadius:objective?.radius??4.7,
        score:{friendly:objective?.friendlyProgress??0,hostile:objective?.hostileProgress??0,
            max:objective?.domination?.scoreToWin??0},
        knowledge};
}
