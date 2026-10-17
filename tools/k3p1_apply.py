from pathlib import Path

ROOT = Path('.')

def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:100]!r}')
    text = text.replace(old, new, 1)
    p.write_text(text)

fault_support = r'''/** k.3p.1 — squad response to recoverable weapon faults.
 *
 * This layer owns only temporary support assignments. It does not move rigs, repair
 * hardware, choose shots, or bypass LOS. A healthy teammate may screen one nearby
 * recoverable casualty while the existing locomotion/fire-control systems remain
 * authoritative.
 */
import { canFieldService } from './fieldService.js';
import { damagePosture } from './damageBehavior.js';

export const SCREEN_ASSIGN_RANGE_M = 14;
export const SCREEN_BREAK_RANGE_M = 18;
export const SCREEN_STANDOFF_M = 2.8;
export const SCREEN_COMMIT_SECONDS = 1.0;
export const SERVICE_EXPLOIT_THROTTLE_SCALE = 1.06;

const rigOf = actor => actor?.rig ?? actor;
const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));

export function needsFaultSupport(actor) {
    return !!actor && actor.active !== false && canFieldService(actor.condition, actor.fieldService);
}

export function canScreenFault(actor) {
    if (!actor || actor.active === false || needsFaultSupport(actor)) return false;
    const posture = damagePosture(actor.condition, actor.behavior);
    if (posture.state === 'CRITICAL' || posture.state === 'CRIPPLED' || posture.state === 'WEAPONLESS')
        return false;
    return posture.structure > .22 && posture.power > .15 && posture.combat > .12;
}

function nearestThreat(casualty, roster) {
    const opponents = roster.filter(actor => actor?.active !== false && actor.team !== casualty.team);
    const current = opponents.find(actor => actor.id === casualty.targetId);
    if (current) return current;
    return opponents.reduce((best, actor) => {
        const d = distance(rigOf(casualty), rigOf(actor));
        return !best || d < best.distance ? { actor, distance: d } : best;
    }, null)?.actor ?? null;
}

export function createFaultSupportState() {
    return { assignments: new Map() };
}

export function resetFaultSupportState(state) {
    state?.assignments?.clear();
}

/** Keep valid assignments stable for the full recovery crisis. The one-second
 * commitment value is diagnostic/documentary hysteresis; a screen is only replaced
 * early if the screener or casualty becomes invalid or separates dramatically. */
export function updateFaultSupportAssignments(state, roster, dt = 0) {
    if (!state?.assignments) return state;
    const live = (roster ?? []).filter(Boolean);
    const byId = new Map(live.map(actor => [actor.id, actor]));
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;

    for (const [screenerId, assignment] of [...state.assignments]) {
        const screener = byId.get(screenerId);
        const casualty = byId.get(assignment.casualtyId);
        assignment.commitLeft = Math.max(0, (assignment.commitLeft ?? 0) - step);
        if (!screener || !casualty || screener.team !== casualty.team ||
            !needsFaultSupport(casualty) || !canScreenFault(screener) ||
            distance(rigOf(screener), rigOf(casualty)) > SCREEN_BREAK_RANGE_M) {
            state.assignments.delete(screenerId);
            continue;
        }
        const threat = assignment.threatId ? byId.get(assignment.threatId) : null;
        if (!threat || threat.active === false || threat.team === casualty.team)
            assignment.threatId = nearestThreat(casualty, live)?.id ?? null;
    }

    const occupiedCasualties = new Set([...state.assignments.values()].map(a => a.casualtyId));
    const occupiedScreeners = new Set(state.assignments.keys());
    const casualties = live.filter(needsFaultSupport).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const casualty of casualties) {
        if (occupiedCasualties.has(casualty.id)) continue;
        const candidates = live
            .filter(actor => actor.id !== casualty.id && actor.team === casualty.team &&
                !occupiedScreeners.has(actor.id) && canScreenFault(actor))
            .map(actor => ({ actor, distance: distance(rigOf(actor), rigOf(casualty)) }))
            .filter(entry => entry.distance <= SCREEN_ASSIGN_RANGE_M)
            .sort((a, b) => a.distance - b.distance || String(a.actor.id).localeCompare(String(b.actor.id)));
        const pick = candidates[0]?.actor;
        if (!pick) continue;
        const threat = nearestThreat(casualty, live);
        state.assignments.set(pick.id, {
            screenerId: pick.id,
            casualtyId: casualty.id,
            threatId: threat?.id ?? null,
            commitLeft: SCREEN_COMMIT_SECONDS,
        });
        occupiedCasualties.add(casualty.id);
        occupiedScreeners.add(pick.id);
    }
    return state;
}

export function faultSupportForActor(state, actorId) {
    return state?.assignments?.get(actorId) ?? null;
}

/** An actor already fighting a target that has stopped to service its weapon may
 * press the opening slightly harder. This never changes targets, grants LOS, or
 * overrides withdrawal/recovery behavior. */
export function exploitServicingTarget(intent, target, posture = null) {
    if (!intent || !target?.fieldService?.held || posture?.preferredMode === 'WITHDRAW' ||
        intent.mode === 'WITHDRAW' || intent.mode === 'REGROUP' || intent.mode === 'SCREEN')
        return intent;
    return {
        ...intent,
        throttleScale: Math.max(intent.throttleScale ?? .9, SERVICE_EXPLOIT_THROTTLE_SCALE),
        brakeBias: Math.min(intent.brakeBias ?? .24, .18),
        note: `${intent.note ?? intent.mode} · PRESS SERVICE`,
    };
}
'''
(ROOT / 'faultSupport.js').write_text(fault_support)

