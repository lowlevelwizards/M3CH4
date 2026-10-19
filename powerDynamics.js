/** k.3v.4 — fixed-step generator bus and finite surge accumulator.
 * True kW / kJ accounting. No damage, randomness, inventory or special AI laws.
 * The existing fitted power rating remains the continuous, non-negotiable cap.
 */
import { installedPart } from './components.js';
const clamp = (v,a,b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
const PROFILE = Object.freeze({
    'power-dynamo': Object.freeze({ label: 'DYNAMO G-2', responseSeconds: .75, fallSeconds: .85,
        reserveKJ: 16, dischargeKw: 85, rechargeKw: 26 }),
    'power-air': Object.freeze({ label: 'DRAFT A-1', responseSeconds: .20, fallSeconds: .24,
        reserveKJ: 6, dischargeKw: 65, rechargeKw: 17 }),
});
const profileFor = id => PROFILE[id] ?? PROFILE['power-dynamo'];
const rating = (assembly, slot) => installedPart(assembly,slot)?.definition?.powerKw ?? 0;
export function createPowerSystem(assembly) {
    const power = installedPart(assembly,'power');
    const id = power?.definition.id ?? null;
    const profile = profileFor(id);
    const demandKw = standbyDemandKw(assembly);
    return {
        generatorId:id, reserveKJ:profile.reserveKJ, reserveFraction:1,
        generationKw:Math.min(Math.max(0,rating(assembly,'power')),demandKw),
        demandKw, servedKw:demandKw, capacityKw:Math.max(0,rating(assembly,'power')),
        busRatio:1, shotPulseKw:0, brownout:false, weaponReady:true,
    };
}
/** Actual stationary service demand: cab electronics, weapon standby current,
 * and the minimum mechanical/hydraulic circulation of the installed legs.
 * Mobile full-duty draw uses the catalogue's existing kW requirements. */
export function standbyDemandKw(assembly) {
    return Math.max(0,-rating(assembly,'command')) +
        Math.max(0,-rating(assembly,'combat')) * .32 +
        Math.max(0,-rating(assembly,'mobility')) * .18;
}
export function registerPowerShot(state,assembly) {
    if(!state) return;
    // A *successfully consumed* shot requests transient stabilizer/breech current.
    // Max rather than additive stacking: sustained firing maintains a demand
    // while individual magazines still obey their own cooldown authority.
    const weaponKw = Math.max(0,-rating(assembly,'combat'));
    state.shotPulseKw = Math.min(weaponKw * 3.4,
        (state.shotPulseKw ?? 0) + weaponKw * 2.45);
}
export function advancePowerSystem(state,assembly,rig,dt,powerHealth=1) {
    if(!state || !Number.isFinite(dt) || dt<=0) return state;
    const id = installedPart(assembly,'power')?.definition.id ?? null;
    if(state.generatorId!==id) Object.assign(state,createPowerSystem(assembly));
    const spec = profileFor(id);
    const capacity = Math.max(0,rating(assembly,'power'))*clamp(powerHealth,0,1);
    const mobilityKw = Math.max(0,-rating(assembly,'mobility'));
    const duty = clamp(rig?.driveLoad ?? 0,0,1);
    const idle = standbyDemandKw(assembly);
    const demandKw = idle + mobilityKw * .82 * duty + (state.shotPulseKw??0);
    const reserveCap = spec.reserveKJ * clamp(powerHealth,0,1);
    state.reserveKJ = clamp(state.reserveKJ,0,reserveCap);
    const availableReserve = reserveCap - state.reserveKJ;
    const target = Math.min(capacity,demandKw + (availableReserve > .001 ? spec.rechargeKw : 0));
    const tau = target > state.generationKw ? spec.responseSeconds : spec.fallSeconds;
    const blend = 1 - Math.exp(-dt / Math.max(.001,tau));
    state.generationKw = clamp(state.generationKw + (target - state.generationKw)*blend,0,capacity);
    const shortageKw = Math.max(0,demandKw-state.generationKw);
    const dischargeKw = Math.min(shortageKw,spec.dischargeKw,state.reserveKJ/dt);
    const excessKw = Math.max(0,state.generationKw-demandKw);
    const rechargeKw = Math.min(excessKw,spec.rechargeKw,availableReserve/dt);
    state.reserveKJ = clamp(state.reserveKJ + (rechargeKw-dischargeKw)*dt,0,reserveCap);
    state.shotPulseKw = Math.max(0,(state.shotPulseKw??0)*Math.exp(-dt/.37));
    state.capacityKw = capacity;
    state.demandKw = demandKw;
    state.servedKw = Math.min(demandKw,state.generationKw + dischargeKw);
    state.reserveFraction = reserveCap > 0 ? state.reserveKJ/reserveCap : 0;
    state.busRatio = demandKw > .001 ? clamp(state.servedKw/demandKw,0,1) : 1;
    state.brownout = state.busRatio < .95;
    // Poor bus voltage inhibits a new trigger pull; it does not consume ammo.
    state.weaponReady = state.busRatio >= .85 && capacity >= .5;
    return state;
}
/** Dynamic bus shortage can derate the SAME leg actuator forces as physical
 * damage; existing static power limits/weapon damage still apply independently. */
export function powerConstrainedOutput(output,powerSystem) {
    if(!powerSystem) return output;
    return {
        ...output,
        powerFactor: Math.min(output.powerFactor,powerSystem.busRatio),
        busRatio:powerSystem.busRatio,
    };
}
export function powerProfile(assembly) {
    const id = installedPart(assembly,'power')?.definition.id ?? null;
    return { ...profileFor(id), id };
}
