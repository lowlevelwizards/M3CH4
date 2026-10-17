from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing replacement anchor in {path}: {old[:100]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'non-unique replacement anchor in {path}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))

def sub_once(path, pattern, replacement, flags=0):
    text = read(path)
    new, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'regex replacement count {count} in {path}: {pattern[:100]!r}')
    write(path, new)

# k.3n.1: fix the small coordination foundation written before the interrupted turn.
sub_once('squadCoordination.js',
    r"function centroid\(actors\) \{.*?\n\}\n\nfunction deterministicSide",
    """function centroid(actors) {
    const live = (actors ?? []).filter(actor => actor?.active !== false);
    if (!live.length) return null;
    let x = 0, z = 0;
    for (const actor of live) {
        const rig = rigOf(actor);
        x += rig?.x ?? 0;
        z += rig?.z ?? 0;
    }
    return { x: x / live.length, z: z / live.length };
}

function deterministicSide""", re.S)

# k.3n.2: authored objectives on top of the existing campaign jobs.
replace_once('contracts.js',
"""        loadout: yardLoadout, behavior: YARD_DOG_BEHAVIOR,
        salvagePriority:""",
"""        loadout: yardLoadout, behavior: YARD_DOG_BEHAVIOR,
        objective: Object.freeze({ type: 'elimination', label: 'BREAK HOSTILE TEAM', description: 'Win the opening bout by making the opposing squad combat ineffective.' }),
        salvagePriority:""")
replace_once('contracts.js',
"""        loadout: yardLoadout, behavior: RECOVERY_BEHAVIOR,
        salvagePriority:""",
"""        loadout: yardLoadout, behavior: RECOVERY_BEHAVIOR,
        objective: Object.freeze({ type: 'recovery', label: 'SECURE RECOVERY SITE', description: 'Hold the marked east-yard recovery pad uncontested.', point: Object.freeze({ x: 16, z: 1.5 }), radius: 4.8, holdSeconds: 8.5 }),
        salvagePriority:""")
replace_once('contracts.js',
"""        behavior: CUTTER_BEHAVIOR,
        salvagePriority:""",
"""        behavior: CUTTER_BEHAVIOR,
        objective: Object.freeze({ type: 'control', label: 'HOLD WEST CONTROL', description: 'Control the marked west-yard work zone while Cutter contests it.', point: Object.freeze({ x: -16, z: -1 }), radius: 4.8, holdSeconds: 11 }),
        salvagePriority:""")
replace_once('contracts.js',
"""        behavior: MULE_BEHAVIOR,
        salvagePriority:""",
"""        behavior: MULE_BEHAVIOR,
        objective: Object.freeze({ type: 'breakthrough', label: 'BREAK THE FAR LINE', description: 'Get a friendly rig into the hostile backline and hold long enough to break through.', friendlyGoal: Object.freeze({ x: 0, z: -20 }), hostileGoal: Object.freeze({ x: 0, z: 20 }), radius: 4.4, holdSeconds: 5.5 }),
        salvagePriority:""")
replace_once('contracts.js',
"""        loadout: yardLoadout, behavior: YARD_DOG_BEHAVIOR,
        salvagePriority: Object.freeze(['combat', 'mobility', 'structure', 'power', 'command']),""",
"""        loadout: yardLoadout, behavior: YARD_DOG_BEHAVIOR,
        objective: Object.freeze({ type: 'elimination', label: 'BREAK THE CIRCUIT CREW', description: 'The final is a straight mixed-role squad fight. Make the opposing team combat ineffective.' }),
        salvagePriority: Object.freeze(['combat', 'mobility', 'structure', 'power', 'command']),""")

replace_once('contractUI.js',
"""    if (copy) copy.textContent = `${contract.kind} · ${contract.role} · RISK ${contract.risk}. ${contract.briefing} Known equipment: ${contract.knownEquipment.join(' · ')}.`;""",
"""    if (copy) copy.textContent = `${contract.kind} · ${contract.role} · RISK ${contract.risk}. Objective: ${contract.objective?.label ?? 'BREAK HOSTILE TEAM'}. ${contract.briefing} Known equipment: ${contract.knownEquipment.join(' · ')}.`;""")
replace_once('contractUI.js',
"""    const role = document.createElement('span'); role.className = 'node-role'; role.textContent = `${contract.kind} · RISK ${contract.risk}`;""",
"""    const role = document.createElement('span'); role.className = 'node-role'; role.textContent = `${contract.kind} · ${contract.objective?.label ?? 'ELIMINATION'} · RISK ${contract.risk}`;""")

