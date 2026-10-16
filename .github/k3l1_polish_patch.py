from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Persistent emitter reset includes power arc debt.
replace_once('scene.js',
"                budget.spark = 0;\n                budget.smoke = 0;",
"                budget.spark = 0;\n                budget.smoke = 0;\n                budget.arc = 0;")
# Internal penetrations briefly illuminate the struck metal; armor pings remain quiet.
replace_once('scene.js',
"    function spawnImpactParticles(position, normal, outcome) {\n        const profile = impactProfile(outcome);\n        activateParticle(sparkPool, 'spark', position, normal.clone().multiplyScalar(.18), profile.flashScale * 1.25, .085, 0, 0, profile.kind === 'power-disable' ? 0xffe199 : 0xffcf70);",
"    function spawnImpactParticles(position, normal, outcome) {\n        const profile = impactProfile(outcome);\n        if (outcome?.internalDamage > 0)\n            flashDamageLight(position, outcome.slot === 'power' ? 0xc8fff2 : 0xffb56b, outcome.slot === 'power' ? 10 : 5.5, .075, 4.6);\n        activateParticle(sparkPool, 'spark', position, normal.clone().multiplyScalar(.18), profile.flashScale * 1.25, .085, 0, 0, profile.kind === 'power-disable' ? 0xffe199 : 0xffcf70);")

# Everything materially changed in this build gets a fresh browser cache generation.
p = Path('index.html')
text = p.read_text()
for old, new in {
    '"./combat.js?v=k3l0"': '"./combat.js?v=k3l1"',
    '"./components.js?v=k2"': '"./components.js?v=k3l1"',
    '"./progression.js?v=k3l0"': '"./progression.js?v=k3l1"',
    '"./acquisition.js?v=k3l0"': '"./acquisition.js?v=k3l1"',
    '"./persistence.js?v=k3l0"': '"./persistence.js?v=k3l1"',
    '"./scene.js": "./sceneAssembly.js?v=k3l0"': '"./scene.js": "./sceneAssembly.js?v=k3l1"',
    '"./damageFate.js?v=k3l0"': '"./damageFate.js?v=k3l1"',
    '"./salvageDraft.js?v=k3l0"': '"./salvageDraft.js?v=k3l1"',
    'src="./main.js?v=k3l0"': 'src="./main.js?v=k3l1"',
    'src="./garageMountUI.js?v=k3l0"': 'src="./garageMountUI.js?v=k3l1"',
}.items():
    if old not in text:
        raise SystemExit(f'missing cache key {old}')
    text = text.replace(old, new, 1)
p.write_text(text)
print('k3l1 polish patch applied')
