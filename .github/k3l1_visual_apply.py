from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))

# Stronger persistent physical failure vocabulary, with power arcing as its own channel.
path = Path('damageVisuals.js')
text = path.read_text()
pattern = r"/\*\* Persistent distress is intentionally restrained\. Destroyed metal does not automatically explode\. \*/\nexport function persistentFailureProfile\(slot, ratio\) \{.*?\n\}"
replacement = '''/** Persistent distress turns battle damage into a readable machine state. It remains
 * subsystem-specific: electricity belongs mostly to power, smoke grows after real
 * internal damage, and structure stays mechanically dirty rather than magical. */
export function persistentFailureProfile(slot, ratio) {
    const severity = 1 - clamp01(ratio);
    let sparkStart = .58, smokeStart = .76, sparkMax = 5.0, smokeMax = 1.0, arcMax = 0;
    if (slot === 'power') {
        sparkStart = .26; smokeStart = .40; sparkMax = 14.0; smokeMax = 3.4; arcMax = 1.25;
    }
    else if (slot === 'combat') {
        sparkStart = .38; smokeStart = .55; sparkMax = 9.0; smokeMax = 2.0;
    }
    else if (slot === 'mobility') {
        sparkStart = .44; smokeStart = .62; sparkMax = 8.0; smokeMax = 1.65;
    }
    else if (slot === 'command') {
        sparkStart = .52; smokeStart = .72; sparkMax = 6.0; smokeMax = 1.0; arcMax = .18;
    }
    else if (slot === 'structure') {
        sparkStart = .67; smokeStart = .78; sparkMax = 4.2; smokeMax = .9;
    }
    const sparkT = clamp01((severity - sparkStart) / Math.max(.001, 1 - sparkStart));
    const smokeT = clamp01((severity - smokeStart) / Math.max(.001, 1 - smokeStart));
    const arcT = slot === 'power' ? clamp01((severity - .42) / .58) : slot === 'command' ? clamp01((severity - .82) / .18) : 0;
    return {
        severity,
        sparkRate: sparkT * sparkMax,
        smokeRate: smokeT * smokeMax,
        arcRate: arcT * arcMax,
        disabled: ratio <= 0,
    };
}'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1: raise SystemExit(f'damage profile match count {count}')
path.write_text(text)

# Main renderer: filmic contrast and one real shadowing path.
replace_once('main.js',
"renderer.outputColorSpace = THREE.SRGBColorSpace;\nrenderer.shadowMap.enabled = false;",
"renderer.outputColorSpace = THREE.SRGBColorSpace;\nrenderer.toneMapping = THREE.ACESFilmicToneMapping;\nrenderer.toneMappingExposure = 1.22;\nrenderer.shadowMap.enabled = true;\nrenderer.shadowMap.type = THREE.PCFSoftShadowMap;")
replace_once('main.js',
"            onAction: () => {\n                equipSerial(assembly, def.slot, preview.serial);\n                refreshAssembly(true);\n                selectPart(def.slot);\n            },",
"            onAction: () => {\n                try {\n                    equipSerial(assembly, def.slot, preview.serial);\n                    refreshAssembly(true);\n                    selectPart(def.slot);\n                } catch (error) {\n                    showStatus(error?.message || 'THIS PHYSICAL COMPONENT CANNOT BE INSTALLED HERE');\n                }\n            },")
replace_once('main.js',
"document.addEventListener('m3ch4:inventory-changed', () => {\n    refreshAssembly(true);\n    renderPartInfo();\n    showStatus('SALVAGE SECURED · OWNED INVENTORY UPDATED');\n});",
"document.addEventListener('m3ch4:inventory-changed', () => {\n    refreshAssembly(true);\n    renderPartInfo();\n    showStatus('SALVAGE SECURED · OWNED INVENTORY UPDATED');\n});\ndocument.addEventListener('m3ch4:assembly-mutated', () => {\n    refreshAssembly(true);\n    if (selectedPart) selectPart(selectedPart, false);\n});")

# Scene lighting, wounds, falling parts, stronger persistent FX.
path = Path('scene.js')
text = path.read_text()
text = text.replace(
"    scene.add(new THREE.HemisphereLight(0xb2b59d, 0x26231d, 1.1));\n    const sun = new THREE.DirectionalLight(0xffd69a, 2.1);\n    sun.position.set(-7, 12, 8);\n    scene.add(sun);",
"    // Lower broad ambient wash and let shaped warm/cool sources describe the forms.\n    scene.add(new THREE.HemisphereLight(0x9dafaa, 0x171511, .56));\n    const sun = new THREE.DirectionalLight(0xffd29a, 3.15);\n    sun.position.set(-10, 17, 11);\n    sun.castShadow = true;\n    sun.shadow.mapSize.set(1024, 1024);\n    sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;\n    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;\n    sun.shadow.camera.near = 2; sun.shadow.camera.far = 65;\n    sun.shadow.bias = -.0007; sun.shadow.normalBias = .035;\n    scene.add(sun);\n    const coolRim = new THREE.DirectionalLight(0x79a9a8, .72);\n    coolRim.position.set(12, 6, -16);\n    scene.add(coolRim);", 1)

text = text.replace(
"    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {\n        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(),\n    }]));",
"    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {\n        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(), parent: group.parent,\n    }]));", 1)
text = text.replace(
"        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,\n        baseParts: capturePartTransforms(targetExterior),",
"        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,\n        wounds: new Map(SLOTS.map(slot => [slot, []])), woundMarks: [],\n        baseParts: capturePartTransforms(targetExterior),", 1)
text = text.replace(
"            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,\n            baseParts: capturePartTransforms(actorExterior),",
"            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,\n            wounds: new Map(SLOTS.map(slot => [slot, []])), woundMarks: [],\n            baseParts: capturePartTransforms(actorExterior),", 1)
text = text.replace("    const makeEmitterBudget = () => new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0 }]));",
                    "    const makeEmitterBudget = () => new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0, arc: 0 }]));", 1)
text = text.replace(
"        if (wasActive && !record.active)\n            wreckCombatantVisual(record);\n        else if (!wasActive && record.active)\n            resetCombatantVisual(record);",
"        if (wasActive && !record.active)\n            wreckCombatantVisual(record);\n        else if (record.active && (!wasActive || record.wrecked || record.destroyedSlots.size || record.disabledSlots.size))\n            resetCombatantVisual(record);", 1)

text = text.replace(
"    const sparkPool = makePool(52, new THREE.BoxGeometry(.035, .035, .14), 0xffc968, true);\n    const chipPool = makePool(34, new THREE.BoxGeometry(.075, .055, .09), 0x4a4d46, true);\n    const smokePool = makePool(28, new THREE.BoxGeometry(.15, .15, .15), 0x252a26, true);",
"    const sparkPool = makePool(88, new THREE.BoxGeometry(.042, .042, .18), 0xffc968, true);\n    const chipPool = makePool(52, new THREE.BoxGeometry(.085, .060, .11), 0x4a4d46, true);\n    // Soft low-resolution billboards read as smoke plumes instead of floating cubes.\n    const smokePool = makePool(56, new THREE.PlaneGeometry(.24, .24), 0x252a26, true);", 1)

# Add small pooled damage lights and falling state after cursor declaration.
needle = "    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;\n"
insert = '''    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;
    const fallingParts = new Map();
    const impactLights = Array.from({ length: 5 }, () => {
        const light = new THREE.PointLight(0xffbf6c, 0, 5.5, 2);
        light.visible = false; light.castShadow = false; scene.add(light);
        return { light, life: 0, duration: 0 };
    });
    let impactLightCursor = 0;
    function flashDamageLight(position, color = 0xffbf6c, intensity = 7, duration = .10, distance = 5.5) {
        const state = impactLights[impactLightCursor++ % impactLights.length];
        state.light.position.copy(position); state.light.color.setHex(color);
        state.light.intensity = intensity; state.light.distance = distance; state.light.visible = true;
        state.life = state.duration = duration;
    }