# k.3n.1: team intent influences movement without replacing tactical awareness or physics.
replace_once('enemyMotion.js',
"""export function advanceEnemyMotion(motion, enemy, player, dt, canMove = true, world = DEFAULT_WORLD, radius = .95, behavior = null) {""",
"""export function advanceEnemyMotion(motion, enemy, player, dt, canMove = true, world = DEFAULT_WORLD, radius = .95, behavior = null, teamIntent = null) {""")
replace_once('enemyMotion.js',
"""    else {
        base = tacticalManeuver(motion, enemy, trackingPoint, profile);
        if (tactical.mode === 'SEARCH') {
            motion.phase = 'REPOSITION';
            motion.navigation = `LAST CONTACT · ${tactical.blockedBy ?? 'LOS LOST'}`;
        }
        else if (tactical.mode === 'UNDER_FIRE') {
            motion.phase = 'UNDER FIRE';
            motion.navigation = `UNDER FIRE · ${motion.navigation}`;
        }
    }""",
"""    else if (tactical.mode === 'SEARCH') {
        base = tacticalManeuver(motion, enemy, trackingPoint, profile);
        motion.phase = 'REPOSITION';
        motion.navigation = `LAST CONTACT · ${tactical.blockedBy ?? 'LOS LOST'}`;
    }
    else if (teamIntent?.point) {
        const intentDistance = distance(from, teamIntent.point);
        const targetSteer = clamp(headingError(enemy, player) * profile.steerGain - enemy.yawRate * profile.yawRateDamping);
        if (teamIntent.mode === 'ANCHOR' && intentDistance < 2.2) {
            base = { throttle: 0, strafe: 0, steer: targetSteer, brake: Math.max(.52, teamIntent.brakeBias ?? 0) };
        }
        else if (intentDistance > 1.15) {
            base = driveToward(enemy, teamIntent.point, intentDistance);
            base.steer = targetSteer;
            base.throttle *= teamIntent.throttleScale ?? 1;
            base.strafe = clamp(base.strafe + (teamIntent.strafeBias ?? 0));
            base.brake = Math.max(base.brake ?? 0, teamIntent.brakeBias ?? 0);
        }
        else {
            base = tacticalManeuver(motion, enemy, player, profile);
        }
        motion.phase = teamIntent.mode ?? motion.phase;
        motion.navigation = `${teamIntent.role ?? 'SQUAD'} · ${teamIntent.note ?? teamIntent.mode ?? 'COORDINATE'}`;
        if (tactical.mode === 'UNDER_FIRE') motion.navigation = `UNDER FIRE · ${motion.navigation}`;
    }
    else {
        base = tacticalManeuver(motion, enemy, player, profile);
        if (tactical.mode === 'UNDER_FIRE') {
            motion.phase = 'UNDER FIRE';
            motion.navigation = `UNDER FIRE · ${motion.navigation}`;
        }
    }""")

# k.3o.1: presentation identity rides existing weapon stats instead of rebalancing damage.
replace_once('combat.js',
"""    'gun-cannon': { id: 'gun-cannon', label: 'TRAINING CANNON', magazine: 12, spareRounds: 60, roundsPerSecond: 2.4, reloadSeconds: 2.5, damage: 38, recoilImpulseNs: 1725, spread: .004, muzzleZ: -1.90 },
    'gun-short': { id: 'gun-short', label: 'STUMP CANNON', magazine: 8, spareRounds: 48, roundsPerSecond: 2.0, reloadSeconds: 2.1, damage: 47, recoilImpulseNs: 2550, spread: .012, muzzleZ: -1.31 },
    'gun-light': { id: 'gun-light', label: 'NEEDLE CANNON', magazine: 16, spareRounds: 80, roundsPerSecond: 3.5, reloadSeconds: 2.8, damage: 28, recoilImpulseNs: 1050, spread: .002, muzzleZ: -2.73 },""",
"""    'gun-cannon': { id: 'gun-cannon', label: 'TRAINING CANNON', magazine: 12, spareRounds: 60, roundsPerSecond: 2.4, reloadSeconds: 2.5, damage: 38, recoilImpulseNs: 1725, spread: .004, muzzleZ: -1.90, visualRecoil: .92, visualRecovery: 3.05, muzzleFlashSeconds: .095, handling: 'UTILITY / BALANCED' },
    'gun-short': { id: 'gun-short', label: 'STUMP CANNON', magazine: 8, spareRounds: 48, roundsPerSecond: 2.0, reloadSeconds: 2.1, damage: 47, recoilImpulseNs: 2550, spread: .012, muzzleZ: -1.31, visualRecoil: 1.38, visualRecovery: 2.25, muzzleFlashSeconds: .135, handling: 'CLUNKY / HEAVY KICK' },
    'gun-light': { id: 'gun-light', label: 'NEEDLE CANNON', magazine: 16, spareRounds: 80, roundsPerSecond: 3.5, reloadSeconds: 2.8, damage: 28, recoilImpulseNs: 1050, spread: .002, muzzleZ: -2.73, visualRecoil: .56, visualRecovery: 4.8, muzzleFlashSeconds: .065, handling: 'LIGHT / FAST RECOVERY' },""")

