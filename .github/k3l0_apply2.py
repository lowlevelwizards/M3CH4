from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1))

# -----------------------------------------------------------------------------
# main.js — six-pilot ledger, destruction fate, real wreck result and rebuild UI.
# -----------------------------------------------------------------------------
replace_once('main.js',
"import { repairQuote, settleSortie, totalRepairQuote } from './economy.js';",
"import { rebuildQuote, repairQuote, settleSortie, totalRepairQuote } from './economy.js';")
replace_once('main.js',
"import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from './combatPresentation.js';",
"""import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from './combatPresentation.js';
import { createBoutLedger, recordBoutHit, recordMissionKill, scoreBout } from './boutScoring.js';
import { buildWreckManifests, createSalvageDraft, SCRAPYARD_CHARTER, wreckPreservation } from './salvageDraft.js';
import { clearBoutResult, publishBoutResult } from './boutSession.js';
import { resetDamageFate } from './damageFate.js';""")

replace_once('main.js',
"""const supportActors = [...friendlySupportActors, ...hostileSupportActors];
const aiActors = [primaryEnemyActor, ...supportActors];
let testEnded = false;""",
"""const supportActors = [...friendlySupportActors, ...hostileSupportActors];
const aiActors = [primaryEnemyActor, ...supportActors];
const boutRoster = () => [
    { id: 'player', team: FRIENDLY_TEAM, label: 'YOU' },
    ...aiActors.map(actor => ({ id: actor.id, team: actor.team, label: actor.label })),
];
let boutLedger = createBoutLedger(boutRoster());
const partSnapshot = part => part ? {
    armor: part.armor, maxArmor: part.maxArmor,
    integrity: part.integrity, maxIntegrity: part.maxIntegrity,
    destruction: part.destruction ?? 0, destroyed: !!part.destroyed,
} : null;
function scoreHit(attackerId, victimId, slot, before, hit, after) {
    if (!before || !after) return;
    const scoredHit = { ...hit, internalDamage: Math.max(0, before.integrity - after.integrity) };
    recordBoutHit(boutLedger, { attackerId, victimId, slot, before, after, hit: scoredHit, time: performance.now() / 1000 });
}
function syncOwnedPartFate(slot) {
    const fitted = installedPart(assembly, slot);
    const part = playerCondition.parts[slot];
    if (fitted && part) fitted.instance.destroyed = !!part.destroyed;
}
let testEnded = false;""")

replace_once('main.js',
"""    installed.instance.condition = weaponIntegrityRatio(playerCondition);
    if (addWear)""",
"""    installed.instance.condition = weaponIntegrityRatio(playerCondition);
    installed.instance.destroyed = !!part.destroyed;
    if (addWear)""")

replace_once('main.js',
"""function showHitConfirm(hit, text = null) {
    const kind = hit?.friendlyBlock ? 'friendly' : hit?.cleared ? 'cleared' : hit?.wreckHit ? 'wreck' : hit?.disabled ? 'disabled' : hit?.internalDamage > 0 ? 'breach' : 'armor';
    const label = text ?? (kind === 'disabled' ? 'DISABLED' : kind === 'breach' ? 'BREACH' : kind === 'cleared' ? 'WRECK CLEARED' : kind === 'wreck' ? 'WRECK' : kind === 'friendly' ? 'ALLY BLOCK' : 'HIT');""",
"""function showHitConfirm(hit, text = null) {
    const destroyed = !!hit?.justDestroyed;
    const kind = hit?.friendlyBlock ? 'friendly' : destroyed ? 'disabled' : hit?.cleared ? 'cleared' : hit?.wreckHit ? 'wreck' : hit?.disabled ? 'disabled' : hit?.internalDamage > 0 ? 'breach' : 'armor';
    const label = text ?? (destroyed ? 'DESTROYED' : kind === 'disabled' ? 'DISABLED' : kind === 'breach' ? 'BREACH' : kind === 'cleared' ? 'WRECK CLEARED' : kind === 'wreck' ? 'WRECK' : kind === 'friendly' ? 'ALLY BLOCK' : 'HIT');""")

