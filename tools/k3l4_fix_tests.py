from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'tests/cockpitView.test.mjs',
    "    assert.equal(tether.yaw, -lookYaw * COMBINER_TETHER_FOLLOW);",
    "    assert.equal(tether.yaw, Math.max(-COMBINER_TETHER_YAW_LIMIT, Math.min(COMBINER_TETHER_YAW_LIMIT, -lookYaw * COMBINER_TETHER_FOLLOW)));",
)
replace_once(
    'tests/k3l4Polish.test.mjs',
    "  assert.match(acquisition, /setGarageAction\\('CLAIM SECURED'/);",
    "  assert.match(acquisition, /setGarageAction\\(playerClaimed \\? 'CLAIM SECURED'/);",
)
