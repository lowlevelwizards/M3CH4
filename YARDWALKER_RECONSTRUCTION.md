# Yardwalker clean anatomy / four-tier reconstruction

**Art target:** 2026-10-27 approved simplified Yardwalker lineup. Fewer,
bigger purposeful mechanical shapes; a wide mustard carriage, clear fixed
hip yokes, one tapered main thigh spar, one rigid same-link strut, one orange
knee hinge, one tapered olive shin, and integrated flat work boots.

## Single source of truth

- `yardwalker-design/master.json`: the canonical geometry, immutable original
  rest-pose joint positions, and 8 joint-parented armor identities.
- `yardwalkerDesignData.js`: generated ES module for browsers (to avoid JSON
  import-assertion compatibility); **do not edit by hand**.
- `yardwalkerWorkbenchExport.js` plus `research/exportYardwalkerDesign.mjs`:
  create/verify four independently editable Workbench V2 JSON assets.
- `yardwalkerVisual.js`: production builder reads the same shape descriptions
  and compiles them under the existing named hip, knee, ankle, foot groups.
  It is still the normal `legs-yard` shared factory model in gameplay.

Run:

```sh
node research/exportYardwalkerDesign.mjs
node research/exportYardwalkerDesign.mjs --check
node --test tests/yardwalkerRedesign.test.mjs
```

## Workbench imports

Use Workbench V2/V3 **Library > Import Part JSON** and choose:

- `workbench-assets/yardwalker/yardwalker-00-naked.asset.json`
- `workbench-assets/yardwalker/yardwalker-01-guarded.asset.json`
- `workbench-assets/yardwalker/yardwalker-02-heavy.asset.json`
- `workbench-assets/yardwalker/yardwalker-03-encased.asset.json`

These have consistent anchor/group identities and local transforms. Editable
anchor metadata alone **does not animate** inside a generic Workbench preview;
the real game restores `userData.joint` and side in its builder. Do not
replace the animated production model with a flattened Workbench mesh.

The original V1 calf-only recipe tool is retained as a legacy archive
and clearly marked as such. Current production shin geometry is authored in
the shared master JSON; V1 edits no longer affect it.

## Anatomy and deliberate simplification

The Naked core consists of 38 large shapes across both articulated legs.
Each thigh and shin now has just one primary tapered load-bearing component,
a distinct knee bearing and broad, integrated work boot. The hydraulic-look
pressure cylinder and rod have two simple attachment lugs and are attached to the same moving upper-leg assembly;
they are not a simulated piston crossing two moving joints. Thus they cannot
pop apart under the existing game's IK, and no fake physics is introduced.

Configured shapes: 38 / 42 / 44 / 46 (tiers 0 / 1 / 2 / 3).
Armor identities: 0 / 4 / 6 / 8, with stronger tier geometry **replacing**
earlier shell profiles. Parent carriage for stationary hip guards, moving
hip for thigh armor, moving knee for shin and calf coverage. The joints
remain visually exposed and move freely.

Fixed catalogue identity: `legs-yard`, U1 mounting face at `[0,.825,0]`,
2 × 1.65 × 1.18 m envelope, 1,240 kg base mass. Existing mobility physics,
per-leg damage, foot contacts, gait, pilot control and career saves are
unchanged. Armor Lab masses are dev-only proposals.

## Review gates before merge

- Full deterministic JSON diff regeneration: no drift.
- All currently authored core nodes remain identical across tiers.
- Real Three.js source and all variants fit the neutral catalogue envelope.
- Walking, reverse step, strafe, compression do not break joint-parenting.
- Real browser screenshot artifacts: front / side of four tiers, gait shot.
- Actual garage and arena test with every frame family, and phone viewport
  review for leg-silhouette readability.
- Confirm hit ownership and no new accidental raycast blockers.
- Deliberate visual review against concept. Merge only once acceptable.

No feet-kit, new inventory part, serialized live armor durability,
replacement vehicle dynamics or advanced suspension is part of this change.