replace_once('main.js',
"function missionKillAiActor(actor, reason) {\n    if (!actor?.active) return;",
"function missionKillAiActor(actor, reason, attackerId = null) {\n    if (!actor?.active) return;\n    recordMissionKill(boutLedger, { attackerId, victimId: actor.id, reason, time: performance.now() / 1000 });")
replace_once('main.js',
"function missionKillPlayer(reason) {\n    if (!playerCombatActive) return;",
"function missionKillPlayer(reason, attackerId = null) {\n    if (!playerCombatActive) return;\n    recordMissionKill(boutLedger, { attackerId, victimId: 'player', reason, time: performance.now() / 1000 });")

replace_once('main.js',
"""        resetSquadBattle();
        controls.recenterLook();""",
"""        resetSquadBattle();
        boutLedger = createBoutLedger(boutRoster());
        clearBoutResult();
        controls.recenterLook();""")

# Garage presentation / rebuild guarantee for sanctioned starter circuit.
replace_once('main.js',
"""        stats.textContent = `${fitted.definition.name}\nSERIAL ${fitted.instance.serial}\nMASS ${fitted.definition.massKg} kg\nCONDITION ${Math.round(fitted.instance.condition * 100)}% · REPAIRS ${fitted.instance.repairs} · WEAR ${Math.round(fitted.instance.wear * 100)}%`;""",
"""        stats.textContent = `${fitted.definition.name}\nSERIAL ${fitted.instance.serial}\nMASS ${fitted.definition.massKg} kg\nCONDITION ${Math.round(fitted.instance.condition * 100)}% · REPAIRS ${fitted.instance.repairs} · WEAR ${Math.round(fitted.instance.wear * 100)}%${fitted.instance.destroyed ? '\nWRECKED · REBUILD REQUIRED' : ''}`;""")
replace_once('main.js',
"""        const condition = fitted.instance.condition;
        if (selectedPart === 'mobility') {""",
"""        const condition = fitted.instance.condition;
        if (fitted.instance.destroyed) {
            symptom.textContent = 'DESTROYED HARDWARE · HOUSE RECOVERY RETURNED THE CARCASS · REBUILD OR REPLACE BEFORE DEPLOYMENT';
        }
        else if (selectedPart === 'mobility') {""")
replace_once('main.js',
"""        const quotedRepair = repairQuote(playerCondition.parts[selectedPart]);
        const affordable = quotedRepair <= economy.credits;
        repair.disabled = quotedRepair <= 0 || !affordable;
        repair.textContent = quotedRepair <= 0 ? 'NO REPAIR REQUIRED' :
            affordable ? `REPAIR ${labels[selectedPart]} · ₡${quotedRepair}` :
                `REPAIR ${labels[selectedPart]} · ₡${quotedRepair} · INSUFFICIENT`;""",
"""        const destroyedPart = !!playerCondition.parts[selectedPart]?.destroyed;
        const quotedRepair = destroyedPart ? rebuildQuote(playerCondition.parts[selectedPart]) : repairQuote(playerCondition.parts[selectedPart]);
        const affordable = quotedRepair <= economy.credits;
        repair.disabled = quotedRepair <= 0 || (!destroyedPart && !affordable);
        repair.textContent = quotedRepair <= 0 ? 'NO REPAIR REQUIRED' : destroyedPart
            ? `REBUILD ${labels[selectedPart]} · ₡${quotedRepair}${affordable ? '' : ' · HOUSE GUARANTEE'}`
            : affordable ? `REPAIR ${labels[selectedPart]} · ₡${quotedRepair}` :
                `REPAIR ${labels[selectedPart]} · ₡${quotedRepair} · INSUFFICIENT`;""")