'''
if needle not in text: raise SystemExit('particle cursor marker missing')
text = text.replace(needle, insert, 1)

# Replace random-center source with persistent local wound anchors and visible scorch sites.
pattern = r"    function partWorldPoint\(record, slot\) \{.*?\n    \}\n    function spawnDisableBurst"
replacement = '''    function recordDamageWound(actorId, slot, worldPoint) {
        const record = squadCombatants.get(actorId);
        const group = record?.exterior.partGroups.get(slot);
        if (!record || !group || !worldPoint) return;
        group.updateWorldMatrix(true, false);
        const local = group.worldToLocal(worldPoint.clone());
        const wounds = record.wounds.get(slot) ?? [];
        wounds.push(local.clone());
        if (wounds.length > 2) wounds.shift();
        record.wounds.set(slot, wounds);
        const mark = new THREE.Mesh(new THREE.IcosahedronGeometry(.065, 0), new THREE.MeshBasicMaterial({ color: 0x0d100e }));
        mark.position.copy(local); mark.scale.set(1.35, .32, 1.35); group.add(mark);
        record.woundMarks.push(mark);
        if (record.woundMarks.length > 10) {
            const oldest = record.woundMarks.shift(); oldest.parent?.remove(oldest); oldest.geometry.dispose(); oldest.material.dispose();
        }
    }
    function partWorldPoint(record, slot) {
        const group = record?.exterior.partGroups.get(slot);
        const wounds = record?.wounds?.get(slot) ?? [];
        const point = new THREE.Vector3();
        if (group && wounds.length && Math.random() < .82) {
            point.copy(wounds[Math.floor(Math.random() * wounds.length)]);
            group.localToWorld(point);
            point.x += (Math.random() - .5) * .10;
            point.y += (Math.random() - .5) * .08;
            point.z += (Math.random() - .5) * .10;
        } else {
            if (group) group.getWorldPosition(point); else record?.exterior.root.getWorldPosition(point);
            point.x += (Math.random() - .5) * .26;
            point.y += (Math.random() - .5) * .20;
            point.z += (Math.random() - .5) * .26;
        }
        return point;
    }
    function spawnDisableBurst'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1: raise SystemExit(f'partWorldPoint block count {count}')

