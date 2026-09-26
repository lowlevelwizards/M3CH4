# M3CH4 0.0.1k.2 — First Real Assembly

**Changed/new files only**: overlay on the complete `0.0.1j.2 + 0.0.1k.1` project. Do NOT deploy this partial ZIP alone, and do not delete unchanged files.

Select **GARAGE → POWER** to move the existing generator between **REAR / DIRECT** and **LEFT OUTRIGGER / +85 KG**. This is a real nested structural mount: the physical generator model, hittable meshes, combat aim and persistent graph follow its new position. Heavy mobility's independent H2 adapter is still supported. Unsafe swaps and removal now show garage errors, and frame-less saves can reopen in the garage.

The new v3 save uses a **separate** localStorage key; the original v1/v2 key is preserved for rollback. Read `K2_NOTES.md` for migration, scope limitations and mobile smoke-test steps. Run `npm test` from your full project directory after overlay.
