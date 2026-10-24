import * as THREE from 'three';
import { deriveRigConfig } from './assemblyPhysics.js';
import { soundBrace, soundDriveStrain, soundEmpty, soundWeaponShot, soundWeaponMechanism, soundWeaponReloadPhase, soundFootScrape, soundReload, soundCombatImpact, soundSystemEvent, setBacklotAmbienceActive } from './audio.js';
import { soundFamilyFor, createMotionSoundState, advanceContactMotionSound } from './liveSystemsEvents.js';
import {advanceFootContacts} from './footContactController.js?v=k5r5';
import {groundFootprint} from './groundFootprintEvidence.js?v=k5b4';
import { shotContacts } from './scattergun.js';
import { weaponActionSpreadRadians, advanceChargedTrigger, advanceProjectileTrigger } from './weaponController.js';
import {createReloadCueState,advanceReloadCue} from './reloadMechanism.js';
import { createWeaponStabilizer,advanceWeaponStabilizer,registerWeaponStabilityShot,resetWeaponStabilizer } from './weaponStability.js';
import { resolvePenetratingContacts } from './weaponPenetration.js';
import { shieldImpactLabel } from './frameShielding.js';
import { advanceWeapon, applyRecoil, applyTargetHit, createTargetCondition, createWeaponState, ammoCostCents, reserveReadout, makeRangeTarget, fireWeapon, mirrorTargetCondition, reconcileTargetCondition, restoreTargetPart, shotSpread, startReload, weaponFor } from './combat.js';
import { BY_ID, equipSerial, equipAuxiliary, inspectAssembly, installedPart, remove, SLOTS, equip, generatorMount, setGeneratorMount, } from './components.js';
import { equipmentHas, servicePumpRate, stabilizerRecoilMultiplier } from './equipment.js';
import { createSmokeState, deploySmoke, stepSmoke, smokeObscures } from './tacticalSmoke.js';
import { bodyFollowSteer, Controls } from './controls.js';
import { rebuildQuote, repairQuote, settleSortie, totalRepairQuote } from './economy.js';
import { gestureMetrics } from './inspectionCamera.js';
import { createRigState, physicsYawToViewYaw, stepRig, } from './locomotion.js';
import {mapForContract,contractAtMap,orderedTeamSpawns} from './maps/mapRegistry.js?v=k5q2';
import { createArenaScene } from './scene.js';
import {winningMachines,renderWinnerNameplates} from './winnerTableau.js';
import {createPhysicalEvidenceCard} from './physicalEvidenceInspector.js';
import {storeSurfaceEvents,readSurfaceEvents} from './partServiceJournal.js';
import {queueServiceRecord,flushServiceRecords} from './serviceEventRecorder.js';
import { damageInstalledPart, derateRigConfig, functionalOutput, resetInstalledDamage, restoreFieldServicedDrive, weaponCycleMultiplier, weaponSpreadMultiplier, } from './functionalDamage.js';
import { advancePowerSystem, createPowerSystem, powerConstrainedOutput, registerPowerShot, setActiveWeaponLoad } from './powerDynamics.js';
import { createThermalCombat, coolThermalCombat, cutContact, moduleHeatKey } from './thermalCombat.js';
import { FIELD_SERVICE_SECONDS, advanceFieldService, beginFieldService, cancelFieldService, canFieldService, createFieldServiceState, fieldServiceStationary, serviceableSlots, fieldServiceTarget, cycleFieldServiceTarget, countDisabled, weaponFailureState, weaponIntegrityRatio, weaponMissionKillReason, } from './fieldService.js';
import { driveCondition, repairInstalledPart } from './garage.js';
import { advanceEnemyMotion, createEnemyMotion, withinFiringArc } from './enemyMotion.js';
import { chooseCoverPoint, noteBlockedFire, noteIncomingFire, recentThreatTargetId } from './tacticalAwareness.js';
import { aiWeaponMissionKillReason, aiWeaponRecoveryDirective, aiWeaponRecoveryPosture } from './aiFieldService.js';
import { createWorldModel, observeBattlefield } from './ai/worldModel.js';
import {soundBearing} from './battlefieldPressure.js';
import { shotThreatEvidence,recordShotEvidence,counterFlankOrder,
    recordSubsystemHit,threatenedSubsystem,threatFacingPoint } from './ai/combatIntelligence.js';
import { planTeam } from './ai/teamPlanner.js';
import { assessTargetFireLanes, chooseClearFiringPoint } from './ai/firingLane.js?v=k5s1';
import { planCounterFlankResponses } from './ai/defensiveResponse.js';
import { createStrategicState, evaluateStrategy } from './ai/strategicState.js';
import { createPilotBrain, decidePilot } from './ai/pilotBrain.js';
import { createIntentExecutor, executeIntent } from './ai/intentExecutor.js';
import { createAiTrace, recordAiDecision, formatAiTrace } from './ai/debug.js';
import { prioritizeVisibleTarget, shouldAttemptTacticalShot, tacticalAimSlot } from './ai/adaptiveTactics.js';
import { aiWeaponEngagement } from './ai/weaponTactics.js';
import { createRoundClock,advanceRoundClock,formatRoundClock } from './roundClock.js';
import { createFaultSupportState, faultSupportForActor, resetFaultSupportState, updateFaultSupportAssignments } from './faultSupport.js';
import { damagePosture } from './damageBehavior.js';
import {damageLabCondition} from './woundedMachine.js';
import { advanceSortieObjective, createSortieObjective, objectivePresentation, objectiveStatusText } from './sortieObjectives.js';
import { clearMachineSave, loadMachine, storeMachine } from './persistence.js';
import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileMissionKillReason, hostileOutput, hostileSpread, } from './hostileRig.js';
import { contractById } from './contracts.js';
import { applyEnemyCrewPaint, applyFriendlyCrewPaint } from './crewLivery.js';
import { FRIENDLY_SUPPORTS, HOSTILE_SUPPORT_SPAWNS, FRIENDLY_TEAM, HOSTILE_TEAM, chooseSquadTarget, hostileSupportRecipes, squadCounts, squadOutcome } from './squadBattle.js';
import { encounterWingArms, weaponDoctrine, fitEncounterWeapon } from './campaignArsenal.js';
import { damageWreckIntegrity, shoveWreck, wreckCollisionRadius } from './wreckPhysics.js';
import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from './combatPresentation.js';
import { createBoutLedger, recordBoutHit, recordMissionKill, scoreBout } from './boutScoring.js';
import { buildWreckManifests, createSalvageDraft, SCRAPYARD_CHARTER, wreckPreservation } from './salvageDraft.js';
import { clearBoutResult, publishBoutResult } from './boutSession.js';
import { recordCombatMatch, recordCombatRound } from './combatRecords.js';
import { resetDamageFate } from './damageFate.js';
import { partCreditValue } from './partEconomy.js';
import { createPartCard, createPartDetail, installPartGridStyles } from './partGridUI.js';
import { createModuleIcon } from './moduleIcons.js';
import { loadStable, storeStable, rigById, serialOwner } from './stable.js';
import { changeInactiveBay, serviceInactiveBay, setInactiveBayGeneratorMount, bayAssembly } from './garageBay.js';
import { buyCounterLot } from './usedPartsCounter.js';
import { loadCampaign } from './campaign.js';
import {TEST_YARD,readTestYardAssembly,storeTestYardAssembly,clearTestYardAssembly,createTestYardPanel} from './testYard.js';
const testYard=/(?:^|\/)test-yard\.html$/.test(window.location.pathname);
if(testYard)document.body.classList.add('test-yard');
let yardMode='static';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.12;
const labels = {
    structure: 'STRUCTURE', mobility: 'MOBILITY', power: 'POWER',
    command: 'COMMAND', combat: 'COMBAT',
};
// Loading takes place before either the renderer or the damage/garage UI exists.
// An invalid or inaccessible save never prevents a fresh rig from opening.
let saveStorage = null;
try {
    saveStorage = testYard ? null : window.localStorage;
}
catch { /* Safari storage may be unavailable. */ }
const yardAssembly=testYard?readTestYardAssembly():null;
const loadedMachine=testYard?{
    ...loadMachine(null),assembly:yardAssembly,
    playerCondition:createTargetCondition(yardAssembly,true),status:'yard',
}:loadMachine(saveStorage);
const assembly = loadedMachine.assembly;
/** Transient material projection of the existing per-serial service ledger.
 * The rollback-safe v8 machine save remains untouched: no new inventory keys,
 * economics, or simulation wear are introduced here.
 */
try { assembly.partHistory = loadStable(saveStorage).stable.partHistory; }
catch { assembly.partHistory = {}; }

const damage = loadedMachine.damage;
const economy = loadedMachine.economy;
// A separately owned hostile mech built with the same module definitions.
const targetAssembly = makeRangeTarget();
// Contract defines the whole opponent squad's signature livery; lead uses DEFAULT.
applyEnemyCrewPaint(targetAssembly,targetAssembly.contractId,0);
const activeContract = testYard ? {...contractById(targetAssembly.contractId),trainingGround:true} : contractById(targetAssembly.contractId);
const selectedMap=mapForContract(activeContract);
const selectedWorld=selectedMap.world;
const mappedContract=contractAtMap(activeContract,selectedMap);
const friendlySpawns=orderedTeamSpawns(selectedMap,'friendly');
const hostileSpawns=orderedTeamSpawns(selectedMap,'hostile');
const playerSpawn=friendlySpawns[0],hostileSpawn=hostileSpawns[0];
let targetCondition = createTargetCondition(targetAssembly);
let sortieObjective = createSortieObjective(mappedContract);
// Incoming fire uses the same localized armor/integrity representation, seeded from the owned player's current condition.
const playerCondition = loadedMachine.playerCondition;
let weaponSpec = weaponFor(assembly);
let weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
const hostileWeaponSpec = weaponFor(targetAssembly);
let hostileWeaponState = hostileWeaponSpec ? createWeaponState(hostileWeaponSpec) : null;
const leadBehavior = weaponDoctrine(activeContract.behavior,hostileWeaponSpec.id);
let hostileController = createHostileController(.45,leadBehavior);
let hostileMotion = createEnemyMotion(leadBehavior);
let hostileRig = createRigState(hostileSpawn);
const hostileBaseConfig = deriveRigConfig(targetAssembly);
if (!hostileBaseConfig)
    throw new Error('Hostile training assembly is not fieldable.');
const hostileDriveDamage = { drives: {} };
let playerCombatActive = true;
const primaryEnemyActor = {
    id: 'enemy-0', team: HOSTILE_TEAM, label: targetAssembly.name,
    assembly: targetAssembly, condition: targetCondition, rig: hostileRig,
    weaponSpec: hostileWeaponSpec, weaponState: hostileWeaponState,
    controller: hostileController, motion: hostileMotion,
    baseConfig: hostileBaseConfig, driveDamage: hostileDriveDamage,
    stabilizer:createWeaponStabilizer(),
    powerSystem: createPowerSystem(targetAssembly),
    behavior: leadBehavior,
    spawn: hostileSpawn, active: true, targetId: 'player', killReason: null,
    fieldService: createFieldServiceState(servicePumpRate(targetAssembly)),
    teamIntent: null, brain: createPilotBrain(), executor: createIntentExecutor(),
    combatMemory:{},lastSurvivalCoverCheck:-Infinity,survivalCover:null,
    wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,
};
function makeSupportActor(id, team, contractId, spawn, label = null, rosterIndex=1, combatId=null) {
    const actorAssembly = makeRangeTarget(contractId);
    if (combatId) fitEncounterWeapon(actorAssembly,combatId);
    if(team===FRIENDLY_TEAM)
        applyFriendlyCrewPaint(actorAssembly,saveStorage,assembly,rosterIndex);
    else
        applyEnemyCrewPaint(actorAssembly,targetAssembly.contractId,rosterIndex);
    if (label) actorAssembly.name = label;
    const behavior = team===HOSTILE_TEAM
        ? weaponDoctrine(contractById(contractId).behavior,combatId ?? weaponFor(actorAssembly)?.id)
        : contractById(contractId).behavior;
    const actorCondition = createTargetCondition(actorAssembly);
    const actorWeaponSpec = weaponFor(actorAssembly);
    const baseConfig = deriveRigConfig(actorAssembly);
    if (!baseConfig || !actorWeaponSpec)
        throw new Error(`Squad support ${id} is not fieldable.`);
    return {
        id, team, label: label ?? actorAssembly.name, assembly: actorAssembly,
        condition: actorCondition, rig: createRigState(spawn),
        weaponSpec: actorWeaponSpec, weaponState: createWeaponState(actorWeaponSpec),
        controller: createHostileController(team === FRIENDLY_TEAM ? .38 : .52, behavior),
        motion: createEnemyMotion(behavior), baseConfig, driveDamage: { drives: {} },
        stabilizer:createWeaponStabilizer(),
        powerSystem: createPowerSystem(actorAssembly),
        behavior, spawn, active: true, targetId: null, killReason: null,
        fieldService: createFieldServiceState(servicePumpRate(actorAssembly)),
        teamIntent: null, brain: createPilotBrain(), executor: createIntentExecutor(),
        combatMemory:{},lastSurvivalCoverCheck:-Infinity,survivalCover:null,
        wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,
    };
}
const friendlySupportActors = FRIENDLY_SUPPORTS.map((recipe,index) =>
    makeSupportActor(recipe.id,FRIENDLY_TEAM,recipe.contractId,
        friendlySpawns[index+1],recipe.label,index+1));
const hostileSupportActors = hostileSupportRecipes(targetAssembly.contractId).map((contractId, index) => {
    const spawn = hostileSpawns[index+1];
    const arm = encounterWingArms(targetAssembly.contractId)[index];
    return makeSupportActor(HOSTILE_SUPPORT_SPAWNS[index].id, HOSTILE_TEAM,
        contractId, spawn, null, index+1, arm);
});
const supportActors = [...friendlySupportActors, ...hostileSupportActors];
const aiActors = [primaryEnemyActor, ...supportActors];
const friendlyTeamTotal = 1 + friendlySupportActors.length;
const hostileTeamTotal = 1 + hostileSupportActors.length;
const boutRoster = () => [
    { id: 'player', team: FRIENDLY_TEAM, label: 'YOU' },
    ...aiActors.map(actor => ({ id: actor.id, team: actor.team, label: actor.label })),
];
let boutLedger = createBoutLedger(boutRoster());
const partSnapshot = part => part ? {
    armor: part.armor, maxArmor: part.maxArmor,
    integrity: part.integrity, maxIntegrity: part.maxIntegrity,
    destruction: part.destruction ?? 0, destroyed: !!part.destroyed,
} : null;
/** Actual outgoing weapon impulse, actual recipient mass and brace state.
 * The renderer can display the resulting shock, but cannot change hit physics.
 * Shotgun pellets share the weapon impulse rather than each inventing a blast.
 */
function physicalHitPresentation(hit,attacker,target){
    const gun=attacker?.weaponSpec ?? weaponSpec;
    const impulseNs=(gun?.recoilImpulseNs??0)/Math.max(1,gun?.pellets??1);
    return {...hit,impactImpulseNs:impulseNs,
        impactMassKg:target?.baseConfig?.massKg??rigConfig?.massKg??2400,
        impactBrace:target?.rig?.brace??rig.brace??0};
}
function scoreHit(attackerId, victimId, slot, before, hit, after) {
    if (!before || !after) return;
    const scoredHit = { ...hit, internalDamage: Math.max(0, before.integrity - after.integrity) };
    recordBoutHit(boutLedger, { attackerId, victimId, slot, before, after, hit: scoredHit, time: performance.now() / 1000 });
}
function syncOwnedPartFate(slot) {
    const fitted = installedPart(assembly, slot);
    const part = playerCondition.parts[slot];
    if (fitted && part) fitted.instance.destroyed = !!part.destroyed;
}
let testEnded = false;
let testEndReason = null;
let sortieRoundsFired = 0;
let sortieAmmoCostCents = 0;
let sortieProjectiles = 0;
let sortieConfirmedContacts = 0;
let fieldService = createFieldServiceState(servicePumpRate(assembly));
let smokeState=createSmokeState();
const faultSupportState = createFaultSupportState();
let lastPlayerScreenId = null;
let servicePointerId = null;
let serviceKeyHeld = false;
// All six rigs share the same physical yard. Dynamic rig boxes collide in stepRig,
// but enemyMotion ignores them when planning long-lived obstacle detours.
const movingObstacleAt = (id, spawn, radius = 1) => ({
    id, dynamic: true, minX: spawn.x - radius, maxX: spawn.x + radius,
    minZ: spawn.z - radius, maxZ: spawn.z + radius,
});
const pilotObstacle = movingObstacleAt('player', playerSpawn);
const actorObstacles = new Map(aiActors.map(actor => [actor.id, movingObstacleAt(actor.id, actor.spawn)]));
function placeMovingObstacle(box, x, z, radius) {
    box.minX = x - radius; box.maxX = x + radius;
    box.minZ = z - radius; box.maxZ = z + radius;
}
function syncMovingObstacles() {
    placeMovingObstacle(pilotObstacle, rig.x, rig.z, effectiveConfig?.collisionRadiusM ?? 1);
    for (const actor of aiActors) {
        const baseRadius = actor.baseConfig?.collisionRadiusM ?? 1;
        const radius = actor.active ? baseRadius : wreckCollisionRadius(baseRadius, actor.wreckAge, actor.wreckCleared);
        placeMovingObstacle(actorObstacles.get(actor.id), actor.rig.x, actor.rig.z, radius);
    }
}
function combatWorldFor(actorId) {
    const dynamic = [];
    if (actorId !== 'player') dynamic.push(pilotObstacle);
    for (const [id, obstacle] of actorObstacles) if (id !== actorId) dynamic.push(obstacle);
    return { ...selectedWorld, obstacles: [...selectedWorld.obstacles, ...dynamic] };
}
function shoveDisabledWrecks(moverState, moverConfig) {
    const moverRadius = moverConfig?.collisionRadiusM ?? 1;
    for (const actor of aiActors) {
        if (actor.active) continue;
        const wreckRadius = wreckCollisionRadius(actor.baseConfig?.collisionRadiusM ?? 1, actor.wreckAge, actor.wreckCleared);
        const shove = shoveWreck(moverState, actor.rig, moverRadius, wreckRadius, FIXED_DT);
        if (!shove) continue;
        actor.rig.x = THREE.MathUtils.clamp(actor.rig.x + shove.dx, selectedWorld.minX + wreckRadius, selectedWorld.maxX - wreckRadius);
        actor.rig.z = THREE.MathUtils.clamp(actor.rig.z + shove.dz, selectedWorld.minZ + wreckRadius, selectedWorld.maxZ - wreckRadius);
        arena.updateCombatantRig(actor.id, actor.rig);
    }
}
function aiLocomotionConfig(actor) {
    const mobility = installedPart(actor.assembly, 'mobility');
    if (mobility) {
        const part=actor.condition.parts.mobility;
        const health=Math.max(0,part.integrity/Math.max(1,part.maxIntegrity));
        const serial=mobility.instance.serial;
        const previous=actor.driveDamage.drives[serial];
        const mean=previous?(previous.left+previous.right)/2:health;
        if(!previous) actor.driveDamage.drives[serial]={left:health,right:health};
        else if(Math.abs(mean-health)>.0001){
            // Keep the relative damaged side after a new internal hit or
            // service. The existing average module integrity is authoritative.
            const offset=(previous.left-previous.right)/2;
            const allowed=Math.min(health,1-health,Math.abs(offset));
            const skew=Math.sign(offset)*allowed;
            actor.driveDamage.drives[serial]={left:health+skew,right:health-skew};
        }
    }
    return derateRigConfig(actor.baseConfig,
        powerConstrainedOutput(functionalOutput(actor.assembly, actor.driveDamage), actor.powerSystem));
}
function hostileLocomotionConfig() { return aiLocomotionConfig(primaryEnemyActor); }
function primeAiWeaponRecovery(actor, threatRig) {
    const awareness = actor?.motion?.awareness;
    if (!actor || !awareness) return;
    awareness.underFireSeconds = Math.max(awareness.underFireSeconds ?? 0, 4.2);
    awareness.urgency = Math.max(awareness.urgency ?? 0, 2.35);
    if (threatRig) awareness.lastThreat = { x: threatRig.x, z: threatRig.z };
    const config = aiLocomotionConfig(actor);
    const cover = threatRig ? chooseCoverPoint(
        actor.rig, threatRig, combatWorldFor(actor.id), config.collisionRadiusM,
        actor.behavior, actor.motion.lastSide, threatRig) : null;
    if (cover) {
        awareness.coverTarget = cover.point;
        awareness.coverId = cover.coverId;
        awareness.coverHold = 0;
    }
    actor.teamPlanLeft = 0;
}
/** A new disabled subsystem creates an urgent recovery decision, never
 * erases authentic destruction overflow or invents a second HP pool. */
function noteAiModuleDisabled(actor,slot,threatRig) {
    actor.teamPlanLeft=0;
    if(actor.motion?.awareness)actor.motion.awareness.underFireSeconds=Math.max(1,actor.motion.awareness.underFireSeconds??0);
    primeAiWeaponRecovery(actor,threatRig);
}

function interruptAiFieldService(actor) {
    if (!actor?.fieldService?.held) return;
    cancelFieldService(actor.fieldService);
    actor.teamPlanLeft = 0;
}
function handleAiFieldServiceCompleted(actor, serviceStep) {
    mirrorTargetCondition(actor.assembly, actor.condition);
    if(serviceStep?.slot === 'combat') actor.weaponState.cooldown=Math.max(actor.weaponState.cooldown,.55);
    actor.controller.triggerLeft = Math.max(actor.controller.triggerLeft ?? 0, .85);
    actor.teamPlanLeft = 0;
    if (actor.motion?.awareness) {
        actor.motion.awareness.underFireSeconds *= .35;
        actor.motion.awareness.coverTarget = null;
        actor.motion.awareness.coverId = null;
        actor.motion.awareness.coverHold = 0;
    }
    arena.updateCombatantDamage(actor.id, actor.condition);
    if (actor.id === 'enemy-0') {
        mirrorTargetCondition(targetAssembly, targetCondition);
        renderTarget();
    }
}
let inspection = inspectAssembly(assembly);
let rigConfig = deriveRigConfig(assembly);
if (!rigConfig)
    throw new Error('Starting test rig must be fieldable.');
let playerPower = createPowerSystem(assembly);
let staticOutput = functionalOutput(assembly, damage);
let output = powerConstrainedOutput(staticOutput, playerPower);
let effectiveConfig = derateRigConfig(rigConfig, output);
function syncOwnedWeaponCondition(addWear = false) {
    const installed = installedPart(assembly, 'combat');
    const part = playerCondition.parts.combat;
    if (!installed || !part)
        return;
    installed.instance.condition = weaponIntegrityRatio(playerCondition);
    installed.instance.destroyed = !!part.destroyed;
    if (addWear)
        installed.instance.wear = Math.min(1, (Number(installed.instance.wear) || 0) + .08);
}
function currentSortieFailureReason() {
    return disabledReason(playerCondition, functionalOutput(assembly, damage)) ??
        weaponMissionKillReason(playerCondition, fieldService);
}
function deploymentBlockReason() {
    const current = functionalOutput(assembly, damage);
    return disabledReason(playerCondition, current) ?? (!current.weaponOperational ? 'WEAPON OFFLINE' : null);
}
let playerMissionKillReason = null;
function updateFunctionalStatus() {
    staticOutput = functionalOutput(assembly, damage);
    output = powerConstrainedOutput(staticOutput, playerPower);
    if (rigConfig)
        effectiveConfig = derateRigConfig(rigConfig, output);
    const faults = [];
    if (output.left < .99)
        faults.push(`L DRIVE ${Math.round(output.left * 100)}%`);
    if (output.right < .99)
        faults.push(`R DRIVE ${Math.round(output.right * 100)}%`);
    if (output.power < .99)
        faults.push(`GENERATOR ${Math.round(output.power * 100)}%`);
    if (playerPower.brownout)
        faults.push(`BUS ${Math.round(playerPower.busRatio * 100)}%`);
    const weaponFailure = weaponFailureState(playerCondition, fieldService);
    if (weaponFailure === 'faulted')
        faults.push('WEAPON DISABLED · FIELD SERVICE');
    else if (weaponFailure === 'destroyed' || weaponFailure === 'unrecoverable')
        faults.push('WEAPON LOST');
    else if (output.weapon < .99)
        faults.push(`WEAPON ${Math.round(output.weapon * 100)}%`);
    if(countDisabled(playerCondition))faults.unshift(`DISABLED ${countDisabled(playerCondition)}/3`);
    // A disabled pilot has exactly one persistent priority alarm. Ordinary
    // subsystem telemetry cannot overwrite the mission-kill reason.
    if (!playerCombatActive && playerMissionKillReason) {
        faultStrip.textContent = 'RIG DISABLED · ' + playerMissionKillReason;
        faultStrip.classList.add('faulted');
        faultStrip.classList.remove('nominal');
    } else {
        faultStrip.textContent = faults.length ? `⚠ ${faults.join(' · ')}` : 'RIG NOMINAL';
        faultStrip.classList.toggle('faulted', faults.length > 0);
        faultStrip.classList.toggle('nominal', faults.length === 0);
    }
    renderPlayerDamageHUD();
}
function required(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`Missing required element: ${selector}`);
    return element;
}
const mount = required('#game');
const speedEl = required('#speed');
const yawRateEl = required('#yaw-rate');
const loadBar = required('#load-bar');
const motionEl = required('#motion-direction');
const bracePedal = required('#brake');
const lookHeadingEl = required('#look-heading');
const devToggle = required('#dev-toggle');
const devPanel = required('#dev-panel');
const devReadout = required('#dev-readout');
// One title-derived build label: the DEV drawer must never retain an old milestone.
const devVersion = document.querySelector('#dev-version');
if (devVersion) devVersion.textContent =
    (document.title.split(' — ')[1] ?? 'BUILD UNKNOWN') +
    ' · VENUE ' + selectedMap.name + ' / v' + selectedMap.version;
