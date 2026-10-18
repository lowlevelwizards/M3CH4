import test from 'node:test';
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
    assert.match(source, /screening\?\.casualtyId/);
    assert.match(source, /goal:'SCREEN'/);
    assert.match(source, /decidePilot\(actor\.brain/);
});
