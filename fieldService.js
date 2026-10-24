/** Universal, mechanically limited emergency restart for damaged combat assemblies.
 * Damage fate and physical ownership remain authoritative in combat.js. Service
 * restores INTERNAL functionality only, never armor or destruction reserve.
 */
export const FIELD_SERVICE_SECONDS = 4.0;
export const FIELD_SERVICE_COOLDOWN_SECONDS = 10.0;
export const FIELD_SERVICE_RECOVERY_RATIO = .25;
export const FIELD_SERVICE_MAX_SPEED_MPS = .35;
export const FIELD_SERVICE_MAX_YAW_RATE_RAD = .12;
export const WEAPON_FAULT_THRESHOLD = 0;
export const WEAPON_FAULT_FLOOR = 0;
export const SERVICE_PRIORITY = Object.freeze(['power','command','mobility','combat','structure']);
const SLOTS = Object.freeze(['structure','mobility','power','command','combat']);
const clamp01 = n => Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export const integrityRatio = (condition,slot) => {
    const p=condition?.parts?.[slot];
    return p?.maxIntegrity>0 ? clamp01(p.integrity/p.maxIntegrity) : 0;
};
export const weaponIntegrityRatio = condition => integrityRatio(condition,'combat');
export function disabledSlots(condition) {
    return SLOTS.filter(slot => {
        const p=condition?.parts?.[slot];
        return !!p && (p.destroyed || p.integrity<=0);
    });
}
export const countDisabled = condition => disabledSlots(condition).length;
export function systemMissionKillReason(condition) {
    if(condition?.parts?.structure?.destroyed) return 'FRAME DESTROYED';
    if(condition?.parts?.command?.destroyed) return 'PILOT COMPARTMENT DESTROYED';
    return countDisabled(condition)>=3 ? 'TOTAL SYSTEM FAILURE · THREE DISABLES' : null;
}
export function serviceableSlots(condition) {
    return SERVICE_PRIORITY.filter(slot=>{
        const p=condition?.parts?.[slot];
        return !!p && !p.destroyed && p.integrity<=0;
    });
}
export function createFieldServiceState(rateMultiplier=1){
    return {used:false,held:false,progress:0,faultLatched:false,
        rateMultiplier:Number.isFinite(rateMultiplier)?Math.max(1,Math.min(1.5,rateMultiplier)):1,
        selectedSlot:null,activeSlot:null,cooldownLeft:0,attempts:{},
        lastServicedSlot:null,lastRecoveryRatio:0};
}
export function fieldServiceTarget(condition,service) {
    const available=serviceableSlots(condition);
    return available.includes(service?.selectedSlot) ? service.selectedSlot : available[0]??null;
}
export function cycleFieldServiceTarget(condition,service) {
    if(!service || service.held)return fieldServiceTarget(condition,service);
    const list=serviceableSlots(condition);
    if(!list.length){service.selectedSlot=null;return null;}
    const i=list.indexOf(fieldServiceTarget(condition,service));
    service.selectedSlot=list[(i+1)%list.length];
    return service.selectedSlot;
}
export function canFieldService(condition,service) {
    return !!service && !service.held && (service.cooldownLeft??0)<=.00001 &&
        !!fieldServiceTarget(condition,service) && !systemMissionKillReason(condition);
}
export function fieldServiceStationary(rig){
    return Math.hypot(Number(rig?.vx)||0,Number(rig?.vz)||0)<=FIELD_SERVICE_MAX_SPEED_MPS &&
        Math.abs(Number(rig?.yawRate)||0)<=FIELD_SERVICE_MAX_YAW_RATE_RAD;
}
export function beginFieldService(condition,service,rig){
    if(!canFieldService(condition,service)||!fieldServiceStationary(rig))return false;
    service.activeSlot=fieldServiceTarget(condition,service);
    service.selectedSlot=service.activeSlot;
    service.held=true;
    service.progress=0;
    return true;
}
export function cancelFieldService(service){
    if(!service)return;
    service.held=false;
    service.activeSlot=null;
    service.progress=0;
}
export function advanceFieldService(condition,service,rig,dt){
    if(!service || !Number.isFinite(dt)||dt<=0)
        return {event:null,progress:service?.progress??0};
    service.cooldownLeft=Math.max(0,(service.cooldownLeft??0)-dt);
    if(!service.held)return {event:null,progress:service.progress,cooldownLeft:service.cooldownLeft};
    const slot=service.activeSlot;
    const p=condition?.parts?.[slot];
    if(!p||p.destroyed||p.integrity>0||systemMissionKillReason(condition)){
        cancelFieldService(service);
        return {event:'unavailable',progress:0};
    }
    if(!fieldServiceStationary(rig)){
        cancelFieldService(service);
        return {event:'interrupted',progress:0};
    }
    service.progress=Math.min(FIELD_SERVICE_SECONDS,service.progress+dt*(service.rateMultiplier??1));
    if(service.progress<FIELD_SERVICE_SECONDS)
        return {event:'progress',progress:service.progress,slot};
    const attempt=(service.attempts[slot]??0)+1;
    const ratio=attempt===1?FIELD_SERVICE_RECOVERY_RATIO:attempt===2?.20:.15;
    p.integrity=Math.max(p.integrity,p.maxIntegrity*ratio);
    service.attempts[slot]=attempt;
    service.used=true;
    service.lastServicedSlot=slot;
    service.lastRecoveryRatio=ratio;
    service.cooldownLeft=FIELD_SERVICE_COOLDOWN_SECONDS;
    cancelFieldService(service);
    service.selectedSlot=fieldServiceTarget(condition,service);
    return {event:'completed',progress:FIELD_SERVICE_SECONDS,slot,ratio,attempt};
}
export function weaponFailureState(condition,service) {
    const p=condition?.parts?.combat;
    if(p?.destroyed)return 'destroyed';
    const health=weaponIntegrityRatio(condition);
    if(health<=0)return 'faulted';
    return health<.95?'damaged':'ready';
}
/** The old one-time weapon bypass is retired. Ordinary zero-integrity faults
 * are now recoverable, and the real damage reserve is never reset on disable. */
export function arrestFirstWeaponFailure(){return false;}
export function weaponMissionKillReason(condition){return systemMissionKillReason(condition);}