const resetRig = required('#reset-rig');
const wipeSave = required('#wipe-save');
const toggleColliders = required('#toggle-colliders');
const resolutionToggle = required('#resolution-toggle');
const assemblyToggle = required('#assembly-toggle');
const inspectionPanel = required('#inspection-panel');
const partInfo = required('#part-info');
const partList = required('#part-list');
const checkList = required('#field-checks');
const fieldStatus = required('#field-status');
const assemblyMass = required('#assembly-mass');
const powerStatus = required('#power-status');
const creditBalance = required('#credit-balance');
const adapterStatus = required('#adapter-status');
const orbitHelp = required('#orbit-help');
const resetOrbitButton = required('#inspect-reset');
const centerView = required('#center-view');
const appView = required('#app-view');
const appSheet = required('#app-sheet');
const appMessage = required('#app-message');
const debriefSheet = required('#sortie-debrief');
const debriefTitle = required('#debrief-title');
const debriefLines = required('#debrief-lines');
const debriefGarage = required('#debrief-garage');
const sortieOutro = required('#sortie-outro');
const sortieOutroTitle = required('#sortie-outro-title');
const sortieOutroReason = required('#sortie-outro-reason');
const winnerTableau = required('#winner-tableau');
const fireButton = required('#fire');
const reloadButton = required('#reload');
const smokeButton=document.createElement('button');
smokeButton.id='utility-smoke';smokeButton.type='button';
smokeButton.className='equipment-smoke-btn';
smokeButton.setAttribute('aria-label','Deploy Cinder smoke screen');
smokeButton.textContent='SMOKE ×2';
reloadButton.parentElement?.append(smokeButton);
const weaponLabel = required('#weapon-label');
const ammoReadout = required('#ammo-count');
const shotReport = required('#shot-report');
const targetToggle = required('#target-toggle');
const targetPanel = required('#target-panel');
const targetReadout = required('#target-readout');
const resetTarget = required('#reset-target');
const rangeCrosshair = required('#center-crosshair');
rangeCrosshair.textContent='';
let shotSafetyTimer=0;
const faultStrip = required('#fault-strip');
const teamStatus = required('#team-status');
const roundClockHud=document.createElement('div');
roundClockHud.id='round-clock-hud';
roundClockHud.setAttribute('role','timer');
roundClockHud.setAttribute('aria-label','Round time remaining');
teamStatus.insertAdjacentElement('afterend',roundClockHud);
const objectiveStatus = required('#objective-status');
const playerDamageHud = required('#player-damage-hud');
const hitConfirm = required('#hit-confirm');
const playerHitFlash = required('#player-hit-flash');
const playerDamageSegments = new Map([...playerDamageHud.querySelectorAll('[data-system]')].map(element => [element.dataset.system, element]));
let hitConfirmTimer = null;
let playerHitTimer = null;
let lastCoverAudit = '—';
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.className = 'game-canvas';
renderer.domElement.setAttribute('aria-label', '3D warehouse and mech');
renderer.domElement.style.touchAction = 'none';
renderer.domElement.style.imageRendering = 'pixelated';
mount.appendChild(renderer.domElement);
const hudRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
hudRenderer.outputColorSpace = THREE.SRGBColorSpace;
hudRenderer.setClearColor(0x000000, 0);
hudRenderer.domElement.className = 'hud-canvas';
hudRenderer.domElement.setAttribute('aria-hidden', 'true');
hudRenderer.domElement.style.pointerEvents = 'none';
mount.appendChild(hudRenderer.domElement);
const arena = createArenaScene(assembly, targetAssembly,selectedMap);
// Load scar positions for only the mounted serialized parts; older saves remain
// valid without a history database. No artwork is stored in the machine save.
Promise.all([...new Set(Object.values(assembly.installed||{}))].map(readSurfaceEvents))
    .then(perSerial=>arena.restoreSurfaceMarks(perSerial.flat()))
    .catch(error=>console.warn('SURFACE HISTORY READ UNAVAILABLE:',error?.message||error));
function preserveSuccessfulService(serial,mode,eventKey) {
    if(!serial||!eventKey)return;
    const eventId='service-'+eventKey.replace(/[^a-zA-Z0-9:-]/g,'').slice(0,112);
    if(queueServiceRecord(saveStorage,{serial,mode,eventId}))
      flushServiceRecords(saveStorage,event=>arena.restoreSurfaceMarks([event]))
        .catch(error=>console.warn('SERVICE ARCHIVE RETAINED FOR RETRY',error?.message||error));
}
flushServiceRecords(saveStorage,event=>arena.restoreSurfaceMarks([event]))
    .catch(error=>console.warn('SERVICE HISTORY RESTORE DEFERRED',error?.message||error));
for (const actor of supportActors)
    arena.addCombatant(actor.id, actor.assembly, actor.team, actor.spawn);
arena.updateTargetDamage(targetCondition);
for (const actor of supportActors)
    arena.updateCombatantDamage(actor.id, actor.condition);
arena.updateObjectivePresentation?.(objectivePresentation(sortieObjective));
let rig = createRigState(playerSpawn);
const playerMount=createWeaponStabilizer();
let footScraping = false, drivetrainLoaded = false, footingSoundCooldown = 0;
// The authoritative weapon reload timer is the sole cue clock. Use one
// independent state per weapon object; switching bays cannot revive old cues.
const reloadCueStates=new WeakMap();
function soundActualReloadPhases(state,spec,local=false,sourceRig=null){
    if(!state||!spec)return;
    let cue=reloadCueStates.get(state);
    if(!cue){cue=createReloadCueState();reloadCueStates.set(state,cue);}
    const stage=advanceReloadCue(cue,state.reloadLeft,spec.reloadSeconds,spec.id);
    if(!stage)return;
    const distance=local?0:Math.hypot((sourceRig?.x??0)-rig.x,
        (sourceRig?.z??0)-rig.z);
    if(!local&&distance>21)return;
    soundWeaponReloadPhase(spec.id,stage,{
        cockpit:local,distance,
        pan:local?0:soundBearing(sourceRig,rig,rig.yaw),
    });
}
// Sound cadence is isolated from the physics integrator. Do not mutate drive,
// foot contacts or any persistent machine state to produce these events.
const movementSoundStates=new WeakMap();
function emitMachineMotionSound(machineAssembly,machineRig,dt,local=false,driveHealth=null){
    const distance=local?0:Math.hypot(machineRig.x-rig.x,machineRig.z-rig.z);
    // All rigs advance their visible gait whether or not they are audible.
    // Only emission is distance culled; never freeze remote animation.
    let acoustic=movementSoundStates.get(machineRig);
    if(!acoustic){acoustic=createMotionSoundState();movementSoundStates.set(machineRig,acoustic);}
    const familyId=installedPart(machineAssembly,'mobility')?.definition.id??'legs-yard';
    const family=soundFamilyFor(familyId);
    const speed=Math.hypot(machineRig.vx,machineRig.vz);
    acoustic.contactFeet=advanceFootContacts(acoustic.contactFeet,machineRig,familyId,dt,{
        leftHealth:driveHealth?.left??1,rightHealth:driveHealth?.right??1,
        disabled:(driveHealth?.left??1)<=0&&(driveHealth?.right??1)<=0,
    });
    if(local||distance<24){
        const mark=groundFootprint(acoustic.contactFeet,machineRig,familyId);
        if(mark)arena.recordFootprint(mark);
    }
    const events=advanceContactMotionSound(acoustic,family,speed,dt,acoustic.contactFeet);
    if(!local&&distance>17)return acoustic;
    for(const id of events) {
        const idle=id==='engine'&&speed<.65;
        if(!local&&id==='engine'&&distance>9)continue;
        // Reduce simultaneous machinery. Local footfalls still communicate
        // mass; other mechs are an acoustic background, not five co-pilots.
        const footWeight=id===family.id?(.55+.45*(acoustic.contactFeet?.lastLandingStrength??.4)):1;
        const driveEffort=id==='engine'?(.8+.3*(acoustic.contactFeet?.actuatorEffort??0)):1;
        const strength=(id==='engine'?(local?(idle?.13:.20):.12)
            :id==='hydraulics'?(local?.20:.10):(local?.66:.30))*footWeight*driveEffort;
        soundSystemEvent(id,{variant:id==='engine'?0:acoustic.hydraulicStep%3,
            distance,cockpit:local,strength});
    }
    return acoustic;
}
const controls = new Controls(required('#drive-zone'), required('#drive-knob'), required('#look-zone'), required('#brake'));
let inspecting = false;
let yardUI = null;
// DEV-only external animation preview. Uses the real current garage assembly,
// never drives live physics, expenses, weapon state, or persistent ownership.
const animationPreviewButton=required('#animation-preview-toggle');
const animationPreviewMode=required('#animation-preview-mode');
const animationPreviewSpeed=required('#animation-preview-speed');
let animationPreviewOn=false;
function syncAnimationPreview(){
    const mode=animationPreviewOn?animationPreviewMode.value:'off';
    arena.setAnimationPreview(mode,Number(animationPreviewSpeed.value));
    animationPreviewButton.textContent=animationPreviewOn?'■ STOP ANIMATION':'▶ ANIMATION LAB';
    animationPreviewButton.setAttribute('aria-pressed',String(animationPreviewOn));
}
animationPreviewButton.addEventListener('click',()=>{
    if(!inspecting){
        showStatus('OPEN GARAGE TO AUDITION ARTICULATION');
        return;
    }
    animationPreviewOn=!animationPreviewOn;
    syncAnimationPreview();
});
animationPreviewMode.addEventListener('change',()=>{
    if(animationPreviewOn)syncAnimationPreview();
});
animationPreviewSpeed.addEventListener('input',()=>{
    if(animationPreviewOn)syncAnimationPreview();
});
let aiMemory=createWorldModel(), aiSnapshot=null, aiPlans={}, aiClock=0,
    aiPlanCooldown=0,aiPerceptionCooldown=0;
let strategicMemory=createStrategicState();
let squadCounterOrders={friendly:{},hostile:{}};
let aiAssaultMemory={friendly:{},hostile:{}};
let aiCorridorMemory={friendly:{},hostile:{}};
let roundClock=createRoundClock();
let lastRoundClockText='';
const aiTrace=createAiTrace();
let selectedPart = null;
let statusTimeout = null;
const thermalCombat=createThermalCombat();
let fireHeld = false;
let firePointerId = null;
let fireLastX = 0;
let fireLastY = 0;
let fireKeyHeld = false;
let recoilFlash = 0;
let reportFade = 0;
let shotsFired = 0;
let lastHit = 'NO SHOTS YET';
let targetPanelRefresh = 0;
let sortiePhase = 'garage';
const SORTIE_BREATHER_SECONDS=3;
const SORTIE_SHOWCASE_SECONDS=5;
let sortieOutroRemaining = 0;
let pendingDebrief = null;
let pendingWinnerPresentation = null;
const selectionButtons = new Map();
let inventoryPreviewSerial = null;
installPartGridStyles();
function actorById(id) {
    if (id === 'player')
        return { id: 'player', team: FRIENDLY_TEAM, label: 'YOU', rig, condition: playerCondition, assembly, active: playerCombatActive, fieldService };
    return aiActors.find(actor => actor.id === id) ?? null;
}
function battleParticipants() {
    return [actorById('player'), ...aiActors];
}
function liveOpponents(actor) {
    if (actor.team === FRIENDLY_TEAM)
        return aiActors.filter(candidate => candidate.team === HOSTILE_TEAM && candidate.active);
    const candidates = friendlySupportActors.filter(candidate => candidate.active);
    if (playerCombatActive) candidates.unshift(actorById('player'));
    return candidates;
}
function resolveActorTarget(actor) {
    // Only currently observed contacts can be fired on. Last-seen reports
    // remain search waypoints, not omniscient enemy coordinates.
    const contacts=aiSnapshot?.knowledge?.[actor.team]?.contacts??[];
    const visible=new Set(contacts.filter(c=>c.visible).map(c=>c.id));
    const candidates=liveOpponents(actor).filter(c=>visible.has(c.id));
    const threatId=recentThreatTargetId(actor.motion);
    const candidate=prioritizeVisibleTarget(actor,candidates,aiSnapshot,
        squadCounterOrders[actor.team]?.[actor.id] ??
            aiPlans[actor.team]?.orders?.[actor.id]??null,actor.targetId,threatId);
    actor.targetId=candidate?.id??null;
    return candidate??null;
}
const dominationHud=document.createElement('div');
dominationHud.id='domination-hud';
dominationHud.setAttribute('role','status');
dominationHud.setAttribute('aria-label','Domination score and zones');
objectiveStatus.insertAdjacentElement('afterend',dominationHud);
// A single, state-driven HUD owns score, objective symbols, capture direction,
// and local contested state. The round series pill nests into this HUD below.
const objectiveBand=document.createElement('div');objectiveBand.className='k4p-band';
const ourScore=document.createElement('strong');ourScore.className='k4p-score friendly';
const zones=document.createElement('div');zones.className='k4p-zones';
const theirScore=document.createElement('strong');theirScore.className='k4p-score hostile';
const localCapture=document.createElement('div');localCapture.className='k4p-local hidden';
const zoneElements=new Map();
objectiveBand.append(ourScore,zones,theirScore);
dominationHud.append(objectiveBand,localCapture);
function ensureZone(id){
    if(zoneElements.has(id))return zoneElements.get(id);
    const card=document.createElement('div');card.className='k4p-zone';
    const letter=document.createElement('strong');letter.textContent=id;
    const meter=document.createElement('div');meter.className='k4p-meter';
    const fill=document.createElement('i');meter.append(fill);
    const who=document.createElement('small');
    card.append(letter,meter,who);zones.append(card);
    const zone={card,letter,fill,who};zoneElements.set(id,zone);
    return zone;
}
function renderObjectiveStatus() {
    const text = objectiveStatusText(sortieObjective).replace(/^OBJ\\s*·\\s*/,'◆ ').replace('BREAK HOSTILE TEAM','BREAK FOES');
    if (objectiveStatus.textContent !== text) objectiveStatus.textContent = text;
    objectiveStatus.classList.toggle('contested', !!sortieObjective?.contested);
    const dom=sortieObjective?.domination;
    const domActive=sortieObjective?.type==='domination'&&!inspecting;
    dominationHud.classList.toggle('hidden',!domActive);
    document.body.classList.toggle('domination-active',!!domActive);
    // Only one top-of-viewport status system may be visible at a time.
    const matchHud=document.getElementById('bo3-combat-hud');
    if(matchHud){
        if(domActive && matchHud.parentElement!==dominationHud)dominationHud.append(matchHud);
        else if(!domActive && matchHud.parentElement===dominationHud)document.body.append(matchHud);
    }
    if(domActive && dom){
        ourScore.textContent=Math.floor(sortieObjective.friendlyProgress);
        theirScore.textContent=Math.floor(sortieObjective.hostileProgress);
        ourScore.title='Friendly · '+Math.floor(sortieObjective.friendlyProgress)+' of '+dom.scoreToWin;
        theirScore.title='Hostile · '+Math.floor(sortieObjective.hostileProgress)+' of '+dom.scoreToWin;
        const activeIds=new Set();
        let local=null;
        for(const point of dom.points){
            const widget=ensureZone(point.id);activeIds.add(point.id);
            const {card,fill,who}=widget;
            const owner=point.owner||'neutral';
            const moving=point.contested?'contested':
                point.friendly>0&&point.owner!=='friendly'?'friendly':
                point.hostile>0&&point.owner!=='hostile'?'hostile':'idle';
            card.dataset.owner=owner;card.dataset.capture=moving;
            card.classList.toggle('contested',!!point.contested);
            const progress=Math.round(Math.min(1,Math.abs(point.influence))*100);
            fill.style.width=progress+'%';
            who.textContent=point.contested?'!':moving==='friendly'?'↑'+point.friendly:
                moving==='hostile'?'↓'+point.hostile:'';
            card.title=point.id+' · '+(point.contested?'CONTESTED':
                owner==='friendly'?'FRIENDLY CONTROL':
                owner==='hostile'?'HOSTILE CONTROL':'NEUTRAL')+
                ' · '+(point.friendly||0)+' friendly, '+(point.hostile||0)+' hostile · '+progress+'%';
            card.setAttribute('aria-label',card.title);
            if(playerCombatActive && Math.hypot(rig.x-point.x,rig.z-point.z)<=sortieObjective.radius)
                local=point;
        }
        for(const [id,item]of zoneElements)if(!activeIds.has(id)){
            item.card.remove();zoneElements.delete(id);
        }
        if(local){
            const pct=Math.round(Math.abs(local.influence)*100);
            localCapture.textContent=local.contested?local.id+' CONTESTED':
                local.friendly>0&&local.owner!=='friendly'?'CAPTURING '+local.id+' · '+pct+'%':
                local.hostile>0?'DEFEND '+local.id:'DEFEND '+local.id;
            localCapture.classList.remove('hidden');
            localCapture.classList.toggle('contested',!!local.contested);
        }else{localCapture.classList.add('hidden');localCapture.textContent='';}
        dominationHud.setAttribute('aria-label','Friendly '+ourScore.textContent+
            ', hostile '+theirScore.textContent+'; '+dom.points.map(p=>p.id+' '+
            (p.contested?'contested':p.owner||'neutral')).join(', '));
    }
    arena.updateObjectivePresentation?.(objectivePresentation(sortieObjective));
}
function renderRoundClock(){
    const label=formatRoundClock(roundClock);
    if(label===lastRoundClockText)return;
    lastRoundClockText=label;roundClockHud.textContent=label;
    roundClockHud.classList.toggle('overtime',!!roundClock.overtime);
    roundClockHud.classList.toggle('urgent',!!roundClock.overtime||
        roundClock.limitSeconds-roundClock.elapsed<30);
}
function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    const screener = friendlySupportActors.find(actor => faultSupportForActor(faultSupportState, actor.id)?.casualtyId === 'player');
    const supportCue = screener ? ` · ${screener.label} COVERING` : '';
    teamStatus.textContent = `ALLY ${counts.friendly}/${friendlyTeamTotal} · HOSTILE ${counts.hostile}/${hostileTeamTotal}${supportCue}`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
    renderObjectiveStatus();
    renderRoundClock();
    syncCockpitInstruments();
}
// Cockpit percentages display INTERNAL integrity, exactly as the pit patch
// restores. Armor is a separate, visible protective layer in the garage.
function playerPartRemaining(part) {
    if (!part) return 0;
    return Math.max(0, Math.min(1, part.integrity / Math.max(1, part.maxIntegrity)));
}
function syncCockpitInstruments() {
    if (!arena?.updateCockpitInstruments) return;
    const systems = {}, armor = {};
    let lowest = 1; let disabled = false;
    for (const slot of SLOTS) {
        const part = playerCondition.parts[slot];
        const ratio = playerPartRemaining(part);
        systems[slot] = Math.round(ratio * 100);
        // Armor is an independent external pool, never derived from core health.
        armor[slot] = part?.maxArmor > 0 ?
            Math.round(Math.max(0, Math.min(1,part.armor/part.maxArmor)) * 100) : 0;
        lowest = Math.min(lowest, ratio);
        disabled ||= !!part && part.integrity <= 0;
    }
    const counts = squadCounts(playerCombatActive, aiActors);
    const failure = weaponFailureState(playerCondition, fieldService);
    const weaponStateLabel = !weaponSpec ? 'LOST' : !playerPower.weaponReady ? 'PWR SAG' : failure === 'faulted' ? 'FAULT' : failure === 'destroyed' || failure === 'unrecoverable' ? 'LOST' : output.weapon < .95 ? 'DAMAGED' : weaponState?.reloadLeft > 0 ? 'RELOAD' : 'READY';
    arena.updateCockpitInstruments({
        systems, armor, team: counts, warning: disabled || lowest < .38 ? 2 : lowest < .72 ? 1 : 0,
        drive: { left: output.left, right: output.right },
        weapon: weaponSpec?.label ?? 'NO WEAPON',
        ammo: weaponState ? `${weaponState.loaded}/${reserveReadout(weaponState)}` : '—',
        weaponState: sortiePhase === 'outro' ? 'SAFE' : weaponStateLabel,
    });
}
function renderPlayerDamageHUD(flashSlot = null) {
    for (const slot of SLOTS) {
        const element = playerDamageSegments.get(slot);
        const part = playerCondition.parts[slot];
        if (!element || !part) continue;
        const ratio = playerPartRemaining(part);
        const value = element.querySelector('i');
        if (value) value.textContent = String(Math.round(ratio * 100));
        const shell=part.maxArmor>0 ? Math.max(0,Math.min(1,part.armor/part.maxArmor)) : 0;
        element.style.setProperty('--core',Math.round(ratio*100)+'%');
        element.style.setProperty('--armor',Math.round(shell*100)+'%');
        element.setAttribute('aria-label',slot.toUpperCase()+' · INTEGRITY '+Math.round(ratio*100)+
            '% · ARMOR '+Math.round(shell*100)+'%');
        element.classList.toggle('breached', shell < .04);
        element.classList.toggle('damaged', ratio < .72);
        element.classList.toggle('severe', ratio < .38);
        element.classList.toggle('disabled', part.integrity <= 0);
        if (flashSlot === slot) {
            element.classList.remove('hit');
            void element.offsetWidth;
            element.classList.add('hit');
            window.setTimeout(() => element.classList.remove('hit'), 460);
        }
    }
    syncCockpitInstruments();
}
function signalPlayerHit(slot, hit) {
    renderPlayerDamageHUD(slot);
    // Armor impacts and core penetration are different physical events.
    const indicator=playerDamageSegments.get(slot);
    if(indicator) {
        indicator.classList.toggle('armor-impact',hit.armorAbsorbed>0&&hit.internalDamage<=0);
        indicator.classList.toggle('core-impact',hit.internalDamage>0);
    }
    arena.triggerCockpitHit(slot, {
        ...cockpitImpactProfile(slot, {
            internalDamage:hit.internalDamage,disabled:hit.disabled,driveSide:hit.driveSide,
        }),
        // A part can lose protection without losing integrity. The presentation
        // must respond to the ACTUAL damage channel, not inferred percent loss.
        internalDamage:hit.internalDamage,armorAbsorbed:hit.armorAbsorbed,
    });
    playerHitFlash.className = `player-hit-flash active hit-${slot}${hit.internalDamage > 0 ? ' breached' : ''}`;
    void playerHitFlash.offsetWidth;
    if (playerHitTimer !== null) window.clearTimeout(playerHitTimer);
    playerHitTimer = window.setTimeout(() => {
        playerHitFlash.className = 'player-hit-flash';
        playerHitTimer = null;
    }, 240);
}
function showVerifiedShieldReadout(contact) {
    const label = shieldImpactLabel(contact);
    if (!label) return null;
    shotReport.classList.remove('faded', 'disabled-part');
    shotReport.classList.add('penetrated');
    shotReport.textContent = label;
    reportFade = Math.max(reportFade, 1.55);
    return label;
}
let scatterFeedback=null;
function showHitConfirm(hit, text = null) {
    if(scatterFeedback){
        const score=hit?.justDestroyed?6:hit?.justDisabled||hit?.disabled?5:
            hit?.internalDamage>0?4:text==='FRAME BLOCK'?2:
            hit?.friendlyBlock?1:hit?.wreckHit?1:3;
        if(!hit?.friendlyBlock&&!hit?.wreckHit&&text!=='FRAME BLOCK')scatterFeedback.landed++;
        if(score>scatterFeedback.rank){
            scatterFeedback.rank=score;scatterFeedback.best={hit,text};
        }
        return;
    }
    const destroyed = !!hit?.justDestroyed;
    const kind = text?.includes('FRAME BLOCK') ? 'blocked' : hit?.friendlyBlock ? 'friendly' : destroyed ? 'destroyed' : hit?.cleared ? 'cleared' : hit?.wreckHit ? 'wreck' : hit?.disabled ? 'disabled' : hit?.internalDamage > 0 ? 'breach' : 'armor';
    const label = text ?? (destroyed ? 'DESTROYED' : kind === 'disabled' ? 'DISABLED' : kind === 'breach' ? 'BREACH' : kind === 'cleared' ? 'WRECK CLEARED' : kind === 'wreck' ? 'WRECK' : kind === 'friendly' ? 'ALLY BLOCK' : 'HIT');
    hitConfirm.textContent = label;
    hitConfirm.className = `hit-confirm visible ${kind}`;
    rangeCrosshair.classList.remove('blocked-hit','armor-hit','breach-hit','disable-hit','destroy-hit','friendly-hit');
    rangeCrosshair.classList.add('confirmed-hit');
    rangeCrosshair.classList.add(kind==='destroyed'?'destroy-hit':
        kind==='disabled'||kind==='cleared'?'disable-hit':
        kind==='breach'?'breach-hit':
        kind==='blocked'?'blocked-hit':kind==='friendly'?'friendly-hit':'armor-hit');
    if (hitConfirmTimer !== null) window.clearTimeout(hitConfirmTimer);
    hitConfirmTimer = window.setTimeout(() => {
        hitConfirm.className = 'hit-confirm';
        rangeCrosshair.classList.remove('blocked-hit','armor-hit','breach-hit','disable-hit','destroy-hit','friendly-hit');
        hitConfirmTimer = null;
    }, kind === 'disabled' || kind === 'cleared' ? 620 : 280);
}
function checkSquadOutcome() {
    const outcome = squadOutcome(playerCombatActive, aiActors);
    // Domination is won by score OR by defeating the entire opposing squad.
    // The squad resolver already requires every hostile actor to be disabled;
    // no capture/score mutation is needed and the existing bout outcome stays
    // authoritative for salvage, BO3, and persistent machine damage.
    if (outcome && !testEnded) {
        if (!testYard) finishSortie(outcome.victory, outcome.reason);
    }
}
function missionKillAiActor(actor, reason, attackerId = null) {
    if (!actor?.active) return;
    recordMissionKill(boutLedger, { attackerId, victimId: actor.id, reason, time: performance.now() / 1000 });
    actor.active = false;
    actor.killReason = reason;
    actor.targetId = null;
    actor.wreckAge = 0;
    actor.wreckIntegrity = 1;
    actor.wreckCleared = false;
    actor.rig.vx = 0; actor.rig.vz = 0; actor.rig.yawRate = 0;
    arena.setCombatantActive(actor.id, false);
    arena.updateCombatantDamage(actor.id, actor.condition);
    if (actor.id === 'enemy-0') {
        mirrorTargetCondition(targetAssembly, targetCondition);
        renderTarget();
    }
    renderSquadStatus();
    checkSquadOutcome();
}