# Extend squad intent with a positional SCREEN assignment, while preserving own-damage priorities.
replace_once('squadCoordination.js',
"export function squadIntent(actor, roster, target, objectivePoint = null, posture = null) {",
"export function squadIntent(actor, roster, target, objectivePoint = null, posture = null, support = null) {")
replace_once('squadCoordination.js',
"""    if (posture?.preferredMode === 'HOLD')
        return { mode: 'ANCHOR', role, point: { x: self.x, z: self.z }, brakeBias: .72, note: `${posture.state} · HOLD` };

    // A stranded machine should rejoin the fight before attempting a clever flank.
""",
"""    if (posture?.preferredMode === 'HOLD')
        return { mode: 'ANCHOR', role, point: { x: self.x, z: self.z }, brakeBias: .72, note: `${posture.state} · HOLD` };

    if (support?.screenTarget) {
        const casualty = rigOf(support.screenTarget);
        const threat = rigOf(support.screenThreat ?? target);
        const dx = (threat?.x ?? targetRig.x) - casualty.x;
        const dz = (threat?.z ?? targetRig.z) - casualty.z;
        const length = Math.max(.001, Math.hypot(dx, dz));
        const nx = dx / length, nz = dz / length;
        const tx = -nz, tz = nx;
        const side = deterministicSide(actor.id);
        const point = {
            x: casualty.x + nx * 2.8 + tx * side * .65,
            z: casualty.z + nz * 2.8 + tz * side * .65,
        };
        const settled = distance(self, point) < 1.5;
        return {
            mode: 'SCREEN', role,
            point: separatedPoint(point, actor, allies, 1.1),
            throttleScale: settled ? .45 : .9,
            brakeBias: settled ? .62 : .2,
            note: `SCREEN ${support.screenTarget.label ?? support.screenTarget.id}`,
            supportTargetId: support.screenTarget.id,
        };
    }

    // A stranded machine should rejoin the fight before attempting a clever flank.
""")

