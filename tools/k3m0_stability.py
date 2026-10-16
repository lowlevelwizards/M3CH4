from pathlib import Path

path = Path('tacticalAwareness.js')
text = path.read_text()
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
new = """    const continuingBlock = (state.blockedFireSeconds || 0) > 0;
    state.blockedFireSeconds = Math.max(state.blockedFireSeconds || 0, 1.8);
    state.blockedBy = blockerId ?? state.blockedBy;
    // Commit to the chosen lane for the lifetime of this blocked-fire memory; do not
    // ping-pong left/right every time another round strikes the same obstruction.
    if (!continuingBlock) state.repositionSide = state.repositionSide === 1 ? -1 : 1;"""
if text.count(old) != 1: raise RuntimeError('blocked fire block changed')
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
});
"""
if "sustained incoming fire accumulates reaction time" in tests: raise RuntimeError('tests already patched')
test_path.write_text(tests + append)