const observeOverlay = document.createElement('section');
observeOverlay.id = 'allied-observation';
observeOverlay.classList.add('hidden');
observeOverlay.setAttribute('aria-label', 'Observe surviving allied mechs');
const observeCaption = document.createElement('strong');
observeCaption.setAttribute('aria-live','polite');
const observePrev = document.createElement('button');
observePrev.type = 'button'; observePrev.textContent = '‹';
const observeNext = document.createElement('button');
observeNext.type = 'button'; observeNext.textContent = '›';
observePrev.setAttribute('aria-label','Previous surviving ally');
observeNext.setAttribute('aria-label','Next surviving ally');
observeOverlay.append(observePrev, observeCaption, observeNext);
document.body.append(observeOverlay);
let observedAllyId = null;
function activeAllies() { return friendlySupportActors.filter(actor=>actor.active); }
function setObservedAlly(direction=0) {
    const allies=activeAllies();
    if(!allies.length) { leaveAlliedObservation(); return; }
    const current=allies.findIndex(actor=>actor.id===observedAllyId);
    const index=current<0 ? 0 : direction===0 ? current :
        (current+direction+allies.length)%allies.length;
    const ally=allies[index];
    observedAllyId=ally.id;
    observeCaption.textContent='OBSERVING · '+(ally.label||ally.id).toUpperCase()+
        ' · '+(index+1)+'/'+allies.length;
    arena.setSpectatorRig(ally.rig);
}
observePrev.addEventListener('click',()=>setObservedAlly(-1));
observeNext.addEventListener('click',()=>setObservedAlly(1));
function enterAlliedObservation() {
    if(!activeAllies().length) return;
    observeOverlay.classList.remove('hidden');
    document.body.classList.add('observing-allies');
    setObservedAlly(0);
}
function leaveAlliedObservation() {
    observeOverlay.classList.add('hidden');
    document.body.classList.remove('observing-allies');
    observedAllyId=null;
    arena.setSpectatorRig(null);
}
function missionKillPlayer(reason, attackerId = null) {
    if (!playerCombatActive) return;
    recordMissionKill(boutLedger, { attackerId, victimId: 'player', reason, time: performance.now() / 1000 });
    playerCombatActive = false;
    playerMissionKillReason = reason;
    rig.vx = 0; rig.vz = 0; rig.yawRate = 0;
    stopFireInput();
    stopFieldServiceInput();
    controls.setEnabled(false);
    faultStrip.textContent = 'RIG DISABLED · ' + reason;
    faultStrip.classList.remove('nominal');
    faultStrip.classList.add('faulted');
    shotReport.classList.add('faded');
    shotReport.classList.remove('penetrated','disabled-part');
    shotReport.textContent = '';
    reportFade = 0;
    enterAlliedObservation();
    renderSquadStatus();
    renderAmmo();
    persistMachine();
    checkSquadOutcome();
}
function resetAiActor(actor) {
    Object.assign(actor.rig, createRigState(actor.spawn));
    Object.assign(actor.condition, createTargetCondition(actor.assembly));
    if (actor.weaponState && actor.weaponSpec)
        Object.assign(actor.weaponState, createWeaponState(actor.weaponSpec));
    Object.assign(actor.controller,createHostileController(
        actor.id==='enemy-0'?.45:actor.team===FRIENDLY_TEAM?.38:.52,actor.behavior));
    Object.assign(actor.motion, createEnemyMotion(actor.behavior));
    actor.fieldService = createFieldServiceState(servicePumpRate(actor.assembly));
    actor.active = true;
    actor.targetId = null;
    actor.fireLane = null;
    actor.fireReposition = null;
    actor.killReason = null;
    actor.teamIntent=null;
    actor.lastServiceCoverCheck=-Infinity;
    actor.serviceCover=null;
    actor.combatMemory={};
    actor.lastSurvivalCoverCheck=-Infinity;
    actor.survivalCover=null;
    actor.brain=createPilotBrain();
    actor.executor=createIntentExecutor();
    actor.teamSupportTargetId = null;
    actor.wreckAge = 0;
    actor.wreckIntegrity = 1;
    actor.wreckCleared = false;
    resetWeaponStabilizer(actor.stabilizer);
    actor.driveDamage.drives = {};
    // Physically anchored support feet and any unfinished catch belong to
    // the previous round, not the new machine spawn.
    const acoustic=movementSoundStates.get(actor.rig);
    if(acoustic)acoustic.contactFeet=null;
    actor.visualGait=null;
    actor.powerSystem = createPowerSystem(actor.assembly);
    arena.setCombatantActive(actor.id, true);
    arena.updateCombatantRig(actor.id, actor.rig);
    arena.updateCombatantDamage(actor.id, actor.condition);
}
function resetSquadBattle() {
    playerMissionKillReason=null;
    // Each round starts with a settled mount; cosmetic recoil does not leak
    // across the repair pit, nor into the next squad match.
    resetWeaponStabilizer(playerMount);
    leaveAlliedObservation();
    aiMemory=createWorldModel();aiSnapshot=null;aiPlans={};aiClock=0;
    squadCounterOrders={friendly:{},hostile:{}};
    aiPlanCooldown=0;aiPerceptionCooldown=0;
    roundClock=createRoundClock();lastRoundClockText='';
    strategicMemory=createStrategicState();
    aiAssaultMemory={friendly:{},hostile:{}};
    aiCorridorMemory={friendly:{},hostile:{}};
    aiTrace.rows.length=0;
    resetFaultSupportState(faultSupportState);
    lastPlayerScreenId = null;
    for (const actor of aiActors) resetAiActor(actor);
    // Side-friendly squad does not enter the calibration lanes.
    if(testYard)for(const actor of friendlySupportActors) {
        actor.active=false;
        arena.setCombatantActive(actor.id,false);
    }
    mirrorTargetCondition(targetAssembly, targetCondition);
    arena.resetTargetDamage(targetCondition);
    arena.updateHostileNavigation(null);
    renderSquadStatus();
}

function stopFireInput() {
    // Release capture before changing screens so an old touch cannot fire on redeploy.
    const captured = firePointerId;
    firePointerId = null;
    fireKeyHeld = false;
    fireHeld = false;
    fireButton.classList.remove('firing');
    if (captured !== null && fireButton.hasPointerCapture(captured)) {
        fireButton.releasePointerCapture(captured);
    }
}
function stopFieldServiceInput() {
    const captured = servicePointerId;
    servicePointerId = null;
    serviceKeyHeld = false;
    cancelFieldService(fieldService);
    reloadButton.classList.remove('servicing');
    if (captured !== null && reloadButton.hasPointerCapture(captured))
        reloadButton.releasePointerCapture(captured);
}
function showStatus(message) {
    fieldStatus.dataset.message = message;
    if (statusTimeout !== null)
        window.clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(() => {
        delete fieldStatus.dataset.message;
        statusTimeout = null;
    }, 2400);
    renderFieldStatus();
}
let saveErrorShown = false;
let persistenceSuppressed = false;
function persistMachine() {
    if (persistenceSuppressed || testYard) return;
    const saved = storeMachine(saveStorage, { assembly, damage, playerCondition, economy });
    if (!saved && !saveErrorShown) {
        saveErrorShown = true;
        showStatus('LOCAL SAVE UNAVAILABLE · THIS SESSION WILL NOT PERSIST');
    }
}
function renderEconomy() {
    creditBalance.textContent = `₡${economy.credits.toLocaleString()}`;
}
function renderFieldStatus() {
    fieldStatus.classList.toggle('ready', inspection.ready);
    fieldStatus.classList.toggle('blocked', !inspection.ready);
    fieldStatus.classList.toggle('message', !!fieldStatus.dataset.message);
    fieldStatus.textContent = fieldStatus.dataset.message || (inspection.ready ? 'READY' : 'BLOCKED');
    fieldStatus.title = inspection.ready ? 'All five required functions are present.' : 'One or more required functions are missing or overloaded.';
}
function selectPart(slot, focus = true) {
    if (slot !== selectedPart) inventoryPreviewSerial = null;
    selectedPart = slot;
    arena.selectPart(slot);
    inspectionPanel.classList.toggle('expanded', slot !== null);
    // Clearing the highlight never steals the inspection camera from the pilot.
    if (focus && slot)
        arena.focusPart(slot);
    for (const [key, button] of selectionButtons) {
        button.classList.toggle('selected', key === slot);
        button.setAttribute('aria-pressed', String(key === slot));
    }
    renderPartInfo();
    if (inspecting)
        window.requestAnimationFrame(syncInspectorLayout);
}
function specLine(part) {
    if (part.slot === 'structure')
        return `FRAME LIMIT ${part.loadLimitKg.toLocaleString()} kg`;
    if (part.slot === 'mobility')
        return `LOAD ${part.loadLimitKg.toLocaleString()} kg · FWD ${part.maxForwardSpeedMps} m/s · LAT ${part.maxLateralSpeedMps} m/s · ${-part.powerKw} kW`;
    if (part.slot === 'power')
        return `OUTPUT ${part.powerKw} kW`;
    if (part.slot === 'command')
        return `CONTROL LOAD ${-part.powerKw} kW`;
    return `FIRING LOAD ${-part.powerKw} kW · LIVE-FIRE RANGE`;
}
function renderPartInfo() {
    partInfo.replaceChildren();
    if (!selectedPart) {
        partInfo.textContent = 'Tap a system icon to inspect the installed module, repair damage or choose another available part.';
        return;
    }
    const fitted = installedPart(assembly, selectedPart);
    const section = document.createElement('div');
    section.className = 'part-model';
    section.textContent = labels[selectedPart];
    partInfo.append(section);
    if (fitted) {
        const stats = document.createElement('div');
        stats.className = 'part-stat';
        stats.style.whiteSpace = 'pre-line';
        stats.textContent = `${fitted.definition.name}\nSERIAL ${fitted.instance.serial}\nMASS ${fitted.definition.massKg} kg\nCONDITION ${Math.round(fitted.instance.condition * 100)}% · REPAIRS ${fitted.instance.repairs} · WEAR ${Math.round(fitted.instance.wear * 100)}%${fitted.instance.destroyed ? '\nWRECKED · REBUILD REQUIRED' : ''}`;
        const description = document.createElement('div');
        description.className = 'part-purpose';
        description.textContent = fitted.definition.description;
        const specs = document.createElement('div');
        specs.className = 'part-specs';
        specs.textContent = specLine(fitted.definition);
        partInfo.append(stats, specs, description);
        const meter = document.createElement('div');
        meter.className = `garage-condition ${fitted.instance.condition < .55 ? 'severe' : fitted.instance.condition < .99 ? 'damaged' : ''}`;
        meter.setAttribute('aria-label', `Component condition ${Math.round(fitted.instance.condition * 100)} percent`);
        const fill = document.createElement('i');
        fill.style.width = `${Math.max(0, Math.min(100, fitted.instance.condition * 100))}%`;
        meter.append(fill);
        partInfo.append(meter);
        const symptom = document.createElement('div');
        symptom.className = 'garage-symptom';
        const condition = fitted.instance.condition;
        if (fitted.instance.destroyed) {
            symptom.textContent = 'PART DESTROYED · REBUILD OR REPLACE';
        }
        else if (selectedPart === 'mobility') {
            const sections = driveCondition(assembly, damage);
            symptom.textContent = sections
                ? `LEFT DRIVE ${Math.round(sections.left * 100)}% · RIGHT DRIVE ${Math.round(sections.right * 100)}% · uneven output pulls the rig under power.`
                : 'NO MOBILITY INSTALLED';
        }
        else if (selectedPart === 'power') {
            symptom.textContent = `GENERATOR OUTPUT ${output.powerAvailableKw.toFixed(0)} kW · DEMAND ${output.nominalDemandKw.toFixed(0)} kW${output.powerFactor < 1 ? ' · DRIVE POWER LIMITED' : ''}`;
        }
        else if (selectedPart === 'combat') {
            symptom.textContent = !output.weaponOperational ? 'WEAPON OFFLINE · INSUFFICIENT POWER OR INTERNAL DAMAGE' :
                output.weapon < .99 ? 'WEAPON DAMAGED · INCREASED SPREAD AND SLOWER CYCLE' : 'WEAPON READY · NO FUNCTIONAL DAMAGE';
        }
        else
            symptom.textContent = condition < .99
                ? 'COSMETIC / STRUCTURAL CONDITION ONLY · FUNCTIONAL CONSEQUENCES NOT YET MODELED' : 'NO RECORDED DAMAGE';
        partInfo.append(symptom);
        const repair = document.createElement('button');
        repair.type = 'button';
        repair.className = 'garage-repair';
        const destroyedPart = !!playerCondition.parts[selectedPart]?.destroyed;
        const quotedRepair = destroyedPart ? rebuildQuote(playerCondition.parts[selectedPart]) : repairQuote(playerCondition.parts[selectedPart]);
        const affordable = quotedRepair <= economy.credits;
        repair.disabled = quotedRepair <= 0 || (!destroyedPart && !affordable);
        repair.textContent = quotedRepair <= 0 ? 'NO REPAIR REQUIRED' : destroyedPart
            ? `REBUILD ${labels[selectedPart]} · ₡${quotedRepair}${affordable ? '' : ' · HOUSE GUARANTEE'}`
            : affordable ? `REPAIR ${labels[selectedPart]} · ₡${quotedRepair}` :
                `REPAIR ${labels[selectedPart]} · ₡${quotedRepair} · INSUFFICIENT`;
        repair.addEventListener('click', () => {
            if (!selectedPart)
                return;
            const destroyed = !!playerCondition.parts[selectedPart]?.destroyed;
            const cost = destroyed ? rebuildQuote(playerCondition.parts[selectedPart]) : repairQuote(playerCondition.parts[selectedPart]);
            if (cost <= 0)
                return;
            if (!destroyed && cost > economy.credits) {
                showStatus(`INSUFFICIENT CREDITS · NEED ₡${cost}`);
                return;
            }
            const charged = destroyed ? Math.min(cost, economy.credits) : cost;
            economy.credits -= charged;
            const result = repairInstalledPart(assembly, damage, selectedPart);
            restoreTargetPart(playerCondition, assembly, selectedPart);
            arena.updatePilotDamage(playerCondition);
            testEndReason = disabledReason(playerCondition, functionalOutput(assembly, damage));
            updateFunctionalStatus();
            renderEconomy();
            renderPartsList();
            renderPartInfo();
            renderChecks();
            const subsidy = cost - charged;
            showStatus(result.rebuilt
                ? `${result.serial} REBUILT · −₡${charged}${subsidy > 0 ? ` · HOUSE GUARANTEE ₡${subsidy}` : ''}`
                : `${result.serial} SERVICED · −₡${charged}`);
            renderAmmo();
            persistMachine();
            const repaired=installedPart(assembly,selectedPart)?.instance;
            if(repaired)preserveSuccessfulService(repaired.serial,
                result.rebuilt?'workshop-rebuild':'workshop-repair',
                repaired.serial+'-'+repaired.repairs);
        });
        partInfo.append(repair);
    }
    else {
        const missing = document.createElement('div');
        missing.className = 'part-purpose missing-part';
        missing.textContent = 'EMPTY STATION · SELECT PART';
        partInfo.append(missing);
    }
    const ownedInstances = assembly.owned.filter(instance => BY_ID.get(instance.definitionId)?.slot === selectedPart);
    if (!inventoryPreviewSerial || !ownedInstances.some(instance => instance.serial === inventoryPreviewSerial))
        inventoryPreviewSerial = fitted?.instance.serial ?? ownedInstances[0]?.serial ?? null;
    const options = document.createElement('div');
    options.className = 'swap-options part-grid';
    for (const instance of ownedInstances) {
        const def = BY_ID.get(instance.definitionId);
        const fittedHere = fitted?.instance.serial === instance.serial;
        const entry = {
            id: `garage:${instance.serial}`, serial: instance.serial, sourceSerial: instance.serial,
            slot: def.slot, definitionId: def.id, name: def.name,
            condition: instance.condition, destroyed: !!instance.destroyed,
            status: instance.destroyed ? 'destroyed' : instance.condition <= .001 ? 'disabled' : instance.condition < .38 ? 'critical' : instance.condition < .78 ? 'damaged' : 'operational',
        };
        const value = partCreditValue(def, instance.condition, { destroyed: instance.destroyed, wear: instance.wear });
        const thumbnailUrl = arena.partThumbnailDataUrl?.(def.id, entry) ?? null;
        const button = createPartCard({
            entry, thumbnailUrl, value, selected: inventoryPreviewSerial === instance.serial,
            source: fittedHere ? 'INSTALLED' : instance.serial,
            onSelect: () => { inventoryPreviewSerial = instance.serial; renderPartInfo(); },
        });
        button.classList.add('swap-option');
        if (fittedHere) button.classList.add('installed-option');
        button.dataset.serial = instance.serial;
        options.appendChild(button);
    }
    partInfo.append(options);
    const preview = ownedInstances.find(instance => instance.serial === inventoryPreviewSerial);
    if (preview) {
        const def = BY_ID.get(preview.definitionId);
        const fittedHere = fitted?.instance.serial === preview.serial;
        const entry = {
            id: `garage:${preview.serial}`, serial: preview.serial, sourceSerial: preview.serial,
            slot: def.slot, definitionId: def.id, name: def.name,
            condition: preview.condition, destroyed: !!preview.destroyed,
            status: preview.destroyed ? 'destroyed' : preview.condition <= .001 ? 'disabled' : preview.condition < .38 ? 'critical' : preview.condition < .78 ? 'damaged' : 'operational',
        };
        const value = partCreditValue(def, preview.condition, { destroyed: preview.destroyed, wear: preview.wear });
        const thumbnailUrl = arena.partThumbnailDataUrl?.(def.id, entry) ?? null;
        const detail = createPartDetail({
            entry, thumbnailUrl, value,
            meta: `${def.massKg} kg · WEAR ${Math.round((preview.wear ?? 0) * 100)}% · REPAIRS ${preview.repairs ?? 0}
${specLine(def)}`,
            actionLabel: fittedHere ? 'INSTALLED' : `INSTALL · ${preview.serial}`,
            actionDisabled: fittedHere,
            onAction: () => {
                try {
                    equipSerial(assembly, def.slot, preview.serial);
                    refreshAssembly(true);
                    selectPart(def.slot);
                } catch (error) {
                    showStatus(error?.message || 'PART CANNOT FIT THIS STATION');
                }
            },
        });
        partInfo.append(detail);
    }
    if (fitted) {
        const takeOff = document.createElement('button');
        takeOff.type = 'button';
        takeOff.className = 'remove-option';
        takeOff.textContent = 'REMOVE PART';
        takeOff.addEventListener('click', () => {
            remove(assembly, selectedPart);
            refreshAssembly(true);
            selectPart(selectedPart);
        });
        partInfo.appendChild(takeOff);
    }
}
function moduleCondition(slot) {
    const fitted = installedPart(assembly, slot);
    if (!fitted)
        return null;
    if (slot === 'mobility') {
        const drive = driveCondition(assembly, damage);
        return drive ? Math.min(fitted.instance.condition, drive.left, drive.right) : fitted.instance.condition;
    }
    if (slot === 'power')
        return Math.min(fitted.instance.condition, output.power);
    if (slot === 'combat')
        return output.weaponOperational ? Math.min(fitted.instance.condition, output.weapon) : 0;
    return fitted.instance.condition;
}
function moduleStatus(slot) {
    const fitted = installedPart(assembly, slot);
    if (fitted?.instance.destroyed)
        return 'destroyed';
    const condition = moduleCondition(slot);
    if (condition === null)
        return 'missing';
    if (condition <= .05)
        return 'disabled';
    if (condition < .45)
        return 'severe';
    if (condition < .8)
        return 'degraded';
    return 'good';
}
function moduleStatusLabel(status) {
    return status === 'good' ? 'GOOD' : status === 'degraded' ? 'DEGRADED' :
        status === 'severe' ? 'DAMAGED' : status === 'destroyed' ? 'WRECKED' :
        status === 'disabled' ? 'DISABLED' : 'MISSING';
}
function renderPartsList() {
    selectionButtons.clear();
    partList.replaceChildren();
    for (const slot of SLOTS) {
        const fitted = installedPart(assembly, slot);
        const condition = moduleCondition(slot);
        const status = moduleStatus(slot);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `module-tab status-${status}`;
        button.setAttribute('aria-label', `${labels[slot]} · ${fitted?.definition.name ?? 'missing'} · ${moduleStatusLabel(status)}`);
        button.setAttribute('aria-pressed', String(slot === selectedPart));
        button.title = `${labels[slot]} · ${fitted?.definition.name ?? 'missing'} · ${moduleStatusLabel(status)}`;
        const glyph = document.createElement('span');
        glyph.className = 'module-glyph';
        glyph.append(createModuleIcon(slot));
        const category = document.createElement('small');
        category.textContent = labels[slot] === 'STRUCTURE' ? 'FRAME' : labels[slot] === 'MOBILITY' ? 'MOVE' : labels[slot] === 'COMMAND' ? 'CMD' : labels[slot] === 'COMBAT' ? 'ARMS' : 'PWR';
        const value = document.createElement('i');
        value.textContent = condition === null ? '—' : `${Math.round(condition * 100)}%`;
        button.append(glyph, category, value);
        button.classList.toggle('selected', slot === selectedPart);
        button.addEventListener('click', () => selectPart(selectedPart === slot ? null : slot));
        partList.appendChild(button);
        selectionButtons.set(slot, button);
    }
}
function renderChecks() {
    checkList.replaceChildren();
    for (const check of inspection.checks) {
        const row = document.createElement('div');
        row.className = `field-check ${check.passes ? 'pass' : 'fail'}`;
        const title = document.createElement('strong');
        title.textContent = `${check.passes ? '✓' : '!'} ${check.label.toUpperCase()}`;
        const reason = document.createElement('div');
        reason.textContent = check.reason;
        row.append(title, reason);
        checkList.append(row);
    }
    assemblyMass.textContent = `${inspection.massKg.toLocaleString()} kg`;
    powerStatus.textContent = `${inspection.powerUsedKw} / ${inspection.powerAvailableKw} kW`;
    renderEconomy();
    adapterStatus.textContent = inspection.adapters.length
        ? inspection.adapters.map(a => `${a.description} · ${a.serial}`).join(' · ')
        : 'Direct-mount stations · no adapters';
    renderFieldStatus();
}
function refreshAssembly(save = false) {
    inspection = inspectAssembly(assembly);
    fieldService.rateMultiplier=servicePumpRate(assembly);
    smokeButton.hidden=!equipmentHas(assembly,'cinder-smoke');
    rigConfig = deriveRigConfig(assembly);
    playerPower = createPowerSystem(assembly);
    updateFunctionalStatus();
    const nextSpec = weaponFor(assembly);
    if (nextSpec?.id !== weaponSpec?.id)
        weaponState = nextSpec ? createWeaponState(nextSpec) : null;
    weaponSpec = nextSpec;
    resetWeaponStabilizer(playerMount);
    arena.setPilotWeapon(weaponSpec);
    arena.setPilotStabilizer(playerMount);
    renderAmmo();
    reconcileTargetCondition(playerCondition, assembly);
    arena.rebuildAssembly(assembly);
    arena.updatePilotDamage(playerCondition);
    renderPartsList();
    renderChecks();
    renderPartInfo();
    if (save)
        persistMachine();
}
refreshAssembly();
selectPart(null, false);
// k.3s.0: the five module stations are controlled by the viewed bay, not the
// battle-active rig. Only edits of the combat-active bay touch this live assembly;
// inactive bays mutate their own stable record without switching combat authority.
document.addEventListener('m3ch4:bay-module', event => {
    const request = event.detail;
    if (!request || !inspecting || !SLOTS.includes(request.slot)) return;
    try {
        const stable = loadStable(saveStorage).stable;
        if (request.rigId === stable.activeRigId) {
            const serial = request.serial || null;
            if (serial) {
                const owner = serialOwner(stable, serial);
                if (owner && owner.id !== request.rigId)
                    throw new Error(serial + ' IS INSTALLED ON ' + (owner.name || owner.id));
                equipSerial(assembly, request.slot, serial);
            } else {
                const removed = remove(assembly, request.slot);
                if (!removed.ok) throw new Error(removed.reason || 'REMOVE BLOCKED');
            }
            refreshAssembly(true);
            document.dispatchEvent(new CustomEvent('m3ch4:assembly-mutated'));
            request.result = { ok:true };
        } else {
            request.result = changeInactiveBay(saveStorage, request.rigId, request.slot, request.serial);
        }
    } catch (error) { request.result = { ok:false, reason:error?.message || 'PART CHANGE FAILED' }; }
});
// An inter-round patch writes both persistent saves before reloading. Reconcile the
// same serial into the running in-memory authority first: the normal pagehide save
// must not undo that external, successful field-work transaction.
document.addEventListener('m3ch4:bay-reconcile-patch', event => {
    const action=event.detail;
    const items=action?.type==='triage'?action.repairs||[]:[action];
    if(!items?.length)return;
    const saved=loadMachine(saveStorage);
    for(const item of items){
        const serial=item?.serial,slot=item?.slot;
        if(!serial||!SLOTS.includes(slot))continue;
        const authoritativePart=saved.assembly.owned.find(part=>part.serial===serial);
        const livePart=assembly.owned.find(part=>part.serial===serial);
        if(authoritativePart&&livePart)Object.assign(livePart,authoritativePart);
        if(assembly.installed[slot]===serial&&saved.assembly.installed[slot]===serial){
            const snapshot=saved.playerCondition?.parts?.[slot];
            if(snapshot&&playerCondition.parts[slot])Object.assign(playerCondition.parts[slot],snapshot);
            if(slot==='mobility'&&saved.damage?.drives?.[serial])
                damage.drives[serial]={...saved.damage.drives[serial]};
        }
        // The field-work transaction already succeeded and was committed to
        // both saves. Queue one service fact per truly patched serial now,
        // before the pit's immediate location.reload().
        const key='pit-'+action.rigId+'-'+action.afterRound+'-'+serial+'-'+action.at;
        preserveSuccessfulService(serial,'pit-triage',key);
    }
});
// The running v8 machine is authoritative for credits and the global serial
// inventory. Counter transactions must update it here, not a stale UI copy.
document.addEventListener('m3ch4:counter-buy', event => {
    const request=event.detail;
    if (!request || !inspecting ||
        document.querySelector('#unified-garage')?.dataset.mode!=='vendor') return;
    const result=buyCounterLot(saveStorage,loadCampaign(saveStorage).sorties,
        request.serial,{assembly,damage,playerCondition,economy});
    request.result=result;
    if (!result.ok) return;
    renderEconomy();
    document.dispatchEvent(new CustomEvent('m3ch4:inventory-changed',{
        detail:{serial:result.part.serial,definitionId:result.part.definitionId,
            source:'used parts counter'},
    }));
});
document.addEventListener('m3ch4:bay-equipment', event => {
    const request=event.detail;
    if(!request||!inspecting||testYard){if(request)request.result={ok:false,reason:'GARAGE ONLY'};return;}
    try {
        const stable=loadStable(saveStorage).stable;
        const active=request.rigId===stable.activeRigId;
        const candidate=active?assembly:bayAssembly(stable,request.rigId);
        if(!candidate){request.result={ok:false,reason:'UNKNOWN BAY'};return;}
        const result=equipAuxiliary(candidate,request.mount,request.id);
        if(!result.ok){request.result=result;return;}
        if(active){
            refreshAssembly(true);
            document.dispatchEvent(new CustomEvent('m3ch4:assembly-mutated'));
        }else{
            const rig=rigById(stable,request.rigId);
            rig.equipment={...candidate.equipment};
            if(!storeStable(saveStorage,stable)){request.result={ok:false,reason:'SAVE FAILED'};return;}
        }
        request.result={ok:true};
    } catch(error){request.result={ok:false,reason:error?.message||'FITTING REJECTED'};}
});
document.addEventListener('m3ch4:bay-generator-mount', event => {
    const request = event.detail;
    if (!request || !inspecting) return;
    try {
        const stable = loadStable(saveStorage).stable;
        if (request.rigId === stable.activeRigId) {
            const prior = generatorMount(assembly);
            const result = setGeneratorMount(assembly, request.position);
            if (!result.ok) { request.result = result; return; }
            const validation = inspectAssembly(assembly).checks.find(check => !check.passes);
            if (validation) {
                setGeneratorMount(assembly, prior);
                request.result = { ok:false, reason:validation.reason };
                return;
            }
            refreshAssembly(true);
            document.dispatchEvent(new CustomEvent('m3ch4:assembly-mutated'));
            request.result = { ok:true };
        } else {
            request.result = setInactiveBayGeneratorMount(saveStorage, request.rigId, request.position);
        }
    } catch (error) {
        request.result = { ok:false, reason:error?.message || 'GENERATOR MOUNT FAILED' };
    }
});
document.addEventListener('m3ch4:bay-service', event => {
    const request = event.detail;
    if (!request || !inspecting || !SLOTS.includes(request.slot)) return;
    try {
        const stable = loadStable(saveStorage).stable;
        if (request.rigId === stable.activeRigId) {
            const slot = request.slot;
            const fitted = installedPart(assembly, slot);
            if (!fitted) throw new Error('NO FITTED PART');
            const state = playerCondition.parts[slot];
            const destroyed = !!state?.destroyed || !!fitted.instance.destroyed;
            const cost = destroyed ? rebuildQuote(state) : repairQuote(state);
            if (cost <= 0 && fitted.instance.condition >= 1) throw new Error('NO REPAIR REQUIRED');
            if (!destroyed && cost > economy.credits) throw new Error('INSUFFICIENT CREDITS');
            const charged = destroyed ? Math.min(cost, economy.credits) : cost;
            economy.credits -= charged;
            repairInstalledPart(assembly, damage, slot);
            restoreTargetPart(playerCondition, assembly, slot);
            updateFunctionalStatus();
            refreshAssembly(true);
            arena.updatePilotDamage(playerCondition);
            const serviced=installedPart(assembly,slot)?.instance;
            if(serviced)preserveSuccessfulService(serviced.serial,
                destroyed?'workshop-rebuild':'workshop-repair',
                serviced.serial+'-'+serviced.repairs);
            document.dispatchEvent(new CustomEvent('m3ch4:assembly-mutated'));
            request.result = { ok:true, charged, rebuilt:destroyed };
        } else {
            const result = serviceInactiveBay(saveStorage, request.rigId, request.slot, economy.credits);
            if (!result.ok) { request.result = result; return; }
            // Both save generations hold the SAME global owned serial catalogue.
            // Reconcile it into the in-memory active assembly before main persists,
            // otherwise an old v8 copy could silently erase an inactive bay repair.
            const livePart = assembly.owned.find(part => part.serial === result.serial);
            if (livePart) Object.assign(livePart, result.part);
            economy.credits -= result.charged;
            persistMachine();
            renderEconomy();
            preserveSuccessfulService(result.serial,
                result.rebuilt?'workshop-rebuild':'workshop-repair',
                result.serial+'-'+result.part.repairs);
            request.result = result;
        }
    } catch (error) { request.result = { ok:false, reason:error?.message || 'SERVICE FAILED' }; }
});