# Integrate one global support plan into the live fixed-step battle loop.
replace_once('main.js',
"import { squadIntent } from './squadCoordination.js';\nimport { damagePosture } from './damageBehavior.js';",
"import { squadIntent } from './squadCoordination.js';\nimport { createFaultSupportState, exploitServicingTarget, faultSupportForActor, resetFaultSupportState, updateFaultSupportAssignments } from './faultSupport.js';\nimport { damagePosture } from './damageBehavior.js';")
replace_once('main.js',
"let fieldService = createFieldServiceState();\nlet servicePointerId = null;",
"let fieldService = createFieldServiceState();\nconst faultSupportState = createFaultSupportState();\nlet servicePointerId = null;")
replace_once('main.js',
"return { id: 'player', team: FRIENDLY_TEAM, label: 'YOU', rig, condition: playerCondition, assembly, active: playerCombatActive };",
"return { id: 'player', team: FRIENDLY_TEAM, label: 'YOU', rig, condition: playerCondition, assembly, active: playerCombatActive, fieldService };")
replace_once('main.js',
"""    actor.teamIntent = null;
    actor.teamPlanLeft = 0;
    actor.teamPlanTargetId = null;
""",
"""    actor.teamIntent = null;
    actor.teamPlanLeft = 0;
    actor.teamPlanTargetId = null;
    actor.teamSupportTargetId = null;
""")
replace_once('main.js',
"""function resetSquadBattle() {
    for (const actor of aiActors) resetAiActor(actor);
""",
"""function resetSquadBattle() {
    resetFaultSupportState(faultSupportState);
    for (const actor of aiActors) resetAiActor(actor);
""")
replace_once('main.js',
"            if (!aftermathDriving) for (const actor of aiActors) {",
"""            if (!aftermathDriving) {
                const participants = battleParticipants();
                updateFaultSupportAssignments(faultSupportState, participants, FIXED_DT);
                for (const actor of aiActors) {""")
replace_once('main.js',
"""                const recovery = aiWeaponRecoveryDirective(actor, target);
                const posture = aiWeaponRecoveryPosture(damagePosture(actor.condition, actor.behavior), recovery);
                actor.teamPlanLeft = Math.max(0, (actor.teamPlanLeft ?? 0) - FIXED_DT);
                if (actor.teamPlanLeft === 0 || actor.teamPlanTargetId !== target.id) {
                    actor.teamIntent = squadIntent(actor, battleParticipants(), target, objectivePointForTeam(sortieObjective, actor.team), posture);
                    actor.teamPlanTargetId = target.id;
                    actor.teamPlanLeft = .24 + ((actor.id.charCodeAt(actor.id.length - 1) || 0) % 3) * .04;
                }
""",
"""                const recovery = aiWeaponRecoveryDirective(actor, target);
                const posture = aiWeaponRecoveryPosture(damagePosture(actor.condition, actor.behavior), recovery);
                const screenAssignment = faultSupportForActor(faultSupportState, actor.id);
                const supportTargetId = screenAssignment?.casualtyId ?? null;
                if (actor.teamSupportTargetId !== supportTargetId) {
                    actor.teamSupportTargetId = supportTargetId;
                    actor.teamPlanLeft = 0;
                }
                const screenTarget = supportTargetId ? participants.find(candidate => candidate.id === supportTargetId) ?? null : null;
                const screenThreat = screenAssignment?.threatId ? participants.find(candidate => candidate.id === screenAssignment.threatId) ?? null : null;
                actor.teamPlanLeft = Math.max(0, (actor.teamPlanLeft ?? 0) - FIXED_DT);
                if (actor.teamPlanLeft === 0 || actor.teamPlanTargetId !== target.id) {
                    actor.teamIntent = squadIntent(actor, participants, target, objectivePointForTeam(sortieObjective, actor.team), posture, { screenTarget, screenThreat });
                    actor.teamIntent = exploitServicingTarget(actor.teamIntent, target, posture);
                    actor.teamPlanTargetId = target.id;
                    actor.teamPlanLeft = .24 + ((actor.id.charCodeAt(actor.id.length - 1) || 0) % 3) * .04;
                }
""")
replace_once('main.js',
"""                }
            }
            if (!aftermathDriving && !testEnded) {
""",
"""                }
            }
            }
            if (!aftermathDriving && !testEnded) {
""")

