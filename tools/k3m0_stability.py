from pathlib import Path

path = Path('tacticalAwareness.js')
text = path.read_text()

old = """        blockedFireSeconds: 0,
        blockedBy: null,
        repositionSide: 1,"""
new = """        blockedFireSeconds: 0,
        blockedBy: null,
        blockedLaneCommitted: false,
        repositionSide: 1,"""
if text.count(old) != 1: raise RuntimeError('blocked lane state changed')
text = text.replace(old, new, 1)

old = """    const strength = clamp(Number(severity) || 0, .25, 2.5);
    state.underFireSeconds = Math.max(state.underFireSeconds || 0, 2.35 + strength * .55);
    state.underFireElapsed = 0;
    state.urgency = Math.max(state.urgency || 0, strength);"""
new = """    const strength = clamp(Number(severity) || 0, .25, 2.5);
    const continuingPressure = (state.underFireSeconds || 0) > 0;
    state.underFireSeconds = Math.max(state.underFireSeconds || 0, 2.35 + strength * .55);
    // A burst of repeated shots is sustained pressure, not a sequence of brand-new
    // encounters. Preserve elapsed exposure so suppression eventually forces action.
    if (!continuingPressure) state.underFireElapsed = 0;
    state.urgency = Math.max(state.urgency || 0, strength);"""
if text.count(old) != 1: raise RuntimeError('incoming pressure block changed')
text = text.replace(old, new, 1)

old = """    state.blockedFireSeconds = Math.max(state.blockedFireSeconds || 0, 1.8);
    state.blockedBy = blockerId ?? state.blockedBy;
    state.repositionSide = state.repositionSide === 1 ? -1 : 1;"""
new = """    state.blockedFireSeconds = Math.max(state.blockedFireSeconds || 0, 1.8);
    state.blockedBy = blockerId ?? state.blockedBy;
    // Commit to one lane for this entire blocked-fire episode; repeated impacts on
    // the same bad lane extend the memory instead of producing left/right oscillation.
    if (!state.blockedLaneCommitted) {
        state.repositionSide = state.repositionSide === 1 ? -1 : 1;
        state.blockedLaneCommitted = true;
    }"""
if text.count(old) != 1: raise RuntimeError('blocked fire block changed')
text = text.replace(old, new, 1)

old = """    state.underFireSeconds = Math.max(0, state.underFireSeconds - dt);
    state.blockedFireSeconds = Math.max(0, state.blockedFireSeconds - dt);
    state.decisionCooldown = Math.max(0, state.decisionCooldown - dt);"""
new = """    state.underFireSeconds = Math.max(0, state.underFireSeconds - dt);
    state.blockedFireSeconds = Math.max(0, state.blockedFireSeconds - dt);
    if (state.blockedFireSeconds === 0) {
        state.blockedLaneCommitted = false;
        state.blockedBy = null;
    }
    state.decisionCooldown = Math.max(0, state.decisionCooldown - dt);"""
if text.count(old) != 1: raise RuntimeError('awareness timer block changed')
text = text.replace(old, new, 1)
path.write_text(text)

test_path = Path('tests/tacticalAwareness.test.mjs')
tests = test_path.read_text()
append = r"""

test('sustained incoming fire accumulates reaction time instead of restarting it', () => {
    const owner = { awareness: createTacticalAwareness() };
    const source = rig(0, -5);
    noteIncomingFire(owner, source, 'player', .5);
    owner.awareness.underFireElapsed = .4;
    noteIncomingFire(owner, source, 'player', .5);
    assert.equal(owner.awareness.underFireElapsed, .4);
});

test('repeated blocked shots commit to one reposition lane until memory expires', () => {
    const owner = { awareness: createTacticalAwareness() };
    noteBlockedFire(owner, 'screen');
    const first = owner.awareness.repositionSide;
    noteBlockedFire(owner, 'screen');
    assert.equal(owner.awareness.repositionSide, first);
    assert.equal(owner.awareness.blockedLaneCommitted, true);
});
"""
if "sustained incoming fire accumulates reaction time" in tests: raise RuntimeError('tests already patched')
test_path.write_text(tests + append)
