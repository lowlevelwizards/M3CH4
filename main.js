import * as THREE from 'three';
import { deriveRigConfig } from './assemblyPhysics.js';
import { soundBrace, soundDriveStrain, soundEmpty, soundFire, soundFootScrape, soundImpact, soundReload, soundShield } from './audio.js';
import { shieldImpactLabel } from './frameShielding.js';
import { advanceWeapon, applyRecoil, applyTargetHit, createTargetCondition, createWeaponState, makeRangeTarget, fireWeapon, mirrorTargetCondition, reconcileTargetCondition, restoreTargetPart, shotSpread, startReload, weaponFor } from './combat.js';
import { BY_ID, equipSerial, inspectAssembly, installedPart, remove, SLOTS, generatorMount, setGeneratorMount, } from './components.js';
import { bodyFollowSteer, Controls } from './controls.js';
import { rebuildQuote, repairQuote, settleSortie, totalRepairQuote } from './economy.js';
import { gestureMetrics } from './inspectionCamera.js';
import { createRigState, DEFAULT_WORLD, HOSTILE_SPAWN, PLAYER_SPAWN, physicsYawToViewYaw, stepRig, } from './locomotion.js';
import { createArenaScene } from './scene.js';
import { damageInstalledPart, derateRigConfig, functionalOutput, resetInstalledDamage, weaponCycleMultiplier, weaponSpreadMultiplier, } from './functionalDamage.js';
import { advancePowerSystem, createPowerSystem, powerConstrainedOutput, registerPowerShot } from './powerDynamics.js';
import { FIELD_SERVICE_SECONDS, advanceFieldService, arrestFirstWeaponFailure, beginFieldService, cancelFieldService, canFieldService, createFieldServiceState, fieldServiceStationary, weaponFailureState, weaponIntegrityRatio, weaponMissionKillReason, } from './fieldService.js';
import { driveCondition, repairInstalledPart } from './garage.js';
import { advanceEnemyMotion, createEnemyMotion, withinFiringArc } from './enemyMotion.js';
import { chooseCoverPoint, noteBlockedFire, noteIncomingFire, recentThreatTargetId } from './tacticalAwareness.js';
import { aiWeaponMissionKillReason, aiWeaponRecoveryDirective, aiWeaponRecoveryPosture } from './aiFieldService.js';
import { createWorldModel, observeBattlefield } from './ai/worldModel.js';
import { shotThreatEvidence,recordShotEvidence,counterFlankOrder,
    recordSubsystemHit,threatenedSubsystem,threatFacingPoint } from './ai/combatIntelligence.js';
import { planTeam } from './ai/teamPlanner.js';
import { createStrategicState, evaluateStrategy } from './ai/strategicState.js';
import { createPilotBrain, decidePilot } from './ai/pilotBrain.js';
import { createIntentExecutor, executeIntent } from './ai/intentExecutor.js';
import { createAiTrace, recordAiDecision, formatAiTrace } from './ai/debug.js';
import { prioritizeVisibleTarget, shouldAttemptTacticalShot, tacticalAimSlot } from './ai/adaptiveTactics.js';
import { createFaultSupportState, faultSupportForActor, resetFaultSupportState, updateFaultSupportAssignments } from './faultSupport.js';
import { damagePosture } from './damageBehavior.js';
import { advanceSortieObjective, createSortieObjective, objectivePresentation, objectiveStatusText } from './sortieObjectives.js';
import { clearMachineSave, loadMachine, storeMachine } from './persistence.js';
import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileMissionKillReason, hostileOutput, hostileSpread, } from './hostileRig.js';
import { contractById } from './contracts.js';
import { FRIENDLY_SUPPORTS, HOSTILE_SUPPORT_SPAWNS, FRIENDLY_TEAM, HOSTILE_TEAM, chooseSquadTarget, hostileSupportRecipes, squadCounts, squadOutcome } from './squadBattle.js';
import { damageWreckIntegrity, shoveWreck, wreckCollisionRadius } from './wreckPhysics.js';
import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from './combatPresentation.js';
import { createBoutLedger, recordBoutHit, recordMissionKill, scoreBout } from './boutScoring.js';
import { buildWreckManifests, createSalvageDraft, SCRAPYARD_CHARTER, wreckPreservation } from './salvageDraft.js';
import { clearBoutResult, publishBoutResult } from './boutSession.js';
import { resetDamageFate } from './damageFate.js';
import { partCreditValue } from './partEconomy.js';
import { createPartCard, createPartDetail, installPartGridStyles } from './partGridUI.js';
import { loadStable, serialOwner } from './stable.js';
import { changeInactiveBay, serviceInactiveBay, setInactiveBayGeneratorMount } from './garageBay.js';
import { buyCounterLot } from './usedPartsCounter.js';
import { loadCampaign } from './campaign.js';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.12;
const labels = {
    structure: 'STRUCTURE', mobility: 'MOBILITY', power: 'POWER',
    command: 'COMMAND', combat: 'COMBAT',
};
const symbols = { structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' };
// Loading takes place before either the renderer or the damage/garage UI exists.
// An invalid or inaccessible save never prevents a fresh rig from opening.
let saveStorage = null;
try {
    saveStorage = window.localStorage;
}
catch { /* Safari storage may be unavailable. */ }
const loadedMachine = loadMachine(saveStorage);
const assembly = loadedMachine.assembly;
const damage = loadedMachine.damage;
const economy = loadedMachine.economy;
// A separately owned hostile mech built with the same module definitions.
const targetAssembly = makeRangeTarget();
const activeContract = contractById(targetAssembly.contractId);
let targetCondition = createTargetCondition(targetAssembly);
let sortieObjective = createSortieObjective(activeContract);
// Incoming fire uses the same localized armor/integrity representation, seeded from the owned player's current condition.
const playerCondition = loadedMachine.playerCondition;
let weaponSpec = weaponFor(assembly);
let weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
const hostileWeaponSpec = weaponFor(targetAssembly);
let hostileWeaponState = hostileWeaponSpec ? createWeaponState(hostileWeaponSpec) : null;
let hostileController = createHostileController();
let hostileMotion = createEnemyMotion();
let hostileRig = createRigState(HOSTILE_SPAWN);
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
    powerSystem: createPowerSystem(targetAssembly),
    behavior: activeContract.behavior,
    spawn: HOSTILE_SPAWN, active: true, targetId: 'player', killReason: null,
    fieldService: createFieldServiceState(),
    teamIntent: null, brain: createPilotBrain(), executor: createIntentExecutor(),
    combatMemory:{},lastSurvivalCoverCheck:-Infinity,survivalCover:null,
    wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,
};
function makeSupportActor(id, team, contractId, spawn, label = null) {
    const actorAssembly = makeRangeTarget(contractId);
    if (label) actorAssembly.name = label;
    const behavior = contractById(contractId).behavior;
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
        powerSystem: createPowerSystem(actorAssembly),
        behavior, spawn, active: true, targetId: null, killReason: null,
        fieldService: createFieldServiceState(),
        teamIntent: null, brain: createPilotBrain(), executor: createIntentExecutor(),
        combatMemory:{},lastSurvivalCoverCheck:-Infinity,survivalCover:null,
        wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,
    };
}
const friendlySupportActors = FRIENDLY_SUPPORTS.map(spawn =>
    makeSupportActor(spawn.id, FRIENDLY_TEAM, spawn.contractId, spawn, spawn.label));