# Cache/version identity for mobile playtesting.
replace_once('index.html',
'    "./aiFieldService.js": "./aiFieldService.js?v=k3p0",',
'    "./aiFieldService.js": "./aiFieldService.js?v=k3p0",\n    "./squadCoordination.js": "./squadCoordination.js?v=k3p1",\n    "./faultSupport.js": "./faultSupport.js?v=k3p1",')
replace_once('index.html',
'<title>MECH ARENA — 0.0.1k.3p.0 — Recoverable Weapon Disable</title>',
'<title>MECH ARENA — 0.0.1k.3p.1 — Fault Support & Exploitation</title>')
replace_once('index.html',
'<script type="module" src="./main.js?v=k3p0"></script>',
'<script type="module" src="./main.js?v=k3p1"></script>')

# Focused behavior + integration regression coverage.
test = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    SCREEN_COMMIT_SECONDS,
    canScreenFault,
    createFaultSupportState,
    exploitServicingTarget,
    faultSupportForActor,
    needsFaultSupport,
    updateFaultSupportAssignments,
} from '../faultSupport.js';
import { createFieldServiceState } from '../fieldService.js';
import { squadIntent } from '../squadCoordination.js';

const condition = ({ structure = 1, mobility = 1, power = 1, command = 1, combat = 1 } = {}) => ({
    parts: Object.fromEntries(Object.entries({ structure, mobility, power, command, combat }).map(([slot, health]) => [slot, {
        integrity: 100 * health, maxIntegrity: 100, destroyed: false,
    }])),
});
const actor = (id, team, x, z, opts = {}) => ({
    id, team, label: id.toUpperCase(), active: opts.active ?? true,
    rig: { x, z }, condition: condition(opts.health),
    behavior: { id: opts.behavior ?? 'pressure', preferredRangeM: 6 },
    fieldService: opts.service ?? createFieldServiceState(),
    targetId: opts.targetId ?? null,
});
const fault = a => {
    a.condition.parts.combat.integrity = 8;
    a.fieldService.faultLatched = true;
    return a;
};

test('one nearest healthy ally screens a recoverable casualty without squad dog-piling', () => {
    const casualty = fault(actor('casualty', 'friendly', 0, 0, { targetId: 'enemy' }));
    const near = actor('near', 'friendly', 3, 0);
    const far = actor('far', 'friendly', 7, 0);
    const enemy = actor('enemy', 'hostile', 0, 8);
    const state = createFaultSupportState();
    updateFaultSupportAssignments(state, [casualty, near, far, enemy], 1 / 60);

    assert.equal(needsFaultSupport(casualty), true);
    assert.equal(faultSupportForActor(state, 'near')?.casualtyId, 'casualty');
    assert.equal(faultSupportForActor(state, 'near')?.threatId, 'enemy');
    assert.equal(faultSupportForActor(state, 'near')?.commitLeft > 0, true);
    assert.equal(faultSupportForActor(state, 'far'), null);
    assert.equal(state.assignments.size, 1);
});

test('critical, crippled, weapon-faulted actors do not abandon themselves to screen', () => {
    const casualty = fault(actor('casualty', 'friendly', 0, 0));
    const critical = actor('critical', 'friendly', 2, 0, { health: { structure: .1 } });
    const crippled = actor('crippled', 'friendly', 2.5, 0, { health: { mobility: .1 } });
    const faulted = fault(actor('faulted', 'friendly', 3, 0));
    const healthy = actor('healthy', 'friendly', 4, 0);
    const enemy = actor('enemy', 'hostile', 0, 7);

    assert.equal(canScreenFault(critical), false);
    assert.equal(canScreenFault(crippled), false);
    assert.equal(canScreenFault(faulted), false);
    const state = createFaultSupportState();
    updateFaultSupportAssignments(state, [casualty, critical, crippled, faulted, healthy, enemy], 0);
    assert.equal(faultSupportForActor(state, 'healthy')?.casualtyId, 'casualty');
    assert.equal(state.assignments.size, 1);
});