# Main combat integration.
replace_once('main.js',
"""import { noteBlockedFire, noteIncomingFire, recentThreatTargetId } from './tacticalAwareness.js';""",
"""import { noteBlockedFire, noteIncomingFire, recentThreatTargetId } from './tacticalAwareness.js';
import { squadIntent } from './squadCoordination.js';
import { damagePosture } from './damageBehavior.js';
import { advanceSortieObjective, createSortieObjective, objectivePointForTeam, objectivePresentation, objectiveStatusText } from './sortieObjectives.js';""")
replace_once('main.js',
"""const targetAssembly = makeRangeTarget();
let targetCondition = createTargetCondition(targetAssembly);""",
"""const targetAssembly = makeRangeTarget();
const activeContract = contractById(targetAssembly.contractId);
let targetCondition = createTargetCondition(targetAssembly);
let sortieObjective = createSortieObjective(activeContract);""")
replace_once('main.js',
"""    behavior: contractById(targetAssembly.contractId).behavior,
    spawn: HOSTILE_SPAWN, active: true, targetId: 'player', killReason: null,
    wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,""",
"""    behavior: activeContract.behavior,
    spawn: HOSTILE_SPAWN, active: true, targetId: 'player', killReason: null,
    teamIntent: null, teamPlanLeft: 0, teamPlanTargetId: null,
    wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,""")
replace_once('main.js',
"""        behavior, spawn, active: true, targetId: null, killReason: null,
        wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,""",
"""        behavior, spawn, active: true, targetId: null, killReason: null,
        teamIntent: null, teamPlanLeft: 0, teamPlanTargetId: null,
        wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,""")
replace_once('main.js',
"""const aiActors = [primaryEnemyActor, ...supportActors];
const boutRoster = () => [""",
"""const aiActors = [primaryEnemyActor, ...supportActors];
const friendlyTeamTotal = 1 + friendlySupportActors.length;
const hostileTeamTotal = 1 + hostileSupportActors.length;
const boutRoster = () => [""")
replace_once('main.js',
"""const teamStatus = required('#team-status');
const playerDamageHud = required('#player-damage-hud');""",
"""const teamStatus = required('#team-status');
const objectiveStatus = required('#objective-status');
const playerDamageHud = required('#player-damage-hud');""")
replace_once('main.js',
"""for (const actor of supportActors)
    arena.updateCombatantDamage(actor.id, actor.condition);
let rig = createRigState();""",
"""for (const actor of supportActors)
    arena.updateCombatantDamage(actor.id, actor.condition);
arena.updateObjectivePresentation?.(objectivePresentation(sortieObjective));
let rig = createRigState();""")
replace_once('main.js',
"""function liveOpponents(actor) {""",
"""function battleParticipants() {
    return [actorById('player'), ...aiActors];
}
function liveOpponents(actor) {""")
replace_once('main.js',
"""function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    teamStatus.textContent = `ALLY ${counts.friendly}/3 · HOSTILE ${counts.hostile}/3`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
    syncCockpitInstruments();
}""",
"""function renderObjectiveStatus() {
    const text = objectiveStatusText(sortieObjective);
    if (objectiveStatus.textContent !== text) objectiveStatus.textContent = text;
    objectiveStatus.classList.toggle('contested', !!sortieObjective?.contested);
    arena.updateObjectivePresentation?.(objectivePresentation(sortieObjective));
}
function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    teamStatus.textContent = `ALLY ${counts.friendly}/${friendlyTeamTotal} · HOSTILE ${counts.hostile}/${hostileTeamTotal}`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
    renderObjectiveStatus();
    syncCockpitInstruments();
}""")
replace_once('main.js',
"""    actor.targetId = null;
    actor.killReason = null;
    actor.wreckAge = 0;""",
"""    actor.targetId = null;
    actor.killReason = null;
    actor.teamIntent = null;
    actor.teamPlanLeft = 0;
    actor.teamPlanTargetId = null;
    actor.wreckAge = 0;""")
