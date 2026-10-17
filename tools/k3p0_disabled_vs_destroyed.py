from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label}: anchor missing in {path}')
    p.write_text(text.replace(old, new, 1))

# Keep zero-integrity but physically intact hardware recoverable while the one-shot
# bypass is still pending. Destruction is already represented separately by damageFate.
replace_once('fieldService.js', """export function weaponFailureState(condition, service) {
    const ratio = weaponIntegrityRatio(condition);
    if (ratio <= 0)
        return 'destroyed';
    if (ratio <= WEAPON_FAULT_THRESHOLD)
        return service?.used ? 'unrecoverable' : 'faulted';
    if (ratio < 0.95)
        return 'damaged';
    return 'ready';
}""", """export function weaponFailureState(condition, service) {
    const part = condition?.parts?.combat;
    const ratio = weaponIntegrityRatio(condition);
    if (part?.destroyed)
        return 'destroyed';
    // A latched emergency fault can remain physically intact at zero functional
    // integrity. That is DISABLED hardware, not destroyed hardware.
    if (ratio <= 0 && !service?.faultLatched)
        return 'destroyed';
    if (ratio <= WEAPON_FAULT_THRESHOLD)
        return service?.used ? 'unrecoverable' : 'faulted';
    if (ratio < 0.95)
        return 'damaged';
    return 'ready';
}""", 'weapon failure state')

replace_once('fieldService.js', """export function canFieldService(condition, service) {
    const ratio = weaponIntegrityRatio(condition);
    return !!service && !service.used && ratio > 0 && ratio <= WEAPON_FAULT_THRESHOLD;
}""", """export function canFieldService(condition, service) {
    const part = condition?.parts?.combat;
    const ratio = weaponIntegrityRatio(condition);
    return !!service && !service.used && !part?.destroyed &&
        ratio <= WEAPON_FAULT_THRESHOLD && (ratio > 0 || service.faultLatched);
}""", 'field service eligibility')

replace_once('fieldService.js', """/** A recoverable first fault keeps the sortie alive. Once the emergency restart is
 * spent—or the component is actually destroyed—there is no useful combat action
 * left and the bout should resolve immediately instead of making the pilot wait. */
export function weaponMissionKillReason(condition, service) {
    const ratio = weaponIntegrityRatio(condition);
    if (ratio <= 0)
        return 'WEAPON DESTROYED';
    if (ratio <= WEAPON_FAULT_THRESHOLD && service?.used)
        return 'WEAPON FAULT · FIELD SERVICE SPENT';
    return null;
}""", """/** A recoverable first fault keeps the sortie alive. Zero functional integrity is
 * still recoverable while the latched bypass remains unused and the physical weapon
 * has not crossed its destruction reserve. Once the bypass is spent—or the hardware
 * is actually destroyed—the weapon can legitimately mission-kill the rig. */
export function weaponMissionKillReason(condition, service) {
    const part = condition?.parts?.combat;
    const ratio = weaponIntegrityRatio(condition);
    if (part?.destroyed)
        return 'WEAPON DESTROYED';
    if (ratio <= 0 && !service?.faultLatched)
        return 'WEAPON DESTROYED';
    if (ratio <= WEAPON_FAULT_THRESHOLD && service?.used)
        return 'WEAPON FAULT · FIELD SERVICE SPENT';
    return null;
}""", 'player mission kill semantics')

# Give AI the same disabled-vs-destroyed truth instead of returning the legacy
# generic WEAPON DISABLED reason after the destruction reserve is crossed.
replace_once('aiFieldService.js', """export function aiWeaponMissionKillReason(condition, behavior = null, service = null) {
    const reason = hostileMissionKillReason(condition, behavior);
    if (reason === 'WEAPON DISABLED' && canFieldService(condition, service))
        return null;
    return reason;
}""", """export function aiWeaponMissionKillReason(condition, behavior = null, service = null) {
    if (condition?.parts?.combat?.destroyed)
        return 'WEAPON DESTROYED';
    const reason = hostileMissionKillReason(condition, behavior);
    if (reason === 'WEAPON DISABLED' && canFieldService(condition, service))
        return null;
    return reason;
}""", 'AI destruction reason')

