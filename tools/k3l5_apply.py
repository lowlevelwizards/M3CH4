from pathlib import Path

ROOT = Path('.')

def read(path): return (ROOT / path).read_text()
def write(path, text): (ROOT / path).write_text(text)
def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# cockpitView.js — restore a small physical deadband, then stronger tether motion,
# while retaining the k.3l.4 hard safe-area saturation.
write('cockpitView.js', """/** k.3l.5 — soft cockpit deadband + safe-area tether.
 * Small pilot head movements keep the combiner visually settled. Outside that central
 * deadband the chassis-mounted displays move more assertively than k.3l.4, restoring
 * physical cockpit parallax, then saturate before critical telemetry can leave view. */
export const COMBINER_TETHER_FOLLOW = 0.78;
export const COMBINER_TETHER_YAW_DEADZONE = 0.075;
export const COMBINER_TETHER_PITCH_DEADZONE = 0.050;
export const COMBINER_TETHER_YAW_LIMIT = 0.16;
export const COMBINER_TETHER_PITCH_LIMIT = 0.10;

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
const outsideDeadzone = (value, deadzone) => {
    if (!Number.isFinite(value)) return 0;
    const magnitude = Math.max(0, Math.abs(value) - deadzone);
    return Math.sign(value) * magnitude;
};

export function combinerTetherFromLook(lookYaw = 0, lookPitch = 0) {
    const yaw = -outsideDeadzone(lookYaw, COMBINER_TETHER_YAW_DEADZONE) * COMBINER_TETHER_FOLLOW;
    const pitch = -outsideDeadzone(lookPitch, COMBINER_TETHER_PITCH_DEADZONE) * COMBINER_TETHER_FOLLOW;
    return {
        yaw: clamp(yaw, COMBINER_TETHER_YAW_LIMIT),
        pitch: clamp(pitch, COMBINER_TETHER_PITCH_LIMIT),
    };
}
""")

# combat.js — make the starter guns feel like crude industrial projectile machinery.
combat = read('combat.js')
combat = replace_once(combat,
"""    'gun-cannon': { id: 'gun-cannon', label: 'TRAINING CANNON', magazine: 12, spareRounds: 60, roundsPerSecond: 2.4, reloadSeconds: 2.5, damage: 38, recoilImpulseNs: 1350, spread: .004, muzzleZ: -1.90 },
    'gun-short': { id: 'gun-short', label: 'STUMP CANNON', magazine: 8, spareRounds: 48, roundsPerSecond: 2.0, reloadSeconds: 2.1, damage: 47, recoilImpulseNs: 1950, spread: .012, muzzleZ: -1.31 },
    'gun-light': { id: 'gun-light', label: 'NEEDLE CANNON', magazine: 16, spareRounds: 80, roundsPerSecond: 3.5, reloadSeconds: 2.8, damage: 28, recoilImpulseNs: 850, spread: .002, muzzleZ: -2.73 },""",
"""    'gun-cannon': { id: 'gun-cannon', label: 'TRAINING CANNON', magazine: 12, spareRounds: 60, roundsPerSecond: 2.4, reloadSeconds: 2.5, damage: 38, recoilImpulseNs: 1725, spread: .004, muzzleZ: -1.90 },
    'gun-short': { id: 'gun-short', label: 'STUMP CANNON', magazine: 8, spareRounds: 48, roundsPerSecond: 2.0, reloadSeconds: 2.1, damage: 47, recoilImpulseNs: 2550, spread: .012, muzzleZ: -1.31 },
    'gun-light': { id: 'gun-light', label: 'NEEDLE CANNON', magazine: 16, spareRounds: 80, roundsPerSecond: 3.5, reloadSeconds: 2.8, damage: 28, recoilImpulseNs: 1050, spread: .002, muzzleZ: -2.73 },""",
'weapon recoil impulses')
write('combat.js', combat)

# combatPresentation.js — enough aftermath time to inhabit the cleared yard.
pres = read('combatPresentation.js')
pres = replace_once(pres, 'export const SORTIE_OUTRO_SECONDS = 2.65;', 'export const SORTIE_OUTRO_SECONDS = 4.25;', 'sortie aftermath duration')
write('combatPresentation.js', pres)