replace_once('main.js',
"""        resetSquadBattle();
        boutLedger = createBoutLedger(boutRoster());
        clearBoutResult();""",
"""        resetSquadBattle();
        sortieObjective = createSortieObjective(activeContract);
        renderObjectiveStatus();
        boutLedger = createBoutLedger(boutRoster());
        clearBoutResult();""")
replace_once('main.js',
"""                const actorOutput = hostileOutput(actor.condition, actor.behavior);
                const canManeuver = actorOutput.structure > .05 && actorOutput.command > .05 && actorOutput.power > .12 && actorOutput.mobility > .05;
                const actorConfig = aiLocomotionConfig(actor);
                const maneuver = advanceEnemyMotion(actor.motion, actor.rig, target.rig, FIXED_DT, canManeuver, combatWorldFor(actor.id), actorConfig.collisionRadiusM, actor.behavior);
                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                shoveDisabledWrecks(actor.rig, actorConfig);
                arena.updateCombatantRig(actor.id, actor.rig);""",
"""                const actorOutput = hostileOutput(actor.condition, actor.behavior);
                const canManeuver = actorOutput.structure > .05 && actorOutput.command > .05 && actorOutput.power > .12 && actorOutput.mobility > .05;
                const actorConfig = aiLocomotionConfig(actor);
                const posture = damagePosture(actor.condition, actor.behavior);
                actor.teamPlanLeft = Math.max(0, (actor.teamPlanLeft ?? 0) - FIXED_DT);
                if (actor.teamPlanLeft === 0 || actor.teamPlanTargetId !== target.id) {
                    actor.teamIntent = squadIntent(actor, battleParticipants(), target, objectivePointForTeam(sortieObjective, actor.team), posture);
                    actor.teamPlanTargetId = target.id;
                    actor.teamPlanLeft = .24 + ((actor.id.charCodeAt(actor.id.length - 1) || 0) % 3) * .04;
                }
                let maneuver = advanceEnemyMotion(actor.motion, actor.rig, target.rig, FIXED_DT, canManeuver, combatWorldFor(actor.id), actorConfig.collisionRadiusM, actor.behavior, actor.teamIntent);
                maneuver = {
                    ...maneuver,
                    throttle: maneuver.throttle * Math.max(.66, posture.paceScale),
                    strafe: (maneuver.strafe ?? 0) * Math.max(.56, posture.strafeScale),
                    steer: maneuver.steer * Math.max(.62, posture.steerScale),
                };
                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                shoveDisabledWrecks(actor.rig, actorConfig);
                arena.updateCombatantRig(actor.id, actor.rig, { target: target.rig, posture, dt: FIXED_DT });""")
replace_once('main.js',
"""            if (weaponSpec && weaponState) {
                advanceWeapon(weaponState, weaponSpec, FIXED_DT);""",
"""            if (!aftermathDriving && !testEnded) {
                const objectiveOutcome = advanceSortieObjective(sortieObjective, battleParticipants(), FIXED_DT);
                renderObjectiveStatus();
                if (objectiveOutcome) finishSortie(objectiveOutcome.victory, objectiveOutcome.reason);
            }
            if (weaponSpec && weaponState) {
                advanceWeapon(weaponState, weaponSpec, FIXED_DT);""")

