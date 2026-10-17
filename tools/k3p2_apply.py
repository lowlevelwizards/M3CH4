from pathlib import Path

ROOT = Path('.')

def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

def replace_all(path, old, new, expected=None):
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if expected is not None and count != expected:
        raise SystemExit(f'expected {expected} anchors in {path}, found {count}: {old[:120]!r}')
    if count == 0:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new))

# ----- scene.js: authoritative recovery presentation -----
replace_all(
    'scene.js',
    "        recoilKick: 0, recoilRecovery: 3.2,\n",
    "        recoilKick: 0, recoilRecovery: 3.2,\n        weaponFault: false, weaponServicing: false, serviceSparkBudget: 0, weaponRecoveryKick: 0, recoveryBurstPending: false,\n",
    expected=2,
)

replace_once(
    'scene.js',
    "    let muzzleFlash = 0;\n    let pilotWeaponPresentation = { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };",
    "    let muzzleFlash = 0;\n    let pilotWeaponPresentation = { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };\n    let pilotWeaponFault = false, pilotWeaponServicing = false, pilotServiceSparkBudget = 0;\n    let pilotWeaponRecoveryKick = 0, pilotRecoveryBurstPending = false;",
)

replace_once(
    'scene.js',
    "    function updateRigVisual(state, lookYaw, lookPitch, dt) {\n        const smoothing = 1 - Math.exp(-16 * dt);",
    "    function updateRigVisual(state, lookYaw, lookPitch, dt, serviceVisual = null) {\n        const wasServicing = pilotWeaponServicing;\n        pilotWeaponFault = !!serviceVisual?.weaponFault;\n        pilotWeaponServicing = !!serviceVisual?.weaponServicing;\n        if (wasServicing && !pilotWeaponServicing && !pilotWeaponFault) {\n            pilotWeaponRecoveryKick = 1;\n            pilotRecoveryBurstPending = true;\n        }\n        pilotWeaponRecoveryKick = Math.max(0, pilotWeaponRecoveryKick - dt * 2.25);\n        const smoothing = 1 - Math.exp(-16 * dt);",
)

replace_once(
    'scene.js',
    "        gunPivot.rotation.set(lookPitch * .85 + muzzleKick * .042, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');\n        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;",
    "        const pilotServiceSag = pilotWeaponFault ? (pilotWeaponServicing ? .20 : .13) : 0;\n        const pilotRecoveryLift = pilotWeaponRecoveryKick * .09;\n        gunPivot.rotation.set(lookPitch * .85 + muzzleKick * .042 + pilotServiceSag - pilotRecoveryLift, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');\n        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;",
)

replace_once(
    'scene.js',
    "    function partWorldPoint(record, slot) {\n        const group = record?.exterior.partGroups.get(slot);",
    "    function weaponServicePoint(record) {\n        const group = record?.exterior.partGroups.get('combat');\n        const point = new THREE.Vector3(0, .02, .30);\n        if (group) {\n            group.updateWorldMatrix(true, true);\n            return group.localToWorld(point);\n        }\n        record?.exterior.root.updateWorldMatrix(true, true);\n        return record?.exterior.root.localToWorld(new THREE.Vector3(.75, 2.0, -.25)) ?? point;\n    }\n    function partWorldPoint(record, slot) {\n        const group = record?.exterior.partGroups.get(slot);",
)

replace_once(
    'scene.js',
    "        if (record.active && !record.wrecked && !record.cleared) {\n            const dt = Math.max(0, visual?.dt ?? 1 / 60);",
    "        if (record.active && !record.wrecked && !record.cleared) {\n            const dt = Math.max(0, visual?.dt ?? 1 / 60);\n            const wasServicing = record.weaponServicing;\n            record.weaponFault = !!visual?.weaponFault;\n            record.weaponServicing = !!visual?.weaponServicing;\n            if (wasServicing && !record.weaponServicing && !record.weaponFault) {\n                record.weaponRecoveryKick = 1;\n                record.recoveryBurstPending = true;\n            }\n            record.weaponRecoveryKick = Math.max(0, (record.weaponRecoveryKick ?? 0) - dt * 2.0);",
)