# A follow-up hit can drive a faulted weapon to zero integrity without detaching it;
# only actual destruction (or a spent bypass) should become the terminal visual.
replace_once('main.js', """    const hit = applyTargetHit(target.condition, contact.slot, actor.weaponSpec.damage);
    const weaponFaulted = contact.slot === 'combat' && arrestAiWeaponFailure(target, beforeIntegrity, actor.rig);
    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    noteIncomingFire(target.motion, actor.rig, actor.id, hit.internalDamage > 0 ? 1.55 : 1.08);
    const visualHit = { ...hit, justDisabled: !weaponFaulted && beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""", """    const hit = applyTargetHit(target.condition, contact.slot, actor.weaponSpec.damage);
    const weaponFaulted = contact.slot === 'combat' && arrestAiWeaponFailure(target, beforeIntegrity, actor.rig);
    const weaponRecoverable = contact.slot === 'combat' && canFieldService(target.condition, target.fieldService);
    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    noteIncomingFire(target.motion, actor.rig, actor.id, hit.internalDamage > 0 ? 1.55 : 1.08);
    const visualHit = { ...hit, justDisabled: !weaponRecoverable && beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""", 'AI versus AI recoverable visual')

replace_once('main.js', """        const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
        const weaponFaulted = contact.slot === 'combat' && arrestAiWeaponFailure(targetActor, beforeIntegrity, rig);
        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        noteIncomingFire(targetActor.motion, rig, 'player', hit.internalDamage > 0 ? 1.65 : 1.12);
        const visualHit = { ...hit, justDisabled: !weaponFaulted && beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""", """        const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
        const weaponFaulted = contact.slot === 'combat' && arrestAiWeaponFailure(targetActor, beforeIntegrity, rig);
        const weaponRecoverable = contact.slot === 'combat' && canFieldService(targetActor.condition, targetActor.fieldService);
        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        noteIncomingFire(targetActor.motion, rig, 'player', hit.internalDamage > 0 ? 1.65 : 1.12);
        const visualHit = { ...hit, justDisabled: !weaponRecoverable && beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""", 'player versus AI recoverable visual')

replace_once('main.js', "showHitConfirm(hit, weaponFaulted ? 'WEAPON FAULT' : null);", "showHitConfirm(hit, weaponRecoverable ? 'WEAPON FAULT' : null);", 'recoverable hit confirm')

# Update the pre-existing player recovery regression to the physical fate model.
p = Path('tests/emergencyRecovery.test.mjs')
text = p.read_text()
old = """    // Another disabling hit before the bypass is completed is genuinely terminal.
    player.parts.combat.integrity = 0;
    assert.equal(arrestFirstWeaponFailure(player, service, 115 * WEAPON_FAULT_FLOOR), false);
    assert.equal(weaponFailureState(player, service), 'destroyed');
    assert.equal(weaponMissionKillReason(player, service), 'WEAPON DESTROYED');"""
new = """    // Zero functional integrity is still a disabled, serviceable assembly while the
    // physical weapon remains intact and this bypass has not been spent.
    player.parts.combat.integrity = 0;
    assert.equal(arrestFirstWeaponFailure(player, service, 115 * WEAPON_FAULT_FLOOR), false);
    assert.equal(weaponFailureState(player, service), 'faulted');
    assert.equal(canFieldService(player, service), true);
    assert.equal(weaponMissionKillReason(player, service), null);
    player.parts.combat.destroyed = true;
    assert.equal(weaponFailureState(player, service), 'destroyed');
    assert.equal(weaponMissionKillReason(player, service), 'WEAPON DESTROYED');"""
if old not in text:
    raise SystemExit('emergency recovery fate assertion anchor missing')
p.write_text(text.replace(old, new, 1))

# Add a focused regression proving sustained fire must cross physical destruction
# reserve rather than merely touch zero integrity after the first fault.
p = Path('tests/k3p0RecoverableWeapon.test.mjs')
text = p.read_text()
anchor = """test('a post-bypass weapon disable is a real mission kill', () => {"""
insert = """test('continued fire must actually destroy a latched fault before field service is denied', () => {
  const condition = createTargetCondition(makeRangeTarget('yard-dog'));
  const service = createFieldServiceState();
  const weapon = condition.parts.combat;
  const before = weapon.integrity;
  applyTargetHit(condition, 'combat', weapon.armor + weapon.integrity + 1);
  arrestFirstWeaponFailure(condition, service, before);
  applyTargetHit(condition, 'combat', 38);
  assert.equal(condition.parts.combat.integrity, 0);
  assert.equal(condition.parts.combat.destroyed, false);
  assert.equal(canFieldService(condition, service), true);
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), null);
  applyTargetHit(condition, 'combat', 38);
  assert.equal(condition.parts.combat.destroyed, true);
  assert.equal(canFieldService(condition, service), false);
  assert.equal(aiWeaponMissionKillReason(condition, { id: 'pressure' }, service), 'WEAPON DESTROYED');
});

""" + anchor
if anchor not in text:
    raise SystemExit('k3p0 destruction reserve test anchor missing')
p.write_text(text.replace(anchor, insert, 1))