# Scene: objective marker, visible articulation, and per-weapon recoil presentation.
replace_once('scene.js',
"""    const pilotRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: C.green, side: THREE.DoubleSide, transparent: true, opacity: .26 }));
    pilotRing.rotation.x = -Math.PI / 2;
    pilotRing.position.set(PLAYER_SPAWN.x, .034, PLAYER_SPAWN.z);
    arenaPresentationRoot.add(pilotRing);
    let muzzleKick = 0;
    let muzzleFlash = 0;""",
"""    const pilotRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: C.green, side: THREE.DoubleSide, transparent: true, opacity: .26 }));
    pilotRing.rotation.x = -Math.PI / 2;
    pilotRing.position.set(PLAYER_SPAWN.x, .034, PLAYER_SPAWN.z);
    arenaPresentationRoot.add(pilotRing);
    const objectiveMaterial = new THREE.MeshBasicMaterial({ color: 0xd7a24b, side: THREE.DoubleSide, transparent: true, opacity: .58, depthWrite: false });
    const objectiveRing = new THREE.Mesh(new THREE.RingGeometry(.90, 1, 48), objectiveMaterial);
    objectiveRing.rotation.x = -Math.PI / 2;
    objectiveRing.position.y = .045;
    objectiveRing.visible = false;
    arenaPresentationRoot.add(objectiveRing);
    function updateObjectivePresentation(presentation) {
        objectiveRing.visible = !!presentation?.visible;
        if (!presentation?.visible) return;
        objectiveRing.position.set(presentation.point?.x ?? 0, .045, presentation.point?.z ?? 0);
        const radius = Math.max(1, Number(presentation.radius) || 5);
        objectiveRing.scale.set(radius, radius, radius);
        objectiveMaterial.color.setHex(presentation.contested ? 0xe16d4e : 0xd7a24b);
        objectiveMaterial.opacity = presentation.contested ? .82 : .58;
    }
    let muzzleKick = 0;
    let muzzleFlash = 0;
    let pilotWeaponPresentation = { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };""")
replace_once('scene.js',
"""    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {
        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(), parent: group.parent,
    }]));
    const primaryMarker = makeSquadMarker('hostile');""",
"""    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {
        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(), parent: group.parent,
    }]));
    const captureArticulation = exterior => {
        const joints = [];
        exterior.partGroups.get('mobility')?.traverse(object => {
            if (!object.userData?.joint) return;
            joints.push({ object, joint: object.userData.joint, side: Number(object.userData.side) || 0, base: object.rotation.clone() });
        });
        return { joints, phase: 0 };
    };
    const primaryMarker = makeSquadMarker('hostile');""")
replace_once('scene.js',
"""        baseParts: capturePartTransforms(targetExterior),
    });""",
"""        baseParts: capturePartTransforms(targetExterior), articulation: captureArticulation(targetExterior),
        recoilKick: 0, recoilRecovery: 3.2,
    });""")
replace_once('scene.js',
"""            baseParts: capturePartTransforms(actorExterior),
        };""",
"""            baseParts: capturePartTransforms(actorExterior), articulation: captureArticulation(actorExterior),
            recoilKick: 0, recoilRecovery: 3.2,
        };""")
replace_once('scene.js',
"""    function updateCombatantRig(id, state) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.exterior.root.position.set(state.x, record.cleared ? -.14 : record.wrecked ? -.06 : 0, state.z);
        record.exterior.root.rotation.y = physicsYawToViewYaw(state.yaw);
        record.exterior.root.updateWorldMatrix(true, true);
    }""",
"""    function updateCombatantRig(id, state, visual = null) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.exterior.root.position.set(state.x, record.cleared ? -.14 : record.wrecked ? -.06 : 0, state.z);
        record.exterior.root.rotation.y = physicsYawToViewYaw(state.yaw);
        if (record.active && !record.wrecked && !record.cleared) {
            const dt = Math.max(0, visual?.dt ?? 1 / 60);
            const health = THREE.MathUtils.clamp(visual?.posture?.animationHealth ?? 1, .08, 1);
            const speed = Math.hypot(state.vx ?? 0, state.vz ?? 0);
            const movement = Math.min(1, speed / 2.8);
            const articulation = record.articulation;
            if (articulation) {
                articulation.phase += dt * (1.5 + speed * 1.45) * (.52 + health * .48);
                const amplitude = movement * (.075 + health * .11);
                for (const joint of articulation.joints) {
                    const sidePhase = joint.side > 0 ? Math.PI : 0;
                    const wave = Math.sin(articulation.phase + sidePhase);
                    const magnitude = joint.joint === 'hip' ? .42 : joint.joint === 'knee' ? -.62 : joint.joint === 'ankle' ? .32 : -.16;
                    joint.object.rotation.x = joint.base.x + wave * amplitude * magnitude;
                    joint.object.rotation.z = joint.base.z + (1 - health) * joint.side * Math.sin(articulation.phase * .53) * .035;
                }
            }
            const target = visual?.target;
            if (target) {
                const desired = Math.atan2(target.x - state.x, -(target.z - state.z));
                const error = Math.atan2(Math.sin(desired - state.yaw), Math.cos(desired - state.yaw));
                const command = record.exterior.partGroups.get('command');
                const combat = record.exterior.partGroups.get('combat');
                const commandBase = record.baseParts.get('command');
                const combatBase = record.baseParts.get('combat');
                const smoothing = 1 - Math.exp(-dt * (5.2 * (.45 + health * .55)));
                if (command && commandBase)
                    command.rotation.y = THREE.MathUtils.lerp(command.rotation.y, commandBase.rotation.y - THREE.MathUtils.clamp(error, -.48, .48) * .42, smoothing);
                if (combat && combatBase) {
                    combat.rotation.y = THREE.MathUtils.lerp(combat.rotation.y, combatBase.rotation.y - THREE.MathUtils.clamp(error, -.72, .72) * .72, smoothing);
                    combat.position.z = combatBase.position.z + (record.recoilKick ?? 0);
                }
            }
            const damage = 1 - health;
            record.exterior.root.position.y += Math.sin((record.articulation?.phase ?? 0) * .5) * damage * movement * .035;
            record.exterior.root.rotation.x = THREE.MathUtils.clamp(-(state.longitudinalAcceleration ?? 0) * .007 + Math.sin((record.articulation?.phase ?? 0) * .47) * damage * .018, -.065, .065);
            record.exterior.root.rotation.z = THREE.MathUtils.clamp(-(state.lateralSpeed ?? 0) * .012 - (state.yawRate ?? 0) * speed * .008 + Math.sin((record.articulation?.phase ?? 0) * .61) * damage * .022, -.075, .075);
        }
        record.exterior.root.updateWorldMatrix(true, true);
    }""")
