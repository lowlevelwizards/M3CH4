from pathlib import Path


def replace_once(path, old, new, label):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    file.write_text(text.replace(old, new, 1))

replace_once(
    'main.js',
    """    // World and cockpit telemetry deliberately use separate resolution budgets.\n    arena.camera.layers.set(0);\n    renderer.render(arena.scene, arena.camera);\n    hudRenderer.clear();\n    if (!inspecting) {\n        arena.camera.layers.set(1);\n        hudRenderer.render(arena.scene, arena.camera);\n    }\n    arena.camera.layers.set(0);\n""",
    """    // World and cockpit telemetry deliberately use separate resolution budgets.\n    arena.camera.layers.set(0);\n    renderer.render(arena.scene, arena.camera);\n    hudRenderer.clear();\n    if (!inspecting) {\n        // scene.background belongs to the chunky world pass. Temporarily suppress it\n        // so the display-resolution HUD renderer remains a transparent composite.\n        const worldBackground = arena.scene.background;\n        arena.scene.background = null;\n        arena.camera.layers.set(1);\n        hudRenderer.render(arena.scene, arena.camera);\n        arena.camera.layers.set(0);\n        arena.scene.background = worldBackground;\n    }\n""",
    'transparent HUD composite',
)

replace_once(
    'scene.js',
    "const coolRim = new THREE.DirectionalLight(0x79a9a8, .72);",
    "const coolRim = new THREE.DirectionalLight(0x79a9a8, .90);",
    'arena silhouette rim separation',
)

replace_once(
    'acquisitionUI.js',
    """function scheduleGarageReturn(result) {\n    if (autoGarageTimer !== null) window.clearTimeout(autoGarageTimer);\n    garage.textContent = 'CLAIM SECURED · RETURNING TO GARAGE';\n    autoGarageTimer = window.setTimeout(() => {\n""",
    """function scheduleGarageReturn(result) {\n    if (autoGarageTimer !== null) window.clearTimeout(autoGarageTimer);\n    const playerClaimed = result.draft.picks.some(pick => pick.actorId === 'player' && !pick.skipped);\n    garage.textContent = playerClaimed ? 'CLAIM SECURED · RETURNING TO GARAGE' : 'DRAFT COMPLETE · RETURNING TO GARAGE';\n    autoGarageTimer = window.setTimeout(() => {\n""",
    'accurate automatic return label',
)

replace_once(
    'acquisitionUI.js',
    """    layout.append(browser, inspector); panel.append(layout); salvagePage.append(panel);\n\n    if (currentDrafter(result.draft) === 'player')\n        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';\n""",
    """    layout.append(browser, inspector); panel.append(layout); salvagePage.append(panel);\n\n    if (currentDrafter(result.draft) === 'player')\n        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';\n    else if (!currentDrafter(result.draft) && autoGarageTimer === null)\n        scheduleGarageReturn(result);\n""",
    'auto return after any completed draft',
)

replace_once(
    'acquisitionUI.js',
    """    render();\n    if (!currentDrafter(result.draft)) scheduleGarageReturn(result);\n}\n\nfunction visiblePageIndices() {\n""",
    """    render();\n}\n\nfunction visiblePageIndices() {\n""",
    'single auto-return scheduling path',
)

replace_once(
    'acquisitionUI.js',
    """function render() {\n    const result = latestBoutResult();\n    const newResult = !!result && result !== lastRenderedResult;\n    renderScore(result);\n    renderDraft(result);\n""",
    """function render() {\n    const result = latestBoutResult();\n    const newResult = !!result && result !== lastRenderedResult;\n    if (newResult) selectedEntryId = null;\n    renderScore(result);\n    renderDraft(result);\n""",
    'reset selection before rendering new result',
)

replace_once(
    'acquisitionUI.js',
    """    if (newResult) {\n        lastRenderedResult = result;\n        selectedEntryId = null;\n        currentPageIndex = 0;\n""",
    """    if (newResult) {\n        lastRenderedResult = result;\n        currentPageIndex = 0;\n""",
    'avoid clearing rendered initial selection',
)

# Extend source-level regression to pin transparent high-res compositing.
test_path = Path('tests/k3l3Presentation.test.mjs')
test = test_path.read_text()
needle = "    assert.match(main, /arena\\.camera\\.layers\\.set\\(1\\)/);\n"
if needle not in test:
    raise RuntimeError('HUD regression anchor not found')
test = test.replace(needle, needle + "    assert.match(main, /arena\\.scene\\.background = null/);\n", 1)
test_path.write_text(test)

print('k.3l.3 final compositor/flow fixes applied')
