import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_FOLLOW_START, bodyFollowSteer } from '../controls.js';
import { COMBINER_TETHER_FOLLOW, COMBINER_TETHER_PITCH_LIMIT, COMBINER_TETHER_YAW_LIMIT, combinerTetherFromLook } from '../cockpitView.js';

test('free-look moves immediately while body follow remains inside its deadzone', () => {
    const lookYaw = BODY_FOLLOW_START * 0.75;
    assert.equal(bodyFollowSteer(lookYaw), 0);
    const tether = combinerTetherFromLook(lookYaw, 0.08);
    assert.equal(tether.yaw, Math.max(-COMBINER_TETHER_YAW_LIMIT, Math.min(COMBINER_TETHER_YAW_LIMIT, -lookYaw * COMBINER_TETHER_FOLLOW)));
    assert.equal(tether.pitch, -0.08 * COMBINER_TETHER_FOLLOW);
});

test('combiner recenters as compensated look offset approaches chassis center', () => {
    const far = combinerTetherFromLook(0.55, 0);
    const caughtUp = combinerTetherFromLook(0.12, 0);
    assert.ok(Math.abs(caughtUp.yaw) < Math.abs(far.yaw));
    assert.ok(bodyFollowSteer(0.55) < 0);
});


test('combiner tether saturates before critical readouts can leave the safe windshield area', () => {
    const extreme = combinerTetherFromLook(1.2, -0.8);
    assert.equal(extreme.yaw, -COMBINER_TETHER_YAW_LIMIT);
    assert.equal(extreme.pitch, COMBINER_TETHER_PITCH_LIMIT);
});