# Lights on meaningful physical events.
text = text.replace("        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(outcome?.slot === 'power' ? .36 : .27, 0), flashMat);\n        flash.position.copy(position);",
                    "        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(outcome?.slot === 'power' ? .36 : .27, 0), flashMat);\n        flashDamageLight(position, outcome?.slot === 'power' ? 0xd9fff1 : 0xffa75b, outcome?.slot === 'power' ? 13 : 8, .12, 6);\n        flash.position.copy(position);", 1)
text = text.replace("        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(power ? .58 : .46, 0), flashMat);\n        flash.position.copy(position);",
                    "        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(power ? .58 : .46, 0), flashMat);\n        flashDamageLight(position, power ? 0xc8fff2 : 0xffbd70, power ? 22 : 14, .18, power ? 8 : 6.5);\n        flash.position.copy(position);", 1)
text = text.replace("        const line = new THREE.Line(geometry, material); scene.add(line);\n        transientFX.push({ object: line, remaining: .12 + Math.random()*.12, duration: .24, material });",
                    "        const line = new THREE.Line(geometry, material); scene.add(line);\n        if (Math.random() < .45) flashDamageLight(origin, 0xc8fff2, 7 * strength, .08, 5.5);\n        transientFX.push({ object: line, remaining: .12 + Math.random()*.12, duration: .24, material });", 1)