replace_once(
    'scene.js',
    "                    const weaponFault = !!visual?.weaponFault;\n                    const serviceSag = visual?.weaponServicing ? .22 : .14;\n                    const traverseScale = weaponFault ? .18 : .72;\n                    combat.rotation.y = THREE.MathUtils.lerp(combat.rotation.y, combatBase.rotation.y - THREE.MathUtils.clamp(error, -.72, .72) * traverseScale, smoothing);\n                    combat.rotation.x = THREE.MathUtils.lerp(combat.rotation.x, combatBase.rotation.x + (weaponFault ? serviceSag : 0), smoothing);\n                    combat.position.y = THREE.MathUtils.lerp(combat.position.y, combatBase.position.y - (weaponFault ? .045 : 0), smoothing);",
    "                    const weaponFault = !!visual?.weaponFault;\n                    const serviceSag = visual?.weaponServicing ? .28 : .16;\n                    const recoveryLift = (record.weaponRecoveryKick ?? 0) * .11;\n                    const traverseScale = weaponFault ? .18 : .72;\n                    const weaponSmoothing = record.weaponRecoveryKick > 0 ? Math.max(smoothing, 1 - Math.exp(-dt * 12.5)) : smoothing;\n                    combat.rotation.y = THREE.MathUtils.lerp(combat.rotation.y, combatBase.rotation.y - THREE.MathUtils.clamp(error, -.72, .72) * traverseScale, weaponSmoothing);\n                    combat.rotation.x = THREE.MathUtils.lerp(combat.rotation.x, combatBase.rotation.x + (weaponFault ? serviceSag : 0) - recoveryLift, weaponSmoothing);\n                    combat.position.y = THREE.MathUtils.lerp(combat.position.y, combatBase.position.y - (weaponFault ? .055 : 0) + recoveryLift * .14, weaponSmoothing);",
)

replace_once(
    'scene.js',
    "        powerArcCooldown = Math.max(0, powerArcCooldown - dt);\n        if (!inspecting && persistentPowerHealth < .52 && powerArcCooldown <= 0) {",
    "        powerArcCooldown = Math.max(0, powerArcCooldown - dt);\n        if (!inspecting && pilotWeaponServicing) {\n            cockpit.updateWorldMatrix(true, true);\n            pilotServiceSparkBudget += 28 * dt;\n            while (pilotServiceSparkBudget >= 1) {\n                pilotServiceSparkBudget -= 1;\n                const origin = gunPivot.localToWorld(new THREE.Vector3(0, .01, .26));\n                const velocity = new THREE.Vector3((Math.random() - .5) * 1.4, -.25 - Math.random() * 1.55, (Math.random() - .5) * 1.15);\n                activateParticle(sparkPool, 'spark', origin, velocity, .62 + Math.random() * .42, .22 + Math.random() * .22, -2.4, 0, Math.random() > .25 ? 0x76dfff : 0xc8fff2);\n            }\n        } else pilotServiceSparkBudget = 0;\n        if (!inspecting && pilotRecoveryBurstPending) {\n            cockpit.updateWorldMatrix(true, true);\n            const origin = gunPivot.localToWorld(new THREE.Vector3(0, .01, .26));\n            flashDamageLight(origin, 0x76dfff, 5.5, .10, 3.6);\n            for (let i = 0; i < 7; i++)\n                activateParticle(sparkPool, 'spark', origin, new THREE.Vector3((Math.random()-.5)*2.0, .2+Math.random()*1.5, (Math.random()-.5)*1.7), .7+Math.random()*.45, .20+Math.random()*.24, -2.8, 0, i % 3 ? 0x76dfff : 0xe0fbff);\n            pilotRecoveryBurstPending = false;\n        }\n        if (!inspecting && persistentPowerHealth < .52 && powerArcCooldown <= 0) {",
)

replace_once(
    'scene.js',
    "        for (const record of squadCombatants.values()) {\n            if (!record.condition?.parts || record.cleared) continue;\n            record.exterior.root.updateWorldMatrix(true, true);\n            for (const slot of SLOTS) {",
    "        for (const record of squadCombatants.values()) {\n            if (!record.condition?.parts || record.cleared) continue;\n            record.exterior.root.updateWorldMatrix(true, true);\n            if (record.weaponServicing && record.active && !record.wrecked) {\n                record.serviceSparkBudget += 26 * dt;\n                while (record.serviceSparkBudget >= 1) {\n                    record.serviceSparkBudget -= 1;\n                    const origin = weaponServicePoint(record);\n                    const velocity = new THREE.Vector3((Math.random() - .5) * 1.6, -.18 - Math.random() * 1.7, (Math.random() - .5) * 1.35);\n                    activateParticle(sparkPool, 'spark', origin, velocity, .60 + Math.random() * .45, .21 + Math.random() * .24, -2.5, 0, Math.random() > .25 ? 0x76dfff : 0xc8fff2);\n                }\n            } else record.serviceSparkBudget = 0;\n            if (record.recoveryBurstPending && record.active && !record.wrecked) {\n                const origin = weaponServicePoint(record);\n                flashDamageLight(origin, 0x76dfff, 6.5, .10, 4.2);\n                for (let i = 0; i < 8; i++)\n                    activateParticle(sparkPool, 'spark', origin, new THREE.Vector3((Math.random()-.5)*2.2, .25+Math.random()*1.65, (Math.random()-.5)*1.8), .72+Math.random()*.48, .20+Math.random()*.26, -2.9, 0, i % 3 ? 0x76dfff : 0xe0fbff);\n                record.recoveryBurstPending = false;\n            }\n            for (const slot of SLOTS) {",
)

