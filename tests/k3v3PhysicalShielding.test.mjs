import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shieldedModuleOnRay, shieldImpactLabel } from '../frameShielding.js';
import { makeTestAssembly, equip, inspectAssembly, CATALOG } from '../components.js';
import { createTargetCondition, applyTargetHit } from '../combat.js';

const hit = (distance, slot, actorId = 'enemy-0') => ({
    distance, object: { userData: { slot, actorId } },
});

test('shielding requires structure to be the FIRST physical mesh, not an arbitrary facing bonus', () => {
    assert.equal(shieldedModuleOnRay([hit(2,'power'),hit(3,'structure')]),null);
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(3,'power')]),'power');
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(4,'command')]),'command');
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(4,'combat')]),'combat');
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(4,'mobility')]),'mobility');
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(4,'structure')]),null);
});

test('shielding never infers protection through a gap, an obstacle or someone else\'s machine', () => {
    assert.equal(shieldedModuleOnRay([]),null);
    assert.equal(shieldedModuleOnRay([hit(2,'miss'),hit(3,'command')]),null);
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(3,'power','enemy-1')]),null);
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(2.005,'power')]),null);
    assert.equal(shieldedModuleOnRay([hit(2,'structure'),hit(3,'structure'),hit(4,'power')]),'power');
});

test('shield labels never claim more than physically verified secondary hit', () => {
    assert.equal(shieldImpactLabel({slot:'structure',shieldedSlot:'command'}),'FRAME SHIELDED CAB');
    assert.equal(shieldImpactLabel({slot:'structure',shieldedSlot:'combat'}),'FRAME SHIELDED WEAPON');
    assert.equal(shieldImpactLabel({slot:'structure',shieldedSlot:'mobility'}),'FRAME SHIELDED DRIVE');
    assert.equal(shieldImpactLabel({slot:'structure',shieldedSlot:'power'}),'FRAME SHIELDED GENERATOR');
    assert.equal(shieldImpactLabel({slot:'structure',shieldedSlot:null}),null);
    assert.equal(shieldImpactLabel({slot:'command',shieldedSlot:'power'}),null);
    assert.equal(shieldImpactLabel(null),null);
});

test('frame-first impact consumes ONLY structural armor; deeper component remains untouched', () => {
    for (const id of ['frame-sr','frame-utility','frame-wedge']) {
        const assembly = makeTestAssembly();
        equip(assembly,'structure',id);
        assert.equal(inspectAssembly(assembly).ready,true);
        const target = createTargetCondition(assembly);
        const power = {...target.parts.power};
        const cab = {...target.parts.command};
        const before = target.parts.structure.armor;
        const result = applyTargetHit(target,'structure',38);
        assert.equal(result.slot,'structure');
        assert.equal(target.parts.structure.armor,before-38);
        assert.deepEqual(target.parts.power,power);
        assert.deepEqual(target.parts.command,cab);
    }
});

test('protected and direct module hits still follow original armor, integrity and disabled/destroyed rules', () => {
    const a = createTargetCondition(makeTestAssembly()),b = createTargetCondition(makeTestAssembly());
    const first = applyTargetHit(a,'power',38);
    const second = applyTargetHit(b,'power',38);
    assert.deepEqual(first,second);
    assert.equal(first.remainingArmor,a.parts.power.maxArmor-38);
    assert.equal(a.parts.structure.armor,a.parts.structure.maxArmor);
});

test('only the three existing frames and 14 original definition IDs are involved', () => {
    assert.deepEqual(CATALOG.filter(c=>c.slot==='structure').map(c=>c.id),
        ['frame-sr','frame-utility','frame-wedge']);
    assert.equal(CATALOG.length,15);
});

test('player and AI shots use the same actual intersections and first-hit damage authority', () => {
    const read = file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
    const scene=read('../scene.js');
    const main=read('../main.js');
    assert.match(scene,/export function buildExteriorRig\(assembly\)/);
    assert.match(scene,/shieldedModuleOnRay\(intersections, actual\)/);
    assert.match(scene,/raycaster\.intersectObjects\(blockers, false\)/);
    assert.match(scene,/raycaster\.intersectObjects\(\[\.\.\.combatPickMeshes\(\), \.\.\.worldSolids\], false\)/);
    assert.match(main,/applyTargetHit\(playerCondition, contact\.slot,/);
    assert.match(main,/applyTargetHit\(targetActor\.condition, contact\.slot,/);
    assert.match(main,/applyTargetHit\(target\.condition, contact\.slot,/);
});