# Destroyed combat/power genuinely detach into world space and fall until their bounds touch floor.
pattern = r"    function markPartDestroyedVisual\(actorId, slot\) \{.*?\n    \}\n    function wreckCombatantVisual"
replacement = '''    function settleAttachedPartToFloor(group, clearance = .025) {
        group.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(group);
        if (Number.isFinite(bounds.min.y) && bounds.min.y > clearance)
            group.position.y -= bounds.min.y - clearance;
    }
    function markPartDestroyedVisual(actorId, slot) {
        const record = squadCombatants.get(actorId);
        if (!record || record.destroyedSlots.has(slot)) return;
        record.destroyedSlots.add(slot);
        const group = record.exterior.partGroups.get(slot);
        if (!group) return;
        const side = actorId.length % 2 ? 1 : -1;
        if (slot === 'combat' || slot === 'power') {
            group.updateWorldMatrix(true, true);
            scene.attach(group);
            group.rotation.x += slot === 'combat' ? .46 : .31;
            group.rotation.z += side * (slot === 'combat' ? .78 : .58);
            fallingParts.set(`${actorId}:${slot}`, {
                actorId, slot, record, group, settled: false,
                velocity: new THREE.Vector3(side * (.28 + Math.random() * .30), .35 + Math.random() * .48, (Math.random() - .5) * .65),
                spin: new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * .65, side * (.8 + Math.random() * 1.1)),
            });
        } else if (slot === 'mobility') {
            group.rotation.z += side * .42; group.rotation.x += .19;
            settleAttachedPartToFloor(group, .02);
        } else if (slot === 'command') {
            group.position.y -= .18; group.rotation.z += side * .27; group.rotation.x += .14;
        } else if (slot === 'structure') {
            record.exterior.root.rotation.z += side * .13;
            record.exterior.root.position.y -= .09;
        }
    }
    function wreckCombatantVisual'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1: raise SystemExit(f'destroy visual block count {count}')

# Reset reattaches any detached physical hardware and clears wound scars.
pattern = r"    function resetCombatantVisual\(record\) \{.*?\n    \}\n    function clearPooledParticles"
replacement = '''    function resetCombatantVisual(record) {
        record.wrecked = false;
        record.cleared = false;
        record.disabledSlots.clear();
        record.destroyedSlots.clear();
        record.exterior.root.position.y = 0;
        record.exterior.root.rotation.x = 0;
        record.exterior.root.rotation.z = 0;
        for (const slot of SLOTS) {
            fallingParts.delete(`${record.id}:${slot}`);
            const group = record.exterior.partGroups.get(slot);
            const base = record.baseParts.get(slot);
            if (!group || !base) continue;
            if (base.parent && group.parent !== base.parent) base.parent.add(group);
            group.position.copy(base.position);
            group.rotation.copy(base.rotation);
            group.scale.copy(base.scale);
            record.wounds.set(slot, []);
        }
        while (record.woundMarks.length) {
            const mark = record.woundMarks.pop(); mark.parent?.remove(mark); mark.geometry.dispose(); mark.material.dispose();
        }
    }
    function clearPooledParticles'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1: raise SystemExit(f'reset visual block count {count}')

# Record actual penetration sites for player and AI outgoing shots.
text = text.replace("        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);\n        if (outcome?.justDestroyed)",
                    "        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);\n        if (outcome?.internalDamage > 0 && contact.actorId) recordDamageWound(contact.actorId, outcome.slot, impactPoint);\n        if (outcome?.justDestroyed)", 1)
# second occurrence in showCombatantShot has no profile assignment
text = text.replace("            spawnImpactParticles(impactPoint, contact.normal, outcome);\n            if (outcome.justDestroyed)",
                    "            spawnImpactParticles(impactPoint, contact.normal, outcome);\n            if (outcome.internalDamage > 0 && contact.actorId) recordDamageWound(contact.actorId, outcome.slot, impactPoint);\n            if (outcome.justDestroyed)", 1)

# Update persistent loop: falling debris, billboard smoke, dynamic lights, power arcs.
needle = "        const pulse = .55 + .45 * Math.abs(Math.sin(performance.now() * .008));\n"
falling_update = '''        for (const state of fallingParts.values()) {
            if (state.settled) continue;
            state.velocity.y -= 7.8 * dt;
            state.group.position.addScaledVector(state.velocity, dt);
            state.group.rotation.x += state.spin.x * dt;
            state.group.rotation.y += state.spin.y * dt;
            state.group.rotation.z += state.spin.z * dt;
            state.group.updateWorldMatrix(true, true);
            const bounds = new THREE.Box3().setFromObject(state.group);
            if (bounds.min.y <= .025 && state.velocity.y <= 0) {
                state.group.position.y += .025 - bounds.min.y;
                state.velocity.set(0, 0, 0); state.spin.multiplyScalar(.18); state.settled = true;
                const hit = state.group.getWorldPosition(new THREE.Vector3()); hit.y = .05;
                for (let i = 0; i < 5; i++) activateParticle(chipPool, 'chip', hit, new THREE.Vector3((Math.random()-.5)*1.1, .35+Math.random()*.65, (Math.random()-.5)*1.1), .8, .45+Math.random()*.3, -6.5, 0, 0x4b4a42);
            }
        }
        for (const state of impactLights) {
            if (state.life <= 0) continue;
            state.life = Math.max(0, state.life - dt);
            state.light.intensity *= Math.exp(-16 * dt);
            if (state.life <= 0) { state.light.intensity = 0; state.light.visible = false; }
        }
'''
if needle not in text: raise SystemExit('pulse marker missing')
text = text.replace(needle, falling_update + needle, 1)
text = text.replace("            if (state.smoke) {\n                const scale = state.baseScale * (1 + (1 - t) * state.grow);\n                state.mesh.scale.setScalar(scale);\n                state.mesh.material.opacity = .44 * t;",
                    "            if (state.smoke) {\n                state.mesh.quaternion.copy(camera.quaternion);\n                const scale = state.baseScale * (1 + (1 - t) * state.grow);\n                state.mesh.scale.setScalar(scale);\n                state.mesh.material.opacity = .52 * t;", 1)