/** Workshop and combat share the v8 inventory; never let a stale in-memory
 * copy undo successful serialized paint edits on the next automatic save. */
function reconcileLivePaint(){
    const saved=loadMachine(saveStorage);
    const painted=new Map(saved.assembly.owned.map(part=>[part.serial,part.paint||null]));
    for(const part of assembly.owned){
        if(!painted.has(part.serial))continue;
        const finish=painted.get(part.serial);
        if(finish)part.paint={...finish};
        else delete part.paint;
    }
    refreshAssembly(false);
}
function refreshFriendlyCrewPaint(){
    friendlySupportActors.forEach((actor,i)=>{
        applyFriendlyCrewPaint(actor.assembly,saveStorage,assembly,i+1);
        arena.repaintCombatant(actor.id);
    });
}
document.addEventListener('m3ch4:paint-committed',()=>{
    reconcileLivePaint();
    refreshFriendlyCrewPaint();
});
document.addEventListener('m3ch4:team-livery-committed',refreshFriendlyCrewPaint);
document.addEventListener('m3ch4:inventory-changed', () => {
    refreshAssembly(true);
    renderPartInfo();
    showStatus('SALVAGE SECURED · OWNED INVENTORY UPDATED');
});
document.addEventListener('m3ch4:assembly-mutated', () => {
    refreshAssembly(true);
    if (selectedPart) selectPart(selectedPart, false);
});
function toggleInspection(force) {
    const requested = force ?? !inspecting;
    testEndReason = deploymentBlockReason();
    if (!requested && (!inspection.ready || testEndReason)) {
        showStatus(testEndReason ? `NOT READY · ${testEndReason} · REPAIR REQUIRED` : 'NOT READY · RESTORE ALL FIVE FUNCTIONS');
        return;
    }
    inspecting = requested;
    stopFireInput();
    stopFieldServiceInput();
    if (inspecting) {
        leaveAlliedObservation();
        sortiePhase = 'garage';
        document.body.classList.remove('sortie-outro-active', 'victory-showcase');
        winnerTableau.classList.add('hidden');
        pendingWinnerPresentation=null;
        sortieOutro.classList.add('hidden');
        sortieOutro.setAttribute('aria-hidden', 'true');
        devPanel.classList.add('hidden');
        document.body.classList.remove('dev-open');
        targetPanel.classList.add('hidden');
        targetToggle.setAttribute('aria-pressed', 'false');
        renderPartsList();
        renderPartInfo();
    }
    else {
        // Each deployment is a new paid sortie. Owned damage persists; ammunition and
        // the automated opponent reset, while operating credits do not.
        debriefSheet.classList.add('hidden');
        debriefSheet.setAttribute('aria-hidden', 'true');
        sortieOutro.classList.add('hidden');
        sortieOutro.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('sortie-outro-active', 'victory-showcase');
        winnerTableau.classList.add('hidden');
        sortiePhase = 'combat'; sortieOutroRemaining = 0;
        pendingDebrief = null; pendingWinnerPresentation=null;
        hitchFrames=0;worstFrameGapMs=0;
        reportFade = 0; shotReport.textContent = ''; shotReport.className = 'shot-report faded';
        hitConfirm.className = 'hit-confirm'; rangeCrosshair.classList.remove('confirmed-hit', 'breach-hit', 'disable-hit');
        arena.resetCockpitTransientFeedback();
        assemblyToggle.disabled = false;
        rig = createRigState(playerSpawn);
        playerPower = createPowerSystem(assembly);
        playerCombatActive = true;
        resetSquadBattle();
        sortieObjective = createSortieObjective(mappedContract);
        renderObjectiveStatus();
        boutLedger = createBoutLedger(boutRoster());
        clearBoutResult();
        controls.recenterLook();
        weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
        fieldService = createFieldServiceState(servicePumpRate(assembly));
        smokeState=createSmokeState();
        sortieRoundsFired = 0;
        sortieAmmoCostCents = 0;
        sortieProjectiles = 0;
        sortieConfirmedContacts = 0;
        testEnded = false;
        testEndReason = null;
        updateFunctionalStatus();
        renderAmmo();
    }
    document.body.classList.toggle('inspecting', inspecting);
    inspectionPanel.classList.toggle('hidden', !inspecting);
    orbitHelp.classList.toggle('hidden', !inspecting);
    resetOrbitButton.classList.toggle('hidden', !inspecting);
    centerView.classList.toggle('hidden', inspecting);
    assemblyToggle.classList.toggle('pressed', inspecting);
    assemblyToggle.setAttribute('aria-pressed', String(inspecting));
    assemblyToggle.textContent = inspecting ? 'DEPLOY' : 'GARAGE';
    arena.setInspection(inspecting);
    if(!inspecting&&animationPreviewOn){
        animationPreviewOn=false;
        syncAnimationPreview();
    }
    if (inspecting) {
        arena.resetOrbit();
        syncInspectorLayout();
    }
    controls.setEnabled(!inspecting && !testEnded && playerCombatActive && appSheet.classList.contains('hidden'));
    accumulator = 0;
    yardUI?.setInspecting(inspecting);
}
assemblyToggle.addEventListener('click', () => toggleInspection());
centerView.addEventListener('click', () => controls.recenterLook());
resetOrbitButton.addEventListener('click', () => { arena.resetOrbit(); showStatus('INSPECTION CAMERA RESET'); });
const pointers = new Map();
renderer.domElement.addEventListener('pointerdown', event => {
    if (!inspecting && !observedAllyId)
        return;
    event.preventDefault();
    renderer.domElement.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {
        x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY, dragged: false,
    });
    if (pointers.size >= 2)
        for (const pointer of pointers.values())
            pointer.dragged = true;
});
renderer.domElement.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer || (!inspecting && !observedAllyId))
        return;
    event.preventDefault();
    const before = gestureMetrics([...pointers.values()]);
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 7)
        pointer.dragged = true;
    const after = gestureMetrics([...pointers.values()]);
    if (before && after) {
        for (const active of pointers.values())
            active.dragged = true;
        // Pinch controls distance only; orbit ALWAYS pivots on the machine.
        if(before.separation>2&&after.separation>2){
            if(inspecting)arena.zoomBy(after.separation/before.separation);
            else arena.zoomSpectatorBy(after.separation/before.separation);
        }
    }
    else if (pointer.dragged) {
        if(inspecting)arena.orbitBy(dx,dy);
        else arena.orbitSpectatorBy(dx,dy);
    }
});
const physicalEvidenceCard=createPhysicalEvidenceCard();
document.addEventListener('m3ch4:workspace-layout',physicalEvidenceCard.close);
document.addEventListener('m3ch4:assembly-mutated',physicalEvidenceCard.close);
const endPointer = (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer)
        return;
    // When one finger of a pinch lifts, the remaining finger must never count as a tap.
    if (pointers.size > 1)
        for (const active of pointers.values())
            active.dragged = true;
    pointers.delete(event.pointerId);
    if (inspecting && event.type === 'pointerup' && !pointer.dragged) {
        if (document.querySelector('#unified-garage')?.dataset.mode==='vendor') {
            const serial=arena.pickVendorLot(event.clientX,event.clientY,renderer.domElement);
            if (serial) document.dispatchEvent(new CustomEvent('m3ch4:counter-picked',{detail:{serial}}));
            return;
        }
        const workspace=document.querySelector('#unified-garage')?.dataset.workspace;
        if(workspace==='garage'&&!document.querySelector('#unified-garage')?.classList.contains('painting')){
            const evidence=arena.pickSurfaceEvidence(event.clientX,event.clientY,renderer.domElement);
            if(evidence&&physicalEvidenceCard.open(evidence,event.clientX,event.clientY))
                return; // Exact scar inspection never equips or removes hardware.
        }
        physicalEvidenceCard.close();
        const slot = arena.pickPart(event.clientX, event.clientY, renderer.domElement);
        if (document.querySelector('#unified-garage')) {
            // The viewed bay may not be the combat-active rig. Let the unified
            // station UI own part selection instead of opening the old active bay.
            document.dispatchEvent(new CustomEvent('m3ch4:bay-picked',{detail:{slot}}));
        } else selectPart(slot === selectedPart ? null : slot, slot !== null);
    }
};
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);
renderer.domElement.addEventListener('lostpointercapture', endPointer);
renderer.domElement.addEventListener('wheel', event => {
    if (!inspecting)
        return;
    event.preventDefault();
    arena.zoomBy(Math.exp(-event.deltaY * .0015));
}, { passive: false });
const appStandalone = () => window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
function showAppGuide() {
    appMessage.textContent = appStandalone()
        ? 'You are running the standalone Home Screen app. Safari tabs are hidden.'
        : 'On iPhone: open the hosted game in Safari, tap Share → Add to Home Screen, leave Open as Web App enabled if offered, tap Add, then launch the MECH ARENA icon.';
    appSheet.classList.remove('hidden');
    appSheet.setAttribute('aria-hidden', 'false');
    controls.setEnabled(false);
    stopFireInput();
    stopFieldServiceInput();
}
function hideAppGuide() {
    appSheet.classList.add('hidden');
    appSheet.setAttribute('aria-hidden', 'true');
    controls.setEnabled(!inspecting && !testEnded && playerCombatActive);
}
appView.addEventListener('click', async () => {
    if (appStandalone()) {
        showAppGuide();
        return;
    }
    if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        try {
            await document.documentElement.requestFullscreen();
            appView.textContent = 'FULL SCREEN';
            return;
        }
        catch { /* iPhone Safari requires Home Screen web-app mode. */ }
    }
    showAppGuide();
});
required('#app-close').addEventListener('click', hideAppGuide);
required('#app-done').addEventListener('click', hideAppGuide);
appView.textContent = appStandalone() ? 'APP MODE' : 'APP VIEW';
document.addEventListener('fullscreenchange', () => {
    appView.textContent = document.fullscreenElement ? 'FULL SCREEN' : appStandalone() ? 'APP MODE' : 'APP VIEW';
    resize();
});
const renderScales = [.42, .55, .70];
let renderScaleIndex = 1;
let renderScale = renderScales[renderScaleIndex];
let previousTime = performance.now();
let accumulator = 0;
let fps = 60;
// DEV-only on-device hitch evidence: uncapped frame gaps, not capped physics dt.
let hitchFrames=0, worstFrameGapMs=0;
let showColliders = false;
function syncInspectorLayout() {
    // The actual canvas bounds (not stale window dimensions) are the camera viewport.
    // This also handles landscape-left / landscape-right and Safari toolbar resizing.
    const rect = renderer.domElement.getBoundingClientRect();
    const shell=document.querySelector('#unified-garage');
    const workspace=shell?.dataset.workspace;
    const bayDock=document.querySelector('#unified-garage-dock');
    // Contextual garage toolboxes float OVER the scene rather than pushing the
    // camera. Closing an inspector must never appear to reset orbit or aim.
    // Paint reserves LEFT space; setup reserves RIGHT space to expose the
    // existing true 3D rig as the selection preview.
    let reserved=0;
    if(inspecting && bayDock && workspace==='paint')
        reserved=bayDock.getBoundingClientRect().right-rect.left+8;
    else if(inspecting && bayDock && workspace==='setup')
        reserved=-(rect.right-bayDock.getBoundingClientRect().left+8);
    arena.setInspectorLayout(reserved,rect.width,rect.height);
}
document.addEventListener('m3ch4:workspace-layout',()=>{if(inspecting)syncInspectorLayout();});
function resize() {
    const bounds = mount.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    arena.camera.aspect = width / height;
    arena.camera.updateProjectionMatrix();
    renderer.setSize(Math.floor(width * renderScale), Math.floor(height * renderScale), false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
    // The combiner is intentionally independent from world resolution: keep text crisp
    // without paying full-resolution lighting/shading cost for the arena.
    hudRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    hudRenderer.setSize(width, height, false);
    hudRenderer.domElement.style.width = `${width}px`;
    hudRenderer.domElement.style.height = `${height}px`;
    syncInspectorLayout();
}
window.addEventListener('resize', resize);
// Safari can settle the visual viewport a little after its orientation event.
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
    resize();
    window.setTimeout(resize, 180);
});
resize();
if (testYard) {
    yardUI=createTestYardPanel({
        assembly,
        onInstall:(slot,id)=>{
            equip(assembly,slot,id);
            refreshAssembly(false);
            storeTestYardAssembly(assembly);
        },
        onEquipment:(mount,id)=>{
            const fit=equipAuxiliary(assembly,mount,id);
            if(!fit.ok)throw new Error(fit.reason);
            refreshAssembly(false);
            storeTestYardAssembly(assembly);
        },
        onDeploy:()=>{if(inspecting)toggleInspection(false);},
        onGarage:()=>{if(!inspecting)toggleInspection(true);},
        onTargets:()=>resetTarget.click(),
        onMode:()=>{
            yardMode=yardMode==='static'?'live':'static';
            yardUI.setMode(yardMode);
            resetSquadBattle();
            renderTarget();
            showStatus(yardMode==='static'?'TARGET AI PARKED':'LIVE TRAINING AI ENABLED');
        },
        onCenter:()=>centerView.click(),
        onReset:()=>{
            stopFireInput();
            stopFieldServiceInput();
            resetInstalledDamage(assembly,damage);
            for(const slot of SLOTS) {
                const fitted=installedPart(assembly,slot);
                if(fitted) {
                    fitted.instance.condition=1;
                    fitted.instance.destroyed=false;
                    fitted.instance.wear=0;
                }
                restoreTargetPart(playerCondition,assembly,slot);
            }
            leaveAlliedObservation();
            rig=createRigState(playerSpawn);
            playerPower=createPowerSystem(assembly);
            playerCombatActive=true;
            playerMissionKillReason=null;
            testEnded=false;testEndReason=null;
            weaponState=weaponSpec?createWeaponState(weaponSpec):null;
            fieldService=createFieldServiceState(servicePumpRate(assembly));
            smokeState=createSmokeState();
            resetWeaponStabilizer(playerMount);
            arena.clearRockets();
            arena.resetCockpitTransientFeedback();
            controls.recenterLook();
            refreshAssembly(false);
            arena.updatePilotDamage(playerCondition);
            renderPlayerDamageHUD();
            renderAmmo();
            controls.setEnabled(!inspecting);
            showStatus('TEST RIG REBUILT · TARGET DAMAGE PRESERVED');
        },
        onReadDamage:(who,slot)=>{
            const subject=who==='enemy'?primaryEnemyActor:null;
            const cond=subject?.condition??playerCondition;
            const health=cond.parts[slot]?.maxIntegrity>0?
                Math.round(100*cond.parts[slot].integrity/cond.parts[slot].maxIntegrity):0;
            const instance=installedPart(subject?.assembly??assembly,'mobility');
            const driveState=subject?.driveDamage??damage;
            const sides=instance&&driveState.drives?.[instance.instance.serial];
            return `${who==='enemy'?'ENEMY':'PILOT'} · ${slot.toUpperCase()} ${health}%`+
                (slot==='mobility'&&sides?` · L ${Math.round(sides.left*100)}% / R ${Math.round(sides.right*100)}%`:'');
        },
        onDamage:({who,slot,side,percent})=>{
            if(!testYard || !SLOTS.includes(slot))return 'NOT AVAILABLE';
            const actor=who==='enemy'?primaryEnemyActor:null;
            if(actor&&!actor.active)return 'RESET TARGETS TO RESTART A KNOCKED-OUT AI';
            const target=actor?.condition??playerCondition;
            const hardware=actor?.assembly??assembly;
            const damageState=actor?.driveDamage??damage;
            const part=target.parts[slot];
            if(!part)return 'MODULE NOT INSTALLED';
            const ratio=damageLabCondition(target.parts,slot,percent);
            if(slot==='mobility'){
                const fitted=installedPart(hardware,slot);
                if(fitted){
                    const serial=fitted.instance.serial;
                    const v=damageState.drives[serial]??{left:1,right:1};
                    if(side==='left')v.left=ratio;
                    else if(side==='right')v.right=ratio;
                    else v.left=v.right=ratio;
                    damageState.drives[serial]=v;
                    const average=(v.left+v.right)/2;
                    part.integrity=part.maxIntegrity*average;
                    part.armor=average===1?part.maxArmor:0;
                }
            }
            const fitted=installedPart(hardware,slot);
            if(fitted) {fitted.instance.condition=part.integrity/Math.max(1,part.maxIntegrity);fitted.instance.destroyed=false;}
            resetDamageFate(part);
            if(actor){
                mirrorTargetCondition(actor.assembly,actor.condition);
                arena.updateCombatantDamage(actor.id,actor.condition);
                if(actor.id==='enemy-0')renderTarget();
            }else{
                updateFunctionalStatus();arena.updatePilotDamage(playerCondition);
                renderPlayerDamageHUD();renderAmmo();
            }
            return `INJECTED ${slot.toUpperCase()} · ${Math.round(part.integrity/Math.max(1,part.maxIntegrity)*100)}% · ${who.toUpperCase()}`;
        },
        onResetDamage:who=>{
            if(!testYard)return;
            const actor=who==='enemy'?primaryEnemyActor:null;
            const cond=actor?.condition??playerCondition;
            const hardware=actor?.assembly??assembly;
            const driveState=actor?.driveDamage??damage;
            for(const slot of SLOTS){
                damageLabCondition(cond.parts,slot,100);
                resetDamageFate(cond.parts[slot]);
                const fitted=installedPart(hardware,slot);
                if(fitted)fitted.instance.condition=1;
                if(slot==='mobility'&&fitted)
                    driveState.drives[fitted.instance.serial]={left:1,right:1};
            }
            if(actor){
                mirrorTargetCondition(actor.assembly,actor.condition);
                arena.updateCombatantDamage(actor.id,actor.condition);
            }else{
                updateFunctionalStatus();arena.updatePilotDamage(playerCondition);
                renderPlayerDamageHUD();renderAmmo();
            }
        },
        onResetLoadout:()=>{
            clearTestYardAssembly();
            Object.assign(assembly,readTestYardAssembly());
            resetInstalledDamage(assembly,damage);
            Object.assign(playerCondition,createTargetCondition(assembly,true));
            refreshAssembly(false);
            yardUI.render();
            showStatus('FULL-CATALOGUE DEFAULT RESTORED');
        },
    });
}
toggleInspection(true); // Always reopen in the garage, never in an active hostile firefight.
if (loadedMachine.status === 'restored')
    showStatus('OWNED RIG RESTORED · LOCAL SAVE');
