from pathlib import Path

ROOT = Path('.')

# Preserve the intended k.3l.5 deadband behavior while avoiding -0 / float-bit
# brittleness in the regression assertions.
(ROOT / 'tests/cockpitView.test.mjs').write_text("""import test from 'node:test';
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
    const tether = combinerTetherFromLook(lookYaw, COMBINER_TETHER_PITCH_DEADZONE * .8);
    assert.ok(Math.abs(tether.yaw) < 1e-12);
    assert.ok(Math.abs(tether.pitch) < 1e-12);
});

test('outside the deadband the combiner moves assertively then recenters', () => {
    const lookYaw = COMBINER_TETHER_YAW_DEADZONE + .10;
    const tether = combinerTetherFromLook(lookYaw, 0);
    assert.ok(Math.abs(tether.yaw - (-.10 * COMBINER_TETHER_FOLLOW)) < 1e-12);
    assert.ok(Math.abs(combinerTetherFromLook(COMBINER_TETHER_YAW_DEADZONE + .03, 0).yaw) < Math.abs(tether.yaw));
});

test('combiner tether still saturates inside the safe windshield area', () => {
    const extreme = combinerTetherFromLook(1.2, -0.8);
    assert.equal(extreme.yaw, -COMBINER_TETHER_YAW_LIMIT);
    assert.equal(extreme.pitch, COMBINER_TETHER_PITCH_LIMIT);
});
""")

presentation = (ROOT / 'tests/combatPresentation.test.mjs').read_text()
old = 'assert.ok(SORTIE_OUTRO_SECONDS >= 2.4 && SORTIE_OUTRO_SECONDS <= 3.2);'
new = 'assert.ok(SORTIE_OUTRO_SECONDS >= 3.8 && SORTIE_OUTRO_SECONDS <= 5.0);'
if presentation.count(old) != 1:
    raise RuntimeError('combatPresentation outro expectation changed unexpectedly')
(ROOT / 'tests/combatPresentation.test.mjs').write_text(presentation.replace(old, new, 1))