replace_once('main.js',
"""            const cost = repairQuote(playerCondition.parts[selectedPart]);
            if (cost <= 0)
                return;
            if (cost > economy.credits) {
                showStatus(`INSUFFICIENT CREDITS · NEED ₡${cost}`);
                return;
            }
            economy.credits -= cost;
            const result = repairInstalledPart(assembly, damage, selectedPart);""",
"""            const destroyed = !!playerCondition.parts[selectedPart]?.destroyed;
            const cost = destroyed ? rebuildQuote(playerCondition.parts[selectedPart]) : repairQuote(playerCondition.parts[selectedPart]);
            if (cost <= 0)
                return;
            if (!destroyed && cost > economy.credits) {
                showStatus(`INSUFFICIENT CREDITS · NEED ₡${cost}`);
                return;
            }
            const charged = destroyed ? Math.min(cost, economy.credits) : cost;
            economy.credits -= charged;
            const result = repairInstalledPart(assembly, damage, selectedPart);""")
replace_once('main.js',
"""            showStatus(`${result.serial} SERVICED · −₡${cost}`);""",
"""            const subsidy = cost - charged;
            showStatus(result.rebuilt
                ? `${result.serial} REBUILT · −₡${charged}${subsidy > 0 ? ` · HOUSE GUARANTEE ₡${subsidy}` : ''}`
                : `${result.serial} SERVICED · −₡${charged}`);""")

replace_once('main.js',
"""function moduleStatus(slot) {
    const condition = moduleCondition(slot);
    if (condition === null)
        return 'missing';""",
"""function moduleStatus(slot) {
    const fitted = installedPart(assembly, slot);
    if (fitted?.instance.destroyed)
        return 'destroyed';
    const condition = moduleCondition(slot);
    if (condition === null)
        return 'missing';""")
replace_once('main.js',
"""function moduleStatusLabel(status) {
    return status === 'good' ? 'GOOD' : status === 'degraded' ? 'DEGRADED' :
        status === 'severe' ? 'DAMAGED' : status === 'disabled' ? 'DISABLED' : 'MISSING';
}""",
"""function moduleStatusLabel(status) {
    return status === 'good' ? 'GOOD' : status === 'degraded' ? 'DEGRADED' :
        status === 'severe' ? 'DAMAGED' : status === 'destroyed' ? 'WRECKED' :
        status === 'disabled' ? 'DISABLED' : 'MISSING';
}""")

# Reset DEV squad also resets sporting attribution.
replace_once('main.js',
"""resetTarget.addEventListener('click', () => {
    resetSquadBattle();""",
"""resetTarget.addEventListener('click', () => {
    resetSquadBattle();
    boutLedger = createBoutLedger(boutRoster());
    clearBoutResult();""")

# Finish sortie publishes score and live wrecks before the debrief becomes visible.
replace_once('main.js',
"""    controls.setEnabled(false);
    const summary = settleSortie({""",
"""    controls.setEnabled(false);
    const winningTeam = victory ? FRIENDLY_TEAM : HOSTILE_TEAM;
    const survivors = { player: playerCombatActive };
    for (const actor of aiActors) survivors[actor.id] = actor.active;
    const score = scoreBout(boutLedger, { winningTeam, survivors });
    const wrecks = victory ? buildWreckManifests(aiActors.filter(actor => actor.team === HOSTILE_TEAM)) : [];
    const draft = victory ? createSalvageDraft({ draftOrder: score.draftOrder, manifests: wrecks }) : null;
    publishBoutResult({
        victory, reason, winningTeam, score, wrecks, draft,
        charter: SCRAPYARD_CHARTER,
        wreckPreservation: victory ? wreckPreservation(wrecks) : 0,
    });
    const summary = settleSortie({""")