replace_once(
    'scene.js',
    "        if (enabled) {\n            exterior.root.position.set(0, 0, 0);",
    "        if (enabled) {\n            pilotWeaponFault = false; pilotWeaponServicing = false; pilotServiceSparkBudget = 0;\n            pilotWeaponRecoveryKick = 0; pilotRecoveryBurstPending = false;\n            exterior.root.position.set(0, 0, 0);",
)

# ----- main.js: cockpit/team/target signaling wired from authoritative service state -----
replace_once(
    'main.js',
    "let fieldService = createFieldServiceState();\nconst faultSupportState = createFaultSupportState();",
    "let fieldService = createFieldServiceState();\nconst faultSupportState = createFaultSupportState();\nlet lastPlayerScreenId = null;",
)

replace_once(
    'main.js',
    "    const counts = squadCounts(playerCombatActive, aiActors);\n    teamStatus.textContent = `ALLY ${counts.friendly}/${friendlyTeamTotal} · HOSTILE ${counts.hostile}/${hostileTeamTotal}`;",
    "    const counts = squadCounts(playerCombatActive, aiActors);\n    const screener = friendlySupportActors.find(actor => faultSupportForActor(faultSupportState, actor.id)?.casualtyId === 'player');\n    const supportCue = screener ? ` · ${screener.label} COVERING` : '';\n    teamStatus.textContent = `ALLY ${counts.friendly}/${friendlyTeamTotal} · HOSTILE ${counts.hostile}/${hostileTeamTotal}${supportCue}`;",
)

replace_once(
    'main.js',
    "                updateFaultSupportAssignments(faultSupportState, participants, FIXED_DT);\n                for (const actor of aiActors) {",
    "                updateFaultSupportAssignments(faultSupportState, participants, FIXED_DT);\n                const playerScreener = friendlySupportActors.find(actor => faultSupportForActor(faultSupportState, actor.id)?.casualtyId === 'player');\n                const playerScreenId = playerScreener?.id ?? null;\n                if (playerScreenId !== lastPlayerScreenId) {\n                    lastPlayerScreenId = playerScreenId;\n                    renderSquadStatus();\n                    if (playerScreener) {\n                        shotReport.classList.remove('faded', 'disabled-part');\n                        shotReport.classList.add('penetrated');\n                        shotReport.textContent = `${playerScreener.label} COVERING · HOLD POSITION FOR FIELD SERVICE`;\n                        reportFade = Math.max(reportFade, 1.8);\n                    }\n                }\n                for (const actor of aiActors) {",
)

replace_once(
    'main.js',
    "    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt);",
    "    const playerRecoveryState = weaponFailureState(playerCondition, fieldService);\n    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt, {\n        weaponFault: playerRecoveryState === 'faulted',\n        weaponServicing: fieldService.held,\n    });",
)

replace_once(
    'main.js',
    "function handleFieldServiceInterrupted() {\n    shotReport.classList.remove('faded', 'penetrated');",
    "function handleFieldServiceInterrupted() {\n    soundEmpty();\n    shotReport.classList.remove('faded', 'penetrated');",
)

replace_once(
    'main.js',
    "    const suffix = !playerCombatActive ? ' · MISSION KILLED' : testEnded ? ' · SORTIE ENDED' :\n        failure === 'destroyed' ? ' · DESTROYED' :\n        failure === 'unrecoverable' ? ' · FAULT · BYPASS SPENT' :\n        failure === 'faulted' ? ' · FAULTED' :",
    "    const suffix = !playerCombatActive ? ' · MISSION KILLED' : testEnded ? ' · SORTIE ENDED' :\n        failure === 'destroyed' ? ' · DESTROYED' :\n        failure === 'unrecoverable' ? ' · FAULT · BYPASS SPENT' :\n        fieldService.held ? ' · FIELD SERVICE' :\n        failure === 'faulted' ? ' · FAULTED' :",
)

