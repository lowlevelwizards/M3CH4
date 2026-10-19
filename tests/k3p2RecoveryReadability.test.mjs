import test from 'node:test';
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
    assert.match(main, /serviceInterruptedByHit = fieldService\.held/);
    assert.match(main, /if \(serviceInterruptedByHit\) handleFieldServiceInterrupted\(\)/);
    assert.match(main, /REMOTE MODULE TELEMETRY WITHHELD/);
});

test('mobile runtime cache identity still loads the recovery-readability scene source', () => {
    assert.match(index, /sceneAssembly\.js\?v=k3v2/);
    assert.match(index, /main\.js\?v=k3v2/);
    assert.match(bridge, /scene\.js\?source=k3v2/);
});