# Incoming AI hit -> actual owned fate + ledger attribution + killer identity.
replace_once('main.js',
"""    const partBefore = playerCondition.parts[contact.slot];
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, actor.weaponSpec.damage);""",
"""    const partBefore = playerCondition.parts[contact.slot];
    const before = partSnapshot(partBefore);
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, actor.weaponSpec.damage);""")
replace_once('main.js',
"""    if (contact.slot === 'combat') {
        weaponFaulted = arrestFirstWeaponFailure(playerCondition, fieldService, beforeIntegrity);
        if (weaponFaulted) syncOwnedWeaponCondition(false);
    }
    const nowDisabled""",
"""    if (contact.slot === 'combat') {
        weaponFaulted = arrestFirstWeaponFailure(playerCondition, fieldService, beforeIntegrity);
        if (weaponFaulted) {
            resetDamageFate(playerCondition.parts.combat);
            syncOwnedWeaponCondition(false);
        }
    }
    syncOwnedPartFate(contact.slot);
    const after = partSnapshot(playerCondition.parts[contact.slot]);
    scoreHit(actor.id, 'player', contact.slot, before, hit, after);
    const nowDisabled""")
replace_once('main.js',
"""    const visualHit = { ...hit, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled };""",
"""    const visualHit = { ...hit, destroyed: !!after.destroyed, justDestroyed: !before.destroyed && !!after.destroyed, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled };""")
replace_once('main.js',
"""    if (failure) missionKillPlayer(failure);""",
"""    if (failure) missionKillPlayer(failure, actor.id);""")

# AI -> AI live hits are scored before mission resolution.
replace_once('main.js',
"""    const beforeIntegrity = target.condition.parts[contact.slot].integrity;
    const hit = applyTargetHit(target.condition, contact.slot, actor.weaponSpec.damage);
    const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled };""",
"""    const beforePart = partSnapshot(target.condition.parts[contact.slot]);
    const beforeIntegrity = target.condition.parts[contact.slot].integrity;
    const hit = applyTargetHit(target.condition, contact.slot, actor.weaponSpec.damage);
    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""")
replace_once('main.js',
"""    if (kill) missionKillAiActor(target, kill);""",
"""    if (kill) missionKillAiActor(target, kill, actor.id);""",)

# Player firing into an already mission-killed rig now changes real salvage condition.
replace_once('main.js',
"""        if (!targetActor.active) {
            targetActor.wreckIntegrity = damageWreckIntegrity(targetActor.wreckIntegrity, weaponSpec.damage);
            const cleared = targetActor.wreckIntegrity <= .001;
            if (cleared && !targetActor.wreckCleared) {
                targetActor.wreckCleared = true;
                arena.setCombatantCleared(targetActor.id, true);
            }
            const wreckHit = { slot: contact.slot, internalDamage: weaponSpec.damage, armorAbsorbed: 0, disabled: true, justDisabled: false, wreckHit: true, cleared };
            arena.showShot(contact, wreckHit);
            soundImpact();
            showHitConfirm(wreckHit);
            lastHit = `${targetActor.label} · WRECK ${Math.round(targetActor.wreckIntegrity * 100)}%`;
            renderAmmo();
            return;
        }""",
"""        if (!targetActor.active) {
            const beforePart = partSnapshot(targetActor.condition.parts[contact.slot]);
            const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
            const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
            targetActor.wreckIntegrity = damageWreckIntegrity(targetActor.wreckIntegrity, weaponSpec.damage);
            const cleared = targetActor.wreckIntegrity <= .001;
            if (cleared && !targetActor.wreckCleared) {
                targetActor.wreckCleared = true;
                arena.setCombatantCleared(targetActor.id, true);
            }
            const wreckHit = {
                ...hit, wreckHit: true, cleared,
                justDisabled: beforePart.integrity > 0 && afterPart.integrity <= 0,
                justDestroyed: !beforePart.destroyed && !!afterPart.destroyed,
            };
            arena.showShot(contact, wreckHit);
            arena.updateCombatantDamage(targetActor.id, targetActor.condition);
            if (targetActor.id === 'enemy-0') {
                mirrorTargetCondition(targetAssembly, targetCondition);
                renderTarget();
            }
            soundImpact();
            showHitConfirm(wreckHit);
            lastHit = `${targetActor.label} · ${wreckHit.justDestroyed ? 'PART DESTROYED' : `WRECK ${Math.round(targetActor.wreckIntegrity * 100)}%`}`;
            renderAmmo();
            return;
        }""")

