import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('gameplay feeds real combat evidence into tactical memory', () => {
    const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
    assert.match(main, /recentThreatTargetId\(actor\.motion\)/);
    assert.match(main, /noteIncomingFire\(targetActor\.motion, rig, 'player'/);
    assert.match(main, /noteIncomingFire\(target\.motion, actor\.rig, actor\.id/);
    assert.match(main, /noteBlockedFire\(actor\.motion/);
});

test('enemy motion consumes awareness as intent while existing locomotion stays authoritative', () => {
    const source = fs.readFileSync(new URL('../enemyMotion.js', import.meta.url), 'utf8');
    assert.match(source, /advanceTacticalAwareness/);
    assert.match(source, /SEEK COVER/);
    assert.match(source, /TAKE COVER/);
    assert.match(source, /REPOSITION/);
    assert.doesNotMatch(source, /stepRig\(/);
});
