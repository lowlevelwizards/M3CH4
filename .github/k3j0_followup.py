from pathlib import Path

p = Path('main.js')
text = p.read_text()
old = """    controls.setEnabled(false);
    stopFireInput();
}"""
new = """    controls.setEnabled(false);
    stopFireInput();
    stopFieldServiceInput();
}"""
if old in text:
    text = text.replace(old, new, 1)

old = """    if (event.code === 'KeyR' && weaponState && weaponSpec && !event.repeat) {
        if (canFieldService(playerCondition, fieldService)) {"""
new = """    if (event.code === 'KeyR' && weaponState && weaponSpec && !event.repeat) {
        if (!inspecting && !testEnded && canFieldService(playerCondition, fieldService)) {"""
if old in text:
    text = text.replace(old, new, 1)

p.write_text(text)
print('applied k.3j.0 input safety follow-up')
