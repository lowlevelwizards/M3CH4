/** One coherent decision authority per pilot. Plans are sticky; invalidation,
 * critical damage, weapon-service safety, and sharply better team jobs interrupt.
 * Pure and deterministic: no clock, browser, storage or physics dependencies.
 */
const DIST=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createPilotBrain(){return {intent:null,committedUntil:0,
    lastDecision:-Infinity,lastReason:'INIT',history:[]};}
function record(brain,next,now) {
    brain.intent=next;brain.lastReason=next.reason;brain.lastDecision=now;
    brain.history.push({time:now,goal:next.goal,objectiveId:next.objectiveId??null,
        reason:next.reason,utility:next.utility});
    if(brain.history.length>18)brain.history.shift();
}
export function decidePilot(brain,actor,assignment,context,now) {
    const capability=context?.capability??{endurance:1,mobility:1,weapon:1,canMove:true,canFight:true};
    const last=brain.intent;
    const unsafe=capability.endurance<.13 || capability.command<.09;
    const service=!!context?.weaponRecovery?.active;
    let proposed;
    if(service) proposed={goal:context.weaponRecovery.mode==='WITHDRAW'?'WITHDRAW':'SERVICE',
        point:assignment?.point??actor.position,utility:.98,
        reason:'WEAPON SERVICE / SAFE RECOVERY'};
    else if(unsafe && capability.canMove)
        proposed={goal:'WITHDRAW',point:context.retreatPoint??actor.position,
            utility:.95,reason:'CRITICAL MACHINE CONDITION'};
    else if(!capability.canMove)
        proposed={goal:'HOLD',point:actor.position,utility:.83,
            reason:'MOBILITY UNAVAILABLE · DEFEND POSITION'};
    else if(assignment)
        proposed={...assignment,utility:assignment.score??.64,
            reason:assignment.reason??assignment.note??'TEAM ASSIGNMENT'};
    else proposed={goal:'HOLD',point:actor.position,utility:.15,reason:'NO TEAM ORDER'};
    const identity=i=>i?.goal+'|'+(i?.objectiveId??'')+'|'+(i?.targetActorId??'');
    const changed=identity(last)!==identity(proposed);
    const incompatible=last?.objectiveId&&context?.invalidObjectives?.includes(last.objectiveId);
    const emergency=service||unsafe||!capability.canMove||incompatible;
    const improvement=(proposed.utility??0)-(last?.utility??0);
    if(changed&&!emergency&&last&&now<brain.committedUntil&&improvement<.27)
        return last;
    if(!changed&&last){
        // Update destinations/known threat locations without restarting a plan.
        brain.intent={...last,point:proposed.point??last.point,utility:proposed.utility};
        return brain.intent;
    }
    const commitment=proposed.goal==='DEFEND'?5.0:
        proposed.goal==='CAPTURE'||proposed.goal==='CONTEST'?3.4:2.7;
    const next={...proposed,actorId:actor.id,committedUntil:now+commitment};
    brain.committedUntil=next.committedUntil;
    record(brain,next,now);
    return next;
}
