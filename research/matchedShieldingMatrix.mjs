/** Build 2: physically identical target loads; current approved procedural meshes.
 * Requires Three.js 0.186.0. No synthetic armor, hit modifiers or scene substitutes.
 * node research/matchedShieldingMatrix.mjs [--json] [--assert]
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { equip, inspectAssembly, makeTestAssembly } from '../components.js';
import { measureShieldedAssembly, FRAME_IDS, TARGET_SLOTS, DIRECTIONS } from './frameShieldingAudit.mjs';

export const CABS = ['cab-cyclops','cab-utility','cab-armored'];
export const POWER = ['power-dynamo','power-air'];
export function runMatchedShieldingMatrix() {
    const configurations=[];
    for(const frame of FRAME_IDS) for(const cab of CABS) for(const generator of POWER) {
        const assembly=makeTestAssembly();
        equip(assembly,'structure',frame);
        equip(assembly,'mobility','legs-yard');
        equip(assembly,'power',generator);
        equip(assembly,'command',cab);
        equip(assembly,'combat','gun-short');
        const verdict=inspectAssembly(assembly);
        if (!verdict.ready) {
            configurations.push({frame,cab,generator,legal:false,
                reasons:verdict.checks.filter(c=>!c.passes).map(c=>c.reason)});
            continue;
        }
        const measured=measureShieldedAssembly(assembly,frame);
        const byDirection=measured.directions;
        const evidence=measured.samples.filter(sample=>sample.evidentialShield);
        configurations.push({frame,cab,generator,legal:true,massKg:verdict.massKg,
            byDirection,verifiedShieldEvents:evidence.length,
            // Same-ray first contact has priority; a mere frame hit without a
            // deeper intersected module is deliberately excluded from shields.
            samples:measured.samples});
    }
    return {schemaVersion:1,measurement:'actual Three.js first-hit module raycast',
        moduleIdentities:'actual mesh userData.slot; same-ray downstream shield evidence',
        conditions:'same Yardwalker and Stump; all frame/cab/generator choices, six directions, nine samples per target',
        limitations:'finite ray sample, not battle hit probability; no phone performance, penetration or AI',
        configurations};
}
export function assertMatchedShieldingMatrix(report=runMatchedShieldingMatrix()) {
    assert.equal(report.configurations.length,FRAME_IDS.length*CABS.length*POWER.length);
    for(const rig of report.configurations) {
        if (!rig.legal) {
            assert.ok(rig.reasons.length);assert.equal(rig.samples,undefined);continue;
        }
        assert.equal(rig.samples.length,Object.keys(DIRECTIONS).length*TARGET_SLOTS.length*9);
        for(const hit of rig.samples) {
            if(hit.evidentialShield) {
                assert.equal(hit.struck,'structure');
                assert.equal(hit.shieldedSlot,hit.targetSlot);
                assert.ok(hit.intersections.some(x=>x.slot===hit.targetSlot));
            }
            assert.ok(hit.distance===null||(hit.distance>0&&hit.distance<25));
        }
        assert.ok(rig.samples.some(s=>s.struck==='command' && s.targetSlot==='command'),
            'No full command-module immunity from a fabricated shape');
        assert.ok(rig.samples.some(s=>s.struck==='power' && s.targetSlot==='power'),
            'No fully enclosed power pack');
    }
    // Directional Wedge exposure remains a factual mesh result, not a multiplier.
    const wedge=report.configurations.find(r=>r.frame==='frame-wedge'&&
        r.cab==='cab-cyclops'&&r.generator==='power-dynamo');
    assert.ok(wedge.byDirection.front.command.frameFirst >
        wedge.byDirection.rear.command.frameFirst);
    assert.ok(wedge.byDirection.rear.power.reached>wedge.byDirection.front.power.reached);
    return report;
}
export function formatMatchedShieldingMatrix(report=runMatchedShieldingMatrix()) {
    const lines=['# Build 2 / Matched physical shielding','',
        'Real approved models and gameplay raycast geometry, 9 direct rays per target/direction.',
        'Counts are not universal protection percentages. All hardware except shown choices is matched.','',
        '| Frame | Cab | Power | Front cab direct | Front structural intercept | Side cab direct | Rear generator direct | Verified shields |',
        '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |'];
    for(const r of report.configurations) {
        if (!r.legal) {lines.push('| '+[r.frame,r.cab,r.generator,'INVALID','','','',''].join(' | ')+' |');continue;}
        const side=r.byDirection.left.command.reached+r.byDirection.right.command.reached;
        lines.push('| '+[r.frame,r.cab,r.generator,r.byDirection.front.command.reached,
            r.byDirection.front.command.frameFirst,side,r.byDirection.rear.power.reached,
            r.verifiedShieldEvents].join(' | ')+' |');
    }
    return lines.join('\n')+'\n';
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
    const report=runMatchedShieldingMatrix();
    if(process.argv.includes('--assert'))assertMatchedShieldingMatrix(report);
    process.stdout.write(process.argv.includes('--json') ?
        JSON.stringify(report,null,2)+'\n' : formatMatchedShieldingMatrix(report));
}