else if (loadedMachine.status === 'migrated')
    showStatus('SAVE MIGRATED · STARTER OPERATING FUND ADDED');
else if (loadedMachine.status === 'invalid')
    showStatus('INVALID LOCAL SAVE · STARTING FRESH TEST RIG');
else if (loadedMachine.status === 'unavailable')
    showStatus('LOCAL STORAGE UNAVAILABLE · PROGRESS WILL NOT SAVE');
// Backup flush when iPhone Safari suspends the web-app without a page unload.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        stopFireInput();
        stopFieldServiceInput();
        controls.cancelPointers();
        persistMachine();
    }
});
window.addEventListener('pagehide', () => {
    stopFireInput();
    stopFieldServiceInput();
    controls.cancelPointers();
    persistMachine();
});
function frame(now) {
    const rawFrameMs=Math.max(0,now-previousTime);
    const frameDt = Math.min(rawFrameMs / 1000, MAX_FRAME_DT);
    previousTime = now;
    if(!inspecting&&!testEnded&&document.visibilityState==='visible'&&rawFrameMs<1000){
        worstFrameGapMs=Math.max(worstFrameGapMs,rawFrameMs);
        if(rawFrameMs>40)hitchFrames++;
    }
    fps += ((1 / Math.max(frameDt, .0001)) - fps) * .06;
    let input = controls.sample();
    let steps = 0;
    const aftermathDriving = testEnded && sortiePhase === 'outro' && playerCombatActive;
    if (!inspecting && (!testEnded || aftermathDriving) && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {
        accumulator += frameDt;
        while (accumulator >= FIXED_DT && steps < 8) {
            stepSmoke(smokeState,FIXED_DT);
            const followSteer = bodyFollowSteer(input.lookYaw);
            const bodySteer = THREE.MathUtils.clamp(input.steer + followSteer, -1, 1);
            syncMovingObstacles();
            if (playerCombatActive) {
                const yawBefore = rig.yaw;
                const wasBraced = rig.braced;
                const powerWasReady=playerPower.weaponReady;
                setActiveWeaponLoad(playerPower,
                    weaponSpec?.fireMode==='continuous'&&fireHeld&&playerCombatActive&&
                    (weaponState?.loaded??0)>0&&(weaponState?.reloadLeft??0)<=0&&
                    (weaponState?.action?.ventLeft??0)<=0&&output.weaponOperational
                        ? weaponSpec.activeKw : 0);
                advancePowerSystem(playerPower, assembly, rig, FIXED_DT,
                    playerCondition.parts.power.integrity / Math.max(1, playerCondition.parts.power.maxIntegrity));
                if(!powerWasReady&&playerPower.weaponReady)
                    soundSystemEvent('recharge',{variant:1,cockpit:true,strength:.42});
                else if(powerWasReady&&!playerPower.weaponReady&&
                    playerCondition.parts.power.integrity<playerCondition.parts.power.maxIntegrity*.5)
                    soundSystemEvent('zap',{variant:1,cockpit:true,strength:.26});
                output = powerConstrainedOutput(staticOutput, playerPower);
                effectiveConfig = derateRigConfig(rigConfig, output);
                stepRig(rig, { throttle: input.throttle, strafe: input.strafe, steer: bodySteer, brake: input.brake }, FIXED_DT, effectiveConfig, combatWorldFor('player'));
                emitMachineMotionSound(assembly,rig,FIXED_DT,true,{left:output.left,right:output.right});
                advanceWeaponStabilizer(playerMount,weaponSpec?.id,rig,
                    movementSoundStates.get(rig),{
                        combat:weaponIntegrityRatio(playerCondition),
                        command:playerCondition.parts.command.integrity/
                            Math.max(1,playerCondition.parts.command.maxIntegrity),
                        mobility:playerCondition.parts.mobility.integrity/
                            Math.max(1,playerCondition.parts.mobility.maxIntegrity),
                        massKg:rigConfig.massKg,
                    },FIXED_DT);
                if (rig.braced && !wasBraced) soundBrace();
                // Threshold-crossing sounds rather than per-frame synth loops.
                // Disabled/inspection/garage rigs never emit footing feedback.
                footingSoundCooldown = Math.max(0, footingSoundCooldown - FIXED_DT);
                const scrapingNow = rig.footSlipMps > .38 &&
                    Math.hypot(rig.vx, rig.vz) > 1.5;
                const loadedNow = rig.footingLoad > .68 &&
                    Math.hypot(rig.vx, rig.vz) > .9 && !rig.braced;
                if (footingSoundCooldown <= 0 && scrapingNow && !footScraping) {
                    soundFootScrape();
                    footingSoundCooldown = .55;
                } else if (footingSoundCooldown <= 0 && loadedNow && !drivetrainLoaded) {
                    soundDriveStrain();
                    footingSoundCooldown = .9;
                }
                footScraping = scrapingNow || (footScraping && rig.footSlipMps > .15);
                drivetrainLoaded = loadedNow || (drivetrainLoaded && rig.footingLoad > .44);
                shoveDisabledWrecks(rig, effectiveConfig);
                if (Math.abs(followSteer) > .001) {
                    controls.compensateBodyTurn(rig.yaw - yawBefore);
                    input = controls.sample();
                }
                const serviceStep = advanceFieldService(playerCondition, fieldService, rig, FIXED_DT);
                if (serviceStep.event === 'completed') handleFieldServiceCompleted(serviceStep);
                else if (serviceStep.event === 'interrupted') handleFieldServiceInterrupted();
            }
            // Score, damage, target choice and opposing locomotion are frozen once the
            // sortie resolves. Only the surviving player's physical rig keeps coasting/walking.
            if (!aftermathDriving) {
                if(!playerCombatActive && observedAllyId) {
                    const watched=friendlySupportActors.find(actor=>actor.id===observedAllyId);
                    if(!watched?.active) setObservedAlly(1);
                }
                const participants = battleParticipants();
                aiClock+=FIXED_DT;
                aiPlanCooldown-=FIXED_DT;aiPerceptionCooldown-=FIXED_DT;
                if(aiPerceptionCooldown<=0||!aiSnapshot){
                    aiSnapshot=observeBattlefield(aiMemory,participants,sortieObjective,selectedWorld,aiClock,smokeState.clouds);
                    aiPerceptionCooldown=.15; // fast, bounded LOS; team orders remain slow
                }
                if(aiPlanCooldown<=0){
                    const friendlyStrategy=evaluateStrategy(strategicMemory,aiSnapshot,FRIENDLY_TEAM);
                    const hostileStrategy=evaluateStrategy(strategicMemory,aiSnapshot,HOSTILE_TEAM);
                    const previousPlans=aiPlans;
                    aiPlans={
                        friendly:planTeam(aiSnapshot,FRIENDLY_TEAM,{strategy:friendlyStrategy,
                            assaultMemory:aiAssaultMemory.friendly,previousOrders:previousPlans.friendly?.orders,
                            world:selectedWorld,arrivalPolicy:'coordinated',
                            corridorPolicy:'stagger',corridorMemory:aiCorridorMemory.friendly}),
                        hostile:planTeam(aiSnapshot,HOSTILE_TEAM,{strategy:hostileStrategy,
                            assaultMemory:aiAssaultMemory.hostile,previousOrders:previousPlans.hostile?.orders,
                            world:selectedWorld,arrivalPolicy:'coordinated',
                            corridorPolicy:'stagger',corridorMemory:aiCorridorMemory.hostile}),
                    };
                    aiPlanCooldown=.85;
                }
                // Exactly one free nearby pilot screens a threatened teammate;
                // other pilots retain productive fire/objective assignments.
                squadCounterOrders={
                    friendly:planCounterFlankResponses(aiSnapshot?.knowledge?.friendly,
                        aiPlans.friendly?.orders??{},aiClock),
                    hostile:planCounterFlankResponses(aiSnapshot?.knowledge?.hostile,
                        aiPlans.hostile?.orders??{},aiClock),
                };
                updateFaultSupportAssignments(faultSupportState, participants, FIXED_DT);
                const playerScreener = friendlySupportActors.find(actor => faultSupportForActor(faultSupportState, actor.id)?.casualtyId === 'player');
                const playerScreenId = playerScreener?.id ?? null;
                if (playerScreenId !== lastPlayerScreenId) {
                    lastPlayerScreenId = playerScreenId;
                    renderSquadStatus();
                    if (playerScreener) {
                        shotReport.classList.remove('faded', 'disabled-part');
                        shotReport.classList.add('penetrated');
                        shotReport.textContent = `${playerScreener.label} COVERING · HOLD POSITION FOR FIELD SERVICE`;
                        reportFade = Math.max(reportFade, 1.8);
                    }
                }
                for (const actor of aiActors) {
                if (testYard && (yardMode !== 'live' || actor.team === FRIENDLY_TEAM)) continue;
                if (!actor.active) {
                    actor.wreckAge += FIXED_DT;
                    continue;
                }
                const target=resolveActorTarget(actor);
                // Test the real muzzle against multiple target modules: a
                // cockpit or weapon may be exposed above an obscured frame.
                // Trace is non-damaging and does not consume ammunition.
                if(target && (actor.fireLane?.targetId!==target.id ||
                    aiClock>=(actor.fireLane?.validUntil??-Infinity))){
                    const physical=assessTargetFireLanes(slot=>
                        arena.traceCombatantShot(actor.id,target.id,slot,0,0),target.id);
                    actor.fireLane={...physical,targetId:target.id,validUntil:aiClock+.27};
                    if(!physical.clear){
                        noteBlockedFire(actor.motion,physical.blocker);
                        if(actor.fireLaneSearch?.targetId!==target.id)
                            actor.fireLaneSearch={targetId:target.id,tried:[]};
                        const search=actor.fireLaneSearch;
                        const old=actor.fireReposition?.targetId===target.id
                            ? actor.fireReposition:null;
                        const arrived=old&&Math.hypot(
                            actor.rig.x-old.point.x,actor.rig.z-old.point.z)<1.25;
                        if(!old||arrived||aiClock>=old.until){
                            if(old){
                                search.tried.push(old.point);
                                if(search.tried.length>12)search.tried.shift();
                            }
                            const config=aiLocomotionConfig(actor);
                            const options={
                                radius:config.collisionRadiusM,
                                targetId:target.id,
                                side:actor.motion.awareness.repositionSide,
                                allies:participants.filter(p=>p.team===actor.team&&
                                    p.id!==actor.id&&p.active).map(p=>p.rig),
                                excludePoints:search.tried,
                            };
                            let point=chooseClearFiringPoint(actor.rig,target.rig,
                                combatWorldFor(actor.id),options);
                            // Exhausted local angles: widen/revisit after a
                            // complete sweep instead of staring at cover.
                            if(!point&&search.tried.length){
                                search.tried=search.tried.slice(-3);
                                point=chooseClearFiringPoint(actor.rig,target.rig,
                                    combatWorldFor(actor.id),{...options,excludePoints:search.tried});
                            }
                            const travel=point?Math.hypot(
                                actor.rig.x-point.x,actor.rig.z-point.z):0;
                            actor.fireReposition=point?{
                                targetId:target.id,point,
                                until:aiClock+Math.max(3.8,Math.min(9,travel*.8))}:null;
                        }
                    }else{
                        actor.fireReposition=null;
                        actor.fireLaneSearch=null;
                        actor.motion.awareness.blockedFireSeconds=0;
                        actor.motion.awareness.blockedLaneCommitted=false;
                        actor.motion.awareness.blockedBy=null;
                    }
                }
                if(!target){
                    actor.fireLane=null;actor.fireReposition=null;
                    actor.fireLaneSearch=null;
                }
                const actorOutput=hostileOutput(actor.condition,actor.behavior);
                const canManeuver=actorOutput.structure>0&&actorOutput.command>0&&
                    actorOutput.power>0&&actorOutput.mobility>0;
                setActiveWeaponLoad(actor.powerSystem,
                    actor.weaponSpec?.fireMode==='continuous'&&actor.active&&target&&
                    (actor.weaponState?.loaded??0)>0&&(actor.weaponState?.reloadLeft??0)<=0&&
                    Math.hypot(target.rig.x-actor.rig.x,target.rig.z-actor.rig.z)<=actor.weaponSpec.rangeMeters&&
                    actor.fireLane?.clear===true&&
                    (actor.weaponState?.action?.ventLeft??0)<=0 ? actor.weaponSpec.activeKw : 0);
                advancePowerSystem(actor.powerSystem, actor.assembly, actor.rig, FIXED_DT, actorOutput.power);
                const actorConfig=aiLocomotionConfig(actor);
                const recovery=aiWeaponRecoveryDirective(actor,target);
                const posture=aiWeaponRecoveryPosture(damagePosture(actor.condition,actor.behavior),recovery);
                const screening=faultSupportForActor(faultSupportState,actor.id);
                const screenTarget=screening?.casualtyId?
                    participants.find(p=>p.id===screening.casualtyId):null;
                const capability=aiSnapshot?.knowledge?.[actor.team]?.allies
                    .find(p=>p.id===actor.id)?.capability;
                let order=aiPlans[actor.team]?.orders?.[actor.id]??null;
                const alliedView=aiSnapshot?.knowledge?.[actor.team];
                const me=alliedView?.allies.find(p=>p.id===actor.id);
                // Recent shared contact may guide facing/search, but never
                // authorize shots or reveal an opponent's current position.
                const lastSeen=alliedView?.contacts?.filter(c=>!c.visible &&
                    c.confidence>.32 && aiClock-c.lastSeen<=6.0)
                    .sort((a,b)=>b.lastSeen-a.lastSeen)[0]??null;
                const support=squadCounterOrders[actor.team]?.[actor.id]??null;
                if(support&&!screenTarget?.active)order=support;
                // A solid barricade or disabled rig is not an opportunity to
                // waste ammunition. Seek a physical side angle.
                if(target&&actor.fireLane?.clear===false &&
                    actor.fireReposition?.point &&
                    !screenTarget?.active&&!recovery.active){
                    order={goal:'CLEAR_LANE',role:'FIRE_CONTROL',
                        point:{...actor.fireReposition.point},targetActorId:target.id,
                        score:.98,emergency:true,
                        reason:'BARREL BLOCKED · REACQUIRE ANGLE'};
                }
                if(screenTarget?.active&&screenTarget.rig)order={
                    goal:'SCREEN',point:{x:screenTarget.rig.x,z:screenTarget.rig.z},
                    score:.91,reason:'PROTECT FIELD SERVICE',targetActorId:screenTarget.id};
                // A recoverable weapon needs actual defensible ground, not a
                // hardcoded world-edge coordinate. Cache cover searches to
                // avoid doing expensive obstacle evaluation every physics tick.
                if(recovery.active&&recovery.mode==='WITHDRAW'&&target&&
                    (aiClock-(actor.lastServiceCoverCheck??-Infinity)>1.4)){
                    actor.lastServiceCoverCheck=aiClock;
                    actor.serviceCover=chooseCoverPoint(actor.rig,target.rig,selectedWorld,
                        actorConfig.collisionRadiusM,actor.behavior)?.point??null;
                }
                const systemAtRisk=threatenedSubsystem(actor.combatMemory,actor.condition,aiClock);
                const threatPoint=threatFacingPoint(actor.rig,actor.motion?.awareness);
                if(systemAtRisk&&threatPoint&&
                    aiClock-(actor.lastSurvivalCoverCheck??-Infinity)>.9){
                    actor.lastSurvivalCoverCheck=aiClock;
                    actor.survivalCover=chooseCoverPoint(actor.rig,threatPoint,
                        combatWorldFor(actor.id),actorConfig.collisionRadiusM,
                        actor.behavior)?.point??null;
                }
                const selected=decidePilot(actor.brain,
                    {id:actor.id,position:{x:actor.rig.x,z:actor.rig.z}},order,{
                        capability,weaponRecovery:recovery,
                        systemAtRisk,survivalPoint:systemAtRisk?actor.survivalCover:null,
                        enemySeen:!!alliedView?.contacts?.some(c=>c.visible),
                        uncertain:!alliedView?.contacts?.some(c=>c.visible),
                        world:selectedWorld,
                        preferredRangeM:actor.weaponSpec?.fireMode==='continuous'?4.3:actor.behavior?.preferredRangeM,
                        collisionRadius:actorConfig.collisionRadiusM+.3,
                        threatPosition:target?.rig??null,
                        nearbyAllies:participants.filter(p=>p.team===actor.team&&p.id!==actor.id&&p.active).map(p=>({position:p.rig})),
                        preserveMajority:(sortieObjective.domination?.points??[]).filter(p=>p.owner===actor.team&&!p.contested).length>=2,
                        personality:actor.behavior?.id,
                        underFireSeconds:actor.motion?.awareness?.underFireSeconds??0,
                        retreatPoint:recovery.active&&actor.serviceCover?
                            actor.serviceCover:
                            {x:actor.rig.x,z:actor.team===FRIENDLY_TEAM?22:-22},
                    },aiClock);
                const nearbyTraffic=participants.filter(p=>p.team===actor.team&&
                    p.id!==actor.id&&p.active&&p.rig&&
                    Math.hypot(p.rig.x-actor.rig.x,p.rig.z-actor.rig.z)<7)
                    .map(p=>({id:p.id,position:p.rig,
                        radius:p.baseConfig?.collisionRadiusM??1.1,active:p.active,
                        speed:Math.hypot(p.rig.vx??0,p.rig.vz??0),
                        velocity:{x:p.rig.vx??0,z:p.rig.vz??0}}));
                actor.teamIntent=executeIntent(actor.executor,selected,actor.rig,
                    combatWorldFor(actor.id),actorConfig.collisionRadiusM,FIXED_DT,nearbyTraffic,
                    {now:aiClock,actorId:actor.id,trafficPolicy:'adaptive'});
                // A blocked muzzle without an immediate flank candidate
                // must not suppress the broader team route indefinitely.
                const navigationIntent=actor.teamIntent;
                recordAiDecision(aiTrace,actor,actor.brain,actor.executor,aiClock);
                if (recovery.begin && !actor.fieldService.held) beginFieldService(actor.condition, actor.fieldService, actor.rig);
                // A designated screener must actually turn toward the reported
                // flank instead of visually tracking the older frontal target.
                // Only a currently visible shared attacker supplies exact aim;
                // an unknown attacker supplies *bearing*, never fire clearance.
                const responseContact=support?.targetActorId &&
                    alliedView?.contacts?.some(c=>c.id===support.targetActorId&&c.visible)
                        ? actorById(support.targetActorId)?.rig : null;
                const locomotionFocus=support?(responseContact??null):(target?.rig??null);
                let maneuver = advanceEnemyMotion(actor.motion, actor.rig, locomotionFocus, FIXED_DT, canManeuver, combatWorldFor(actor.id), actorConfig.collisionRadiusM, actor.behavior, navigationIntent, actorConfig, support?.threatFacing??lastSeen?.position??null);
                if (actor.fieldService.held || recovery.mode === 'SETTLE')
                    maneuver = { throttle: 0, strafe: 0, steer: 0, brake: 1 };
                else
                    maneuver = { ...maneuver, throttle: maneuver.throttle * Math.max(.66, posture.paceScale), strafe: (maneuver.strafe ?? 0) * Math.max(.56, posture.strafeScale), steer: maneuver.steer * Math.max(.62, posture.steerScale) };
                // An AI holding a firing position plants the same feet through
                // the same brake input. Do not add a special AI recoil buff.
                const settledToShoot = !recovery.active && !!target &&
                    !smokeObscures(actor.rig,target.rig,smokeState.clouds) &&
                    actor.fireLane?.clear===true &&
                    actor.weaponState?.loaded > 0 &&
                    withinFiringArc(actor.rig, target.rig) &&
                    Math.hypot(actor.rig.vx, actor.rig.vz) < .24 &&
                    Math.abs(actor.rig.yawRate) < .2 &&
                    Math.abs(maneuver.throttle) < .12 &&
                    Math.abs(maneuver.strafe ?? 0) < .12 &&
                    Math.abs(maneuver.steer) < .12;
                if (settledToShoot) maneuver = { ...maneuver, brake: 1 };
                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                if(actor.active)actor.visualGait=emitMachineMotionSound(actor.assembly,actor.rig,FIXED_DT,false,actor.driveDamage.drives[installedPart(actor.assembly,'mobility')?.instance.serial]??null);
                advanceWeaponStabilizer(actor.stabilizer,actor.weaponSpec?.id,actor.rig,
                    actor.visualGait,{
                        combat:actor.condition.parts.combat.integrity/
                            Math.max(1,actor.condition.parts.combat.maxIntegrity),
                        command:actor.condition.parts.command.integrity/
                            Math.max(1,actor.condition.parts.command.maxIntegrity),
                        mobility:actor.condition.parts.mobility.integrity/
                            Math.max(1,actor.condition.parts.mobility.maxIntegrity),
                        massKg:actor.baseConfig.massKg,
                    },FIXED_DT);
                shoveDisabledWrecks(actor.rig, actorConfig);
                if (recovery.mode === 'SETTLE' && !actor.fieldService.held && fieldServiceStationary(actor.rig))
                    beginFieldService(actor.condition, actor.fieldService, actor.rig);
                const serviceStep = advanceFieldService(actor.condition, actor.fieldService, actor.rig, FIXED_DT);
                if (serviceStep.event === 'completed') handleAiFieldServiceCompleted(actor,serviceStep);
                arena.updateCombatantRig(actor.id, actor.rig, {
                    target: target?.rig ?? null, posture, dt: FIXED_DT,
                    weaponFault: actor.condition.parts.combat.integrity<=0,
                    weaponServicing: actor.fieldService.held && actor.fieldService.activeSlot==='combat',
                    serviceSlot: actor.fieldService.held ? actor.fieldService.activeSlot : null,
                    recoveryEventId:actor.fieldService.lastServicedSlot?`${actor.fieldService.lastServicedSlot}:${actor.fieldService.attempts[actor.fieldService.lastServicedSlot]}`:null,
                    recoverySlot:actor.fieldService.lastServicedSlot,
                    driveHealth:actor.driveDamage.drives[installedPart(actor.assembly,'mobility')?.instance.serial]??null,
                    gait:actor.visualGait,stability:actor.stabilizer,
                    reloadLeft:actor.weaponState?.reloadLeft??0,
                    reloadSeconds:actor.weaponSpec?.reloadSeconds??0,
                });
                if (actor.id === 'enemy-0') arena.updateHostileNavigation(actor.motion.waypoint);
                if (actor.weaponSpec && actor.weaponState) {
                    advanceWeapon(actor.weaponState, actor.weaponSpec, FIXED_DT);
                    if (actor.weaponState.loaded <= 0 && actor.weaponState.reloadLeft === 0 && actor.weaponState.reserve > 0)
                        startReload(actor.weaponState, actor.weaponSpec);
                    soundActualReloadPhases(actor.weaponState,actor.weaponSpec,false,actor.rig);
                    const ready=actor.powerSystem.weaponReady &&
                        (!target||!smokeObscures(actor.rig,target.rig,smokeState.clouds)) && actor.weaponState.cooldown<=0 &&
                        actor.weaponState.loaded>0&&actor.weaponState.reloadLeft<=0&&
                        !!target&&actor.fireLane?.clear===true&&
                        withinFiringArc(actor.rig,target.rig)&&
                        // At range, a disturbed weapon can settle behind cover.
                        // Close, urgent and contested shots remain possible.
                        (actor.stabilizer.settled>.32 ||
                            Math.hypot(target.rig.x-actor.rig.x,
                                target.rig.z-actor.rig.z)<11 ||
                            !!sortieObjective.domination?.points?.some(p=>p.contested))&&
                        shouldAttemptTacticalShot(actor,target,{urgent:
                            !!sortieObjective.domination?.points?.some(p=>
                                Math.hypot(target.rig.x-p.x,target.rig.z-p.z)<
                                  sortieObjective.radius &&
                                (p.contested||p.owner===actor.team))}) &&
                        aiWeaponEngagement(actor.weaponSpec,{
                            distance:Math.hypot(target.rig.x-actor.rig.x,
                                target.rig.z-actor.rig.z),
                            rigSpeed:Math.hypot(actor.rig.vx,actor.rig.vz),
                            yawError:Math.abs(Math.atan2(
                                Math.sin(Math.atan2(target.rig.x-actor.rig.x,
                                    actor.rig.z-target.rig.z)-actor.rig.yaw),
                                Math.cos(Math.atan2(target.rig.x-actor.rig.x,
                                    actor.rig.z-target.rig.z)-actor.rig.yaw))),
                            brace:actor.rig.brace??0,
                        }).fire;
                    const triggerReady=actor.weaponSpec.fireMode==='charged'
                        ? advanceChargedTrigger(actor.weaponState,actor.weaponSpec,ready,FIXED_DT) : ready;
                    const shot=advanceHostileController(actor.controller,
                        actor.condition,FIXED_DT,!target,triggerReady);
                    if(shot!==null&&target)attemptAiFire(actor,target,shot);
                }
            }
            }
            if (!aftermathDriving && !testEnded && !testYard) {
                const objectiveOutcome = advanceSortieObjective(sortieObjective, battleParticipants(), FIXED_DT);
                renderObjectiveStatus();
                if (objectiveOutcome) finishSortie(objectiveOutcome.victory, objectiveOutcome.reason);
                else {
                    const timeout=advanceRoundClock(roundClock,FIXED_DT,sortieObjective,battleParticipants());
                    renderRoundClock();
                    if(timeout)finishSortie(timeout.victory,timeout.reason);
                }
            }
            if (weaponSpec && weaponState) {
                advanceWeapon(weaponState, weaponSpec, FIXED_DT);
                soundActualReloadPhases(weaponState,weaponSpec,true,rig);
                const authorized=weaponSpec.fireMode==='charged'
                    ? advanceChargedTrigger(weaponState,weaponSpec,
                        fireHeld&&playerCombatActive&&output.weaponOperational&&playerPower.weaponReady,FIXED_DT)
                    : weaponSpec.fireMode==='projectile'
                        ? advanceProjectileTrigger(weaponState,weaponSpec,fireHeld&&playerCombatActive)
                        : fireHeld;
                if (authorized && playerCombatActive) attemptFire();
            }
            // Flight and explosion outcomes are authoritative only when the
            // projectile physically arrives, never at the instant of launch.
            coolThermalCombat(thermalCombat,FIXED_DT);
            for(const blast of arena.advanceRockets(FIXED_DT)) {
                if(blast.ownerId==='player' && blast.contacts.some(({contact}) =>
                    contact?.slot && actorById(contact.actorId)?.team===HOSTILE_TEAM))
                    sortieConfirmedContacts++;
                for(const {contact,damage} of blast.contacts) {
                    if(testEnded)break;
                    if(blast.ownerId==='player') {
                        resolvePlayerShotContact(contact,damage,false,true);
                    } else {
                        const shooter=actorById(blast.ownerId);
                        const target=actorById(contact.actorId);
                        if(shooter&&target)resolveAiShotContact(shooter,target,contact,damage);
                    }
                }
            }
            syncMovingObstacles();
            accumulator -= FIXED_DT;
            steps++;
        }
        if (steps === 8)
            accumulator = 0;
    }
    else
        accumulator = 0;
    // Re-sample after body-follow compensation before rendering the cockpit/gun.
    input = controls.sample();
    const playerRecoveryState = weaponFailureState(playerCondition, fieldService);
    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt, {
        weaponFault: playerRecoveryState === 'faulted',
        weaponHealth:weaponIntegrityRatio(playerCondition),
        weaponServicing: fieldService.held && fieldService.activeSlot==='combat',
        serviceSlot: fieldService.held ? fieldService.activeSlot : null,
        recoveryEventId:fieldService.lastServicedSlot?`${fieldService.lastServicedSlot}:${fieldService.attempts[fieldService.lastServicedSlot]}`:null,
        recoverySlot:fieldService.lastServicedSlot,
        driveHealth:{left:output.left,right:output.right},
        gait:movementSoundStates.get(rig),stability:playerMount,
        reloadLeft:weaponState?.reloadLeft??0,
        reloadSeconds:weaponSpec?.reloadSeconds??0,
    });
    // Only actual Backlot competition runs the distant yard generator loop.
    // This is a state toggle; AudioContext remains locked until a real tap.
    setBacklotAmbienceActive(selectedMap.id==='backlot-dustbowl' &&
        !inspecting && !testEnded && appSheet.classList.contains('hidden') &&
        document.visibilityState==='visible');
    arena.updateCombatEffects(frameDt);
    if (sortiePhase === 'outro') {
        sortieOutroRemaining = Math.max(0, sortieOutroRemaining - frameDt);
        // Three unhurried seconds in the actual battlefield: the surviving
        // pilot can still walk/look, while AI combat and weapon fire are frozen.
        if(pendingWinnerPresentation && sortieOutroRemaining<=SORTIE_SHOWCASE_SECONDS){
            const winners=pendingWinnerPresentation;
            pendingWinnerPresentation=null;
            controls.setEnabled(false);
            document.body.classList.add('sortie-outro-active');
            sortieOutro.classList.remove('breather');
            try{
                const started=arena.beginVictoryShowcase(winners);
                sortieOutro.classList.toggle('physical-showcase',started);
                document.body.classList.toggle('victory-showcase',started);
                winnerTableau.classList.toggle('hidden',!started);
                if(started)renderWinnerNameplates(winnerTableau,winners);
                else winnerTableau.replaceChildren();
            }catch(error){
                winnerTableau.replaceChildren();
                winnerTableau.classList.add('hidden');
                document.body.classList.remove('victory-showcase');
                sortieOutro.classList.remove('physical-showcase');
                console.warn('PHYSICAL WINNER SHOWCASE UNAVAILABLE',error?.message||error);
            }
        }
        arena.updateVictoryShowcase(frameDt);
        const nameAnchors=arena.victoryNameplateAnchors();
        winnerTableau.classList.toggle('spatial',nameAnchors.length>0);
        for(const [i,label] of [...winnerTableau.children].entries()){
            const anchor=nameAnchors[i];
            if(!anchor)continue;
            label.style.left=anchor.x+'%';
            label.style.top=anchor.y+'%';
            label.hidden=!anchor.visible;
        }
        if (sortieOutroRemaining === 0 && pendingDebrief) {
            const next = pendingDebrief; pendingDebrief = null; sortiePhase = 'debrief';
            pendingWinnerPresentation=null;
            arena.endVictoryShowcase();
            sortieOutro.classList.add('hidden'); sortieOutro.setAttribute('aria-hidden', 'true');
            sortieOutro.classList.remove('physical-showcase');
            document.body.classList.remove('victory-showcase', 'sortie-outro-active');
            winnerTableau.classList.add('hidden');
            controls.setEnabled(false);
            assemblyToggle.disabled = false;
            renderDebrief(next.summary, next.reason);
        }
    }
    if (!inspecting && !targetPanel.classList.contains('hidden')) {
        targetPanelRefresh += frameDt;
        if (targetPanelRefresh > .4) {
            targetPanelRefresh = 0;
            renderTarget();
        }
    }
    recoilFlash = Math.max(0, recoilFlash - frameDt);
    reportFade = Math.max(0, reportFade - frameDt);
    rangeCrosshair.classList.toggle('confirmed-hit', hitConfirmTimer !== null);
    rangeCrosshair.classList.toggle('scatter-sight',weaponSpec?.id==='gun-scatter');
    // The reticle denotes the actual mechanical zero-spread ray, not the
    // camera center. Angular offset uses the live vertical camera FOV.
    const sightHeight=renderer.domElement.clientHeight||window.innerHeight;
    const sightScale=sightHeight/(2*Math.tan(THREE.MathUtils.degToRad(arena.camera.fov)*.5));
    rangeCrosshair.style.left=`calc(50% + ${Math.round(Math.tan(playerMount.yaw)*sightScale)}px)`;
    rangeCrosshair.style.top=`calc(50% - ${Math.round(Math.tan(playerMount.pitch)*sightScale)}px)`;
    shotSafetyTimer-=frameDt;
    if(shotSafetyTimer<=0){
        shotSafetyTimer=.12;
        const warning=!inspecting && !testEnded && playerCombatActive &&
            weaponSpec && output.weaponOperational
            ? arena.predictShotObstruction(weaponSpec.muzzleZ) : null;
        rangeCrosshair.classList.toggle('unsafe-shot',!!warning);
        rangeCrosshair.dataset.warning=warning||'';
        rangeCrosshair.setAttribute('aria-label',warning==='friendly'?'FRIENDLY IN BARREL PATH':
            warning==='cover'?'BARREL BLOCKED BY COVER':'');
    }
    shotReport.classList.toggle('faded', reportFade === 0);
    renderAmmo();
    speedEl.textContent = Math.hypot(rig.vx, rig.vz).toFixed(1);
    const lateralDominant = Math.abs(rig.lateralSpeed) > .18 && Math.abs(rig.lateralSpeed) > Math.abs(rig.forwardSpeed) * .72;
    motionEl.textContent = rig.braced ? 'BRACED' : lateralDominant ? (rig.lateralSpeed > 0 ? 'STEP R' : 'STEP L') :
        rig.forwardSpeed < -.15 ? 'REV' : rig.forwardSpeed > .15 ? 'FWD' : 'IDLE';
    bracePedal.textContent = rig.braced ? 'BRACED' : rig.brace > 0 ? 'PLANT' : 'BRAKE';
    bracePedal.classList.toggle('active', input.brake >= .85);
    bracePedal.classList.toggle('braced', !!rig.braced);
    bracePedal.setAttribute('aria-pressed', String(input.brake >= .85));
    yawRateEl.textContent = Math.round(THREE.MathUtils.radToDeg(rig.yawRate)).toString();
    loadBar.style.transform = `scaleX(${rig.driveLoad.toFixed(3)})`;
    arena.updateCockpitMotion?.({
        speed: Math.hypot(rig.vx, rig.vz), direction: motionEl.textContent,
        turnRate: THREE.MathUtils.radToDeg(rig.yawRate), driveLoad: rig.driveLoad,
        brace: rig.brace,
        slip: rig.footSlipMps, footing: rig.footingLoad, recoil: rig.recoilLoad,
        power: playerPower,
    });
    const degrees = Math.round(-THREE.MathUtils.radToDeg(input.lookYaw));
    const following = Math.abs(bodyFollowSteer(input.lookYaw)) > .02;
    lookHeadingEl.textContent = Math.abs(degrees) < 2 ? 'AIM: FORWARD · BODY CENTERED' :
        `AIM: ${degrees > 0 ? 'RIGHT' : 'LEFT'} ${Math.abs(degrees)}°${following ? ' · BODY FOLLOW' : ' · FREE TRAVERSE'}`;
    if (!devPanel.classList.contains('hidden')) {
        devReadout.textContent = [
            `FPS       ${fps.toFixed(0)}`,
            `HITCHES   ${hitchFrames} >40ms · MAX ${worstFrameGapMs.toFixed(0)}ms`,
            `FIXED DT  ${(FIXED_DT * 1000).toFixed(2)} ms`,
            `STEPS     ${steps}${inspecting ? ' (PAUSED)' : ''}`,
            `POS X/Z   ${rig.x.toFixed(2)} / ${rig.z.toFixed(2)} m`,
            `FWD V     ${rig.forwardSpeed.toFixed(2)} m/s`,
            `LAT V     ${rig.lateralSpeed.toFixed(2)} m/s`,
            `YAW       ${THREE.MathUtils.radToDeg(rig.yaw).toFixed(1)}°`,
            `VIEW YAW  ${THREE.MathUtils.radToDeg(physicsYawToViewYaw(rig.yaw) + input.lookYaw).toFixed(1)}°`,
            `YAW RATE  ${THREE.MathUtils.radToDeg(rig.yawRate).toFixed(1)}°/s`,
            `ACCEL     ${rig.longitudinalAcceleration.toFixed(2)} m/s²`,
            `LOAD      ${(rig.driveLoad * 100).toFixed(0)}%`,
            `BRACE     ${rig.braced ? 'PLANTED' : (rig.brace * 100).toFixed(0) + '%'} · BRAKE+STILL`,
            `FOOTING   ${(rig.footingLoad * 100).toFixed(0)}% · ${rig.tractionSaturated ? 'SATURATED' : 'CONTACT'}`,
            `SLIP      ${rig.footSlipMps.toFixed(2)} m/s · RECOIL LOAD ${(rig.recoilLoad * 100).toFixed(0)}%`,
            `MASS      ${inspection.massKg.toLocaleString()} kg`,
            `POWER     ${playerPower.generationKw.toFixed(1)} kW generated / ${playerPower.demandKw.toFixed(1)} kW demanded`,
            `BUS       ${(playerPower.busRatio * 100).toFixed(0)}% · RESERVE ${(playerPower.reserveKJ).toFixed(1)} kJ`,
            `CREDITS   ₡${economy.credits}`,
            `LEFT LEG  ${(output.left * 100).toFixed(0)}%`,
            `RIGHT LEG ${(output.right * 100).toFixed(0)}%`,
            `WEAPON    ${(output.weapon * 100).toFixed(0)}%`,
            `FIELD SVC ${fieldService.held ? `${fieldService.activeSlot} ${Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100)}%` : fieldService.cooldownLeft>0 ? `${fieldService.cooldownLeft.toFixed(1)}s` : canFieldService(playerCondition, fieldService) ? `READY ${fieldServiceTarget(playerCondition,fieldService)}` : '—'} · DISABLES ${countDisabled(playerCondition)}/3`,
            `FIELDED   ${inspection.ready ? 'YES (CONTRACT)' : 'NO'}`,
            `ADAPTERS  ${inspection.adapters.length}`,
            `RENDER    WORLD ${Math.round(renderScale * 100)}% · HUD HI-RES`,
            `ROUNDS    ${weaponState?.loaded ?? 0}/${reserveReadout(weaponState)}`,
            `SHOTS     ${shotsFired} · SORTIE ${sortieRoundsFired} · AMMO ₡${(sortieAmmoCostCents / 100).toFixed(2)}`,
            `TARGET    ${targetCondition.shotsHit} HITS`,
            `SQUAD     ${teamStatus.textContent}${playerCombatActive ? '' : ' · YOU OUT'}`,
            `HOSTILE   ${hostileMotion.phase} · ${hostileRig.x.toFixed(1)} / ${hostileRig.z.toFixed(1)} m`,
            `NAV       ${hostileMotion.navigation} · STUCK ${hostileMotion.stuckSeconds.toFixed(1)}s`,
            `LOS AUDIT ${lastCoverAudit}`,
            `AI TEAMS  F:${aiPlans.friendly?.strategy??'-'} → ${aiPlans.friendly?.target??'-'} / H:${aiPlans.hostile?.strategy??'-'} → ${aiPlans.hostile?.target??'-'}`,
            `AI PLANS\n${formatAiTrace(aiTrace)}`,
            `RIG VIS   ${arena.combatantVisualAudit().ok ? `OK · ${arena.combatantVisualAudit().actors} ACTORS` : `MISPLACED ${arena.combatantVisualAudit().misplaced.join(',')}`}`,
            `WAYPOINT  ${hostileMotion.waypoint ? `${hostileMotion.waypoint.x.toFixed(1)} / ${hostileMotion.waypoint.z.toFixed(1)}` : 'NONE'}`,
            `LAST HIT  ${lastHit}`,
        ].join('\n');
    }
    // World and cockpit telemetry deliberately use separate resolution budgets.
    arena.updateTacticalSmoke(smokeState.clouds);
    arena.camera.layers.set(0);
    renderer.render(arena.scene, arena.camera);
    hudRenderer.clear();
    if (!inspecting) {
        // scene.background belongs to the chunky world pass. Temporarily suppress it
        // so the display-resolution HUD renderer remains a transparent composite.
        const worldBackground = arena.scene.background;
        arena.scene.background = null;
        arena.camera.layers.set(1);
        hudRenderer.render(arena.scene, arena.camera);
        arena.camera.layers.set(0);
        arena.scene.background = worldBackground;
    }
    window.__m3ch4BootOK = true; // first actual 3D + cockpit render completed
    requestAnimationFrame(frame);
}
smokeButton.addEventListener('click',()=>{
    if(inspecting||testEnded||!playerCombatActive||!equipmentHas(assembly,'cinder-smoke'))return;
    if(deploySmoke(smokeState,rig)){
        arena.updateTacticalSmoke(smokeState.clouds);
        showStatus('CINDER DISCHARGED · OPTICAL COVER');
        renderAmmo();
    }
});
devToggle.addEventListener('click', () => {
    const opening = devPanel.classList.contains('hidden');
    devPanel.classList.toggle('hidden');
    document.body.classList.toggle('dev-open', opening);
    renderTarget();
});
resetRig.addEventListener('click', () => { rig = createRigState(playerSpawn); controls.recenterLook(); });
let wipeArmed = false;
let wipeTimer = null;
wipeSave.addEventListener('click', () => {
    if (!wipeArmed) {
        wipeArmed = true;
        wipeSave.textContent = 'CONFIRM WIPE · NEW SAVE';
        wipeSave.setAttribute('aria-pressed', 'true');
        if (wipeTimer !== null) window.clearTimeout(wipeTimer);
        wipeTimer = window.setTimeout(() => {
            wipeArmed = false;
            wipeTimer = null;
            wipeSave.textContent = 'WIPE SAVE / START FRESH';
            wipeSave.setAttribute('aria-pressed', 'false');
        }, 4200);
        return;
    }
    persistenceSuppressed = true;
    if (!clearMachineSave(saveStorage)) {
        persistenceSuppressed = false;
        showStatus('SAVE WIPE FAILED · LOCAL STORAGE UNAVAILABLE');
        return;
    }
    try {
        window.sessionStorage.removeItem('m3ch4-contract-v1');
        window.sessionStorage.removeItem('m3ch4-recovered-part');
        window.sessionStorage.removeItem('m3ch4-contract-changed');
    } catch { /* machine save is already cleared */ }
    window.location.reload();
});
toggleColliders.addEventListener('click', () => {
    showColliders = !showColliders;
    arena.debugColliders.visible = showColliders;
    if (!showColliders) arena.updateShotAudit(null, false);
    toggleColliders.textContent = `COLLIDERS: ${showColliders ? 'ON' : 'OFF'}`;
});
resolutionToggle.addEventListener('click', () => {
    renderScaleIndex = (renderScaleIndex + 1) % renderScales.length;
    renderScale = renderScales[renderScaleIndex];
    resolutionToggle.textContent = `RES ${Math.round(renderScale * 100)}`;
    resize();
});
// One tiny target-readout; diagnostic detail is available without covering the cockpit.
const targetLabels = {
    structure: 'HULL', mobility: 'LEGS', power: 'POWER', command: 'CAB', combat: 'WEAPON',
};
function handleFieldServiceCompleted(serviceStep) {
    const slot=serviceStep?.slot;
    const part=playerCondition.parts[slot];
    const owned=installedPart(assembly,slot);
    if(part && owned) {
        if(slot==='mobility') {
            restoreFieldServicedDrive(assembly,damage,serviceStep.ratio);
            part.integrity=Math.max(part.integrity,part.maxIntegrity*owned.instance.condition);
        } else owned.instance.condition=part.integrity/Math.max(1,part.maxIntegrity);
        owned.instance.destroyed=!!part.destroyed;
        owned.instance.wear=Math.min(1,(owned.instance.wear??0)+.08);
    }
    if (slot === 'combat' && weaponState) {
        weaponState.reloadLeft = 0;
        weaponState.cooldown = Math.max(weaponState.cooldown, .55);
    }
    updateFunctionalStatus();
    arena.updatePilotDamage(playerCondition);
    renderPartsList();
    renderPartInfo();
    soundReload();
    shotReport.classList.remove('faded', 'disabled-part');
    shotReport.classList.add('penetrated');
    shotReport.textContent = `FIELD SERVICE · ${slot?.toUpperCase()??'SYSTEM'} ONLINE · ${Math.round(serviceStep.ratio*100)}% · COOLDOWN 10s`;
    reportFade = 3.2;
    persistMachine();
}
function handleFieldServiceInterrupted() {
    soundEmpty();
    shotReport.classList.remove('faded', 'penetrated');
    shotReport.classList.add('disabled-part');
    shotReport.textContent = 'FIELD SERVICE INTERRUPTED · STOP COMPLETELY AND HOLD';
    reportFade = 1.8;
}
function renderAmmo() {
    const failure=weaponFailureState(playerCondition,fieldService);
    smokeButton.hidden=!equipmentHas(assembly,'cinder-smoke');
    smokeButton.disabled=inspecting||testEnded||!playerCombatActive||smokeState.charges<=0;
    smokeButton.textContent='SMOKE ×'+smokeState.charges;
    const faults=serviceableSlots(playerCondition);
    const selected=fieldServiceTarget(playerCondition,fieldService);
    const available=playerCombatActive && canFieldService(playerCondition,fieldService);
    const stationary=fieldServiceStationary(rig);
    const inService=fieldService.held;
    const suffix=!playerCombatActive?' · KNOCKED OUT':
        failure==='destroyed'?' · DESTROYED':
        failure==='faulted'?' · DISABLED':
        !playerPower.weaponReady?' · PWR SAG':
        output.weapon<.95?' · DAMAGED':'';
    weaponLabel.textContent=weaponSpec?`${weaponSpec.label}${suffix}`:'NO WEAPON';
    if(weaponSpec)ammoReadout.title=`CONTRACT SUPPLY · ₡${(ammoCostCents(weaponSpec)/100).toFixed(2)} PER SHOT · UNLIMITED RESERVE`;
    const servicePercent=Math.round(fieldService.progress/FIELD_SERVICE_SECONDS*100);
    const cooling=(fieldService.cooldownLeft??0)>0;
    const servicing=faults.length>0 && playerCombatActive;
    ammoReadout.textContent=inService?`SERVICE ${servicePercent}%`:
        servicing?`${faults.length} FAULT${faults.length===1?'':'S'} · ${selected?.toUpperCase()??'—'}`:
        !weaponSpec||!weaponState?'—':
        !playerPower.weaponReady?'PWR SAG':
        weaponState.reloadLeft>0?`RELOAD ${weaponState.reloadLeft.toFixed(1)}s`:
        `${weaponState.loaded} / ${reserveReadout(weaponState)}`;
    const reloading=!!weaponSpec&&!!weaponState&&weaponState.reloadLeft>0;
    const progress=inService?fieldService.progress/FIELD_SERVICE_SECONDS:
        reloading?1-weaponState.reloadLeft/Math.max(.01,weaponSpec.reloadSeconds):0;
    reloadButton.classList.toggle('reloading',reloading||inService);
    reloadButton.style.setProperty('--reload-progress',`${Math.round(Math.max(0,Math.min(1,progress))*100)}%`);
    if(servicing){
        const label=selected?.toUpperCase()??'SYSTEM';
        reloadButton.textContent=inService?`SERVICE ${label} ${servicePercent}%`:
            cooling?`${label} · WAIT ${fieldService.cooldownLeft.toFixed(1)}s`:
            !stationary?`STOP · ${label} SERVICE`:`HOLD ${label} SERVICE`;
        reloadButton.disabled=inspecting||testEnded;
        reloadButton.classList.toggle('servicing',inService);
        reloadButton.title=faults.length>1?'Tap to select another disabled module; hold to service':'Hold still to field-service the disabled module';
    } else {
        reloadButton.textContent=reloading?'RELOADING':'RELOAD';
        reloadButton.classList.remove('servicing');
        reloadButton.disabled=!weaponSpec||!weaponState||weaponState.loaded>=weaponSpec.magazine||weaponState.reserve===0||weaponState.reloadLeft>0;
        reloadButton.title='Reload ammunition';
    }
    syncCockpitInstruments();
    fireButton.disabled=!playerCombatActive||!weaponSpec||!weaponState||!inspection.ready||inspecting||testEnded||!output.weaponOperational||
        (weaponState.reloadLeft>0&&firePointerId===null);
}
function renderTarget() {
    targetReadout.replaceChildren();
    const behavior = document.createElement('div');
    behavior.className = 'target-row';
    behavior.textContent = `MOTION: ${hostileMotion.phase} · ${hostileMotion.navigation}`;
    targetReadout.appendChild(behavior);
    if (serviceableSlots(targetCondition).length) {
        const recovery = document.createElement('div');
        recovery.className = 'target-row';
        const pct = Math.round(primaryEnemyActor.fieldService.progress / FIELD_SERVICE_SECONDS * 100);
        recovery.textContent = primaryEnemyActor.fieldService.held
            ? `SYSTEM RECOVERY: ${primaryEnemyActor.fieldService.activeSlot?.toUpperCase()} ${pct}%`
            : `SYSTEM RECOVERY: ${fieldServiceTarget(targetCondition,primaryEnemyActor.fieldService)?.toUpperCase()} · ${primaryEnemyActor.fieldService.cooldownLeft>0?'COOLDOWN':'SEEKING COVER'}`;
        targetReadout.appendChild(recovery);
    } else if (primaryEnemyActor.fieldService.used) {
        const recovery = document.createElement('div');
        recovery.className = 'target-row';
        recovery.textContent = 'SYSTEM RECOVERY: EMERGENCY RESTART PERFORMED · DEGRADED';
        targetReadout.appendChild(recovery);
    }
    if (devPanel.classList.contains('hidden') && !testYard) {
        const withheld = document.createElement('div');
        withheld.className = 'target-row';
        withheld.textContent = 'ENEMY PART CONDITION UNKNOWN · OBSERVE HIT REACTIONS';
        targetReadout.appendChild(withheld);
        return;
    }
    for (const slot of SLOTS) {
        const part = targetCondition.parts[slot];
        const row = document.createElement('div');
        row.className = 'target-row';
        const label = document.createElement('span');
        label.textContent = `${targetLabels[slot]} · ${part.serial}`;
        const metrics = document.createElement('b');
        const percent = Math.ceil(part.integrity / part.maxIntegrity * 100);
        const consequence = slot === 'mobility' ? ` · DRIVE ${percent}%` :
            slot === 'power' ? ` · GEN ${percent}%` :
                slot === 'combat' ? ` · GUN ${percent > 12 ? 'ACTIVE' : 'OFFLINE'}` : '';
        metrics.textContent = `${percent}% · ARM ${Math.ceil(part.armor)}${consequence}`;
        const bar = document.createElement('i');
        bar.style.transform = `scaleX(${part.integrity / part.maxIntegrity})`;
        if (!part.integrity)
            row.classList.add('target-disabled');
        row.append(label, metrics, bar);
        targetReadout.append(row);
    }
}
function renderDebrief(summary, reason) {
    debriefTitle.textContent = summary.victory ? 'CONTRACT CLEARED' : 'MISSION KILL';
    debriefLines.replaceChildren();
    const money = value=>'₡'+Math.abs(Number(value)||0).toLocaleString();
    const signedMoney = value=>(value>=0?'+':'−')+money(value);
    const rows = [
        ['NET EARNED · CASH CHANGE', signedMoney(summary.netPayout), 'primary','net'],
        ['CONTRACT PAYOUT', '+'+money(summary.grossPayout), '','payout'],
        [`CONTRACT AMMUNITION · ${summary.roundsFired} SHOTS`, '−'+money(summary.ammoCost), '','ammo'],
        ...(summary.ammoAssistance > 0 ? [['CIRCUIT AMMO SUPPORT', '+'+money(summary.ammoAssistance), '','ammo-support']] : []),
        ['WALLET BALANCE', money(summary.creditsAfter), '','balance'],
        ['OPTIONAL REPAIR QUOTE · NOT SPENT', money(summary.repairEstimate), 'repair','estimate'],
        ['BOUT RESULT', summary.victory ? 'VICTORY' : reason, '','result'],
    ];
    for (const [label, value, kind, finance] of rows) {
        const row = document.createElement('div');
        row.className = `debrief-row ${kind}`.trim();
        row.dataset.finance=finance;
        const name = document.createElement('span');
        name.textContent = label;
        const amount = document.createElement('strong');
        amount.textContent = value;
        row.append(name, amount);
        debriefLines.append(row);
    }
    debriefSheet.classList.remove('hidden');
    debriefSheet.setAttribute('aria-hidden', 'false');
    // Publish one explicit UI transition *after* the base report is mounted.
    // BO3 and salvage decorators own separate sections; neither needs to observe
    // and recursively rewrite the other's DOM.
    document.dispatchEvent(new CustomEvent('m3ch4:debrief-opened', { detail: { summary, reason } }));
}
function finishSortie(victory, reason) {
    if (testYard || testEnded)
        return;
    testEnded = true;
    testEndReason = victory ? null : reason;
    stopFireInput();
    stopFieldServiceInput();
    arena.clearRockets();
    // Keep controls for the brief *physical* aftermath only if this mech
    // survived. The result is settled, so weapons/AI are already locked.
    controls.setEnabled(playerCombatActive);
    leaveAlliedObservation();
    const winningTeam = victory ? FRIENDLY_TEAM : HOSTILE_TEAM;
    const survivors = { player: playerCombatActive };
    for (const actor of aiActors) survivors[actor.id] = actor.active;
    const score = scoreBout(boutLedger, { winningTeam, survivors });
    const wrecks = victory ? buildWreckManifests(aiActors.filter(actor => actor.team === HOSTILE_TEAM)) : [];
    const draft = victory ? createSalvageDraft({ draftOrder: score.draftOrder, manifests: wrecks }) : null;
    // Save *current* integrity, armor, actuator damage and serialized inventory
    // BEFORE the synchronous round subscribers read stable fieldability or update
    // machine careers. The old ordering evaluated the previous saved condition.
    syncOwnedWeaponCondition();
    persistMachine();
    // Commit actual observed local-surface impacts at the same sortie checkpoint
    // as combat condition. Includes opponents: an acquired salvage serial can
    // inherit scars recorded while it fought against the player.
    const physicalEvents=arena.drainSurfaceEvents();
    if(physicalEvents.length)storeSurfaceEvents(physicalEvents)
        .catch(error=>console.warn('SURFACE HISTORY UNAVAILABLE:',error?.message||error));
    const resolvedResult = publishBoutResult({
        victory, reason, winningTeam, score, wrecks, draft,
        charter: SCRAPYARD_CHARTER,
        wreckPreservation: victory ? wreckPreservation(wrecks) : 0,
    });
    // Commit independently from money/salvage. The BO3 round identity makes
    // reloads idempotent, and actual ledger events—not guessed damage—supply
    // per-rig / serialized-part history. All stats begin from this release.
    const completedSeries = resolvedResult?.series;
    const stableSnapshot = loadStable(saveStorage).stable;
    const combatRigId = resolvedResult?.round?.rigId || stableSnapshot.activeRigId;
    const combatRig = stableSnapshot.rigs.find(item=>item.id===combatRigId);
    const playerStanding = score.standings.find(item=>item.id==='player') || {};
    const incomingBySlot = {};
    const damageEvents = boutLedger.events.filter(event=>event.type==='damage');
    for (const event of damageEvents) if(event.victimId==='player')
        incomingBySlot[event.slot]=(incomingBySlot[event.slot]||0)+event.armorDamage+event.internalDamage;
    const dealt = damageEvents.filter(event=>event.attackerId==='player' &&
        actorById(event.victimId)?.team===HOSTILE_TEAM);
    const roundSerials = {...assembly.installed};
    const eventTotal = (events,key)=>events.reduce((sum,item)=>sum+(item[key]||0),0);
    const roundKey = completedSeries
        ? completedSeries.id+'/round/'+(resolvedResult?.round?.round||completedSeries.rounds.length)
        : 'standalone-'+Date.now();
    recordCombatRound(saveStorage,{
        id:roundKey,seriesId:completedSeries?.id||'',contractId:completedSeries?.contractId||activeContract.id,
        rigId:combatRigId,rigName:combatRig?.name||assembly.name,
        number:resolvedResult?.round?.round||1,victory,shots:sortieRoundsFired,
        projectiles:sortieProjectiles,hits:Math.min(sortieConfirmedContacts,sortieProjectiles),
        kills:playerStanding.missionKills||0,deaths:boutLedger.events.filter(e=>e.type==='missionKill'&&e.victimId==='player').length,
        assists:playerStanding.assists||0,breaches:playerStanding.breaches||0,
        disables:playerStanding.disables||0,destroys:playerStanding.destroyed||0,
        armorDamage:eventTotal(dealt,'armorDamage'),internalDamage:eventTotal(dealt,'internalDamage'),
        damageTaken:Object.values(incomingBySlot).reduce((sum,n)=>sum+n,0),
        damageTakenBySlot:incomingBySlot,weaponSerial:roundSerials.combat,parts:roundSerials,
    });
    if(!completedSeries || resolvedResult?.terminal)
        recordCombatMatch(saveStorage,{
            id:completedSeries?.id||roundKey,
            contractId:completedSeries?.contractId||activeContract.id,
            outcome:(completedSeries?.finalVictory??victory)?'W':'L',
            playerWins:completedSeries?.playerWins??(victory?1:0),
            enemyWins:completedSeries?.enemyWins??(victory?0:1),
            rounds:completedSeries?.rounds?.length??1,
            rigs:completedSeries?.participatingRigIds||[combatRigId],reason,
        });
    document.dispatchEvent(new CustomEvent('m3ch4:combat-recorded'));
    const summary = settleSortie({
        credits: economy.credits,
        victory,
        roundsFired: sortieRoundsFired,
        ammoCostCents: sortieAmmoCostCents,
        repairEstimate: totalRepairQuote(playerCondition),
    });
    economy.credits = summary.creditsAfter;
    renderEconomy();
    persistMachine();
    const timedDecision=reason?.startsWith('TIME LIMIT')||reason?.startsWith('OVERTIME');
    faultStrip.textContent = timedDecision
        ? (victory?'ROUND WON · TIME DECISION':'ROUND LOST · TIME DECISION')
        : victory ? `CONTRACT CLEARED · HOSTILE TEAM DOWN` : `SORTIE LOST · FRIENDLY TEAM DOWN`;
    faultStrip.classList.remove('nominal');
    faultStrip.classList.toggle('faulted', !victory);
    shotReport.classList.remove('faded');
    shotReport.classList.toggle('disabled-part', !victory);
    shotReport.classList.toggle('penetrated', victory);
    shotReport.textContent = '';
    shotReport.classList.add('faded');
    renderSquadStatus();
    reportFade = 0;
    sortiePhase = 'outro';
    document.body.classList.remove('sortie-outro-active','victory-showcase');
    sortieOutro.classList.add('breather');
    sortieOutroRemaining=SORTIE_BREATHER_SECONDS+SORTIE_SHOWCASE_SECONDS;
    pendingDebrief = { summary, reason };
    pendingWinnerPresentation=null;
    const match = resolvedResult?.series;
    if (match) {
        sortieOutroTitle.textContent = resolvedResult.terminal
            ? (match.finalVictory ? 'CONTRACT WON' : 'CONTRACT LOST')
            : `ROUND ${resolvedResult.round.round} ${victory ? 'WON' : 'LOST'}`;
        sortieOutroReason.textContent =
            `BEST OF THREE · YOU ${match.playerWins} — ${match.enemyWins} HOSTILE` +
            (resolvedResult.terminal ? ' · SERIES COMPLETE' : ' · RETURN TO PIT');
    } else {
        sortieOutroTitle.textContent = victory ? 'SORTIE COMPLETE' : 'SORTIE FAILED';
        sortieOutroReason.textContent = victory ? reason : `${reason} · RECOVERY CREW INBOUND`;
    }
    // The winning side now walks in as physical Three.js machines, assembled
    // from the same authored serialized parts. No screenshot cards or extra
    // WebGL canvas are used for the post-match presentation.
    try {
        const winners=winningMachines(victory,{
            id:'player',label:assembly.name||'YOUR RIG',assembly,
            active:playerCombatActive,condition:playerCondition,
        },friendlySupportActors,aiActors.filter(actor=>actor.team===HOSTILE_TEAM));
        const presentation=winners.map(w=>({
            ...w,condition:w.id==='player'?playerCondition:
                aiActors.find(actor=>actor.id===w.id)?.condition||null,
        }));
        // No abrupt scene cut: queue the parade until the battlefield breath ends.
        pendingWinnerPresentation=presentation;
        winnerTableau.replaceChildren();
        winnerTableau.classList.add('hidden');
    } catch(error) {
        winnerTableau.replaceChildren();
        winnerTableau.classList.add('hidden');
        document.body.classList.remove('victory-showcase');
        sortieOutro.classList.remove('physical-showcase');
        console.warn('PHYSICAL WINNER SHOWCASE UNAVAILABLE',error?.message||error);
        pendingWinnerPresentation=[]; // Still end the breather and lock movement.
    }
    sortieOutro.classList.remove('hidden');
    sortieOutro.classList.toggle('failed', !victory);
    sortieOutro.setAttribute('aria-hidden', 'false');
    assemblyToggle.disabled = true;
    renderAmmo();
    syncCockpitInstruments();
}
function applyAiHitToPlayer(actor, contact, shotDamage = actor.weaponSpec.damage, audible = true) {
    const serviceInterruptedByHit = fieldService.held;
    stopFieldServiceInput();
    if (serviceInterruptedByHit) handleFieldServiceInterrupted();
    const partBefore = playerCondition.parts[contact.slot];
    const before = partSnapshot(partBefore);
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, shotDamage);
    if (hit.internalDamage > 0) {
        const amount = hit.internalDamage / Math.max(1, partBefore.maxIntegrity);
        if (contact.slot === 'mobility')
            damageInstalledPart(assembly, damage, 'mobility', amount, contact.driveSide ?? 'left');
        else
            damageInstalledPart(assembly, damage, contact.slot, amount);
        const installed = installedPart(assembly, contact.slot);
        if (installed)
            playerCondition.parts[contact.slot].integrity = playerCondition.parts[contact.slot].maxIntegrity * installed.instance.condition;
    }
    // Zero integrity is a genuine recoverable disable. Never undo real overkill
    // or inflate the module to a fictional last-hit safety floor.
    syncOwnedPartFate(contact.slot);
    const after = partSnapshot(playerCondition.parts[contact.slot]);
    scoreHit(actor.id, 'player', contact.slot, before, hit, after);
    const nowDisabled = playerCondition.parts[contact.slot].integrity <= 0;
    const visualHit = physicalHitPresentation({ ...hit, destroyed: !!after.destroyed, justDestroyed: !before.destroyed && !!after.destroyed, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled },actor,actorById('player'));
    arena.showCombatantShot(actor.id, contact, visualHit);
    arena.updatePilotDamage(playerCondition);
    signalPlayerHit(contact.slot, { ...visualHit, driveSide: contact.driveSide });
    showVerifiedShieldReadout(contact);
    persistMachine();
    if(audible)soundCombatImpact(visualHit,{slot:contact.slot,
        shielded:!!shieldImpactLabel(contact),cockpit:true});
    rig.impact = Math.min(1, rig.impact + .65);
    updateFunctionalStatus();
    renderPartsList();
    renderPartInfo();
    renderAmmo();
    if(beforeIntegrity>0 && playerCondition.parts[contact.slot].integrity<=0) {
        shotReport.classList.remove('faded','penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = `${targetLabels[contact.slot]} DISABLED · ${countDisabled(playerCondition)}/3 SYSTEM FAILURES · FIELD SERVICE AVAILABLE`;
        reportFade = 5.0;
    }
    const failure = currentSortieFailureReason();
    if (failure) missionKillPlayer(failure, actor.id);
}
/** A real tracer passing nearby provides approximate bearing only.
 * No exact source identity or enemy coordinates enter squad knowledge. */