replace_once('scene.js',
"""        record.wrecked = false;
        record.cleared = false;
        record.disabledSlots.clear();""",
"""        record.wrecked = false;
        record.cleared = false;
        record.recoilKick = 0;
        if (record.articulation) {
            record.articulation.phase = 0;
            for (const joint of record.articulation.joints) joint.object.rotation.copy(joint.base);
        }
        record.disabledSlots.clear();""")
replace_once('scene.js',
"""    function showCombatantShot(shooterId, contact, outcome) {
        const shooter = squadCombatants.get(shooterId);
        const friendly = shooter?.team === 'friendly';""",
"""    function showCombatantShot(shooterId, contact, outcome) {
        const shooter = squadCombatants.get(shooterId);
        const friendly = shooter?.team === 'friendly';
        if (shooter) {
            const weaponId = installedPart(shooter.assembly, 'combat')?.definition.id;
            const profile = weaponId === 'gun-short' ? { kick: .24, recovery: 1.9 } : weaponId === 'gun-light' ? { kick: .085, recovery: 4.2 } : { kick: .15, recovery: 2.8 };
            shooter.recoilKick = Math.min(.42, (shooter.recoilKick ?? 0) + profile.kick);
            shooter.recoilRecovery = profile.recovery;
        }""")
replace_once('scene.js',
"""    function updateCombatEffects(dt) {
        muzzleKick = Math.max(0, muzzleKick - dt * 3.6);
        muzzleFlash = Math.max(0, muzzleFlash - dt);""",
"""    function updateCombatEffects(dt) {
        muzzleKick = Math.max(0, muzzleKick - dt * (pilotWeaponPresentation.visualRecovery ?? 3.6));
        muzzleFlash = Math.max(0, muzzleFlash - dt);
        for (const record of squadCombatants.values())
            record.recoilKick = Math.max(0, (record.recoilKick ?? 0) - dt * (record.recoilRecovery ?? 3.2));""")
replace_once('scene.js',
"""    function showShot(contact, outcome) {
        muzzleKick = Math.min(1.2, muzzleKick + 1.0);
        muzzleFlash = .10;""",
"""    function showShot(contact, outcome) {
        muzzleKick = Math.min(1.6, muzzleKick + (pilotWeaponPresentation.visualRecoil ?? 1));
        muzzleFlash = pilotWeaponPresentation.muzzleFlashSeconds ?? .10;""")