# scene.js — slightly larger crisp combiner readouts and slower/deeper visible breech kick.
scene = read('scene.js')
scene = replace_once(scene,
"""        systems: { position: [-.094, .004, -.105], scale: .059 },
        team:    { position: [ 0.000, .057, -.105], scale: .047 },
        weapon:  { position: [ .094,-.004, -.105], scale: .057 },
        motion:  { position: [-.058,-.052, -.105], scale: .048 },
        drive:   { position: [ .020,-.054, -.105], scale: .048 },""",
"""        systems: { position: [-.091, .004, -.105], scale: .066 },
        team:    { position: [ 0.000, .057, -.105], scale: .052 },
        weapon:  { position: [ .091,-.004, -.105], scale: .064 },
        motion:  { position: [-.056,-.052, -.105], scale: .053 },
        drive:   { position: [ .020,-.054, -.105], scale: .053 },""",
'combiner readout scale')
scene = replace_once(scene,
"""        gunPivot.rotation.set(lookPitch * .85, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');
        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;
        gunPivot.position.z = -0.62 + muzzleKick * .13;""",
"""        gunPivot.rotation.set(lookPitch * .85 + muzzleKick * .042, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');
        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;
        gunPivot.position.z = -0.62 + muzzleKick * .19;""",
'visible gun kick')
scene = replace_once(scene,
'        muzzleKick = Math.min(1, muzzleKick + .8);',
'        muzzleKick = Math.min(1.2, muzzleKick + 1.0);',
'player muzzle kick impulse')
scene = replace_once(scene,
'        muzzleKick = Math.max(0, muzzleKick - dt * 5);',
'        muzzleKick = Math.max(0, muzzleKick - dt * 3.6);',
'player muzzle kick recovery')
write('scene.js', scene)

# main.js — freeze combat outcome immediately, but leave the victorious machine
# driveable during the 4.25 s aftermath. Weapons/AI stay stopped because testEnded
# remains authoritative; only the player locomotion fixed-step is admitted.
main = read('main.js')
main = replace_once(main,
"""    stopFireInput();
    stopFieldServiceInput();
    controls.setEnabled(false);
    const winningTeam = victory ? FRIENDLY_TEAM : HOSTILE_TEAM;""",
"""    stopFireInput();
    stopFieldServiceInput();
    // The bout state is final, but a surviving pilot gets a short physical aftermath
    // before the report covers the yard. Fire/service stay locked by testEnded.
    controls.setEnabled(victory && playerCombatActive && appSheet.classList.contains('hidden'));
    const winningTeam = victory ? FRIENDLY_TEAM : HOSTILE_TEAM;""",
'finish sortie aftermath controls')
main = replace_once(main,
"""    let input = controls.sample();
    let steps = 0;
    if (!inspecting && !testEnded && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {""",
"""    let input = controls.sample();
    let steps = 0;
    const aftermathDriving = testEnded && sortiePhase === 'outro' && playerCombatActive;
    if (!inspecting && (!testEnded || aftermathDriving) && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {""",
'frame aftermath gate')
main = replace_once(main,
"""                else if (serviceStep.event === 'interrupted') handleFieldServiceInterrupted();
            }
            for (const actor of aiActors) {""",
"""                else if (serviceStep.event === 'interrupted') handleFieldServiceInterrupted();
            }
            // Score, damage, target choice and opposing locomotion are frozen once the
            // sortie resolves. Only the surviving player's physical rig keeps coasting/walking.
            if (!aftermathDriving) for (const actor of aiActors) {""",
'freeze actors in aftermath')
main = replace_once(main,
"""            const next = pendingDebrief; pendingDebrief = null; sortiePhase = 'debrief';
            sortieOutro.classList.add('hidden'); sortieOutro.setAttribute('aria-hidden', 'true');
            assemblyToggle.disabled = false;
            renderDebrief(next.summary, next.reason);""",
"""            const next = pendingDebrief; pendingDebrief = null; sortiePhase = 'debrief';
            sortieOutro.classList.add('hidden'); sortieOutro.setAttribute('aria-hidden', 'true');
            controls.setEnabled(false);
            assemblyToggle.disabled = false;
            renderDebrief(next.summary, next.reason);""",
'debrief locks aftermath movement')
write('main.js', main)

