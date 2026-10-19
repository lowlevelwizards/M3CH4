/** Tactical knowledge only: never mutate combat actors or expose omniscient positions.
 * Objectives are public arena information; enemies enter shared squad knowledge
 * through plausible line-of-sight observation and expire after lost contact.
 */
import { tacticalLineOfSight } from '../tacticalAwareness.js';
import { partHealth } from '../damageBehavior.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
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
export function observeBattlefield(memory,roster,objective,world,time=0) {
    const participants=(roster??[]).filter(a=>a?.rig).map(a=>({
        id:a.id,team:a.team,active:a.active!==false,label:a.label??a.id,
        position:{x:a.rig.x,z:a.rig.z},
        behavior:a.behavior?.id??'pressure',capability:actorCapabilities(a),
    }));
    const teams=['friendly','hostile'],knowledge={};
    for(const team of teams){
        const allies=participants.filter(p=>p.team===team&&p.active);
        const enemies=participants.filter(p=>p.team!==team&&p.active);
        const previous=memory.contacts.get(team)??new Map();
        const known=new Map();
        for(const enemy of enemies) {
            const spotted=allies.some(friend=>
                distance(friend.position,enemy.position)<38 &&
                tacticalLineOfSight(friend.position,enemy.position,world));
            if(spotted)known.set(enemy.id,{id:enemy.id,team:enemy.team,
                position:{...enemy.position},lastSeen:time,confidence:1,visible:true});
            else {
                const old=previous.get(enemy.id);
                if(old&&time-old.lastSeen<5.5)known.set(enemy.id,{
                    ...old,visible:false,confidence:Math.max(0,1-(time-old.lastSeen)/5.5)});
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
        zoneRadius:objective?.radius??4.7,
        score:{friendly:objective?.friendlyProgress??0,hostile:objective?.hostileProgress??0,
            max:objective?.domination?.scoreToWin??0},
        knowledge};
}