replace_once('scene.js',
"""    function setPilotWeapon(spec) {
        const barrel = cockpit.userData.gunBarrel;
        const breech = cockpit.userData.gunBreech;
        gunPivot.visible = !!spec;
        if (!spec)
            return;""",
"""    function setPilotWeapon(spec) {
        const barrel = cockpit.userData.gunBarrel;
        const breech = cockpit.userData.gunBreech;
        gunPivot.visible = !!spec;
        pilotWeaponPresentation = spec ?? { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };
        if (!spec)
            return;""")
replace_once('scene.js',
"""        addCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit,""",
"""        addCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit, updateObjectivePresentation,""")

# Cache/version and a compact objective readout in the existing HUD.
replace_once('index.html',
"""    "./combat.js": "./combat.js?v=k3l5",""",
"""    "./combat.js": "./combat.js?v=k3o1",""")
replace_once('index.html',
"""    "./contracts.js": "./contracts.js?v=k3h0",""",
"""    "./contracts.js": "./contracts.js?v=k3n2",""")
replace_once('index.html',
"""    "./scene.js": "./sceneAssembly.js?v=k3l5",""",
"""    "./scene.js": "./sceneAssembly.js?v=k3o1",""")
replace_once('index.html',
"""    "./enemyMotion.js": "./enemyMotion.js?v=k3m0",""",
"""    "./enemyMotion.js": "./enemyMotion.js?v=k3n3",""")
replace_once('index.html',
"""    <link rel="stylesheet" href="./styles.css?v=k3l3" />""",
"""    <link rel="stylesheet" href="./styles.css?v=k3o1" />""")
replace_once('index.html',
"""    <title>MECH ARENA — 0.0.1k.3m.0 — Tactical Awareness</title>""",
"""    <title>MECH ARENA — 0.0.1k.3o.1 — Combat Depth</title>""")
replace_once('index.html',
"""    <div id="team-status" class="team-status" aria-live="polite">ALLY 3/3 · HOSTILE 3/3</div>""",
"""    <div id="team-status" class="team-status" aria-live="polite">ALLY 3/3 · HOSTILE 3/3</div>
    <div id="objective-status" class="objective-status" aria-live="polite">OBJ · BREAK HOSTILE TEAM</div>""")
replace_once('index.html',
"""    <script type="module" src="./main.js?v=k3n0"></script>
    <script type="module" src="./garageMountUI.js?v=k3n0"></script>""",
"""    <script type="module" src="./main.js?v=k3o1"></script>
    <script type="module" src="./garageMountUI.js?v=k3o1"></script>""")
replace_once('garageMountUI.js',
"""import './contractUI.js?v=k3n0';""",
"""import './contractUI.js?v=k3o1';""")
replace_once('sceneAssembly.js',
"""import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3l5';""",
"""import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3o1';""")

styles = read('styles.css')
if '/* k.3n.2 objective readout */' not in styles:
    styles += """

/* k.3n.2 objective readout */
.objective-status{position:absolute;z-index:6;left:50%;top:max(96px,calc(env(safe-area-inset-top) + 86px));transform:translateX(-50%);max-width:58vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;padding:3px 7px;border:1px solid #b68d4d66;background:#151912cf;color:#d9b568;font:800 8px/1.2 ui-monospace,monospace;letter-spacing:.055em}
.objective-status.contested{border-color:#dc755bbb;color:#ffc09c;background:#35201bd9}
body.inspecting .objective-status{display:none}
@media(max-height:430px){.objective-status{top:max(82px,calc(env(safe-area-inset-top) + 72px));font-size:7px}}
"""
    write('styles.css', styles)

