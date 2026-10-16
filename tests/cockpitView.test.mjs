import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_FOLLOW_START, bodyFollowSteer } from '../controls.js';
import { combinerTetherFromLook } from '../cockpitView.js';

test('free-look moves immediately while body follow remains inside its deadzone', () => {
    const lookYaw = BODY_FOLLOW_START * 0.75;
    assert.equal(bodyFollowSteer(lookYaw), 0);
    const tether = combinerTetherFromLook(lookYaw, 0.08);
    assert.equal(tether.yaw, -lookYaw);
    assert.equal(tether.pitch, -0.08);
});

test('combiner recenters as compensated look offset approaches chassis center', () => {
    const far = combinerTetherFromLook(0.55, 0);
    const caughtUp = combinerTetherFromLook(0.12, 0);
    assert.ok(Math.abs(caughtUp.yaw) < Math.abs(far.yaw));
    assert.ok(bodyFollowSteer(0.55) < 0);
});