# Player -> live hostile contribution.
replace_once('main.js',
"""        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;
        const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
        const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled };""",
"""        const beforePart = partSnapshot(targetActor.condition.parts[contact.slot]);
        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;
        const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""")
replace_once('main.js',
"""        if (kill) missionKillAiActor(targetActor, kill);""",
"""        if (kill) missionKillAiActor(targetActor, kill, 'player');""")

# -----------------------------------------------------------------------------
# scene.js — blackened catastrophic hardware, collapse/drop poses, bigger bursts.
# -----------------------------------------------------------------------------
replace_once('scene.js',
"""        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,
        baseParts: capturePartTransforms(targetExterior),""",
"""        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,
        baseParts: capturePartTransforms(targetExterior),""")
replace_once('scene.js',
"""            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,
            baseParts: capturePartTransforms(actorExterior),""",
"""            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,
            baseParts: capturePartTransforms(actorExterior),""")

replace_once('scene.js',
"""    function wreckCombatantVisual(record) {""",
"""    function spawnWorldPowerArc(origin, strength = 1) {
        const end = origin.clone().add(new THREE.Vector3((Math.random()-.5)*1.5, .35+Math.random()*1.25, (Math.random()-.5)*1.5));
        const points = [origin.clone()];
        for (let i = 1; i < 7; i++) {
            const p = origin.clone().lerp(end, i / 7);
            p.x += (Math.random()-.5) * .22 * strength;
            p.y += (Math.random()-.5) * .18 * strength;
            p.z += (Math.random()-.5) * .22 * strength;
            points.push(p);
        }
        points.push(end);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: Math.random() > .3 ? 0xc8fff2 : 0xffe58d, transparent: true, opacity: 1 });
        const line = new THREE.Line(geometry, material); scene.add(line);
        transientFX.push({ object: line, remaining: .12 + Math.random()*.12, duration: .24, material });
    }
    function spawnCatastrophicBurst(position, normal, outcome) {
        const power = outcome?.slot === 'power';
        const flashMat = new THREE.MeshBasicMaterial({ color: power ? 0xf4ffd9 : 0xffbd70, transparent: true, opacity: 1, depthWrite: false });
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(power ? .58 : .46, 0), flashMat);
        flash.position.copy(position); scene.add(flash);
        transientFX.push({ object: flash, remaining: .22, duration: .22, material: flashMat });
        for (let i = 0; i < (power ? 28 : 22); i++) {
            const direction = randomBurstDirection(normal, 2.0);
            activateParticle(sparkPool, 'spark', position, direction.multiplyScalar(2.2 + Math.random()*5.0), 1.2 + Math.random()*1.5, .28 + Math.random()*.48, -4.5, 0, i % 4 ? 0xffcf70 : 0xfff6c9);
        }
        for (let i = 0; i < (outcome?.slot === 'mobility' ? 18 : 14); i++) {
            const direction = randomBurstDirection(normal, 2.1);
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(1.4 + Math.random()*3.8), 1.8 + Math.random()*2.3, .75 + Math.random()*.95, -8.2, 0, i % 3 ? 0x30332f : 0x9b7542);
        }
        for (let i = 0; i < (power ? 9 : 6); i++) {
            const drift = new THREE.Vector3((Math.random()-.5)*.42, .35+Math.random()*.52, (Math.random()-.5)*.42);
            activateParticle(smokePool, 'smoke', position, drift, 1.15+Math.random()*.75, 1.5+Math.random()*1.2, 0, 1.45, 0x171a17, true);
        }
        if (power) for (let i = 0; i < 3; i++) spawnWorldPowerArc(position, .9 + Math.random()*.6);
    }
    function markPartDestroyedVisual(actorId, slot) {
        const record = squadCombatants.get(actorId);
        if (!record || record.destroyedSlots.has(slot)) return;
        record.destroyedSlots.add(slot);
        const group = record.exterior.partGroups.get(slot);
        if (!group) return;
        const side = actorId.length % 2 ? 1 : -1;
        if (slot === 'combat') {
            group.position.y -= .92; group.position.x += side * .18;
            group.rotation.z += side * .82; group.rotation.x += .48;
        } else if (slot === 'power') {
            group.position.y -= .72; group.position.x += side * .14;
            group.rotation.z += side * .62; group.rotation.x += .32;
        } else if (slot === 'mobility') {
            group.position.y -= .38; group.rotation.z += side * .34; group.rotation.x += .16;
        } else if (slot === 'command') {
            group.position.y -= .16; group.rotation.z += side * .24; group.rotation.x += .12;
        } else if (slot === 'structure') {
            record.exterior.root.rotation.z += side * .11;
            record.exterior.root.position.y -= .08;
        }
    }
    function wreckCombatantVisual(record) {""")
