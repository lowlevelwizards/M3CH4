from pathlib import Path


def replace(path, old, new, count=-1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

replace(
    'scene.js',
    """        const slot = actual?.object.userData.slot;
        return { slot: slot ?? null, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };
    }
    function traceCombatantShot""",
    """        const slot = actual?.object.userData.slot;
        const actorId = actual?.object.userData.actorId ?? null;
        return { actorId: slot ? actorId : null, slot: slot ?? null, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };
    }
    function traceCombatantShot""",
)

replace(
    'main.js',
    """function hideAppGuide() {
    appSheet.classList.add('hidden');
    appSheet.setAttribute('aria-hidden', 'true');
    controls.setEnabled(!inspecting && !testEnded);
}""",
    """function hideAppGuide() {
    appSheet.classList.add('hidden');
    appSheet.setAttribute('aria-hidden', 'true');
    controls.setEnabled(!inspecting && !testEnded && playerCombatActive);
}""",
)

print('applied k.3k.0 safety follow-up')