test('screen assignment is stable through the crisis and disappears immediately when recovery is complete', () => {
    const casualty = fault(actor('casualty', 'friendly', 0, 0));
    const first = actor('first', 'friendly', 4, 0);
    const second = actor('second', 'friendly', 6, 0);
    const enemy = actor('enemy', 'hostile', 0, 8);
    const state = createFaultSupportState();
    updateFaultSupportAssignments(state, [casualty, first, second, enemy], 0);
    assert.equal(faultSupportForActor(state, 'first')?.commitLeft, SCREEN_COMMIT_SECONDS);

    second.rig.x = 1;
    updateFaultSupportAssignments(state, [casualty, first, second, enemy], .4);
    assert.equal(faultSupportForActor(state, 'first')?.casualtyId, 'casualty', 'closer newcomer must not cause flicker');
    assert.equal(faultSupportForActor(state, 'second'), null);

    casualty.fieldService.used = true;
    casualty.fieldService.faultLatched = false;
    casualty.condition.parts.combat.integrity = 20;
    updateFaultSupportAssignments(state, [casualty, first, second, enemy], .1);
    assert.equal(state.assignments.size, 0);
});

test('SCREEN intent physically occupies the threat side of the casualty without overriding own withdrawal', () => {
    const casualty = actor('casualty', 'friendly', 0, 0);
    const screener = actor('screen', 'friendly', -4, 0);
    const ally = actor('ally', 'friendly', -6, 0);
    const enemy = actor('enemy', 'hostile', 0, 10);
    const intent = squadIntent(screener, [casualty, screener, ally, enemy], enemy, null, null, {
        screenTarget: casualty, screenThreat: enemy,
    });
    assert.equal(intent.mode, 'SCREEN');
    assert.equal(intent.supportTargetId, 'casualty');
    assert.ok(intent.point.z > casualty.rig.z && intent.point.z < enemy.rig.z);

    const withdrawn = squadIntent(screener, [casualty, screener, ally, enemy], enemy, null, {
        preferredMode: 'WITHDRAW', state: 'CRITICAL',
    }, { screenTarget: casualty, screenThreat: enemy });
    assert.equal(withdrawn.mode, 'WITHDRAW');
});

test('an actor already engaging a servicing target presses slightly harder without retargeting or overriding safety', () => {
    const target = actor('target', 'hostile', 0, 0);
    target.fieldService.held = true;
    const base = { mode: 'PRESSURE', point: { x: 1, z: 2 }, throttleScale: .82, brakeBias: .3, note: 'PRESSURE' };
    const pressed = exploitServicingTarget(base, target, { preferredMode: null });
    assert.equal(pressed.mode, 'PRESSURE');
    assert.ok(pressed.throttleScale > base.throttleScale);
    assert.ok(pressed.note.includes('PRESS SERVICE'));
    assert.deepEqual(pressed.point, base.point);

    const retreat = { ...base, mode: 'WITHDRAW' };
    assert.equal(exploitServicingTarget(retreat, target, null), retreat);
});

test('live combat exposes player recovery to friendly support and keeps support planning outside locomotion', () => {
    const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
    assert.match(source, /fieldService \};/);
    assert.match(source, /updateFaultSupportAssignments\(faultSupportState, participants, FIXED_DT\)/);
    assert.match(source, /faultSupportForActor\(faultSupportState, actor\.id\)/);
    assert.match(source, /teamSupportTargetId !== supportTargetId/);
    assert.match(source, /squadIntent\(actor, participants, target,[\s\S]*\{ screenTarget, screenThreat \}\)/);
    assert.match(source, /exploitServicingTarget\(actor\.teamIntent, target, posture\)/);
});
'''
(ROOT / 'tests/k3p1FaultSupport.test.mjs').write_text(test)

print('k.3p.1 patch applied')