replace_once('scene.js',
"""        record.disabledSlots.clear();
        record.exterior.root.position.y = 0;""",
"""        record.disabledSlots.clear();
        record.destroyedSlots.clear();
        record.exterior.root.position.y = 0;""")

# Catastrophic event precedes ordinary disable burst.
replace_once('scene.js',
"""        if (outcome?.justDisabled || outcome?.wreckHit) {
            spawnDisableBurst(impactPoint, contact.normal, outcome);
            if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
        }""",
"""        if (outcome?.justDestroyed) {
            spawnCatastrophicBurst(impactPoint, contact.normal, outcome);
            markPartDestroyedVisual(contact.actorId, outcome.slot);
        } else if (outcome?.justDisabled || outcome?.wreckHit) {
            spawnDisableBurst(impactPoint, contact.normal, outcome);
            if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
        }""")
replace_once('scene.js',
"""            if (outcome.justDisabled || outcome.wreckHit) {
                spawnDisableBurst(impactPoint, contact.normal, outcome);
                if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
            }""",
"""            if (outcome.justDestroyed) {
                spawnCatastrophicBurst(impactPoint, contact.normal, outcome);
                markPartDestroyedVisual(contact.actorId, outcome.slot);
            } else if (outcome.justDisabled || outcome.wreckHit) {
                spawnDisableBurst(impactPoint, contact.normal, outcome);
                if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
            }""")

# Damage material language: red/heat for disabled, charcoal/black for destroyed.
replace_once('scene.js',
"""                material.color.copy(color).multiplyScalar(Math.max(.24, 1 - damage * .68 - stripped * .18));
                const severe = state.integrity / Math.max(1, state.maxIntegrity) < .32;
                material.emissive.setHex(state.integrity === 0 ? 0x4b1609 : severe ? 0x241008 : 0);
                material.emissiveIntensity = state.integrity === 0 ? .58 : severe ? .16 : 0;""",
"""                if (state.destroyed) {
                    material.color.copy(color).multiplyScalar(.075);
                    material.emissive.setHex(0); material.emissiveIntensity = 0;
                    markPartDestroyedVisual(id, slot);
                } else {
                    material.color.copy(color).multiplyScalar(Math.max(.24, 1 - damage * .68 - stripped * .18));
                    const severe = state.integrity / Math.max(1, state.maxIntegrity) < .32;
                    material.emissive.setHex(state.integrity === 0 ? 0x4b1609 : severe ? 0x241008 : 0);
                    material.emissiveIntensity = state.integrity === 0 ? .58 : severe ? .16 : 0;
                }""")
