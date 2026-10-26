# M3CH4 Part Workbench — Stage 1 (Yardwalker calf)

**Repository:** production M3CH4, not M3CH4Ex.
**Entry point:** `part-workbench.html` (linked from `art-lab.html`).
**Status:** deliberately isolated authoring proof; NOT an arbitrary mech constructor.

## Goal

Make the production Yardwalker calf casing easy to change on a phone, with
controlled editable front and side silhouettes and no fabricated attachments.
The exact `buildExteriorRig` production mesh is the assembled preview,
and `buildPartVisual('legs-yard',{mode:'gameplay'})` provides isolation.

## First supported component

`legs-yard/calf-shell` recipe v1, five fixed-height cross sections.
- Front view controls mirrored cross-section **width**.
- Side view controls independent **front** and **back** surface offsets.
- A single closed low-poly, cap-ended mesh is built from both orthographic
  outlines. Both shin casings use one recipe, so they cannot silently diverge.
- Existing hip, knee, ankle, foot, actuators, chassis receiver, and structural
  shins are **not touched**. The editable mesh is parented to each production
  knee just like the previous authored shell.
- The untouched default recipe is compiled in `partWorkbenchRecipe.js`.
  Other parts and real combat systems never read draft storage.

## Using it (phone)

1. Open Part Workbench through Art Lab once this feature is deployed.
2. Tap FRONT WIDTH or SIDE DEPTH, and drag amber handles sideways.
3. Use 3D presets, one-finger rotate, or two-finger pinch to inspect the
   actual production geometry. Toggle ISOLATE LEGS / FULL MECH.
4. Switch VIEW ORIGINAL / VIEW EDIT to inspect what changed.
5. Optionally load a reference image. It remains a local transient overlay.
6. UNDO, REDO, RESTORE SHAPE, SAVE LOCAL DRAFT and EXPORT/IMPORT JSON are
   separate from the real game, Test Yard and career saves.

The editor automatically writes accepted drag edits to
`m3ch4-part-workbench-calf-v1` in this browser's localStorage.
Its recipe format is strongly validated; malformed imports are rejected.
Export to JSON to move a draft between devices.

## What this stage does NOT do

- Does not write new combat stats, collision or raycast categories, sockets,
  weapon mount standards, or career inventories.
- Does not yet deploy personal drafts to a live bout/Test Yard; that should be
  an explicit, separately reviewed integration step.
- Does not freely sculpt vertices in 3D or change joint lengths.
- Does not create arbitrary mech assemblies or auto-extract 3D geometry from
  reference images.
- Geometry envelope broad-phase and fixture contracts do not prove animated
  surface clearance. Visual articulation approval is still necessary.

## Architecture

- `partWorkbenchRecipe.js` — pure schema, bounds, transformations and closed
  profile mesh topology; independently testable with Node.
- `partWorkbenchGeometry.js` — Three.js adapter and safe dual-shin geometry swap.
- `yardwalkerVisual.js` — uses the same helper to author the stock casing.
- `partWorkbench.js`, `part-workbench.html`, `partWorkbench.css` — dev-only
  phone UI; no separate constructor logic.
- `tests/partWorkbenchRecipe.test.mjs` — validation and topology regression.

**Promotion gate:** Keep this work on a branch until the new editor and
the complete actual game pass smoke tests. Then approve one shape recipe
for inclusion as a static authored production geometry variant. Do not
silently route local draft settings into combat builds.