# acquisitionUI.js — say plainly what salvage order means and where the player sits in it.
acq = read('acquisitionUI.js')
acq = replace_once(acq,
".draft-order{margin-top:5px;padding:5px 6px;border:1px solid #8a754c66;color:#ccb77f;background:#26251d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
".draft-order{margin-top:5px;padding:6px 7px;border:1px solid #9b845477;color:#d7c18b;background:#29271d;white-space:normal;overflow:visible;font-weight:800;letter-spacing:.035em}.draft-order b{color:#f0ca78}.draft-order small{color:#8fa293;font-weight:600}",
'claim order style')
acq = replace_once(acq,
"""        const order = document.createElement('div'); order.className = 'draft-order';
        order.textContent = `SALVAGE · ${result.score.draftOrder.map(id => actorLabel(result, id)).join(' → ')}`;
        match.append(order);""",
"""        const order = document.createElement('div'); order.className = 'draft-order';
        const orderIds = result.score.draftOrder ?? [];
        const numbered = orderIds.map((id, index) => `${index + 1}. ${actorLabel(result, id)}`).join('  →  ');
        order.innerHTML = `<b>CLAIM ORDER</b> · ${numbered}<br><small>Higher bout score / participation drafts first. Each pilot may recover one eligible component.</small>`;
        match.append(order);""",
'claim order score explanation')
acq = replace_once(acq,
"""    const heading = document.createElement('h2');
    heading.textContent = currentDrafter(result.draft) === 'player' ? 'YOUR SALVAGE CLAIM' : 'SALVAGE COMPLETE';
    const rule = document.createElement('span');
    rule.textContent = '1 CLAIM / PILOT · DESTROYED = SCRAP · PERSONAL HARDWARE PROTECTED';""",
"""    const heading = document.createElement('h2');
    const orderIds = result.score?.draftOrder ?? [];
    const playerTurn = orderIds.indexOf('player') + 1;
    heading.textContent = currentDrafter(result.draft) === 'player'
        ? `YOUR TURN · CLAIM ${playerTurn > 0 ? playerTurn : 1} OF ${Math.max(1, orderIds.length)}`
        : 'SALVAGE COMPLETE';
    const rule = document.createElement('span');
    rule.textContent = currentDrafter(result.draft) === 'player'
        ? 'PICK 1 RECOVERABLE PART · DESTROYED = SCRAP · PERSONAL HARDWARE PROTECTED'
        : 'CLAIM ORDER COMPLETE · PERSONAL HARDWARE PROTECTED';""",
'salvage turn clarity')
write('acquisitionUI.js', acq)

# Cache/version bridge.
html = read('index.html')
for old, new, label in [
    ('"./combat.js": "./combat.js?v=k3l1",', '"./combat.js": "./combat.js?v=k3l5",', 'combat cache'),
    ('"./scene.js": "./sceneAssembly.js?v=k3l4",', '"./scene.js": "./sceneAssembly.js?v=k3l5",', 'scene cache'),
    ('"./combatPresentation.js": "./combatPresentation.js?v=k3k3",', '"./combatPresentation.js": "./combatPresentation.js?v=k3l5",', 'presentation cache'),
    ('"./cockpitView.js": "./cockpitView.js?v=k3l4",', '"./cockpitView.js": "./cockpitView.js?v=k3l5",', 'cockpit cache'),
    ('<title>MECH ARENA — 0.0.1k.3l.4 — Safe HUD + Garage Polish</title>', '<title>MECH ARENA — 0.0.1k.3l.5 — Cockpit + Aftermath Feel</title>', 'title'),
    ('<script type="module" src="./main.js?v=k3l4"></script>', '<script type="module" src="./main.js?v=k3l5"></script>', 'main cache'),
    ('<script type="module" src="./garageMountUI.js?v=k3l4"></script>', '<script type="module" src="./garageMountUI.js?v=k3l5"></script>', 'garage cache'),
]:
    html = replace_once(html, old, new, label)