replace_once('scene.js',
"""                material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);
                material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);
                material.emissiveIntensity = state.integrity === 0 ? .35 : 0;""",
"""                if (state.destroyed) {
                    material.color.copy(color).multiplyScalar(.075);
                    material.emissive.setHex(0); material.emissiveIntensity = 0;
                } else {
                    material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);
                    material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);
                    material.emissiveIntensity = state.integrity === 0 ? .35 : 0;
                }""")

# Destroyed modules keep smoking/sparking harder while they remain on-field.
replace_once('scene.js',
"""                const wreckSmoke = record.wrecked ? .42 : 0;
                budget.spark += profile.sparkRate * dt * (record.wrecked ? .55 : 1);
                budget.smoke += (profile.smokeRate + wreckSmoke) * dt;""",
"""                const wreckSmoke = record.wrecked ? .42 : 0;
                const destroyedSpark = part.destroyed ? (slot === 'power' ? 2.8 : 1.2) : 0;
                const destroyedSmoke = part.destroyed ? (slot === 'power' ? 1.15 : .62) : 0;
                budget.spark += (profile.sparkRate + destroyedSpark) * dt * (record.wrecked ? .72 : 1);
                budget.smoke += (profile.smokeRate + wreckSmoke + destroyedSmoke) * dt;""")

# -----------------------------------------------------------------------------
# index.html — cache/version keys for the new backbone.
# -----------------------------------------------------------------------------
replace_once('index.html', '"./combat.js": "./combat.js?v=k3j1"', '"./combat.js": "./combat.js?v=k3l0"')
replace_once('index.html', '"./progression.js": "./progression.js?v=k3h0"', '"./progression.js": "./progression.js?v=k3l0"')
replace_once('index.html', '"./economy.js": "./economy.js?v=k3f0"', '"./economy.js": "./economy.js?v=k3l0"')
replace_once('index.html', '"./acquisition.js": "./acquisition.js?v=k3f0"', '"./acquisition.js": "./acquisition.js?v=k3l0"')
replace_once('index.html', '"./persistence.js": "./persistence.js?v=k3i0"', '"./persistence.js": "./persistence.js?v=k3l0"')
replace_once('index.html', '"./functionalDamage.js": "./functionalDamage.js?v=g11"', '"./functionalDamage.js": "./functionalDamage.js?v=k3l0"')
replace_once('index.html', '"./scene.js": "./sceneAssembly.js?v=k3k4"', '"./scene.js": "./sceneAssembly.js?v=k3l0"')
replace_once('index.html',
'    "./coverTruth.js": "./coverTruth.js?v=k3k4"',
'''    "./coverTruth.js": "./coverTruth.js?v=k3k4",
    "./damageFate.js": "./damageFate.js?v=k3l0",
    "./boutScoring.js": "./boutScoring.js?v=k3l0",
    "./salvageDraft.js": "./salvageDraft.js?v=k3l0",
    "./boutSession.js": "./boutSession.js?v=k3l0"''')
replace_once('index.html',
'    <title>MECH ARENA — 0.0.1k.3k.4 — Combiner Anchoring + Cover Truth</title>',
'    <title>MECH ARENA — 0.0.1k.3l.0 — Bout Stakes + Salvage Draft</title>')
replace_once('index.html',
'      <header>RIG DIAGNOSTICS <span>0.0.1k.3k.4</span></header>',
'      <header>RIG DIAGNOSTICS <span>0.0.1k.3l.0</span></header>')
replace_once('index.html',
'    <script type="module" src="./main.js?v=k3k4"></script>',
'    <script type="module" src="./main.js?v=k3l0"></script>')
replace_once('index.html',
'    <script type="module" src="./garageMountUI.js?v=k3h0"></script>',
'    <script type="module" src="./garageMountUI.js?v=k3l0"></script>')