const hostileSupportActors = hostileSupportRecipes(targetAssembly.contractId).map((contractId, index) => {
    const spawn = HOSTILE_SUPPORT_SPAWNS[index];
    return makeSupportActor(spawn.id, HOSTILE_TEAM, contractId, spawn);
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
let fieldService = createFieldServiceState();
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
const pilotObstacle = movingObstacleAt('player', PLAYER_SPAWN);
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
    return { ...DEFAULT_WORLD, obstacles: [...DEFAULT_WORLD.obstacles, ...dynamic] };
}
function shoveDisabledWrecks(moverState, moverConfig) {
    const moverRadius = moverConfig?.collisionRadiusM ?? 1;
    for (const actor of aiActors) {
        if (actor.active) continue;
        const wreckRadius = wreckCollisionRadius(actor.baseConfig?.collisionRadiusM ?? 1, actor.wreckAge, actor.wreckCleared);
        const shove = shoveWreck(moverState, actor.rig, moverRadius, wreckRadius, FIXED_DT);
        if (!shove) continue;
        actor.rig.x = THREE.MathUtils.clamp(actor.rig.x + shove.dx, DEFAULT_WORLD.minX + wreckRadius, DEFAULT_WORLD.maxX - wreckRadius);
        actor.rig.z = THREE.MathUtils.clamp(actor.rig.z + shove.dz, DEFAULT_WORLD.minZ + wreckRadius, DEFAULT_WORLD.maxZ - wreckRadius);
        arena.updateCombatantRig(actor.id, actor.rig);
    }
}
function aiLocomotionConfig(actor) {
    const mobility = installedPart(actor.assembly, 'mobility');
    if (mobility) {
        const part = actor.condition.parts.mobility;
        const health = Math.max(0, part.integrity / Math.max(1, part.maxIntegrity));
        actor.driveDamage.drives[mobility.instance.serial] = { left: health, right: health };
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
function arrestAiWeaponFailure(actor, beforeIntegrity, threatRig) {
    if (!actor?.fieldService) return false;
    const faulted = arrestFirstWeaponFailure(actor.condition, actor.fieldService, beforeIntegrity);
    if (!faulted) return false;
    resetDamageFate(actor.condition.parts.combat);
    primeAiWeaponRecovery(actor, threatRig);
    return true;
}
function interruptAiFieldService(actor) {
    if (!actor?.fieldService?.held) return;
    cancelFieldService(actor.fieldService);
    actor.teamPlanLeft = 0;
}
function handleAiFieldServiceCompleted(actor) {
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
        faults.push('WEAPON FAULT · FIELD SERVICE AVAILABLE');
    else if (weaponFailure === 'destroyed' || weaponFailure === 'unrecoverable')
        faults.push('WEAPON LOST');
    else if (output.weapon < .99)
        faults.push(`WEAPON ${Math.round(output.weapon * 100)}%`);
    // A disabled pilot has exactly one persistent priority alarm. Ordinary
    // subsystem telemetry cannot overwrite the mission-kill reason.
    if (!playerCombatActive && playerMissionKillReason) {
        faultStrip.textContent = 'RIG DISABLED · ' + playerMissionKillReason;
        faultStrip.classList.add('faulted');
        faultStrip.classList.remove('nominal');
    } else {
        faultStrip.textContent = faults.length ? `⚠ ${faults.join(' · ')}` : 'SYSTEMS NOMINAL';
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
if (devVersion) devVersion.textContent = document.title.split(' — ')[1] ?? 'BUILD UNKNOWN';
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
const fireButton = required('#fire');
const reloadButton = required('#reload');
const weaponLabel = required('#weapon-label');
const ammoReadout = required('#ammo-count');
const shotReport = required('#shot-report');
const targetToggle = required('#target-toggle');
const targetPanel = required('#target-panel');
const targetReadout = required('#target-readout');
const resetTarget = required('#reset-target');
const rangeCrosshair = required('#center-crosshair');
const faultStrip = required('#fault-strip');
const teamStatus = required('#team-status');
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
const arena = createArenaScene(assembly, targetAssembly);
for (const actor of supportActors)
    arena.addCombatant(actor.id, actor.assembly, actor.team, actor.spawn);
arena.updateTargetDamage(targetCondition);
for (const actor of supportActors)
    arena.updateCombatantDamage(actor.id, actor.condition);
arena.updateObjectivePresentation?.(objectivePresentation(sortieObjective));
let rig = createRigState();
let footScraping = false, drivetrainLoaded = false, footingSoundCooldown = 0;
const controls = new Controls(required('#drive-zone'), required('#drive-knob'), required('#look-zone'), required('#brake'));
let inspecting = false;
let aiMemory=createWorldModel(), aiSnapshot=null, aiPlans={}, aiClock=0,
    aiPlanCooldown=0,aiPerceptionCooldown=0;
let strategicMemory=createStrategicState();
let aiAssaultMemory={friendly:{},hostile:{}};
const aiTrace=createAiTrace();
let selectedPart = null;
let statusTimeout = null;
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
let sortieOutroRemaining = 0;
let pendingDebrief = null;
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
        aiPlans[actor.team]?.orders?.[actor.id]??null,actor.targetId,threatId);
    actor.targetId=candidate?.id??null;
    return candidate??null;
}
const dominationHud=document.createElement('div');
dominationHud.id='domination-hud';
dominationHud.setAttribute('aria-label','Three point Domination score and control');
objectiveStatus.insertAdjacentElement('afterend',dominationHud);
function renderObjectiveStatus() {
    const text = objectiveStatusText(sortieObjective);
    if (objectiveStatus.textContent !== text) objectiveStatus.textContent = text;
    objectiveStatus.classList.toggle('contested', !!sortieObjective?.contested);
    const dom=sortieObjective?.domination;
    const domActive=sortieObjective?.type==='domination'&&!inspecting;
    dominationHud.classList.toggle('hidden',!domActive);
    document.body.classList.toggle('domination-active',!!domActive);
    if (domActive && dom) {
        const points=dom.points.map(p=>p.id+' '+(p.contested?'!':p.owner==='friendly'?'▲':
            p.owner==='hostile'?'▼':'·')+' '+Math.round(Math.abs(p.influence)*100)+'%').join('  |  ');
        const score='DOMINATION  '+Math.floor(sortieObjective.friendlyProgress)+' — '+
            Math.floor(sortieObjective.hostileProgress)+' / '+dom.scoreToWin+'  ·  '+points;
        if(dominationHud.textContent!==score)dominationHud.textContent=score;
    }
    arena.updateObjectivePresentation?.(objectivePresentation(sortieObjective));
}
function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    const screener = friendlySupportActors.find(actor => faultSupportForActor(faultSupportState, actor.id)?.casualtyId === 'player');
    const supportCue = screener ? ` · ${screener.label} COVERING` : '';
    teamStatus.textContent = `ALLY ${counts.friendly}/${friendlyTeamTotal} · HOSTILE ${counts.hostile}/${hostileTeamTotal}${supportCue}`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
    renderObjectiveStatus();
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
    const systems = {};
    let lowest = 1; let disabled = false;
    for (const slot of SLOTS) {
        const part = playerCondition.parts[slot];
        const ratio = playerPartRemaining(part);
        systems[slot] = Math.round(ratio * 100);
        lowest = Math.min(lowest, ratio);
        disabled ||= !!part && part.integrity <= 0;
    }
    const counts = squadCounts(playerCombatActive, aiActors);
    const failure = weaponFailureState(playerCondition, fieldService);
    const weaponStateLabel = !weaponSpec ? 'LOST' : !playerPower.weaponReady ? 'PWR SAG' : failure === 'faulted' ? 'FAULT' : failure === 'destroyed' || failure === 'unrecoverable' ? 'LOST' : output.weapon < .95 ? 'DAMAGED' : weaponState?.reloadLeft > 0 ? 'RELOAD' : 'READY';
    arena.updateCockpitInstruments({
        systems, team: counts, warning: disabled || lowest < .38 ? 2 : lowest < .72 ? 1 : 0,
        drive: { left: output.left, right: output.right },
        weapon: weaponSpec?.label ?? 'NO WEAPON',
        ammo: weaponState ? `${weaponState.loaded}/${weaponState.reserve}` : '—',
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
        element.classList.toggle('breached', part.armor < part.maxArmor * .04);
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
    arena.triggerCockpitHit(slot, cockpitImpactProfile(slot, { internalDamage: hit.internalDamage, disabled: hit.disabled, driveSide: hit.driveSide }));
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
function showHitConfirm(hit, text = null) {
    const destroyed = !!hit?.justDestroyed;
    const kind = hit?.friendlyBlock ? 'friendly' : destroyed ? 'disabled' : hit?.cleared ? 'cleared' : hit?.wreckHit ? 'wreck' : hit?.disabled ? 'disabled' : hit?.internalDamage > 0 ? 'breach' : 'armor';
    const label = text ?? (destroyed ? 'DESTROYED' : kind === 'disabled' ? 'DISABLED' : kind === 'breach' ? 'BREACH' : kind === 'cleared' ? 'WRECK CLEARED' : kind === 'wreck' ? 'WRECK' : kind === 'friendly' ? 'ALLY BLOCK' : 'HIT');
    hitConfirm.textContent = label;
    hitConfirm.className = `hit-confirm visible ${kind}`;
    rangeCrosshair.classList.add('confirmed-hit');
    rangeCrosshair.classList.toggle('breach-hit', kind === 'breach');
    rangeCrosshair.classList.toggle('disable-hit', kind === 'disabled' || kind === 'cleared');
    if (hitConfirmTimer !== null) window.clearTimeout(hitConfirmTimer);
    hitConfirmTimer = window.setTimeout(() => {
        hitConfirm.className = 'hit-confirm';
        rangeCrosshair.classList.remove('breach-hit', 'disable-hit');
        hitConfirmTimer = null;
    }, kind === 'disabled' || kind === 'cleared' ? 620 : 280);
}
function checkSquadOutcome() {
    const outcome = squadOutcome(playerCombatActive, aiActors);
    // Domination is won by score OR by defeating the entire opposing squad.
    // The squad resolver already requires every hostile actor to be disabled;
    // no capture/score mutation is needed and the existing bout outcome stays
    // authoritative for salvage, BO3, and persistent machine damage.
    if (outcome && !testEnded)
        finishSortie(outcome.victory, outcome.reason);
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
    actor.fieldService = createFieldServiceState();
    actor.active = true;
    actor.targetId = null;
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
    actor.driveDamage.drives = {};
    actor.powerSystem = createPowerSystem(actor.assembly);
    arena.setCombatantActive(actor.id, true);
    arena.updateCombatantRig(actor.id, actor.rig);
    arena.updateCombatantDamage(actor.id, actor.condition);
}
function resetSquadBattle() {
    playerMissionKillReason=null;
    leaveAlliedObservation();
    aiMemory=createWorldModel();aiSnapshot=null;aiPlans={};aiClock=0;
    aiPlanCooldown=0;aiPerceptionCooldown=0;
    strategicMemory=createStrategicState();
    aiAssaultMemory={friendly:{},hostile:{}};
    aiTrace.rows.length=0;
    resetFaultSupportState(faultSupportState);
    lastPlayerScreenId = null;
    for (const actor of aiActors) resetAiActor(actor);
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
    if (persistenceSuppressed) return;
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
            symptom.textContent = 'DESTROYED HARDWARE · HOUSE RECOVERY RETURNED THE CARCASS · REBUILD OR REPLACE BEFORE DEPLOYMENT';
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
        });
        partInfo.append(repair);
    }
    else {
        const missing = document.createElement('div');
        missing.className = 'part-purpose missing-part';
        missing.textContent = 'NO MODULE INSTALLED. Choose an owned part below.';
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
                    showStatus(error?.message || 'THIS PHYSICAL COMPONENT CANNOT BE INSTALLED HERE');
                }
            },
        });
        partInfo.append(detail);
    }
    if (fitted) {
        const takeOff = document.createElement('button');
        takeOff.type = 'button';
        takeOff.className = 'remove-option';
        takeOff.textContent = 'REMOVE INSTALLED MODULE';
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
        glyph.textContent = symbols[slot];
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
    rigConfig = deriveRigConfig(assembly);
    playerPower = createPowerSystem(assembly);
    updateFunctionalStatus();
    const nextSpec = weaponFor(assembly);
    if (nextSpec?.id !== weaponSpec?.id)
        weaponState = nextSpec ? createWeaponState(nextSpec) : null;
    weaponSpec = nextSpec;
    arena.setPilotWeapon(weaponSpec);
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
    } catch (error) { request.result = { ok:false, reason:error?.message || 'MODULE CHANGE FAILED' }; }
});
// An inter-round patch writes both persistent saves before reloading. Reconcile the
// same serial into the running in-memory authority first: the normal pagehide save
// must not undo that external, successful field-work transaction.
document.addEventListener('m3ch4:bay-reconcile-patch', event => {
    const serial = event.detail?.serial, slot = event.detail?.slot;
    if (!serial || !SLOTS.includes(slot)) return;
    const saved = loadMachine(saveStorage);
    const authoritativePart = saved.assembly.owned.find(part => part.serial === serial);
    const livePart = assembly.owned.find(part => part.serial === serial);
    if (!authoritativePart || !livePart) return;
    Object.assign(livePart, authoritativePart);
    if (assembly.installed[slot] === serial && saved.assembly.installed[slot] === serial) {
        const snapshot = saved.playerCondition?.parts?.[slot];
        if (snapshot && playerCondition.parts[slot]) Object.assign(playerCondition.parts[slot], snapshot);
        if (slot === 'mobility' && saved.damage?.drives?.[serial])
            damage.drives[serial] = { ...saved.damage.drives[serial] };
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
            if (!fitted) throw new Error('NO INSTALLED MODULE');
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
            request.result = result;
        }
    } catch (error) { request.result = { ok:false, reason:error?.message || 'SERVICE FAILED' }; }
});

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
        sortiePhase = 'combat'; sortieOutroRemaining = 0; pendingDebrief = null;
        reportFade = 0; shotReport.textContent = ''; shotReport.className = 'shot-report faded';
        hitConfirm.className = 'hit-confirm'; rangeCrosshair.classList.remove('confirmed-hit', 'breach-hit', 'disable-hit');
        arena.resetCockpitTransientFeedback();
        assemblyToggle.disabled = false;
        rig = createRigState();
        playerPower = createPowerSystem(assembly);
        playerCombatActive = true;
        resetSquadBattle();
        sortieObjective = createSortieObjective(activeContract);
        renderObjectiveStatus();
        boutLedger = createBoutLedger(boutRoster());
        clearBoutResult();
        controls.recenterLook();
        weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
        fieldService = createFieldServiceState();
        sortieRoundsFired = 0;
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
    if (inspecting) {
        arena.resetOrbit();
        syncInspectorLayout();
    }
    controls.setEnabled(!inspecting && !testEnded && playerCombatActive && appSheet.classList.contains('hidden'));
    accumulator = 0;
}
assemblyToggle.addEventListener('click', () => toggleInspection());
centerView.addEventListener('click', () => controls.recenterLook());
resetOrbitButton.addEventListener('click', () => { arena.resetOrbit(); showStatus('INSPECTION CAMERA RESET'); });
const pointers = new Map();
renderer.domElement.addEventListener('pointerdown', event => {
    if (!inspecting)
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
    if (!pointer || !inspecting)
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
        const panX = after.center.x - before.center.x;
        const panY = after.center.y - before.center.y;
        if (panX || panY)
            arena.panBy(panX, panY, renderer.domElement.clientHeight);
        if (before.separation > 2 && after.separation > 2)
            arena.zoomBy(after.separation / before.separation);
    }
    else if (pointer.dragged) {
        arena.orbitBy(dx, dy);
    }
});
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
let showColliders = false;
function syncInspectorLayout() {
    // The actual canvas bounds (not stale window dimensions) are the camera viewport.
    // This also handles landscape-left / landscape-right and Safari toolbar resizing.
    const rect = renderer.domElement.getBoundingClientRect();
    const bayDock = document.querySelector('#unified-garage-dock');
    const inspector = bayDock && !bayDock.closest('.hidden') ? bayDock : inspectionPanel;
    const panelRight = inspecting ? inspector.getBoundingClientRect().right - rect.left + 12 : 0;
    arena.setInspectorLayout(panelRight, rect.width, rect.height);
}
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
    if (document.visibilityState === 'hidden')
        persistMachine();
});
window.addEventListener('pagehide', persistMachine);
function frame(now) {
    const frameDt = Math.min((now - previousTime) / 1000, MAX_FRAME_DT);
    previousTime = now;
    fps += ((1 / Math.max(frameDt, .0001)) - fps) * .06;
    let input = controls.sample();
    let steps = 0;
    const aftermathDriving = testEnded && sortiePhase === 'outro' && playerCombatActive;
    if (!inspecting && (!testEnded || aftermathDriving) && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {
        accumulator += frameDt;
        while (accumulator >= FIXED_DT && steps < 8) {
            const followSteer = bodyFollowSteer(input.lookYaw);
            const bodySteer = THREE.MathUtils.clamp(input.steer + followSteer, -1, 1);
            syncMovingObstacles();
            if (playerCombatActive) {
                const yawBefore = rig.yaw;
                const wasBraced = rig.braced;
                advancePowerSystem(playerPower, assembly, rig, FIXED_DT,
                    playerCondition.parts.power.integrity / Math.max(1, playerCondition.parts.power.maxIntegrity));
                output = powerConstrainedOutput(staticOutput, playerPower);
                effectiveConfig = derateRigConfig(rigConfig, output);
                stepRig(rig, { throttle: input.throttle, strafe: input.strafe, steer: bodySteer, brake: input.brake }, FIXED_DT, effectiveConfig, combatWorldFor('player'));
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
                if (serviceStep.event === 'completed') handleFieldServiceCompleted();
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
                    aiSnapshot=observeBattlefield(aiMemory,participants,sortieObjective,DEFAULT_WORLD,aiClock);
                    aiPerceptionCooldown=.15; // fast, bounded LOS; team orders remain slow
                }
                if(aiPlanCooldown<=0){
                    const friendlyStrategy=evaluateStrategy(strategicMemory,aiSnapshot,FRIENDLY_TEAM);
                    const hostileStrategy=evaluateStrategy(strategicMemory,aiSnapshot,HOSTILE_TEAM);
                    const previousPlans=aiPlans;
                    aiPlans={
                        friendly:planTeam(aiSnapshot,FRIENDLY_TEAM,{strategy:friendlyStrategy,
                            assaultMemory:aiAssaultMemory.friendly,previousOrders:previousPlans.friendly?.orders}),
                        hostile:planTeam(aiSnapshot,HOSTILE_TEAM,{strategy:hostileStrategy,
                            assaultMemory:aiAssaultMemory.hostile,previousOrders:previousPlans.hostile?.orders}),
                    };
                    aiPlanCooldown=.85;
                }
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
                if (!actor.active) {
                    actor.wreckAge += FIXED_DT;
                    continue;
                }
                const target=resolveActorTarget(actor);
                const actorOutput=hostileOutput(actor.condition,actor.behavior);
                const canManeuver=actorOutput.structure>.05&&actorOutput.command>.05&&
                    actorOutput.power>.12&&actorOutput.mobility>.05;
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
                const support=counterFlankOrder(me,order,alliedView?.allies,
                    alliedView?.contacts,DEFAULT_WORLD,aiClock);
                if(support&&!screenTarget?.active)order=support;
                if(screenTarget?.active&&screenTarget.rig)order={
                    goal:'SCREEN',point:{x:screenTarget.rig.x,z:screenTarget.rig.z},
                    score:.91,reason:'PROTECT FIELD SERVICE',targetActorId:screenTarget.id};
                // A recoverable weapon needs actual defensible ground, not a
                // hardcoded world-edge coordinate. Cache cover searches to
                // avoid doing expensive obstacle evaluation every physics tick.
                if(recovery.active&&recovery.mode==='WITHDRAW'&&target&&
                    (aiClock-(actor.lastServiceCoverCheck??-Infinity)>1.4)){
                    actor.lastServiceCoverCheck=aiClock;
                    actor.serviceCover=chooseCoverPoint(actor.rig,target.rig,DEFAULT_WORLD,
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
                        world:DEFAULT_WORLD,
                        preferredRangeM:actor.behavior?.preferredRangeM,
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
                        radius:p.baseConfig?.collisionRadiusM??1.1,active:p.active}));
                actor.teamIntent=executeIntent(actor.executor,selected,actor.rig,
                    combatWorldFor(actor.id),actorConfig.collisionRadiusM,FIXED_DT,nearbyTraffic);
                recordAiDecision(aiTrace,actor,actor.brain,actor.executor,aiClock);
                if (recovery.begin && !actor.fieldService.held) beginFieldService(actor.condition, actor.fieldService, actor.rig);
                let maneuver = advanceEnemyMotion(actor.motion, actor.rig, target?.rig ?? actor.rig, FIXED_DT, canManeuver, combatWorldFor(actor.id), actorConfig.collisionRadiusM, actor.behavior, actor.teamIntent);
                if (actor.fieldService.held || recovery.mode === 'SETTLE')
                    maneuver = { throttle: 0, strafe: 0, steer: 0, brake: 1 };
                else
                    maneuver = { ...maneuver, throttle: maneuver.throttle * Math.max(.66, posture.paceScale), strafe: (maneuver.strafe ?? 0) * Math.max(.56, posture.strafeScale), steer: maneuver.steer * Math.max(.62, posture.steerScale) };
                // An AI holding a firing position plants the same feet through
                // the same brake input. Do not add a special AI recoil buff.
                const settledToShoot = !recovery.active && !!target &&
                    actor.weaponState?.loaded > 0 && actor.motion?.awareness?.lineOfSight !== false &&
                    withinFiringArc(actor.rig, target.rig) &&
                    Math.hypot(actor.rig.vx, actor.rig.vz) < .24 &&
                    Math.abs(actor.rig.yawRate) < .2 &&
                    Math.abs(maneuver.throttle) < .12 &&
                    Math.abs(maneuver.strafe ?? 0) < .12 &&
                    Math.abs(maneuver.steer) < .12;
                if (settledToShoot) maneuver = { ...maneuver, brake: 1 };
                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                shoveDisabledWrecks(actor.rig, actorConfig);
                if (recovery.mode === 'SETTLE' && !actor.fieldService.held && fieldServiceStationary(actor.rig))
                    beginFieldService(actor.condition, actor.fieldService, actor.rig);
                const serviceStep = advanceFieldService(actor.condition, actor.fieldService, actor.rig, FIXED_DT);
                if (serviceStep.event === 'completed') handleAiFieldServiceCompleted(actor);
                arena.updateCombatantRig(actor.id, actor.rig, {
                    target: target?.rig ?? null, posture, dt: FIXED_DT,
                    weaponFault: recovery.active, weaponServicing: actor.fieldService.held,
                });
                if (actor.id === 'enemy-0') arena.updateHostileNavigation(actor.motion.waypoint);
                if (actor.weaponSpec && actor.weaponState) {
                    advanceWeapon(actor.weaponState, actor.weaponSpec, FIXED_DT);
                    if (actor.weaponState.loaded <= 0 && actor.weaponState.reloadLeft === 0 && actor.weaponState.reserve > 0)
                        startReload(actor.weaponState, actor.weaponSpec);
                    const ready=actor.powerSystem.weaponReady && actor.weaponState.cooldown<=0 &&
                        actor.weaponState.loaded>0&&actor.weaponState.reloadLeft<=0&&
                        !!target&&withinFiringArc(actor.rig,target.rig)&&
                        actor.motion?.awareness?.lineOfSight!==false&&
                        shouldAttemptTacticalShot(actor,target,{urgent:
                            !!sortieObjective.domination?.points?.some(p=>
                                Math.hypot(target.rig.x-p.x,target.rig.z-p.z)<
                                  sortieObjective.radius &&
                                (p.contested||p.owner===actor.team))});
                    const shot=advanceHostileController(actor.controller,
                        actor.condition,FIXED_DT,!target,ready);
                    if(shot!==null&&target)attemptAiFire(actor,target,shot);
                }
            }
            }
            if (!aftermathDriving && !testEnded) {
                const objectiveOutcome = advanceSortieObjective(sortieObjective, battleParticipants(), FIXED_DT);
                renderObjectiveStatus();
                if (objectiveOutcome) finishSortie(objectiveOutcome.victory, objectiveOutcome.reason);
            }
            if (weaponSpec && weaponState) {
                advanceWeapon(weaponState, weaponSpec, FIXED_DT);
                if (fireHeld && playerCombatActive) attemptFire();
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
        weaponServicing: fieldService.held,
    });
    arena.updateCombatEffects(frameDt);
    if (sortiePhase === 'outro') {
        sortieOutroRemaining = Math.max(0, sortieOutroRemaining - frameDt);
        if (sortieOutroRemaining === 0 && pendingDebrief) {
            const next = pendingDebrief; pendingDebrief = null; sortiePhase = 'debrief';
            sortieOutro.classList.add('hidden'); sortieOutro.setAttribute('aria-hidden', 'true');
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
    rangeCrosshair.classList.toggle('confirmed-hit', recoilFlash > 0 || hitConfirmTimer !== null);
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
            `FIELD SVC ${fieldService.used ? 'SPENT' : fieldService.held ? `${Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100)}%` : canFieldService(playerCondition, fieldService) ? 'READY' : '—'}`,
            `FIELDED   ${inspection.ready ? 'YES (CONTRACT)' : 'NO'}`,
            `ADAPTERS  ${inspection.adapters.length}`,
            `RENDER    WORLD ${Math.round(renderScale * 100)}% · HUD HI-RES`,
            `ROUNDS    ${weaponState?.loaded ?? 0}/${weaponState?.reserve ?? 0}`,
            `SHOTS     ${shotsFired} · SORTIE ${sortieRoundsFired}`,
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
    requestAnimationFrame(frame);
}
devToggle.addEventListener('click', () => {
    const opening = devPanel.classList.contains('hidden');
    devPanel.classList.toggle('hidden');
    document.body.classList.toggle('dev-open', opening);
    renderTarget();
});
resetRig.addEventListener('click', () => { rig = createRigState(); controls.recenterLook(); });
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
function handleFieldServiceCompleted() {
    syncOwnedWeaponCondition(true);
    if (weaponState) {
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
    shotReport.textContent = 'FIELD SERVICE COMPLETE · WEAPON BYPASS ONLINE · 20% CONDITION';
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
    const failure = weaponFailureState(playerCondition, fieldService);
    const serviceAvailable = playerCombatActive && canFieldService(playerCondition, fieldService);
    const stationary = fieldServiceStationary(rig);
    const suffix = !playerCombatActive ? ' · MISSION KILLED' : testEnded ? ' · SORTIE ENDED' :
        failure === 'destroyed' ? ' · DESTROYED' :
        failure === 'unrecoverable' ? ' · FAULT · BYPASS SPENT' :
        fieldService.held ? ' · FIELD SERVICE' :
        failure === 'faulted' ? ' · FAULTED' :
        !playerPower.weaponReady ? ' · PWR SAG' :
        output.weapon < .95 ? ' · DAMAGED' : '';
    weaponLabel.textContent = weaponSpec ? `${weaponSpec.label}${suffix}` : 'NO WEAPON';
    const servicePercent = Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100);
    ammoReadout.textContent = !weaponSpec || !weaponState ? '—' :
        fieldService.held ? `SERVICE ${servicePercent}%` :
        serviceAvailable ? `FAULT ${Math.round(weaponIntegrityRatio(playerCondition) * 100)}%` :
        !playerPower.weaponReady ? 'PWR SAG' :
        weaponState.reloadLeft > 0 ? `RELOAD ${weaponState.reloadLeft.toFixed(1)}s` :
            `${weaponState.loaded} / ${weaponState.reserve}`;
    if (serviceAvailable) {
        reloadButton.textContent = fieldService.held ? `FIELD SERVICE ${servicePercent}%` : stationary ? 'HOLD FIELD SERVICE' : 'STOP TO FIELD SERVICE';
        reloadButton.disabled = inspecting || testEnded || !stationary;
        reloadButton.classList.toggle('servicing', fieldService.held);
    }
    else {
        reloadButton.textContent = 'RELOAD';
        reloadButton.classList.remove('servicing');
        reloadButton.disabled = !weaponSpec || !weaponState || weaponState.loaded >= weaponSpec.magazine || weaponState.reserve === 0 || weaponState.reloadLeft > 0;
    }
    // Preserve touch capture if an empty magazine starts reloading during a held
    // FIRE drag. Aim remains usable; the weapon itself still refuses to fire.
    syncCockpitInstruments();
    fireButton.disabled = !playerCombatActive || !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||
        (weaponState.reloadLeft > 0 && firePointerId === null);
}
function renderTarget() {
    targetReadout.replaceChildren();
    const behavior = document.createElement('div');
    behavior.className = 'target-row';
    behavior.textContent = `MOTION: ${hostileMotion.phase} · ${hostileMotion.navigation}`;
    targetReadout.appendChild(behavior);
    if (canFieldService(targetCondition, primaryEnemyActor.fieldService)) {
        const recovery = document.createElement('div');
        recovery.className = 'target-row';
        const pct = Math.round(primaryEnemyActor.fieldService.progress / FIELD_SERVICE_SECONDS * 100);
        recovery.textContent = primaryEnemyActor.fieldService.held
            ? `WEAPON RECOVERY: FIELD SERVICE ${pct}%`
            : 'WEAPON RECOVERY: FAULTED · SEEKING SAFE SERVICE';
        targetReadout.appendChild(recovery);
    } else if (primaryEnemyActor.fieldService.used && hostileOutput(targetCondition, primaryEnemyActor.behavior).weapon > .12) {
        const recovery = document.createElement('div');
        recovery.className = 'target-row';
        recovery.textContent = 'WEAPON RECOVERY: EMERGENCY BYPASS SPENT · DEGRADED';
        targetReadout.appendChild(recovery);
    }
    if (devPanel.classList.contains('hidden')) {
        const withheld = document.createElement('div');
        withheld.className = 'target-row';
        withheld.textContent = 'REMOTE MODULE TELEMETRY WITHHELD · USE VISUAL DAMAGE / HIT CONFIRMATION';
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
    const rows = [
        ['RESULT', summary.victory ? 'VICTORY' : reason, 'primary'],
        ['CONTRACT / RECOVERY', `+₡${summary.grossPayout}`, ''],
        [`AMMUNITION · ${summary.roundsFired} RDS`, `−₡${summary.ammoCost}`, ''],
        ['WALLET CHANGE', `${summary.netPayout >= 0 ? '+' : '−'}₡${Math.abs(summary.netPayout)}`, 'primary'],
        ['REPAIR ESTIMATE · NOT SPENT', `₡${summary.repairEstimate}`, 'repair'],
        ['BALANCE', `₡${summary.creditsAfter}`, ''],
    ];
    for (const [label, value, kind] of rows) {
        const row = document.createElement('div');
        row.className = `debrief-row ${kind}`.trim();
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
    if (testEnded)
        return;
    testEnded = true;
    testEndReason = victory ? null : reason;
    stopFireInput();
    stopFieldServiceInput();
    // The bout state is final, but a surviving pilot gets a short physical aftermath
    // before the report covers the yard. Fire/service stay locked by testEnded.
    controls.setEnabled(victory && playerCombatActive && appSheet.classList.contains('hidden'));
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
    const resolvedResult = publishBoutResult({
        victory, reason, winningTeam, score, wrecks, draft,
        charter: SCRAPYARD_CHARTER,
        wreckPreservation: victory ? wreckPreservation(wrecks) : 0,
    });
    const summary = settleSortie({
        credits: economy.credits,
        victory,
        roundsFired: sortieRoundsFired,
        repairEstimate: totalRepairQuote(playerCondition),
    });
    economy.credits = summary.creditsAfter;
    renderEconomy();
    persistMachine();
    faultStrip.textContent = victory ? `CONTRACT CLEARED · HOSTILE TEAM DOWN` : `SORTIE LOST · FRIENDLY TEAM DOWN`;
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
    // A complete squad wipe resolves immediately; territory/score outcomes keep
    // their short physical aftermath. This does not bypass rewards or BO3 scoring.
    sortieOutroRemaining = squadOutcome(playerCombatActive, aiActors)
        ? 0 : SORTIE_OUTRO_SECONDS;
    pendingDebrief = { summary, reason };
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
    sortieOutro.classList.remove('hidden');
    sortieOutro.classList.toggle('failed', !victory);
    sortieOutro.setAttribute('aria-hidden', 'false');
    assemblyToggle.disabled = true;
    renderAmmo();
    syncCockpitInstruments();
}
function applyAiHitToPlayer(actor, contact) {
    const serviceInterruptedByHit = fieldService.held;
    stopFieldServiceInput();
    if (serviceInterruptedByHit) handleFieldServiceInterrupted();
    const partBefore = playerCondition.parts[contact.slot];
    const before = partSnapshot(partBefore);
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, actor.weaponSpec.damage);
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
    let weaponFaulted = false;
    if (contact.slot === 'combat') {
        weaponFaulted = arrestFirstWeaponFailure(playerCondition, fieldService, beforeIntegrity);
        if (weaponFaulted) {
            resetDamageFate(playerCondition.parts.combat);
            syncOwnedWeaponCondition(false);
        }
    }
    syncOwnedPartFate(contact.slot);
    const after = partSnapshot(playerCondition.parts[contact.slot]);
    scoreHit(actor.id, 'player', contact.slot, before, hit, after);
    const nowDisabled = playerCondition.parts[contact.slot].integrity <= 0;
    const visualHit = { ...hit, destroyed: !!after.destroyed, justDestroyed: !before.destroyed && !!after.destroyed, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled };
    arena.showCombatantShot(actor.id, contact, visualHit);
    arena.updatePilotDamage(playerCondition);
    signalPlayerHit(contact.slot, { ...visualHit, driveSide: contact.driveSide });
    showVerifiedShieldReadout(contact);
    persistMachine();
    if (shieldImpactLabel(contact)) soundShield(); else soundImpact();
    rig.impact = Math.min(1, rig.impact + .65);
    updateFunctionalStatus();
    renderPartsList();
    renderPartInfo();
    renderAmmo();
    if (weaponFaulted) {
        shotReport.classList.remove('faded', 'penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = 'WEAPON FAULT · EMERGENCY BYPASS AVAILABLE · STOP BEHIND COVER AND HOLD FIELD SERVICE';
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
        if(evidence)recordShotEvidence(defender.motion,defender.rig,evidence);
    }
}
function attemptAiFire(actor, target, shotIndex) {
    if (!actor?.active || !target || target.active === false || inspecting || testEnded || !appSheet.classList.contains('hidden')) return;
    const actorOutput = hostileOutput(actor.condition, actor.behavior);
    if (!actorOutput.operational || !actor.powerSystem.weaponReady || !withinFiringArc(actor.rig, target.rig)) return;
    // Do not knowingly waste a trigger cycle through solid cover. Actual ballistic
    // raycasts remain authoritative and can still discover low cover / intervening rigs.
    if (actor.motion?.awareness?.lineOfSight === false) return;
    const pointUnderThreat=sortieObjective.domination?.points?.some(p=>
        Math.hypot(target.rig.x-p.x,target.rig.z-p.z)<sortieObjective.radius &&
        (p.contested||p.owner===actor.team));
    if(!shouldAttemptTacticalShot(actor,target,{urgent:pointUnderThreat}))return;
    // A real trigger pull consumes ammunition BEFORE resolving the raycast.
    // Cover impacts, misses and friendly obstruction are still fired rounds.
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);
    if (consumed === null) return;
    // Same physical weapon fire-rate authority as the player; degradation
    // can still slow mechanical cycling, but no arbitrary AI trigger clamp.
    actor.weaponState.cooldown *= 1+
        (1-actorOutput.weapon)*.65+(1-actorOutput.power)*.45;
    registerPowerShot(actor.powerSystem, actor.assembly);
    soundFire();
    const aimX=target.rig.x-actor.rig.x,aimZ=target.rig.z-actor.rig.z;
    applyRecoil(actor.rig,aiLocomotionConfig(actor),aimX,aimZ,actor.weaponSpec.recoilImpulseNs);
    const [spreadX, spreadY] = hostileSpread(shotIndex, actorOutput.spreadRadians);
    const assigned=aiPlans[actor.team]?.orders?.[actor.id]??null;
    const contesting=!!assigned?.objectiveId&&sortieObjective.domination?.points?.some(p=>
        p.id===assigned.objectiveId && p.contested &&
        Math.hypot(target.rig.x-p.x,target.rig.z-p.z)<sortieObjective.radius);
    const aimSlot=tacticalAimSlot(hostileAimSlot(shotIndex,actor.behavior.aimPriority),{
        targetSpeed:Math.hypot(target.rig.vx??0,target.rig.vz??0),
        contesting,visibleService:!!target.fieldService?.held});
    const contact = arena.traceCombatantShot(actor.id, target.id, aimSlot, spreadX, spreadY);
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
    if (target.id !== 'player' && target.motion)
        noteIncomingFire(target.motion, actor.rig, actor.id, contact.actorId === target.id ? 1.0 : .48);
    if (obstruction)
        noteBlockedFire(actor.motion, contact.blockedBy ?? (contact.actorId !== target.id ? contact.actorId : null));
    if (contact.slot === null || contact.actorId !== target.id) {
        // Every fired round gets a real tracer even if it only hits cover,
        // another machine, or open air. Damage still requires a valid hit.
        arena.showCombatantShot(actor.id,contact,null);
        return;
    }
    if (target.id === 'player') {
        applyAiHitToPlayer(actor, contact);
        return;
    }
    interruptAiFieldService(target);
    const beforePart = partSnapshot(target.condition.parts[contact.slot]);
    const beforeIntegrity = target.condition.parts[contact.slot].integrity;
    const hit = applyTargetHit(target.condition, contact.slot, actor.weaponSpec.damage);
    const weaponFaulted = contact.slot === 'combat' && arrestAiWeaponFailure(target, beforeIntegrity, actor.rig);
    const weaponRecoverable = contact.slot === 'combat' && canFieldService(target.condition, target.fieldService);
    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    noteIncomingFire(target.motion, actor.rig, actor.id,
        hit.internalDamage > 0 ? 1.55 : 1.08,target.rig);
    recordSubsystemHit(target.combatMemory,contact.slot,aiClock);
    const visualHit = { ...hit, justDisabled: !weaponRecoverable && beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };
    arena.showCombatantShot(actor.id, contact, visualHit);
    arena.updateCombatantDamage(target.id, target.condition);
    if (target.id === 'enemy-0') {
        mirrorTargetCondition(targetAssembly, targetCondition);
        renderTarget();
    }
    const kill = aiWeaponMissionKillReason(target.condition, target.behavior, target.fieldService);
    if (kill) missionKillAiActor(target, kill, actor.id);
}
function attemptFire() {
    if (!playerCombatActive || !weaponSpec || !weaponState || !rigConfig || inspecting || testEnded || !inspection.ready || !output.weaponOperational || !playerPower.weaponReady || !appSheet.classList.contains('hidden'))
        return;
    const shot = fireWeapon(weaponState, weaponSpec);
    if (shot === null) {
        if (weaponState.loaded <= 0 && weaponState.reloadLeft === 0) {
            if (startReload(weaponState, weaponSpec))
                soundReload();
            else {
                soundEmpty();
                fireHeld = false;
            }
        }
        renderAmmo();
        return;
    }
    weaponState.cooldown *= weaponCycleMultiplier(output);
    registerPowerShot(playerPower, assembly);
    const [spreadX, spreadY] = shotSpread(shot, weaponSpec.spread * weaponSpreadMultiplier(output));
    const contact = arena.traceShot(spreadX, spreadY, weaponSpec.muzzleZ);
    warnNearbyAiFromShot(FRIENDLY_TEAM,contact);
    const directionX = (contact.point.x - contact.muzzle.x) / Math.max(contact.distance, .001);
    const directionZ = (contact.point.z - contact.muzzle.z) / Math.max(contact.distance, .001);
    applyRecoil(rig, effectiveConfig, directionX, directionZ, weaponSpec.recoilImpulseNs);
    shotsFired++;
    sortieRoundsFired++;
    soundFire();
    if (contact.slot !== null && contact.actorId) {
        const targetActor = actorById(contact.actorId);
        if (!targetActor) return;
        // Once a rig is mission-killed it is just obstructing machinery: either team can
        // shove it or spend ammunition breaking it down into a much smaller remnant.
        if (!targetActor.active) {
            const beforePart = partSnapshot(targetActor.condition.parts[contact.slot]);
            const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
            const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
            targetActor.wreckIntegrity = damageWreckIntegrity(targetActor.wreckIntegrity, weaponSpec.damage);
            const cleared = targetActor.wreckIntegrity <= .001;
            if (cleared && !targetActor.wreckCleared) {
                targetActor.wreckCleared = true;
                arena.setCombatantCleared(targetActor.id, true);
            }
            const wreckHit = {
                ...hit, wreckHit: true, cleared,
                justDisabled: beforePart.integrity > 0 && afterPart.integrity <= 0,
                justDestroyed: !beforePart.destroyed && !!afterPart.destroyed,
            };
            arena.showShot(contact, wreckHit);
            arena.updateCombatantDamage(targetActor.id, targetActor.condition);
            if (targetActor.id === 'enemy-0') {
                mirrorTargetCondition(targetAssembly, targetCondition);
                renderTarget();
            }
            soundImpact();
            showHitConfirm(wreckHit);
            lastHit = `${targetActor.label} · ${wreckHit.justDestroyed ? 'PART DESTROYED' : `WRECK ${Math.round(targetActor.wreckIntegrity * 100)}%`}`;
            renderAmmo();
            return;
        }
        if (targetActor.team !== HOSTILE_TEAM) {
            arena.showShot(contact, null);
            soundImpact();
            showHitConfirm({ friendlyBlock: true });
            lastHit = `ALLY BLOCK · ${targetActor.label}`;
            renderAmmo();
            return;
        }
        interruptAiFieldService(targetActor);
        const beforePart = partSnapshot(targetActor.condition.parts[contact.slot]);
        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;
        const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
        const weaponFaulted = contact.slot === 'combat' && arrestAiWeaponFailure(targetActor, beforeIntegrity, rig);
        const weaponRecoverable = contact.slot === 'combat' && canFieldService(targetActor.condition, targetActor.fieldService);
        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        noteIncomingFire(targetActor.motion, rig, 'player',
            hit.internalDamage > 0 ? 1.65 : 1.12,targetActor.rig);
        recordSubsystemHit(targetActor.combatMemory,contact.slot,aiClock);
        const visualHit = { ...hit, justDisabled: !weaponRecoverable && beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };
        arena.showShot(contact, visualHit);
        arena.updateCombatantDamage(targetActor.id, targetActor.condition);
        if (targetActor.id === 'enemy-0') {
            mirrorTargetCondition(targetAssembly, targetCondition);
            renderTarget();
        }
        if (shieldImpactLabel(contact)) soundShield(); else soundImpact();
        recoilFlash = .19;
        const shieldText = showVerifiedShieldReadout(contact);
        lastHit = `${targetActor.label} · ${shieldText ?? targetLabels[hit.slot]} · ${hit.serial}`;
        showHitConfirm(hit, shieldText ? 'FRAME BLOCK' : weaponRecoverable ? 'WEAPON FAULT' : null);
        const kill = aiWeaponMissionKillReason(targetActor.condition, targetActor.behavior, targetActor.fieldService);
        if (kill) missionKillAiActor(targetActor, kill, 'player');
        if (testEnded) return;
    }
    else {
        arena.showShot(contact, null);
        lastHit = contact.blockedBy ? `COVER · ${contact.blockedBy}` : 'RANGE SURFACE / MISS';
    }
    renderAmmo();
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
        if (!inspecting && !testEnded && playerCombatActive && canFieldService(playerCondition, fieldService)) {
            if (beginFieldService(playerCondition, fieldService, rig)) {
                serviceKeyHeld = true;
                soundReload();
                shotReport.textContent = 'FIELD SERVICE STARTED · HOLD STILL';
                reportFade = 5;
            }
        }
        else if (startReload(weaponState, weaponSpec))
            soundReload();
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
reloadButton.addEventListener('pointerdown', event => {
    if (playerCombatActive && canFieldService(playerCondition, fieldService)) {
        if (!beginFieldService(playerCondition, fieldService, rig)) {
            renderAmmo();
            return;
        }
        event.preventDefault();
        servicePointerId = event.pointerId;
        reloadButton.setPointerCapture(event.pointerId);
        soundReload();
        shotReport.classList.remove('faded', 'penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = 'FIELD SERVICE STARTED · HOLD STILL · RELEASE OR MOVE TO ABORT';
        reportFade = 5;
        renderAmmo();
        return;
    }
    if (weaponState && weaponSpec && startReload(weaponState, weaponSpec))
        soundReload();
    renderAmmo();
});
const endServicePointer = event => {
    if (event.pointerId !== servicePointerId)
        return;
    servicePointerId = null;
    if (fieldService.held)
        cancelFieldService(fieldService);
    renderAmmo();
};
reloadButton.addEventListener('pointerup', endServicePointer);
reloadButton.addEventListener('pointercancel', endServicePointer);
reloadButton.addEventListener('lostpointercapture', endServicePointer);
reloadButton.addEventListener('click', event => {
    if (event.detail === 0 && !canFieldService(playerCondition, fieldService)) {
        if (weaponState && weaponSpec && startReload(weaponState, weaponSpec))
            soundReload();
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
