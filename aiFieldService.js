/** Shared physical emergency restart decisions for all five modules. */
import { canFieldService,fieldServiceStationary,serviceableSlots,fieldServiceTarget } from './fieldService.js';
import { hostileMissionKillReason } from './hostileRig.js';
export const AI_FIELD_SERVICE_FALLBACK_DISTANCE_M = 9;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.z??0)-(b?.z??0));
export function aiWeaponMissionKillReason(condition,behavior=null,service=null){
    return hostileMissionKillReason(condition,behavior);
}
export function aiWeaponRecoveryDirective(actor,target=null){
    const service=actor?.fieldService;
    if(!actor||!service || !serviceableSlots(actor.condition).length)
        return Object.freeze({active:false,mode:'NONE',safe:false,begin:false});
    const slot=fieldServiceTarget(actor.condition,service);
    const awareness=actor.motion?.awareness??{};
    const targetDistance=target?distance(actor.rig,target.rig??target):Infinity;
    const covered=!!target && awareness.lineOfSight===false;
    const quiet=(awareness.underFireSeconds??0)<=.18;
    const immobile=(actor.condition.parts.mobility.integrity<=0);
    const safe=covered||(quiet&&targetDistance>=AI_FIELD_SERVICE_FALLBACK_DISTANCE_M)||immobile;
    const stationary=fieldServiceStationary(actor.rig);
    if(service.held)return Object.freeze({active:true,mode:'SERVICE',safe:true,begin:false,slot,targetDistance});
    if((service.cooldownLeft??0)>0)return Object.freeze({active:true,mode:immobile?'SETTLE':'WITHDRAW',safe:false,begin:false,slot,targetDistance});
    if(safe&&stationary&&canFieldService(actor.condition,service))
        return Object.freeze({active:true,mode:'SERVICE',safe:true,begin:true,slot,targetDistance});
    if(safe)return Object.freeze({active:true,mode:'SETTLE',safe:true,begin:false,slot,targetDistance});
    return Object.freeze({active:true,mode:'WITHDRAW',safe:false,begin:false,slot,targetDistance});
}
export function aiWeaponRecoveryPosture(base,directive){
    if(!directive?.active)return base;
    return {...base,state:directive.mode==='SERVICE'?'FIELD SERVICE':'SYSTEM FAULT',
        preferredMode:directive.mode==='WITHDRAW'?'WITHDRAW':'HOLD',
        aggressionScale:Math.min(base?.aggressionScale??1,.18),
        seekCoverBias:Math.max(base?.seekCoverBias??0,1.35)};
}