replace_once(
    'main.js',
    "    ammoReadout.textContent = !weaponSpec || !weaponState ? '—' :\n        serviceAvailable ? `FAULT ${Math.round(weaponIntegrityRatio(playerCondition) * 100)}%` :",
    "    const servicePercent = Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100);\n    ammoReadout.textContent = !weaponSpec || !weaponState ? '—' :\n        fieldService.held ? `SERVICE ${servicePercent}%` :\n        serviceAvailable ? `FAULT ${Math.round(weaponIntegrityRatio(playerCondition) * 100)}%` :",
)

replace_once(
    'main.js',
    "    if (serviceAvailable) {\n        const percent = Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100);\n        reloadButton.textContent = fieldService.held ? `FIELD SERVICE ${percent}%` : stationary ? 'HOLD FIELD SERVICE' : 'STOP TO FIELD SERVICE';",
    "    if (serviceAvailable) {\n        reloadButton.textContent = fieldService.held ? `FIELD SERVICE ${servicePercent}%` : stationary ? 'HOLD FIELD SERVICE' : 'STOP TO FIELD SERVICE';",
)

replace_once(
    'main.js',
    "    resetFaultSupportState(faultSupportState);\n    for (const actor of aiActors) resetAiActor(actor);",
    "    resetFaultSupportState(faultSupportState);\n    lastPlayerScreenId = null;\n    for (const actor of aiActors) resetAiActor(actor);",
)

# ----- browser cache identity -----
replace_once('sceneAssembly.js', "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3p0';", "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3p2';")
replace_once('index.html', '    "./scene.js": "./sceneAssembly.js?v=k3p0",', '    "./scene.js": "./sceneAssembly.js?v=k3p2",')
replace_once('index.html', '<title>MECH ARENA — 0.0.1k.3p.1 — Fault Support & Exploitation</title>', '<title>MECH ARENA — 0.0.1k.3p.2 — Recovery Readability & Tactical Signaling</title>')
replace_once('index.html', '<script type="module" src="./main.js?v=k3p1"></script>', '<script type="module" src="./main.js?v=k3p2"></script>')

# ----- focused regression coverage -----
test = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scene = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../sceneAssembly.js', import.meta.url), 'utf8');

test('field service drives constant blue sparks from the weapon attachment rather than a detached UI effect', () => {
    assert.match(scene, /function weaponServicePoint\(record\)/);
    assert.match(scene, /record\.weaponServicing && record\.active/);
    assert.match(scene, /record\.serviceSparkBudget \+= 26 \* dt/);
    assert.match(scene, /0x76dfff/);
    assert.match(scene, /0xc8fff2/);
});

test('recovering AI weapons visibly sag during service then raise back online', () => {
    assert.match(scene, /const serviceSag = visual\?\.weaponServicing \? \.28 : \.16/);
    assert.match(scene, /wasServicing && !record\.weaponServicing && !record\.weaponFault/);
    assert.match(scene, /record\.weaponRecoveryKick = 1/);
    assert.match(scene, /combat\.rotation\.x = THREE\.MathUtils\.lerp[\s\S]*recoveryLift/);
});

test('the player cockpit weapon uses the same authoritative fault/service state and recovery motion', () => {
    assert.match(main, /playerRecoveryState = weaponFailureState\(playerCondition, fieldService\)/);
    assert.match(main, /weaponServicing: fieldService\.held/);
    assert.match(scene, /pilotWeaponServicing/);
    assert.match(scene, /pilotServiceSparkBudget \+= 28 \* dt/);
    assert.match(scene, /pilotRecoveryLift/);
});

test('recovery status and friendly screening are legible without omniscient new telemetry', () => {
    assert.match(main, /COVERING · HOLD POSITION FOR FIELD SERVICE/);
    assert.match(main, /supportCue = screener \? ` · \$\{screener\.label\} COVERING`/);
    assert.match(main, /fieldService\.held \? `SERVICE \$\{servicePercent\}%`/);
    assert.match(main, /WEAPON RECOVERY: FIELD SERVICE/);
    assert.match(main, /REMOTE MODULE TELEMETRY WITHHELD/);
});

test('mobile runtime cache identity loads the recovery-readability scene source', () => {
    assert.match(index, /sceneAssembly\.js\?v=k3p2/);
    assert.match(index, /main\.js\?v=k3p2/);
    assert.match(index, /Recovery Readability & Tactical Signaling/);
    assert.match(bridge, /scene\.js\?source=k3p2/);
});
'''
(ROOT / 'tests/k3p2RecoveryReadability.test.mjs').write_text(test)
print('k.3p.2 patch applied')