# Focused regression coverage for the new layers.
Path('tests/combatDepth.test.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { contractById } from '../contracts.js';
import { WEAPONS } from '../combat.js';
import { damagePosture } from '../damageBehavior.js';
import { squadIntent, squadRole } from '../squadCoordination.js';
import { advanceSortieObjective, createSortieObjective, OBJECTIVE_TYPES } from '../sortieObjectives.js';

const part = ratio => ({ integrity: ratio * 100, maxIntegrity: 100, destroyed: false });
const condition = ({ structure=1, mobility=1, power=1, command=1, combat=1 } = {}) => ({ parts: {
  structure: part(structure), mobility: part(mobility), power: part(power), command: part(command), combat: part(combat),
} });
const actor = (id, team, behavior, x, z) => ({ id, team, behavior, rig: { x, z }, active: true });

test('campaign contracts now exercise elimination, recovery, control and breakthrough rules', () => {
  assert.equal(contractById('yard-dog').objective.type, OBJECTIVE_TYPES.ELIMINATION);
  assert.equal(contractById('recovery-run').objective.type, OBJECTIVE_TYPES.RECOVERY);
  assert.equal(contractById('cutter').objective.type, OBJECTIVE_TYPES.CONTROL);
  assert.equal(contractById('mule').objective.type, OBJECTIVE_TYPES.BREAKTHROUGH);
  assert.equal(contractById('circuit-final').objective.type, OBJECTIVE_TYPES.ELIMINATION);
});

test('control objective advances only for an uncontested team', () => {
  const state = createSortieObjective({ objective: { type: 'control', point: { x: 0, z: 0 }, radius: 3, holdSeconds: 2 } });
  const friendly = actor('f', 'friendly', null, 0, 0);
  const hostile = actor('h', 'hostile', null, 9, 9);
  assert.equal(advanceSortieObjective(state, [friendly, hostile], 1), null);
  assert.equal(state.friendlyProgress, 1);
  hostile.rig.x = 1; hostile.rig.z = 0;
  advanceSortieObjective(state, [friendly, hostile], .5);
  assert.equal(state.friendlyProgress, 1);
  assert.equal(state.contested, true);
  hostile.rig.x = 9; hostile.rig.z = 9;
  const result = advanceSortieObjective(state, [friendly, hostile], 1);
  assert.equal(result?.victory, true);
});

test('damage posture turns critical machines into withdrawal and crippled machines into holds', () => {
  const critical = damagePosture(condition({ structure: .12 }), { id: 'skirmisher' });
  const crippled = damagePosture(condition({ mobility: .15 }), { id: 'pressure' });
  const weaponlessBruiser = damagePosture(condition({ combat: 0, structure: .8 }), { id: 'bruiser' });
  assert.equal(critical.preferredMode, 'WITHDRAW');
  assert.equal(crippled.preferredMode, 'HOLD');
  assert.equal(weaponlessBruiser.preferredMode, 'ANCHOR');
});

test('squad intent separates anchor, pressure and flanker jobs and regroups isolated actors', () => {
  const pressureBehavior = { id: 'pressure', preferredRangeM: 6 };
  const flankBehavior = { id: 'skirmisher', preferredRangeM: 8 };
  const anchorBehavior = { id: 'bruiser', preferredRangeM: 5 };
  assert.equal(squadRole({ behavior: flankBehavior }), 'FLANKER');
  assert.equal(squadRole({ behavior: anchorBehavior }), 'ANCHOR');
  const target = actor('enemy', 'hostile', pressureBehavior, 0, -8);
  const isolated = actor('isolated', 'friendly', flankBehavior, 14, 12);
  const allyA = actor('ally-a', 'friendly', pressureBehavior, 0, 10);
  const allyB = actor('ally-b', 'friendly', anchorBehavior, 1, 9);
  assert.equal(squadIntent(isolated, [isolated, allyA, allyB], target).mode, 'REGROUP');
  assert.equal(squadIntent(allyB, [isolated, allyA, allyB], target).role, 'ANCHOR');
});

test('starting weapons keep existing damage balance but gain strongly different handling signatures', () => {
  assert.ok(WEAPONS['gun-short'].visualRecoil > WEAPONS['gun-cannon'].visualRecoil);
  assert.ok(WEAPONS['gun-cannon'].visualRecoil > WEAPONS['gun-light'].visualRecoil);
  assert.ok(WEAPONS['gun-short'].visualRecovery < WEAPONS['gun-light'].visualRecovery);
  assert.match(WEAPONS['gun-short'].handling, /HEAVY KICK/);
});
''')

Path('tests/k3oCombatPresentation.test.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('combat scene exposes objective marker and simple joint articulation', () => {
  assert.match(scene, /updateObjectivePresentation/);
  assert.match(scene, /userData\?\.joint/);
  assert.match(scene, /articulation\.phase/);
  assert.match(scene, /recoilKick/);
});

test('live combat integrates squad intent, damage posture and objective resolution', () => {
  assert.match(main, /squadIntent\(/);
  assert.match(main, /damagePosture\(/);
  assert.match(main, /advanceSortieObjective\(/);
  assert.match(main, /objectivePointForTeam\(/);
});

test('objective status is visible as its own compact HUD readout', () => {
  assert.match(index, /id="objective-status"/);
  assert.match(index, /0\.0\.1k\.3o\.1/);
});
''')

print('k.3n.1 -> k.3o.1 scoped integration patch applied')
