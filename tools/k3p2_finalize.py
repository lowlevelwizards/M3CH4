from pathlib import Path
p = Path('main.js')
s = p.read_text()
old = "function applyAiHitToPlayer(actor, contact) {\n    stopFieldServiceInput();\n    const partBefore = playerCondition.parts[contact.slot];"
new = "function applyAiHitToPlayer(actor, contact) {\n    const serviceInterruptedByHit = fieldService.held;\n    stopFieldServiceInput();\n    if (serviceInterruptedByHit) handleFieldServiceInterrupted();\n    const partBefore = playerCondition.parts[contact.slot];"
if old not in s:
    raise SystemExit('applyAiHitToPlayer interruption anchor not found')
p.write_text(s.replace(old, new, 1))

t = Path('tests/k3p2RecoveryReadability.test.mjs')
ts = t.read_text()
anchor = "    assert.match(main, /WEAPON RECOVERY: FIELD SERVICE/);\n"
insert = "    assert.match(main, /serviceInterruptedByHit = fieldService\\.held/);\n    assert.match(main, /if \\(serviceInterruptedByHit\\) handleFieldServiceInterrupted\\(\\)/);\n"
if anchor not in ts:
    raise SystemExit('test anchor not found')
t.write_text(ts.replace(anchor, anchor + insert, 1))
print('k.3p.2 hit interruption finalized')