write('index.html', html)

assembly = read('sceneAssembly.js')
assembly = replace_once(assembly, "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3l4';", "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3l5';", 'scene source cache')
write('sceneAssembly.js', assembly)

mount = read('garageMountUI.js')
mount = replace_once(mount, "import './acquisitionUI.js?v=k3l4';", "import './acquisitionUI.js?v=k3l5';", 'acquisition cache')
write('garageMountUI.js', mount)

# Update the focused cockpit tests for the deadband semantics.
write('tests/cockpitView.test.mjs', """import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_FOLLOW_START, bodyFollowSteer } from '../controls.js';
import {
    COMBINER_TETHER_FOLLOW, COMBINER_TETHER_PITCH_DEADZONE,
    COMBINER_TETHER_PITCH_LIMIT, COMBINER_TETHER_YAW_DEADZONE,
    COMBINER_TETHER_YAW_LIMIT, combinerTetherFromLook,
} from '../cockpitView.js';

test('small free-look sits inside a physical combiner deadband', () => {
    const lookYaw = Math.min(BODY_FOLLOW_START * .45, COMBINER_TETHER_YAW_DEADZONE * .8);
    assert.equal(bodyFollowSteer(lookYaw), 0);
    assert.deepEqual(combinerTetherFromLook(lookYaw, COMBINER_TETHER_PITCH_DEADZONE * .8), { yaw: 0, pitch: 0 });
});

test('outside the deadband the combiner moves assertively then recenters', () => {
    const lookYaw = COMBINER_TETHER_YAW_DEADZONE + .10;
    const tether = combinerTetherFromLook(lookYaw, 0);
    assert.equal(tether.yaw, -.10 * COMBINER_TETHER_FOLLOW);
    assert.ok(Math.abs(combinerTetherFromLook(COMBINER_TETHER_YAW_DEADZONE + .03, 0).yaw) < Math.abs(tether.yaw));
});

test('combiner tether still saturates inside the safe windshield area', () => {
    const extreme = combinerTetherFromLook(1.2, -0.8);
    assert.equal(extreme.yaw, -COMBINER_TETHER_YAW_LIMIT);
    assert.equal(extreme.pitch, COMBINER_TETHER_PITCH_LIMIT);
});
""")

write('tests/k3l5Feel.test.mjs', """import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS } from '../combat.js';
import { SORTIE_OUTRO_SECONDS } from '../combatPresentation.js';

test('post-bout aftermath is long enough to inhabit the cleared yard', () => {
    assert.ok(SORTIE_OUTRO_SECONDS >= 3.8 && SORTIE_OUTRO_SECONDS <= 5.0);
    const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
    assert.match(source, /aftermathDriving/);
    assert.match(source, /if \(!aftermathDriving\) for \(const actor of aiActors\)/);
    assert.match(source, /controls\.setEnabled\(victory && playerCombatActive/);
});

test('starter projectile weapons have deliberate physical recoil', () => {
    assert.ok(WEAPONS['gun-short'].recoilImpulseNs >= 2400);
    assert.ok(WEAPONS['gun-cannon'].recoilImpulseNs >= 1650);
    assert.ok(WEAPONS['gun-light'].recoilImpulseNs >= 1000);
});

test('debrief communicates draft order and the current salvage turn', () => {
    const source = fs.readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
    assert.match(source, /CLAIM ORDER/);
    assert.match(source, /Higher bout score \/ participation drafts first/);
    assert.match(source, /PICK 1 RECOVERABLE PART/);
});

test('cockpit readouts and weapon kick were enlarged without touching world resolution', () => {
    const source = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
    assert.match(source, /systems: \{ position: \[-\.091, \.004, -\.105\], scale: \.066 \}/);
    assert.match(source, /muzzleKick \* \.19/);
    assert.match(source, /muzzleKick - dt \* 3\.6/);
});
""")
