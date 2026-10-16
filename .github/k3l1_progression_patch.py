from pathlib import Path

p = Path('progression.js')
text = p.read_text()
if "MACHINE_PROGRESS_V8_KEY" in text:
    raise SystemExit(0)
replacements = [
    ("export const MACHINE_PROGRESS_V7_KEY = 'mech-arena-machine-v7';", "export const MACHINE_PROGRESS_V8_KEY = 'mech-arena-machine-v8';\nexport const MACHINE_PROGRESS_V7_KEY = 'mech-arena-machine-v7';"),
    ("        const current = storage.getItem(MACHINE_PROGRESS_V7_KEY);\n        if (current) {\n            const data = JSON.parse(current);\n            if (data?.version === 7 && data.progression)\n                return createProgressionState(data.progression);\n        }",
     "        const current = storage.getItem(MACHINE_PROGRESS_V8_KEY);\n        if (current) {\n            const data = JSON.parse(current);\n            if (data?.version === 8 && data.progression)\n                return createProgressionState(data.progression);\n        }\n        const v7 = storage.getItem(MACHINE_PROGRESS_V7_KEY);\n        if (v7) {\n            const data = JSON.parse(v7);\n            if (data?.version === 7 && data.progression)\n                return createProgressionState(data.progression);\n        }"),
    ("        const raw = storage.getItem(MACHINE_PROGRESS_V7_KEY);\n        if (!raw) return false;\n        const data = JSON.parse(raw);\n        if (data?.version !== 7) return false;",
     "        const key = storage.getItem(MACHINE_PROGRESS_V8_KEY) ? MACHINE_PROGRESS_V8_KEY : MACHINE_PROGRESS_V7_KEY;\n        const raw = storage.getItem(key);\n        if (!raw) return false;\n        const data = JSON.parse(raw);\n        if (![7, 8].includes(data?.version)) return false;"),
    ("        storage.setItem(MACHINE_PROGRESS_V7_KEY, JSON.stringify(data));", "        storage.setItem(key, JSON.stringify(data));"),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'missing progression pattern: {old[:100]!r}')
    text = text.replace(old, new, 1)
p.write_text(text)
