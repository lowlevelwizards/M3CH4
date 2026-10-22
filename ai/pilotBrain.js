import { chooseFightPosition, chooseDefendPosition } from './positioning.js';
import { cautiousApproach } from './combatIntelligence.js';
/** One coherent decision authority per pilot. Plans are sticky; invalidation,
 * critical damage, weapon-service safety, and sharply better team jobs interrupt.
 * Pure and deterministic: no clock, browser, storage or physics dependencies.
 */
const DIST=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createPilotBrain(){return {intent:null,committedUntil:0,
    lastDecision:-Infinity,lastGeometryAt:-Infinity,lastReason:'INIT',history:[]};}
function record(brain,next,now) {
    brain.intent=next;brain.lastReason=next.reason;brain.lastDecision=now;
    brain.history.push({time:now,goal:next.goal,objectiveId:next.objectiveId??null,
        role:next.role??null,strategy:next.strategy??null,
        reason:next.reason,utility:next.utility});
    if(brain.history.length>18)brain.history.shift();
}
export function decidePilot(brain,actor,assignment,context,now) {
    const capability=context?.capability??{endurance:1,mobility:1,weapon:1,canMove:true,canFight:true};
    const last=brain.intent;
    // Research policy changes only the pilot's judgment thresholds.
    // Physical capability, mission results and hardware remain authoritative.
    const pilotPolicy=context?.policy?.pilot??null;
    const woundedAt=pilotPolicy?.woundThreshold??.30;
    const exposureAt=pilotPolicy?.woundExposure??1.4;
    const unsafe=capability.endurance<.13 || capability.command<.09;
    const service=!!context?.weaponRecovery?.active;
    let proposed;
    if(service) proposed={goal:context.weaponRecovery.mode==='WITHDRAW'?'WITHDRAW':'SERVICE',
        point:context.weaponRecovery.mode==='WITHDRAW'
            ? context.retreatPoint??actor.position : actor.position,utility:.98,
        reason:'WEAPON SERVICE / SAFE RECOVERY'};
    else if(unsafe && capability.canMove && !(assignment?.goal==='DEFEND' && capability.endurance>.09 && context?.underFireSeconds<.5))
        proposed={goal:'WITHDRAW',point:context.retreatPoint??actor.position,
            utility:.95,reason:'CRITICAL MACHINE CONDITION'};
    else if(!capability.canMove)
        proposed={goal:'HOLD',point:actor.position,utility:.83,
            reason:'MOBILITY UNAVAILABLE · DEFEND POSITION'};
    else if(context?.systemAtRisk&&context?.survivalPoint&&
        context?.underFireSeconds>.25)
        proposed={goal:'WITHDRAW',point:{...context.survivalPoint},
            utility:1.0,reason:'PROTECT '+context.systemAtRisk.slot.toUpperCase()+
                ' · REPEATED IMPACTS'};
    else if(capability.endurance<woundedAt && context?.underFireSeconds>exposureAt && !(assignment?.goal==='DEFEND'&&context?.preserveMajority&&capability.endurance>.19))
        proposed={goal:'WITHDRAW',point:context.retreatPoint??actor.position,
            utility:.93,reason:'WOUNDED UNDER SUSTAINED FIRE'};
    else if(assignment)
        proposed={...assignment,utility:assignment.score??.64,
            reason:assignment.reason??assignment.note??'TEAM ASSIGNMENT'};
    else proposed={goal:'HOLD',point:actor.position,utility:.15,reason:'NO TEAM ORDER'};
    const identity=i=>i?.goal+'|'+(i?.objectiveId??'')+'|'+(i?.targetActorId??'');
    const changed=identity(last)!==identity(proposed);
    const incompatible=last?.objectiveId&&context?.invalidObjectives?.includes(last.objectiveId);
    // Geometry updates are slow intentional positioning choices, not 60Hz
    // steering noise. Objective capture still goes to the physical zone.
    const newTask=changed||!last;
    if(newTask&&context?.world&&
        (context?.uncertain===true||pilotPolicy?.cautiousApproach)&&!context?.enemySeen&&
        !context?.underFireSeconds&&['CAPTURE','CONTEST','SEARCH'].includes(proposed.goal)&&
        proposed.point){
        const via=cautiousApproach(context.world,actor.position,proposed.point,
            context.collisionRadius??1.4,context.personality??'pressure');
        if(via&&!proposed.viaPoint)proposed.viaPoint=via;
    }
    if(proposed.point&&context?.world &&
        now-brain.lastGeometryAt>=(newTask?.75:1.2)) {
        if(proposed.goal==='ENGAGE')proposed.point=chooseFightPosition(
            context.world,actor.position,proposed.point,
            context.preferredRangeM??6,context.personality??'pressure');
        else if(['DEFEND','SCREEN'].includes(proposed.goal)&&proposed.reservationPoint)
            proposed.point={...proposed.reservationPoint};
        else if(['DEFEND','SCREEN'].includes(proposed.goal))proposed.point=chooseDefendPosition(
            context.world,actor.position,proposed.point,
            Math.min(3,Math.max(1.8,(proposed.radius??4.7)-1.3)),
            context.threatPosition??null,context.personality??'pressure',
            context.collisionRadius??1.4,context.nearbyAllies??[],
            context.underFireSeconds??0);
        brain.lastGeometryAt=now;
    } else if(!newTask&&last?.point)proposed.point=last.point;
    const safeAnchor=last?.anchor&&last?.objectiveId===assignment?.objectiveId&&
        assignment?.goal==='DEFEND';
    const emergency=service||unsafe||!capability.canMove||incompatible||
        !!proposed.emergency||
        !!(context?.systemAtRisk&&context?.survivalPoint)||
        (proposed.goal==='SCREEN'&&last?.goal!=='SCREEN');
    const improvement=(proposed.utility??0)-(last?.utility??0);
    if(changed&&!emergency&&last&&(
        (safeAnchor&&improvement<.40)||
        (now<brain.committedUntil&&improvement<.32)))
        return last;
    if(!changed&&last){
        // Update destinations/known threat locations without restarting a plan.
        brain.intent={...last,point:proposed.point??last.point,
            // Known enemy contact ends the speculative sheltered crossing;
            // ordinary objective commitment remains, only the via-stop drops.
            viaPoint:context?.enemySeen?null:(proposed.viaPoint??last.viaPoint),
            arrivalPoint:proposed.arrivalPoint??last.arrivalPoint,
            reservationPoint:proposed.reservationPoint??last.reservationPoint,
            corridorReservation:proposed.corridorReservation??null,
            utility:proposed.utility};
        return brain.intent;
    }
    const commitment=proposed.goal==='STAGE'?1.6:
        proposed.goal==='DEFEND'?7.0:
        proposed.goal==='CAPTURE'||proposed.goal==='CONTEST'?3.4:2.7;
    const next={...proposed,actorId:actor.id,committedUntil:now+
        commitment*(pilotPolicy?.commitment??1)};
    brain.committedUntil=next.committedUntil;
    record(brain,next,now);
    return next;
}
