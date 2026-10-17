from pathlib import Path

path = Path('squadCoordination.js')
text = path.read_text()
old = """    const focus = objectivePoint ?? targetRig;
    const dx = targetRig.x - focus.x, dz = targetRig.z - focus.z;
    const length = Math.max(.001, Math.hypot(dx, dz));"""
new = """    const focus = objectivePoint ?? targetRig;
    // Without an objective the target itself is the focus, so deriving the axis
    // from focus -> target collapses to zero and turns FLANK/PRESSURE into a beeline.
    // Use the squad centre (or self when alone) as the tactical reference instead.
    const reference = objectivePoint ?? allyCenter ?? self;
    const dx = targetRig.x - reference.x, dz = targetRig.z - reference.z;
    const length = Math.max(.001, Math.hypot(dx, dz));"""
if old not in text:
    raise SystemExit('flank-axis anchor missing')
path.write_text(text.replace(old, new, 1))

# Strengthen the new regression so a future refactor cannot silently collapse
# a flanker onto the target point again.
test_path = Path('tests/combatDepth.test.mjs')
test = test_path.read_text()
old_test = """  assert.equal(squadIntent(isolated, [isolated, allyA, allyB], target).mode, 'REGROUP');
});"""
new_test = """  assert.equal(squadIntent(isolated, [isolated, allyA, allyB], target).mode, 'REGROUP');
  const flanker = actor('wing', 'friendly', flank, 2, 8);
  const flankPlan = squadIntent(flanker, [flanker, allyA, allyB], target);
  assert.equal(flankPlan.mode, 'FLANK');
  assert.ok(Math.hypot(flankPlan.point.x - target.rig.x, flankPlan.point.z - target.rig.z) > 2.5);
});"""
if old_test not in test:
    raise SystemExit('combat-depth flank regression anchor missing')
test_path.write_text(test.replace(old_test, new_test, 1))
