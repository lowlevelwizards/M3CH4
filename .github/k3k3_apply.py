from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


def replace_between(path, start, end, new):
    p = Path(path)
    text = p.read_text()
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'start anchor missing in {path}: {start[:100]!r}')
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f'end anchor missing in {path}: {end[:100]!r}')
    p.write_text(text[:a] + new + text[b:])

# --- cache/version + toolbar remains in DOM but prototype controls are gated by DEV -----
p = Path('index.html')
text = p.read_text()
text = text.replace('"./scene.js": "./sceneAssembly.js?v=k3k2"', '"./scene.js": "./sceneAssembly.js?v=k3k3"')
text = text.replace('"./combatPresentation.js": "./combatPresentation.js?v=k3k2"', '"./combatPresentation.js": "./combatPresentation.js?v=k3k3"')
text = text.replace('./styles.css?v=k3k2', './styles.css?v=k3k3')
text = text.replace('0.0.1k.3k.2 — Cockpit Embodiment + Sortie Flow', '0.0.1k.3k.3 — Cockpit HUD + Damage Escalation')
text = text.replace('RIG DIAGNOSTICS <span>0.0.1k.3k.2</span>', 'RIG DIAGNOSTICS <span>0.0.1k.3k.3</span>')
text = text.replace('<script type="module" src="./main.js?v=k3k2"></script>', '<script type="module" src="./main.js?v=k3k3"></script>')
p.write_text(text)

# --- stronger but still subsystem-gated cockpit presentation tuning --------------------
Path('combatPresentation.js').write_text(r'''/** k.3k.3 presentation tuning only. Combat/damage math stays authoritative elsewhere. */
export const SORTIE_OUTRO_SECONDS = 2.65;

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

/** Translate one localized player hit into cockpit motion/electrical feedback.
 * Armor pings stay readable but restrained. Internal/disabled hits are the dramatic events. */
export function cockpitImpactProfile(slot, { internalDamage = 0, disabled = false, driveSide = null } = {}) {
    const internal = Math.max(0, Number(internalDamage) || 0);
    const severity = clamp01((internal > 0 ? .38 : .12) + internal / 72 + (disabled ? .42 : 0));
    const base = {
        severity,
        shake: .014 + severity * .046,
        pitch: 0,
        roll: 0,
        yaw: 0,
        blackoutSeconds: 0,
        flickerSeconds: internal > 0 ? .34 + severity * .42 : .08,
        sparkCount: internal > 0 ? 5 + Math.round(severity * 7) : 1,
        sparkScale: internal > 0 ? 1.15 + severity * .7 : .72,
        arcCount: 0,
        gunShake: 0,
    };
    if (slot === 'structure') {
        base.pitch = -.020 - severity * .052;
        base.shake *= 1.42;
    }
    else if (slot === 'mobility') {
        const side = driveSide === 'right' ? -1 : 1;
        base.roll = side * (.028 + severity * .078);
        base.pitch = .010 * severity;
    }
    else if (slot === 'power') {
        base.pitch = -.015 - severity * .032;
        base.blackoutSeconds = internal > 0 ? (disabled ? .46 : .16 + severity * .15) : 0;
        base.flickerSeconds = internal > 0 ? .88 + severity * .92 : .14;
        base.sparkCount += internal > 0 ? 7 : 1;
        base.sparkScale += internal > 0 ? .28 : 0;
        base.arcCount = internal > 0 ? (disabled ? 4 : 2 + Math.round(severity)) : 0;
    }
    else if (slot === 'command') {
        base.yaw = (disabled ? .052 : .021) * (severity + .4);
        base.pitch = -.014 * severity;
        base.sparkCount += internal > 0 ? 4 : 0;
    }
    else if (slot === 'combat') {
        base.roll = -.018 - severity * .041;
        base.gunShake = .14 + severity * .25;
        base.sparkCount += internal > 0 ? 5 : 1;
    }
    return base;
}
''')