function warnNearbyAiFromShot(firingTeam,contact){
    if(!contact?.muzzle||!contact?.point)return;
    for(const defender of aiActors){
        if(!defender.active||defender.team===firingTeam||defender.id===contact.actorId)
            continue;
        const evidence=shotThreatEvidence(defender.rig,contact.muzzle,contact.point);
        if(evidence)recordShotEvidence(defender.motion,defender.rig,evidence,aiClock);
    }
}
/** A heated surface is the installed serial, never just a reused station/slot. */
function thermalKeyForContact(contact) {
    if(!contact?.actorId||!contact?.slot)return null;
    const target=contact.actorId==='player'
        ? playerCondition : actorById(contact.actorId)?.condition;
    return moduleHeatKey(contact.actorId,contact.slot,target);
}
function armorForPenetratingContact(contact) {
    const target=contact.actorId==='player' ? playerCondition : actorById(contact.actorId)?.condition;
    return target?.parts?.[contact.slot]?.armor??0;
}
function attemptAiFire(actor, target, shotIndex) {
    if (!actor?.active || !target || target.active === false || inspecting || testEnded || !appSheet.classList.contains('hidden')) return;
    const actorOutput = hostileOutput(actor.condition, actor.behavior);
    if (!actorOutput.operational || !actor.powerSystem.weaponReady || !withinFiringArc(actor.rig, target.rig)) return;
    // Fresh muzzle check: never grant shots merely from optical contact.
    // Favor the pilot's chosen subsystem, then use any actually exposed part.
    const pointUnderThreat=sortieObjective.domination?.points?.some(p=>
        Math.hypot(target.rig.x-p.x,target.rig.z-p.z)<sortieObjective.radius &&
        (p.contested||p.owner===actor.team));
    const assigned=aiPlans[actor.team]?.orders?.[actor.id]??null;
    const contesting=!!assigned?.objectiveId&&sortieObjective.domination?.points?.some(p=>
        p.id===assigned.objectiveId && p.contested &&
        Math.hypot(target.rig.x-p.x,target.rig.z-p.z)<sortieObjective.radius);
    const preferredAim=tacticalAimSlot(hostileAimSlot(shotIndex,actor.behavior.aimPriority),{
        targetSpeed:Math.hypot(target.rig.vx??0,target.rig.vz??0),
        contesting,visibleService:!!target.fieldService?.held});
    const fireControl=assessTargetFireLanes(slot=>
        arena.traceCombatantShot(actor.id,target.id,slot,0,0),target.id,preferredAim);
    if(!fireControl.clear){
        actor.fireLane={...fireControl,targetId:target.id,validUntil:aiClock+.16};
        noteBlockedFire(actor.motion,fireControl.blocker);
        return;
    }
    if(!shouldAttemptTacticalShot(actor,target,{urgent:pointUnderThreat}))return;
    const aimSlot=fireControl.aimSlot;
    if(actor.weaponSpec.fireMode==='continuous'&&
        Math.hypot(actor.rig.x-target.rig.x,actor.rig.z-target.rig.z)>actor.weaponSpec.rangeMeters)return;
    // A real trigger pull consumes ammunition BEFORE resolving the raycast.
    // Cover impacts, misses and friendly obstruction are still fired rounds.
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);
    if (consumed === null) return;
    const rough=1-actor.condition.parts.combat.integrity/
        Math.max(1,actor.condition.parts.combat.maxIntegrity);
    const proximity=Math.hypot(actor.rig.x-rig.x,actor.rig.z-rig.z);
    if(rough>.5&&proximity<14&&consumed%3===1)
        soundSystemEvent('hydraulics',{variant:2,cockpit:false,distance:proximity,strength:(rough-.4)*.18});
    // One external recoil stroke per consumed trigger, not one per physical pellet.
    arena.triggerCombatantFiringEvent(actor.id,actor.weaponSpec.id,{
        brace:actor.rig.brace??0,
        condition:(actor.condition.parts.combat?.integrity??0)/
            Math.max(1,actor.condition.parts.combat?.maxIntegrity??1),
    });
    // Same physical weapon fire-rate authority as the player; degradation
    // can still slow mechanical cycling, but no arbitrary AI trigger clamp.
    actor.weaponState.cooldown *= 1+
        (1-actorOutput.weapon)*.65+(1-actorOutput.power)*.45;
    if(actor.weaponSpec.fireMode!=='continuous')registerPowerShot(actor.powerSystem, actor.assembly);
    // Listen from the player's position, not at the same volume from every
    // opponent across the map. One sound per consumed round, not per pellet.
    if(actor.weaponSpec.fireMode!=='continuous'||consumed%3===1)soundWeaponShot(actor.weaponSpec.id,{
        shotIndex:consumed,
        distance:Math.hypot(actor.rig.x-rig.x,actor.rig.z-rig.z),
        pan:soundBearing(actor.rig,rig,rig.yaw),
        cockpit:false,
    });
    const aimX=target.rig.x-actor.rig.x,aimZ=target.rig.z-actor.rig.z;
    applyRecoil(actor.rig,aiLocomotionConfig(actor),aimX,aimZ,actor.weaponSpec.recoilImpulseNs*stabilizerRecoilMultiplier(actor.assembly,actor.rig));
    // The shot samples the existing state. Only its NEXT shot inherits kick.
    const mountSpread=actor.weaponSpec.fireMode==='automatic'
        ? weaponActionSpreadRadians(actor.weaponSpec,actor.weaponState,actor.rig.brace??0):0;
    const [spreadX, spreadY] = hostileSpread(shotIndex, actorOutput.spreadRadians+mountSpread);
    if(actor.weaponSpec.fireMode==='continuous') {
        const contact=arena.traceCombatantShot(actor.id,target.id,aimSlot,spreadX,spreadY);
        registerWeaponStabilityShot(actor.stabilizer,actor.weaponSpec.id,{
            brace:actor.rig.brace,condition:actorOutput.weapon,massKg:actor.baseConfig.massKg});
        const thermalKey=thermalKeyForContact(contact);
        if(thermalKey&&contact.distance<=actor.weaponSpec.rangeMeters) {
            const thermal=cutContact(thermalCombat,thermalKey,
                1/actor.weaponSpec.roundsPerSecond,actor.weaponSpec.damage);
            if(consumed%2===1)arena.showCuttingArc(contact);
            resolveAiShotContact(actor,target,contact,thermal.damage);
        }
        return;
    }
    if(actor.weaponSpec.fireMode==='projectile') {
        const aim=arena.traceCombatantShot(actor.id,target.id,aimSlot,spreadX,spreadY);
        registerWeaponStabilityShot(actor.stabilizer,actor.weaponSpec.id,{
            brace:actor.rig.brace,condition:actorOutput.weapon,massKg:actor.baseConfig.massKg});
        arena.launchRocket({ownerId:actor.id,muzzle:aim.muzzle,point:aim.point,
            speed:actor.weaponSpec.projectileSpeed,radius:actor.weaponSpec.blastRadius,
            damage:actor.weaponSpec.damage});
        return;
    }
    const contacts=actor.weaponSpec.pellets>1
        ? shotContacts(shotIndex,actor.weaponSpec,
            1+Math.max(0,1-actorOutput.weapon)*.45,
            (x,y)=>arena.traceCombatantShot(actor.id,target.id,aimSlot,
                spreadX+x,spreadY+y)).map(entry=>entry.contact)
        : actor.weaponSpec.fireMode==='charged'
            ? [arena.traceCombatantShot(actor.id,target.id,aimSlot,spreadX,spreadY,true)]
            : [arena.traceCombatantShot(actor.id,target.id,aimSlot,spreadX,spreadY)];
    registerWeaponStabilityShot(actor.stabilizer,actor.weaponSpec.id,{
        brace:actor.rig.brace,condition:actorOutput.weapon,massKg:actor.baseConfig.massKg});
    const packets=actor.weaponSpec.fireMode==='charged'
        ? resolvePenetratingContacts(contacts[0]?.penetrationContacts??contacts,{
            energy:actor.weaponSpec.penetrationEnergy,damage:actor.weaponSpec.damage,
            armorAt:armorForPenetratingContact})
        : contacts.map(contact=>({contact,damage:actor.weaponSpec.damage}));
    actor._scatterImpactAudible=false;
    if(packets.length===0&&contacts[0])resolveAiShotContact(actor,target,contacts[0],0);
    for(const {contact,damage} of packets) {
        resolveAiShotContact(actor,target,contact,damage);
        if(testEnded) break;
    }
    actor._scatterImpactAudible=false;
}
function resolveAiShotContact(actor,target,contact,damage) {
    warnNearbyAiFromShot(actor.team,contact);
    const obstruction = contact.blockedBy ? `COVER ${contact.blockedBy}` :
        contact.actorId && contact.actorId !== target.id ? `RIG ${contact.actorId}` :
        contact.slot === null && contact.distance < 99.5 ? 'WORLD GEOMETRY' : null;
    lastCoverAudit = contact.actorId === target.id
        ? `${actor.id} → ${target.id} · CLEAR · TARGET FIRST`
        : obstruction ? `${actor.id} → ${target.id} · BLOCKED · ${obstruction}`
            : `${actor.id} → ${target.id} · MISS`;
    if (showColliders) arena.updateShotAudit(contact, !obstruction && contact.actorId === target.id);
    // AI pilots register fire directed at them even if a crate catches it. That gives
    // suppression/cover behavior before the first internal-damage event.
    // Physical impacts reveal an attacker bearing. A distant shot intercepted
    // by a wall is not evidence that this target personally came under fire;
    // genuine nearby misses are already handled by warnNearbyAiFromShot().
    if (target.id !== 'player' && target.motion && contact.actorId === target.id)
        noteIncomingFire(target.motion, actor.rig, actor.id, 1.0, target.rig);
    if (obstruction)
        noteBlockedFire(actor.motion, contact.blockedBy ?? (contact.actorId !== target.id ? contact.actorId : null));
    if (contact.slot === null || contact.actorId !== target.id) {
        // Every fired round gets a real tracer even if it only hits cover,
        // another machine, or open air. Damage still requires a valid hit.
        arena.showCombatantShot(actor.id,contact,null);
        return;
    }
    if (target.id === 'player') {
        applyAiHitToPlayer(actor, contact, damage, !actor._scatterImpactAudible);
        actor._scatterImpactAudible=true;
        return;
    }
    interruptAiFieldService(target);
    const beforePart = partSnapshot(target.condition.parts[contact.slot]);
    const beforeIntegrity = target.condition.parts[contact.slot].integrity;
    const hit = applyTargetHit(target.condition, contact.slot, damage);
    const newlyDisabled=beforeIntegrity>0&&target.condition.parts[contact.slot].integrity<=0;
    if(newlyDisabled)noteAiModuleDisabled(target,contact.slot,actor.rig);
    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    noteIncomingFire(target.motion, actor.rig, actor.id,
        hit.internalDamage > 0 ? 1.55 : 1.08,target.rig);
    recordSubsystemHit(target.combatMemory,contact.slot,aiClock);
    const visualHit = physicalHitPresentation({ ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed },actor,target);
    if(!actor._scatterImpactAudible){
        soundCombatImpact(visualHit,{slot:contact.slot,shielded:!!shieldImpactLabel(contact),
            distance:Math.hypot(target.rig.x-rig.x,target.rig.z-rig.z)});
        actor._scatterImpactAudible=true;
    }
    arena.showCombatantShot(actor.id, contact, visualHit);
    arena.updateCombatantDamage(target.id, target.condition);
    if (target.id === 'enemy-0') {
        mirrorTargetCondition(targetAssembly, targetCondition);
        renderTarget();
    }
    const kill = aiWeaponMissionKillReason(target.condition, target.behavior, target.fieldService);
    if (kill) missionKillAiActor(target, kill, actor.id);
}
/** The consumed-round event is the sole authority for mechanical animation.
 * Pellets, penetrated layers and delayed rocket impacts never generate duplicate kicks.
 */
