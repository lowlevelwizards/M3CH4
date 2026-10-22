import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, shotSpread, applyRecoil } from '../combat.js';
import { createRigState } from '../locomotion.js';
import { makeTestAssembly } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { patternAtRange } from '../research/scattergunStudy.mjs';

test('weapon trial baseline remains frozen until actual first-hit evidence justifies a change',()=>{
    assert.equal(WEAPONS['gun-cannon'].spread,.004);
    assert.equal(WEAPONS['gun-cannon'].recoilImpulseNs,1725);
    assert.equal(WEAPONS['gun-scatter'].damage,21);
    assert.equal(WEAPONS['gun-scatter'].pellets,6);
    const oldShot=shotSpread(16,.004);
    const trial=shotSpread(16,.0033);
    assert.ok(Math.hypot(...trial)<Math.hypot(...oldShot));
    const config=deriveRigConfig(makeTestAssembly());
    const old=createRigState(),next=createRigState();
    applyRecoil(old,config,0,-1,1725);
    applyRecoil(next,config,0,-1,1550);
    assert.ok(Math.hypot(next.vx,next.vz)<Math.hypot(old.vx,old.vz));
    assert.ok(patternAtRange(4).pelletHits>patternAtRange(28).pelletHits);
});
test('weapon trial IDs cannot be mistaken for purchasable physical part definitions',()=>{
    assert.equal(WEAPONS['gun-cannon:spread-0033'],undefined);
    assert.equal(WEAPONS['gun-scatter:18'],undefined);
    assert.equal(WEAPONS['gun-scatter:16'],undefined);
});
