# M3CH4 0.0.1k.3a.6 — Nine-Combination Assembly Audit

**This ZIP contains only new or changed files.** Overlay it on the complete
repository **after k.3a.5 (Hauler H2)**. Do not replace the repo with this ZIP.
The patch is based on `lowlevelwizards/M3CH4` main at commit
`2ace1b6ca86f4ac65515a183a3a71e4de587cc19` (2026-09-27).

## Open it

GitHub Pages: `https://lowlevelwizards.github.io/M3CH4/chassis-audit.html`

The existing `chassis-preview.html` page now also has an `OPEN 3×3 FIT AUDIT` link.
The original Lab is otherwise unchanged. Click one of the nine machines to enter
focused inspection; `All nine` returns to the matrix. All thumbnails use the
**same camera direction and vertical scale**. Camera presets: 3/4, front, right,
top. `Structural study` hides the three common test fixtures without changing
any measured data. Tap a diagnostic to mark the involved mounting face or
mechanical member. `COPY NINE-CASE REPORT` copies the text version.

## Implemented

- A new isolated, one-WebGL-renderer nine-machine comparison page. Rendering is
  on demand (one context with scissored tiles), not nine independent canvases.
- Pure `chassisAudit.js`: same Cyclops cab, Dynamo power pack and training cannon
  on each of the three existing frames × each of the three engineered leg modules.
- World-space ground alignment from the ACTUAL authored foot positions and
  dimensions, equal-scale grid, structural ground clearance, hip separation,
  foot support footprint and assembled height.
- Checks unchanged fit-contract data: four socket mating faces, provisional
  local capacities, both computed guide lengths, source equipment masses and
  the explicit 110 kg H2/U1 Hauler adapter (counted **once**).
- A more selective *member-level proximity study* samples the major moving
  thigh/shin/actuator centerlines against authored structural volumes and the
  recognisable modeled cab, generator and cannon blocks. This is NOT polygon
  collision, active walking-clearance validation or a force/stability solver.
- A per-configuration inspection panel and annotated findings. Existing broad
  bounding-envelope warnings remain visible rather than being misrepresented
  as demonstrated metal-on-metal collisions.
- An independently generated `K3A6_AUDIT_REPORT.txt` is included so the nine
  measurements can be inspected without opening the browser.
- Restores four earlier focused Chassis Lab regression test files that are
  still absent from repository `main`, alongside two new audit test files.

## Findings that must NOT be auto-corrected

- Every authored frame/module combination passes the existing four functional
  socket placements with the provisional preview socket load limits.
- All pairs of rest-pose feet are level and have positive chassis underside
  clearance. This says **nothing** about the actual future gait/stability.
- All six standard modules and three Hauler versions still use two PROVISIONAL,
  unrated frame-side guide brackets. Their calculated lengths vary by frame;
  their strength, installed mass and swept clearance are not validated.
- All three Twin-Rail combinations retain the existing **cannon envelope versus
  right hip boss** broad-phase warning. No modeled moving-link collision is
  detected from the authored rest-pose proxies, but that does **not** clear
  the real cannon/hip meshes or aiming/recoil movement.
- **New specific defect uncovered:** Hauler's authored top-pad geometry ends
  10 mm below its declared upper mounting datum on all three frames. The
  preview already declares the faces compatible by role and nominal position,
  but the actual metal pad still requires a 10 mm geometry correction or an
  explicitly modeled spacer before it can be treated as a flush bolted joint.

## Strict scope

No edits to `components.js`, `mobilityDefinitions.js`, existing model builders,
production scene, main.js, locomotion, combat, garage, graph, balancing, owned
items or save formats. No new playable parts, frames, joints, adapters or
animations. All concept chassis masses remain **unspecified**; equipment totals
exclude the unknown frame/guide mass.

## Tests and smoke check

Run from the *full* repository (which includes `package.json`, `combat.js` and
`functionalDamage.js`):

```
node --test tests/chassisConcepts.test.mjs tests/chassisFit.test.mjs tests/chassisFitUI.test.mjs tests/mobilityYardwalker.test.mjs tests/chassisAudit.test.mjs tests/chassisAuditUI.test.mjs
```

For a quick phone check: open the audit page on GitHub Pages; inspect all nine
at the same 3/4 scale, change to front and side, tap Hauler on Twin-Rail,
open its adapter-pad-gap warning, and return to the original Lab and main game.
Browser/iPhone WebGL rendering was not verified in the container.

Next build after visual approval: repair the specific Hauler 10 mm adapter
contact, then conduct the first minimal *playable* frame+leg art integration
without changing existing gameplay or saved machine IDs.