function presentPlayerDischarge(contact,shot) {
    arena.triggerPilotFiringEvent(weaponSpec.id,{
        muzzle:contact?.muzzle,point:contact?.point,brace:rig.brace??0,
        condition:weaponIntegrityRatio(playerCondition),shotIndex:shot,
    });
    soundWeaponMechanism(weaponSpec.id,{shotIndex:shot,cockpit:true});
    const worn=1-weaponIntegrityRatio(playerCondition);
    if(worn>.5 && (weaponSpec.fireMode!=='automatic'||shot%4===1))
        soundSystemEvent('hydraulics',{cockpit:true,variant:2,strength:(worn-.4)*.24});
}
function attemptFire() {
    if (!playerCombatActive || !weaponSpec || !weaponState || !rigConfig || inspecting || testEnded || !inspection.ready || !output.weaponOperational || !playerPower.weaponReady || !appSheet.classList.contains('hidden'))
        return;
    const shot = fireWeapon(weaponState, weaponSpec);
    if (shot === null) {
        if (weaponState.loaded <= 0 && weaponState.reloadLeft === 0) {
            if (!startReload(weaponState, weaponSpec)) {
                soundEmpty();
                fireHeld = false;
            }
        }
        renderAmmo();
        return;
    }
    weaponState.cooldown *= weaponCycleMultiplier(output);
    // Bill the actual consumed discharge, not every pellet, projectile impact,
    // hit, reload, or the holding of the trigger.
    if(!testYard)sortieAmmoCostCents += ammoCostCents(weaponSpec);
    if(weaponSpec.fireMode!=='continuous')registerPowerShot(playerPower, assembly);
    // One trigger pull consumes exactly one shell; each actual pellet
    // traverses the ordinary camera→muzzle raycaster and first real hit.
    const degradedSpread=weaponSpreadMultiplier(output);
    const multi=weaponSpec.pellets>1;
    const [baseX,baseY]=shotSpread(shot,multi ? .004*degradedSpread :
        weaponActionSpreadRadians(weaponSpec,weaponState,rig.brace??0)*degradedSpread);
    if(weaponSpec.fireMode==='projectile') {
        const aim=arena.traceShot(baseX,baseY,weaponSpec.muzzleZ);
        const vx=(aim.point.x-aim.muzzle.x)/Math.max(aim.distance,.001);
        const vz=(aim.point.z-aim.muzzle.z)/Math.max(aim.distance,.001);
        applyRecoil(rig,effectiveConfig,vx,vz,weaponSpec.recoilImpulseNs*stabilizerRecoilMultiplier(assembly,rig));
        registerWeaponStabilityShot(playerMount,weaponSpec.id,{brace:rig.brace,condition:weaponIntegrityRatio(playerCondition),massKg:rigConfig.massKg});
        shotsFired++;sortieRoundsFired++;sortieProjectiles++;
        presentPlayerDischarge(aim,shot);
        soundWeaponShot(weaponSpec.id,{shotIndex:shot,cockpit:true});
        arena.launchRocket({ownerId:'player',muzzle:aim.muzzle,point:aim.point,
            speed:weaponSpec.projectileSpeed,radius:weaponSpec.blastRadius,
            damage:weaponSpec.damage});
        renderAmmo();
        return;
    }
    const contacts=multi
        ? shotContacts(shot,weaponSpec,degradedSpread,
            (x,y)=>arena.traceShot(baseX+x,baseY+y,weaponSpec.muzzleZ))
            .map(entry=>entry.contact)
        : [arena.traceShot(baseX,baseY,weaponSpec.muzzleZ,weaponSpec.fireMode==='charged')];
    const center=contacts[0];
    sortieProjectiles += contacts.length; // scattergun counts physical pellets; arc counts ticks.
    const hostileContacts=contacts.filter(contact=>contact?.slot &&
        actorById(contact.actorId)?.team===HOSTILE_TEAM && actorById(contact.actorId)?.active);
    if(weaponSpec.fireMode==='continuous') {
        const thermalKey=thermalKeyForContact(center);
        if(thermalKey&&center.distance<=weaponSpec.rangeMeters) {
            sortieConfirmedContacts += hostileContacts.length;
            const thermal=cutContact(thermalCombat,thermalKey,
                1/weaponSpec.roundsPerSecond,weaponSpec.damage);
            if(shot%2===1)arena.showCuttingArc(center);
            resolvePlayerShotContact(center,thermal.damage,false,true);
        }
        shotsFired++;sortieRoundsFired++;
        registerWeaponStabilityShot(playerMount,weaponSpec.id,{brace:rig.brace,condition:weaponIntegrityRatio(playerCondition),massKg:rigConfig.massKg});
        presentPlayerDischarge(center,shot);
        if(shot%3===1)soundWeaponShot(weaponSpec.id,{shotIndex:shot,cockpit:true});
        renderAmmo();
        return;
    }
    sortieConfirmedContacts += hostileContacts.length;
    warnNearbyAiFromShot(FRIENDLY_TEAM,center);
    const directionX=(center.point.x-center.muzzle.x)/Math.max(center.distance,.001);
    const directionZ=(center.point.z-center.muzzle.z)/Math.max(center.distance,.001);
    applyRecoil(rig,effectiveConfig,directionX,directionZ,weaponSpec.recoilImpulseNs*stabilizerRecoilMultiplier(assembly,rig));
    registerWeaponStabilityShot(playerMount,weaponSpec.id,{brace:rig.brace,condition:weaponIntegrityRatio(playerCondition),massKg:rigConfig.massKg});
    shotsFired++;
    sortieRoundsFired++;
    presentPlayerDischarge(center,shot);
    // The only cockpit-local blast: short muffled cabin reflections rather
    // than distant outdoor echo. No damage or weapon cadence is modified.
    soundWeaponShot(weaponSpec.id,{shotIndex:shot,cockpit:true});
    let impactSoundPlayed=false;
    if(multi)scatterFeedback={landed:0,pellets:contacts.length,best:null,rank:-1};
    const packets=weaponSpec.fireMode==='charged'
        ? resolvePenetratingContacts(center?.penetrationContacts??contacts,{
            energy:weaponSpec.penetrationEnergy,damage:weaponSpec.damage,
            armorAt:armorForPenetratingContact})
        : contacts.map(contact=>({contact,damage:weaponSpec.damage}));
    if(packets.length===0 && weaponSpec.fireMode==='charged') {
        arena.showShot(center,null);
    }
    for(const {contact,damage} of packets){
        if(testEnded)break;
        const affected=resolvePlayerShotContact(contact,damage,
            !impactSoundPlayed,!multi);
        if(affected)impactSoundPlayed=true;
    }
    if(multi){
        const report=scatterFeedback;scatterFeedback=null;
        if(report?.best){
            const base=report.best.text || (report.best.hit?.justDestroyed?'DESTROYED':
                report.best.hit?.disabled?'DISABLED':
                report.best.hit?.internalDamage>0?'BREACH':
                report.best.hit?.friendlyBlock?'ALLY BLOCK':'ARMOR');
            showHitConfirm(report.best.hit,report.landed+'/'+report.pellets+' · '+base);
        }
        lastHit='S-6 · '+(report?.landed||0)+' / '+contacts.length+' PELLETS ON TARGET';
    }
    // Do not replace a verified six-pellet hit with a generic MISS merely
    // because another pellet in the same shell sailed into empty space.
    if(multi&&!impactSoundPlayed&&!testEnded) {
        const cover=contacts.find(c=>c.blockedBy);
        lastHit=cover?`COVER · ${cover.blockedBy}`:'RANGE SURFACE / MISS';
    }
    renderAmmo();
}
function resolvePlayerShotContact(contact,damage,audible=true,recordMiss=true) {
    if (contact.slot !== null && contact.actorId) {
        const targetActor = actorById(contact.actorId);
        if (!targetActor) return;
        // Once a rig is mission-killed it is just obstructing machinery: either team can
        // shove it or spend ammunition breaking it down into a much smaller remnant.
        if (!targetActor.active) {
            const beforePart = partSnapshot(targetActor.condition.parts[contact.slot]);
            const hit = applyTargetHit(targetActor.condition, contact.slot, damage);
            const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
            targetActor.wreckIntegrity = damageWreckIntegrity(targetActor.wreckIntegrity, damage);
            const cleared = targetActor.wreckIntegrity <= .001;
            if (cleared && !targetActor.wreckCleared) {
                targetActor.wreckCleared = true;
                arena.setCombatantCleared(targetActor.id, true);
            }
            const wreckHit = physicalHitPresentation({
                ...hit, wreckHit: true, cleared,
                justDisabled: beforePart.integrity > 0 && afterPart.integrity <= 0,
                justDestroyed: !beforePart.destroyed && !!afterPart.destroyed,
            },{weaponSpec},targetActor);
            arena.showShot(contact, wreckHit);
            arena.updateCombatantDamage(targetActor.id, targetActor.condition);
            if (targetActor.id === 'enemy-0') {
                mirrorTargetCondition(targetAssembly, targetCondition);
                renderTarget();
            }
            if(audible)soundSystemEvent('part',{variant:2,
                distance:Math.hypot(targetActor.rig.x-rig.x,targetActor.rig.z-rig.z),strength:.50});
            showHitConfirm(wreckHit);
            lastHit = `${targetActor.label} · ${wreckHit.justDestroyed ? 'PART DESTROYED' : `WRECK ${Math.round(targetActor.wreckIntegrity * 100)}%`}`;
            return true;
        }
        if (targetActor.team !== HOSTILE_TEAM) {
            arena.showShot(contact, null);
            if(audible)soundSystemEvent('glance',{variant:1,
                distance:Math.hypot(targetActor.rig.x-rig.x,targetActor.rig.z-rig.z),strength:.43});
            showHitConfirm({ friendlyBlock: true });
            lastHit = `ALLY BLOCK · ${targetActor.label}`;
            return true;
        }
        interruptAiFieldService(targetActor);
        const beforePart = partSnapshot(targetActor.condition.parts[contact.slot]);
        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;
        const hit = applyTargetHit(targetActor.condition, contact.slot, damage);
        const newlyDisabled=beforeIntegrity>0&&targetActor.condition.parts[contact.slot].integrity<=0;
        if(newlyDisabled)noteAiModuleDisabled(targetActor,contact.slot,rig);
        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        noteIncomingFire(targetActor.motion, rig, 'player',
            hit.internalDamage > 0 ? 1.65 : 1.12,targetActor.rig);
        recordSubsystemHit(targetActor.combatMemory,contact.slot,aiClock);
        const visualHit = physicalHitPresentation({ ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed },{weaponSpec},targetActor);
        arena.showShot(contact, visualHit);
        arena.updateCombatantDamage(targetActor.id, targetActor.condition);
        if (targetActor.id === 'enemy-0') {
            mirrorTargetCondition(targetAssembly, targetCondition);
            renderTarget();
        }
        if(audible)soundCombatImpact(visualHit,{slot:contact.slot,
            shielded:!!shieldImpactLabel(contact),focus:true,
            distance:Math.hypot(targetActor.rig.x-rig.x,targetActor.rig.z-rig.z)});
        recoilFlash = .19;
        const shieldText = showVerifiedShieldReadout(contact);
        lastHit = `${targetActor.label} · ${shieldText ?? targetLabels[hit.slot]} · ${hit.serial}`;
        showHitConfirm(visualHit, shieldText ? 'FRAME BLOCK' : newlyDisabled ? `${targetLabels[contact.slot]} DISABLED` : null);
        const kill = aiWeaponMissionKillReason(targetActor.condition, targetActor.behavior, targetActor.fieldService);
        if (kill) missionKillAiActor(targetActor, kill, 'player');
        if (testEnded) return true;
        return true;
    }
    else {
        arena.showShot(contact, null);
        if(recordMiss)lastHit = contact.blockedBy ? `COVER · ${contact.blockedBy}` : 'RANGE SURFACE / MISS';
    }
    return false;
}
fireButton.addEventListener('pointerdown', event => {
    if (inspecting || testEnded || fireButton.disabled || firePointerId !== null)
        return;
    event.preventDefault();
    firePointerId = event.pointerId;
    fireLastX = event.clientX;
    fireLastY = event.clientY;
    fireButton.setPointerCapture(event.pointerId);
    fireHeld = true;
    fireButton.classList.add('firing');
    attemptFire(); // A quick tap must fire even if it ends before the next animation frame.
});
fireButton.addEventListener('pointermove', event => {
    if (event.pointerId !== firePointerId)
        return;
    event.preventDefault();
    // Pointer capture keeps the gesture working outside the visible FIRE button.
    // Both touch surfaces use the same aim mapping and preserve existing body follow.
    controls.dragAim(event.clientX - fireLastX, event.clientY - fireLastY);
    fireLastX = event.clientX;
    fireLastY = event.clientY;
});
const endFirePointer = (event) => {
    if (event.pointerId !== firePointerId)
        return;
    firePointerId = null;
    fireHeld = fireKeyHeld;
    fireButton.classList.remove('firing');
};
fireButton.addEventListener('pointerup', endFirePointer);
fireButton.addEventListener('pointercancel', endFirePointer);
fireButton.addEventListener('lostpointercapture', endFirePointer);
window.addEventListener('pointerup', endFirePointer, true);
window.addEventListener('pointercancel', endFirePointer, true);
window.addEventListener('pointermove', event => {
    if (event.pointerId === firePointerId && event.pointerType !== 'touch' && event.buttons === 0)
        stopFireInput();
}, true);
fireButton.addEventListener('click', event => {
    if (event.detail === 0)
        attemptFire(); // keyboard accessibility
});
window.addEventListener('keydown', event => {
    if (event.code === 'KeyF' && !event.repeat && !inspecting && !testEnded && playerCombatActive) {
        fireKeyHeld = true;
        fireHeld = true;
        attemptFire();
    }
    if (event.code === 'KeyR' && weaponState && weaponSpec && !event.repeat) {
        if (!inspecting && !testEnded && playerCombatActive && serviceableSlots(playerCondition).length) {
            if(event.shiftKey || fieldService.cooldownLeft>0) {
                cycleFieldServiceTarget(playerCondition,fieldService);
                renderAmmo();
                return;
            }
            if (beginFieldService(playerCondition, fieldService, rig)) {
                serviceKeyHeld = true;
                soundReload();
                shotReport.textContent = 'FIELD SERVICE STARTED · HOLD STILL';
                reportFade = 5;
            }
        }
        else startReload(weaponState, weaponSpec);
    }
});
window.addEventListener('keyup', event => {
    if (event.code === 'KeyF') {
        fireKeyHeld = false;
        fireHeld = firePointerId !== null;
    }
    if (event.code === 'KeyR' && serviceKeyHeld) {
        serviceKeyHeld = false;
        if (fieldService.held)
            cancelFieldService(fieldService);
    }
});
window.addEventListener('blur', () => {
    stopFireInput();
    stopFieldServiceInput();
});
let servicePointerStart=0;
reloadButton.addEventListener('pointerdown', event => {
    if(playerCombatActive && serviceableSlots(playerCondition).length) {
        event.preventDefault();
        if(!canFieldService(playerCondition,fieldService)) {
            cycleFieldServiceTarget(playerCondition,fieldService);
            renderAmmo();
            return;
        }
        if(!beginFieldService(playerCondition,fieldService,rig)) {
            renderAmmo();
            return;
        }
        servicePointerStart=performance.now();
        servicePointerId=event.pointerId;
        reloadButton.setPointerCapture(event.pointerId);
        soundReload();
        shotReport.classList.remove('faded','penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent='FIELD SERVICE · HOLD STILL · RELEASE OR MOVE TO ABORT';
        reportFade=5;
        renderAmmo();
        return;
    }
    if(weaponState&&weaponSpec)startReload(weaponState,weaponSpec);
    renderAmmo();
});
const endServicePointer=event=>{
    if(event.pointerId!==servicePointerId)return;
    const quickTap=performance.now()-servicePointerStart<240 &&
        (fieldService.progress??0)<.30;
    servicePointerId=null;
    if(fieldService.held)cancelFieldService(fieldService);
    if(quickTap && serviceableSlots(playerCondition).length>1)
        cycleFieldServiceTarget(playerCondition,fieldService);
    renderAmmo();
};
reloadButton.addEventListener('pointerup',endServicePointer);
reloadButton.addEventListener('pointercancel',endServicePointer);
reloadButton.addEventListener('lostpointercapture',endServicePointer);
reloadButton.addEventListener('click',event=>{
    if(event.detail===0) {
        if(serviceableSlots(playerCondition).length)
            cycleFieldServiceTarget(playerCondition,fieldService);
        else if(weaponState&&weaponSpec)startReload(weaponState,weaponSpec);
        renderAmmo();
    }
});
targetToggle.addEventListener('click', () => {
    const isOpen = targetPanel.classList.toggle('hidden') === false;
    targetToggle.setAttribute('aria-pressed', String(isOpen));
});
resetTarget.addEventListener('click', () => {
    resetSquadBattle();
    boutLedger = createBoutLedger(boutRoster());
    clearBoutResult();
    lastHit = 'SQUAD RIGS REBUILT';
    shotReport.textContent = 'SQUAD RESET · ALL SIX COMBATANTS RESTORED';
    reportFade = 2;
    renderTarget();
});
debriefGarage.addEventListener('click', () => {
    debriefSheet.classList.add('hidden');
    debriefSheet.setAttribute('aria-hidden', 'true');
    toggleInspection(true);
});
// Direct internal-damage injections remain DEV-only and intentionally bypass the
// operating wallet so balance testing never makes diagnostics inaccessible.
for (const button of document.querySelectorAll('[data-damage]')) {
    button.addEventListener('click', () => {
        const type = button.dataset.damage;
        let touched = null;
        if (type === 'restore') {
            resetInstalledDamage(assembly, damage);
            for (const slot of SLOTS)
                restoreTargetPart(playerCondition, assembly, slot);
        }
        else if (type === 'left' || type === 'right') {
            damageInstalledPart(assembly, damage, 'mobility', .25, type);
            touched = 'mobility';
        }
        else if (type === 'power' || type === 'weapon') {
            touched = type === 'power' ? 'power' : 'combat';
            damageInstalledPart(assembly, damage, touched, .25);
        }
        if (touched) {
            const installed = installedPart(assembly, touched);
            if (installed)
                playerCondition.parts[touched].integrity = playerCondition.parts[touched].maxIntegrity * installed.instance.condition;
        }
        arena.updatePilotDamage(playerCondition);
        updateFunctionalStatus();
        renderAmmo();
        renderPartInfo();
        renderPartsList();
        persistMachine();
    });
}
updateFunctionalStatus();
renderPlayerDamageHUD();
renderEconomy();
renderAmmo();
renderTarget();
renderSquadStatus();
// k.3d.0: first closed fight -> accounting -> repair loop over the existing garage.
requestAnimationFrame(frame);
