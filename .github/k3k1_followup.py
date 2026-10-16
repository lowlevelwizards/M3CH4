from pathlib import Path

p = Path('main.js')
text = p.read_text()

if "faultStrip.classList.remove('nominal');\n    faultStrip.classList.add('faulted');" not in text:
    old = """    faultStrip.textContent = `MISSION KILL · ${reason} · ALLIES STILL ENGAGED`;
    faultStrip.classList.add('faulted');"""
    new = """    faultStrip.textContent = `MISSION KILL · ${reason} · ALLIES STILL ENGAGED`;
    faultStrip.classList.remove('nominal');
    faultStrip.classList.add('faulted');"""
    if old not in text:
        raise SystemExit('missing mission-kill fault strip anchor')
    text = text.replace(old, new, 1)

if "faultStrip.classList.remove('nominal');\n    faultStrip.classList.toggle('faulted', !victory);" not in text:
    old = """    faultStrip.textContent = victory ? `CONTRACT CLEARED · HOSTILE TEAM DOWN` : `SORTIE LOST · FRIENDLY TEAM DOWN`;
    faultStrip.classList.toggle('faulted', !victory);"""
    new = """    faultStrip.textContent = victory ? `CONTRACT CLEARED · HOSTILE TEAM DOWN` : `SORTIE LOST · FRIENDLY TEAM DOWN`;
    faultStrip.classList.remove('nominal');
    faultStrip.classList.toggle('faulted', !victory);"""
    if old not in text:
        raise SystemExit('missing sortie fault strip anchor')
    text = text.replace(old, new, 1)

old = """        if (targetActor.team !== HOSTILE_TEAM) {
            arena.showShot(contact, null);
            soundImpact();
            showHitConfirm({ friendlyBlock: true });
            lastHit = `ALLY BLOCK · ${targetActor.label}`;
            renderAmmo();
            return;
        }
        if (!targetActor.active) {
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
        }"""
new = """        // Once a rig is mission-killed it is just obstructing machinery: either team can
        // shove it or spend ammunition breaking it down into a much smaller remnant.
        if (!targetActor.active) {
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
        }
        if (targetActor.team !== HOSTILE_TEAM) {
            arena.showShot(contact, null);
            soundImpact();
            showHitConfirm({ friendlyBlock: true });
            lastHit = `ALLY BLOCK · ${targetActor.label}`;
            renderAmmo();
            return;
        }"""
if old in text:
    text = text.replace(old, new, 1)
elif 'Once a rig is mission-killed it is just obstructing machinery' not in text:
    raise SystemExit('missing friendly-wreck reorder anchor')

p.write_text(text)