Path('tests/combatPresentation.test.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from '../combatPresentation.js';

test('sortie outro leaves a readable battlefield beat before debrief', () => {
  assert.ok(SORTIE_OUTRO_SECONDS >= 2.4 && SORTIE_OUTRO_SECONDS <= 3.2);
});

test('power internals cause a strong blackout, long flicker and visible arcing', () => {
  const armor = cockpitImpactProfile('power', { internalDamage: 0 });
  const internal = cockpitImpactProfile('power', { internalDamage: 30 });
  const disabled = cockpitImpactProfile('power', { internalDamage: 30, disabled: true });
  assert.equal(armor.blackoutSeconds, 0);
  assert.equal(armor.arcCount, 0);
  assert.ok(internal.blackoutSeconds >= .18);
  assert.ok(internal.flickerSeconds > .9);
  assert.ok(internal.arcCount >= 2);
  assert.ok(internal.sparkCount > armor.sparkCount);
  assert.ok(disabled.blackoutSeconds >= .4);
  assert.ok(disabled.arcCount > internal.arcCount);
});

test('mobility hit attitude identifies the struck drive side', () => {
  const left = cockpitImpactProfile('mobility', { internalDamage: 20, driveSide: 'left' });
  const right = cockpitImpactProfile('mobility', { internalDamage: 20, driveSide: 'right' });
  assert.ok(left.roll > 0);
  assert.ok(right.roll < 0);
});

test('combat internals shake the physical weapon mount', () => {
  assert.ok(cockpitImpactProfile('combat', { internalDamage: 20 }).gunShake > 0);
});

test('armor pings remain much quieter than internal structure hits', () => {
  const armor = cockpitImpactProfile('structure', { internalDamage: 0 });
  const internal = cockpitImpactProfile('structure', { internalDamage: 35 });
  assert.ok(internal.shake > armor.shake * 1.5);
  assert.ok(internal.sparkCount > armor.sparkCount);
});
''')

# --- scene bridge cache ---------------------------------------------------------------
replace_once('sceneAssembly.js', "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k2';", "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k3';")

# --- scene: re-home cockpit screens onto a protected windshield combiner perimeter -----
replace_once('scene.js',
'''    const cockpit = buildCockpit(scene);\n    const debugColliders = buildDebugColliders(scene);''',
'''    const cockpit = buildCockpit(scene);\n    // The information display is still a real Three.js cockpit layer, but it rides the\n    // windshield/combiner perimeter instead of sitting as three perspective-skewed blocks\n    // on top of the dashboard. Cracks and blackouts remain physically in front of it.\n    const combinerHud = new THREE.Group();\n    combinerHud.name = 'cockpit-combiner-hud';\n    camera.add(combinerHud);\n    const combinerLayout = {\n        systems: { position: [-.086, .004, -.090], scale: .060 },\n        team:    { position: [ 0.000, .051, -.090], scale: .050 },\n        weapon:  { position: [ .084, .010, -.090], scale: .058 },\n        motion:  { position: [-.041,-.038, -.090], scale: .050 },\n        drive:   { position: [ .023,-.039, -.090], scale: .052 },\n    };\n    for (const [name, screen] of Object.entries(cockpit.userData.instrumentScreens)) {\n        cockpit.remove(screen.mesh);\n        combinerHud.add(screen.mesh);\n        const layout = combinerLayout[name];\n        screen.mesh.position.set(...layout.position);\n        screen.mesh.rotation.set(0, 0, 0);\n        screen.mesh.scale.setScalar(layout.scale);\n        screen.mesh.renderOrder = 90;\n        screen.mesh.material.depthTest = false;\n        screen.mesh.material.depthWrite = false;\n    }\n    const debugColliders = buildDebugColliders(scene);''')

replace_once('scene.js',
'''    let powerBlackout = 0, powerFlicker = 0, cockpitWarningLevel = 0;\n    let cockpitInstrumentKey = '';\n    let crackKey = -1;''',
'''    let powerBlackout = 0, powerFlicker = 0, cockpitWarningLevel = 0;\n    let persistentPowerHealth = 1, persistentCommandHealth = 1;\n    let driveLeftHealth = 1, driveRightHealth = 1, powerArcCooldown = 1.8;\n    let cockpitInstrumentKey = '', cockpitMotionKey = '';\n    let crackKey = -1;''')

# Replace the old generic three-panel painter with dedicated perimeter instruments.
replace_between('scene.js',
'    function drawCockpitScreen(screen, lines, tone = \'green\') {',
'    function triggerCockpitHit(slot, profile = {}) {',
r'''    function panelBase(screen, tone = 'green', alpha = .72) {
        const ctx = screen?.ctx; if (!ctx) return null;
        const w = screen.canvas.width, h = screen.canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(7,16,13,${alpha})`; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = tone === 'red' ? '#d56753' : tone === 'amber' ? '#cba45d' : '#6e9d7b';
        ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        return ctx;
    }
    const systemGlyphs = { structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' };
    function conditionColor(value) {
        const n = Number(value) || 0;
        return n <= 0 ? '#ff6554' : n < 38 ? '#f08a66' : n < 72 ? '#e2bc70' : '#a8d8ac';
    }
    function drawSystemScreen(screen, systems) {
        const values = ['structure','mobility','power','command','combat'].map(slot => Number(systems?.[slot] ?? 0));
        const tone = Math.min(...values) < 38 ? 'red' : Math.min(...values) < 72 ? 'amber' : 'green';
        const ctx = panelBase(screen, tone, .68); if (!ctx) return;
        const w = screen.canvas.width, h = screen.canvas.height;
        const slots = ['structure','mobility','power','command','combat'];
        const row = h / slots.length;
        slots.forEach((slot, index) => {
            const value = Math.max(0, Math.min(100, Math.round(Number(systems?.[slot] ?? 0))));
            const y = row * index;
            if (index) { ctx.strokeStyle = 'rgba(120,154,126,.20)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(7,y); ctx.lineTo(w-7,y); ctx.stroke(); }
            ctx.fillStyle = conditionColor(value);
            ctx.font = 'bold 25px monospace'; ctx.textBaseline = 'middle';
            ctx.fillText(systemGlyphs[slot], 10, y + row * .48);
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'right'; ctx.fillText(String(value).padStart(3,' '), w - 9, y + row * .48); ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(150,196,158,.20)'; ctx.fillRect(9, y + row - 7, w - 18, 3);
            ctx.fillStyle = conditionColor(value); ctx.fillRect(9, y + row - 7, (w - 18) * value / 100, 3);
        });
        screen.texture.needsUpdate = true;
    }
    function drawTeamScreen(screen, team = {}) {
        const friendly = Math.max(0, Math.min(3, Number(team.friendly) || 0));
        const hostile = Math.max(0, Math.min(3, Number(team.hostile) || 0));
        const ctx = panelBase(screen, friendly <= 1 ? 'amber' : 'green', .54); if (!ctx) return;
        const drawPip = (x, y, alive, color) => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = alive ? color : 'rgba(90,101,91,.16)'; ctx.strokeStyle = alive ? color : 'rgba(120,125,116,.38)';
            ctx.lineWidth = 3; ctx.fillRect(-8,-8,16,16); ctx.strokeRect(-8,-8,16,16);
            if (!alive) { ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,7); ctx.stroke(); }
            ctx.restore();
        };
        for (let i = 0; i < 3; i++) drawPip(29 + i * 28, 22, i < friendly, '#79d89a');
        for (let i = 0; i < 3; i++) drawPip(screen.canvas.width - 29 - (2-i) * 28, 22, i < hostile, '#e2a158');
        ctx.strokeStyle = 'rgba(187,187,151,.22)'; ctx.beginPath(); ctx.moveTo(screen.canvas.width/2,8); ctx.lineTo(screen.canvas.width/2,34); ctx.stroke();
        screen.texture.needsUpdate = true;
    }
    function weaponAbbrev(label) {
        const text = String(label ?? '').toUpperCase();
        if (text.includes('TRAINING')) return 'TRN-CAN';
        if (text.includes('STUMP')) return 'STP-CAN';
        if (text.includes('NEEDLE')) return 'NDL-CAN';
        return text.replace(/[^A-Z0-9]/g,'').slice(0,7) || 'NO-GUN';
    }
    function drawWeaponScreen(screen, data) {
        const state = String(data.weaponState ?? 'READY');
        const tone = state === 'LOST' ? 'red' : state === 'DAMAGED' || state === 'FAULT' ? 'amber' : 'green';
        const ctx = panelBase(screen, tone, .66); if (!ctx) return;
        ctx.fillStyle = tone === 'red' ? '#f08a70' : tone === 'amber' ? '#e4bd70' : '#a6d7ad';
        ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'middle'; ctx.fillText(weaponAbbrev(data.weapon), 9, 16);
        ctx.font = 'bold 29px monospace'; ctx.fillText(String(data.ammo ?? '—'), 9, 43);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = tone === 'green' ? '#789c80' : ctx.fillStyle; ctx.fillText(state, 10, 66);
        screen.texture.needsUpdate = true;
    }
    function drawMotionScreen(screen, data) {
        const ctx = panelBase(screen, 'green', .54); if (!ctx) return;
        ctx.fillStyle = '#a8d5ad'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 18px monospace'; ctx.fillText(`${data.speed ?? '0.0'} m/s`, 9, 18);
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#d5b66d'; ctx.fillText(String(data.direction ?? 'IDLE'), 132, 18);
        ctx.fillStyle = '#83a68a'; ctx.fillText(`TURN ${data.turnRate ?? 0}°/s`, 9, 43);
        screen.texture.needsUpdate = true;
    }
    function drawDriveScreen(screen, load = 0) {
        const value = Math.max(0, Math.min(1, Number(load) || 0));
        const ctx = panelBase(screen, value > .9 ? 'amber' : 'green', .48); if (!ctx) return;
        const w = screen.canvas.width;
        ctx.fillStyle = '#789a7e'; ctx.font = 'bold 10px monospace'; ctx.textBaseline = 'middle'; ctx.fillText('DRIVE', 9, 12);
        ctx.fillStyle = 'rgba(132,163,136,.18)'; ctx.fillRect(9, 23, w - 18, 10);
        ctx.fillStyle = value > .9 ? '#e2ae59' : '#89c492'; ctx.fillRect(9, 23, (w - 18) * value, 10);
        ctx.fillStyle = '#a9c7ac'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(value * 100)}%`, w - 9, 12); ctx.textAlign = 'left';
        screen.texture.needsUpdate = true;
    }
    function updateCockpitInstruments(data = {}) {
        const key = JSON.stringify(data);
        if (key === cockpitInstrumentKey) return;
        cockpitInstrumentKey = key;
        const s = data.systems ?? {};
        drawSystemScreen(cockpit.userData.instrumentScreens.systems, s);
        drawWeaponScreen(cockpit.userData.instrumentScreens.weapon, data);
        drawTeamScreen(cockpit.userData.instrumentScreens.team, data.team);
        const values = Object.values(s).map(value => Number(value) || 0);
        const lowest = values.length ? Math.min(...values) : 100;
        cockpitWarningLevel = Math.max(0, Math.min(2, Number(data.warning) || 0));
        persistentPowerHealth = Math.max(0, Math.min(1, Number(s.power ?? 100) / 100));
        persistentCommandHealth = Math.max(0, Math.min(1, Number(s.command ?? 100) / 100));
        driveLeftHealth = Math.max(0, Math.min(1, Number(data.drive?.left ?? 1)));
        driveRightHealth = Math.max(0, Math.min(1, Number(data.drive?.right ?? 1)));
        if (lowest >= 72) cockpitWarningLevel = Math.min(cockpitWarningLevel, 0);
        redrawCracks(Number(s.command ?? 100));
    }
    function updateCockpitMotion(data = {}) {
        const normalized = {
            speed: Number(data.speed ?? 0).toFixed(1),
            direction: String(data.direction ?? 'IDLE'),
            turnRate: Math.round(Number(data.turnRate) || 0),
            driveLoad: Math.round(Math.max(0, Math.min(1, Number(data.driveLoad) || 0)) * 100) / 100,
        };
        const key = JSON.stringify(normalized);
        if (key === cockpitMotionKey) return;
        cockpitMotionKey = key;
        drawMotionScreen(cockpit.userData.instrumentScreens.motion, normalized);
        drawDriveScreen(cockpit.userData.instrumentScreens.drive, normalized.driveLoad);
    }
    function spawnCockpitPowerArc(strength = 1) {
        cockpit.updateWorldMatrix(true, true);
        const anchors = [
            [-.58,1.88,-.93],[.55,2.10,-.82],[-.72,2.46,-.64],[.67,2.56,-.62],[.18,1.78,-1.04]
        ];
        const a = anchors[Math.floor(Math.random() * anchors.length)];
        let b = anchors[Math.floor(Math.random() * anchors.length)];
        if (b === a) b = anchors[(anchors.indexOf(a) + 1) % anchors.length];
        const start = cockpit.localToWorld(new THREE.Vector3(...a));
        const end = cockpit.localToWorld(new THREE.Vector3(...b));
        const points = [start.clone()];
        const segments = 6;
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const p = start.clone().lerp(end, t);
            p.x += (Math.random() - .5) * .12 * strength;
            p.y += (Math.random() - .5) * .10 * strength;
            p.z += (Math.random() - .5) * .08 * strength;
            points.push(p);
        }
        points.push(end.clone());
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: Math.random() > .35 ? 0xc8fff2 : 0xffe58d, transparent: true, opacity: 1, depthTest: false });
        const line = new THREE.Line(geometry, material); line.renderOrder = 30; scene.add(line);
        transientFX.push({ object: line, remaining: .09 + Math.random() * .09, duration: .18, material });
        for (let i = 1; i < points.length - 1; i += 2)
            activateParticle(sparkPool, 'spark', points[i], new THREE.Vector3((Math.random()-.5)*1.5, -.2-Math.random()*1.8, (Math.random()-.5)*1.2), 1.4 * strength, .28 + Math.random()*.24, -3.2, 0, 0xe6fff1);
    }
''')

# Replace hit trigger with larger/longer interior sparks and explicit electrical arcs.
replace_between('scene.js',
'    function triggerCockpitHit(slot, profile = {}) {',
'    function resetCockpitTransientFeedback() {',
r'''    function triggerCockpitHit(slot, profile = {}) {
        const severity = Math.max(0, Math.min(1, Number(profile.severity) || 0));
        hitPitchKick += Number(profile.pitch) || 0;
        hitRollKick += Number(profile.roll) || 0;
        hitYawKick += Number(profile.yaw) || 0;
        hitShakeKick = Math.max(hitShakeKick, Number(profile.shake) || 0);
        gunDamageKick = Math.max(gunDamageKick, Number(profile.gunShake) || 0);
        powerBlackout = Math.max(powerBlackout, Number(profile.blackoutSeconds) || 0);
        powerFlicker = Math.max(powerFlicker, Number(profile.flickerSeconds) || 0);
        cockpit.updateWorldMatrix(true, true);
        const localBySlot = {
            structure: [0, 2.05, -.82], mobility: [-.62, 1.58, -.82], power: [-.32, 1.83, -1.02],
            command: [0, 2.72, -.61], combat: [.86, 2.08, -.72],
        };
        const origin = cockpit.localToWorld(new THREE.Vector3(...(localBySlot[slot] ?? [0,2,-.8])));
        const count = Math.max(1, Math.min(18, Math.round(profile.sparkCount ?? 1)));
        const sparkScale = Math.max(.6, Number(profile.sparkScale) || 1);
        for (let i = 0; i < count; i++) {
            const downward = i % 3 === 0;
            const velocity = new THREE.Vector3((Math.random() - .5) * 4.0, downward ? -.4 - Math.random() * 2.0 : .5 + Math.random() * 3.4, (Math.random() - .5) * 3.0);
            activateParticle(sparkPool, 'spark', origin, velocity, sparkScale * (.75 + severity * .95), .24 + Math.random() * .42, -4.7, 0, i % 4 ? 0xffc866 : 0xfff4c2);
        }
        const arcs = Math.max(0, Math.min(5, Math.round(profile.arcCount ?? 0)));
        for (let i = 0; i < arcs; i++) spawnCockpitPowerArc(.85 + severity * .7);
    }
''')

replace_once('scene.js',
'''        hitPitchKick = hitRollKick = hitYawKick = hitShakeKick = gunDamageKick = 0;\n        powerBlackout = powerFlicker = 0;\n        blackoutMaterial.opacity = 0;''',
'''        hitPitchKick = hitRollKick = hitYawKick = hitShakeKick = gunDamageKick = 0;\n        powerBlackout = powerFlicker = 0;\n        powerArcCooldown = 1.8;\n        combinerHud.position.set(0, 0, 0);\n        blackoutMaterial.opacity = 0;''')

# Sustained mobility damage becomes a subtle ongoing lean/stumble rather than only a hit event.
replace_once('scene.js',
'''        const damageWave = Math.sin(performance.now() * .043);\n        const impactJitter = hitShakeKick * Math.sin(performance.now() * .117);''',
'''        const nowMs = performance.now();\n        const damageWave = Math.sin(nowMs * .043);\n        const impactJitter = hitShakeKick * Math.sin(nowMs * .117);\n        const driveDamage = 1 - Math.min(driveLeftHealth, driveRightHealth);\n        const sustainedDriveRoll = (driveRightHealth - driveLeftHealth) * .032 +\n            Math.sin(nowMs * .017) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.2, 1) * .008;\n        const mobilityStumble = Math.sin(nowMs * .026) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.8, 1) * .008;''')
replace_once('scene.js',
'''        cockpit.position.set(visualX + impactJitter * .35, impactJitter * .18, visualZ + impactJitter * .12);\n        cockpit.rotation.set(cockpitPitch + hitPitchKick, renderYaw + hitYawKick, cockpitRoll + hitRollKick, 'YXZ');''',
'''        cockpit.position.set(visualX + impactJitter * .35, impactJitter * .18 + mobilityStumble, visualZ + impactJitter * .12);\n        cockpit.rotation.set(cockpitPitch + hitPitchKick, renderYaw + hitYawKick, cockpitRoll + hitRollKick + sustainedDriveRoll, 'YXZ');''')
replace_once('scene.js',
'''            camera.rotation.set(lookPitch + cockpitPitch * 0.35 + hitPitchKick * 1.35, renderYaw + lookYaw + hitYawKick * 1.1, cockpitRoll * 0.25 + hitRollKick * 1.25, 'YXZ');''',
'''            camera.rotation.set(lookPitch + cockpitPitch * 0.35 + hitPitchKick * 1.35, renderYaw + lookYaw + hitYawKick * 1.1, cockpitRoll * 0.25 + hitRollKick * 1.25 + sustainedDriveRoll * .72, 'YXZ');''')

replace_once('scene.js',
'''        cockpit.visible = !enabled;\n        for (const record of squadCombatants.values()) {''',
'''        cockpit.visible = !enabled;\n        combinerHud.visible = !enabled;\n        for (const record of squadCombatants.values()) {''')

# More obvious flicker/blackout, occasional arcs from severely damaged power, and command HUD jitter.
replace_once('scene.js',
'''        powerBlackout = Math.max(0, powerBlackout - dt);\n        powerFlicker = Math.max(0, powerFlicker - dt);\n        const flicker = powerFlicker > 0 ? (.12 + Math.abs(Math.sin(performance.now() * .075)) * .34) : 0;\n        blackoutMaterial.opacity = powerBlackout > 0 ? .96 : flicker;\n        const screenOpacity = powerBlackout > 0 ? .05 : powerFlicker > 0 ? Math.max(.18, 1 - flicker * 1.7) : .94;\n        for (const screen of Object.values(cockpit.userData.instrumentScreens)) screen.mesh.material.opacity = screenOpacity;''',
'''        powerBlackout = Math.max(0, powerBlackout - dt);\n        powerFlicker = Math.max(0, powerFlicker - dt);\n        powerArcCooldown = Math.max(0, powerArcCooldown - dt);\n        if (!inspecting && persistentPowerHealth < .52 && powerArcCooldown <= 0) {\n            const severity = 1 - persistentPowerHealth;\n            spawnCockpitPowerArc(.72 + severity * .75);\n            powerFlicker = Math.max(powerFlicker, .08 + severity * .11);\n            powerArcCooldown = 1.25 + Math.random() * (2.7 - severity);\n        }\n        const now = performance.now();\n        const flickerWave = Math.abs(Math.sin(now * .105));\n        const flicker = powerFlicker > 0 ? (flickerWave > .67 ? .68 : .16 + flickerWave * .16) : 0;\n        blackoutMaterial.opacity = powerBlackout > 0 ? .995 : flicker;\n        const screenOpacity = powerBlackout > 0 ? .01 : powerFlicker > 0 ? (flickerWave > .67 ? .12 : .74) : .92;\n        for (const screen of Object.values(cockpit.userData.instrumentScreens)) screen.mesh.material.opacity = screenOpacity;\n        const commandDamage = Math.max(0, .62 - persistentCommandHealth) / .62;\n        combinerHud.position.x = Math.sin(now * .089) * commandDamage * .00085;\n        combinerHud.position.y = Math.sin(now * .071 + 1.8) * commandDamage * .00055;''')

replace_once('scene.js',
'''        updateCockpitInstruments, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit,''',
'''        updateCockpitInstruments, updateCockpitMotion, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit,''')

# Replace the dashboard-oriented physical screens with aspect ratios designed for the perimeter combiner.
replace_once('scene.js',
'''    const screens = {\n        systems: makeScreen('systems', 192, 76, -.43, 1.94, -1.195),\n        weapon: makeScreen('weapon', 150, 76, .43, 1.94, -1.195),\n        team: makeScreen('team', 138, 42, 0, 2.20, -1.02, -.10),\n    };''',
'''    const screens = {\n        systems: makeScreen('systems', 88, 220, -.43, 1.94, -1.195),\n        weapon: makeScreen('weapon', 180, 78, .43, 1.94, -1.195),\n        team: makeScreen('team', 200, 44, 0, 2.20, -1.02, -.10),\n        motion: makeScreen('motion', 220, 56, -.28, 1.80, -1.19),\n        drive: makeScreen('drive', 180, 40, .25, 1.80, -1.19),\n    };''')

# --- main: feed drivetrain data into physical HUD + hide prototype tools behind DEV -----
replace_once('main.js',
'''        systems, team: counts, warning: disabled || lowest < .38 ? 2 : lowest < .72 ? 1 : 0,\n        weapon: weaponSpec?.label ?? 'NO WEAPON',\n        ammo: weaponState ? `${weaponState.loaded}/${weaponState.reserve}` : '—',\n        weaponState: sortiePhase === 'outro' ? 'SAFE' : weaponStateLabel,''',
'''        systems, team: counts, warning: disabled || lowest < .38 ? 2 : lowest < .72 ? 1 : 0,\n        drive: { left: output.left, right: output.right },\n        weapon: weaponSpec?.label ?? 'NO WEAPON',\n        ammo: weaponState ? `${weaponState.loaded}/${weaponState.reserve}` : '—',\n        weaponState: sortiePhase === 'outro' ? 'SAFE' : weaponStateLabel,''')

replace_once('main.js',
'''    if (inspecting) {\n        devPanel.classList.add('hidden');\n        targetPanel.classList.add('hidden');''',
'''    if (inspecting) {\n        devPanel.classList.add('hidden');\n        document.body.classList.remove('dev-open');\n        targetPanel.classList.add('hidden');''')

replace_once('main.js',
'''    loadBar.style.transform = `scaleX(${rig.driveLoad.toFixed(3)})`;\n    const degrees = Math.round(-THREE.MathUtils.radToDeg(input.lookYaw));''',
'''    loadBar.style.transform = `scaleX(${rig.driveLoad.toFixed(3)})`;\n    arena.updateCockpitMotion?.({\n        speed: Math.hypot(rig.vx, rig.vz), direction: motionEl.textContent,\n        turnRate: THREE.MathUtils.radToDeg(rig.yawRate), driveLoad: rig.driveLoad,\n    });\n    const degrees = Math.round(-THREE.MathUtils.radToDeg(input.lookYaw));''')

replace_once('main.js',
'''devToggle.addEventListener('click', () => { devPanel.classList.toggle('hidden'); renderTarget(); });''',
'''devToggle.addEventListener('click', () => {\n    const opening = devPanel.classList.contains('hidden');\n    devPanel.classList.toggle('hidden');\n    document.body.classList.toggle('dev-open', opening);\n    renderTarget();\n});''')

# --- CSS: eliminate flat combat telemetry and gate prototype navigation behind DEV ------
p = Path('styles.css')
text = p.read_text()
text += r'''

/* k.3k.3 — cockpit information belongs to the windshield combiner, not HTML chrome. */
body:not(.inspecting) #cockpit-ui { display:none; }
body:not(.inspecting) .team-status,
body:not(.inspecting) .player-damage-hud,
body:not(.inspecting) .weapon-hud { display:none; }
body:not(.dev-open) #center-view,
body:not(.dev-open) #app-view,
body:not(.dev-open) #target-toggle,
body:not(.dev-open) #resolution-toggle { display:none !important; }
body:not(.inspecting):not(.dev-open) #assembly-toggle { display:none !important; }
body:not(.inspecting) .left-tools { gap:4px; }
body:not(.inspecting) .right-tools { opacity:.72; }
body:not(.inspecting) #dev-toggle { min-width:38px; padding:0 7px; font-size:8px; }
body.dev-open .toolbar { z-index:20; }
body:not(.inspecting) .fault-strip { max-width:46vw; }
body:not(.inspecting) .shot-report { max-width:40vw; }
/* The movement controls remain touch UI. All persistent telemetry has moved into 3D. */
body:not(.inspecting) .rig-tag { display:none; }
'''
p.write_text(text)
