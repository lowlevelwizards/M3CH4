import test from 'node:test';
import assert from 'node:assert/strict';
import { muzzleRayFallsShort } from '../barrelAimObstruction.js';

test('crosshair on a wall or floor is clear when the muzzle reaches that surface', () => {
    assert.equal(muzzleRayFallsShort(12,12,true), false);
    assert.equal(muzzleRayFallsShort(12,11.83,true), false);
});
test('camera sight clear over a near barricade but low barrel collides: blocked', () => {
    assert.equal(muzzleRayFallsShort(16,3.2,true), true);
});
test('muzzle around the corner can reach the sighted point: not blocked', () => {
    assert.equal(muzzleRayFallsShort(16,16.01,true), false);
});
test('ally in front of the intended point blocks; aiming directly at an ally does not', () => {
    assert.equal(muzzleRayFallsShort(15,5,true), true);
    assert.equal(muzzleRayFallsShort(5,4.8,true), false);
});
test('open air with no barrel collision never gives a spurious warning', () => {
    assert.equal(muzzleRayFallsShort(100,100,false), false);
    assert.equal(muzzleRayFallsShort(102,100,false), false);
});
test('only meaningful shortfall counts; strikes beyond sighted point do not', () => {
    assert.equal(muzzleRayFallsShort(12,11.6,true), false);
    assert.equal(muzzleRayFallsShort(12,11.5,true), true);
    assert.equal(muzzleRayFallsShort(12,14,true), false);
});
test('missing or non-finite trace distances fail closed without false warning', () => {
    assert.equal(muzzleRayFallsShort(NaN,2,true),false);
    assert.equal(muzzleRayFallsShort(12,Infinity,true),false);
});