text = text.replace("                budget.spark += (profile.sparkRate + destroyedSpark) * dt * (record.wrecked ? .72 : 1);\n                budget.smoke += (profile.smokeRate + wreckSmoke + destroyedSmoke) * dt;",
                    "                budget.spark += (profile.sparkRate + destroyedSpark) * dt * (record.wrecked ? .82 : 1);\n                budget.smoke += (profile.smokeRate + wreckSmoke + destroyedSmoke) * dt;\n                budget.arc += (profile.arcRate + (part.destroyed && slot === 'power' ? .85 : 0)) * dt;", 1)
text = text.replace("                while (budget.smoke >= 1) {\n                    budget.smoke -= 1;\n                    const origin = partWorldPoint(record, slot);\n                    const velocity = new THREE.Vector3((Math.random() - .5) * .16, .22 + Math.random() * .22, (Math.random() - .5) * .16);\n                    activateParticle(smokePool, 'smoke', origin, velocity, .8 + profile.severity * .5, 1.0 + Math.random() * .75, 0, 1.15, slot === 'power' ? 0x20241f : 0x2b2d28, true);\n                }",
                    "                while (budget.smoke >= 1) {\n                    budget.smoke -= 1;\n                    const origin = partWorldPoint(record, slot);\n                    const velocity = new THREE.Vector3((Math.random() - .5) * .18, .30 + Math.random() * .30, (Math.random() - .5) * .18);\n                    activateParticle(smokePool, 'smoke', origin, velocity, 1.0 + profile.severity * .85, 1.45 + Math.random() * 1.15, 0, 1.65, slot === 'power' ? 0x171b18 : 0x252823, true);\n                }\n                while (budget.arc >= 1) {\n                    budget.arc -= 1;\n                    spawnWorldPowerArc(partWorldPoint(record, slot), .65 + profile.severity * .65);\n                }", 1)

# Legitimately detached destroyed parts are no longer a visual-ownership corruption.
text = text.replace("                if (!owned) misplaced.push(`${record.id}:${slot}`);",
                    "                const legitimatelyDetached = record.destroyedSlots.has(slot) && (slot === 'combat' || slot === 'power') && group.parent === scene;\n                if (!owned && !legitimatelyDetached) misplaced.push(`${record.id}:${slot}`);", 1)

# Stronger shaped practical lighting.
text = text.replace("    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffcf8a, emissive: 0xffa43a, emissiveIntensity: 2.4 });",
                    "    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffd39a, emissive: 0xffa43a, emissiveIntensity: 3.2, roughness: .5 });", 1)
text = text.replace("            const light = new THREE.PointLight(0xffb65f, 15, 20, 1.8);\n            light.position.set(x, 6.8, z);",
                    "            const light = new THREE.PointLight(0xffb565, 26, 14, 2.15);\n            light.position.set(x, 6.65, z);", 1)

# All simple physical meshes participate in the one sun shadow path.
text = text.replace("function box(w, h, d, material) {\n    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), material);\n    return mesh;\n}",
                    "function box(w, h, d, material) {\n    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), material);\n    mesh.castShadow = true; mesh.receiveShadow = true;\n    return mesh;\n}", 1)
text = text.replace("            mesh.userData.slot = slot;\n            group.add(mesh);",
                    "            mesh.userData.slot = slot;\n            mesh.castShadow = true; mesh.receiveShadow = true;\n            group.add(mesh);", 1)
text = text.replace("                node.userData.slot = slot;\n                meshes.push(node);",
                    "                node.userData.slot = slot;\n                node.castShadow = true; node.receiveShadow = true;\n                meshes.push(node);", 1)
text = text.replace("    return new THREE.Mesh(geometry, material);\n}",
                    "    const mesh = new THREE.Mesh(geometry, material);\n    mesh.castShadow = true; mesh.receiveShadow = true;\n    return mesh;\n}", 1)

path.write_text(text)

# Cache/version strings.
replace_once('index.html', 'k.3l.0', 'k.3l.1')
print('k3l1 damage and lighting integration applied')
