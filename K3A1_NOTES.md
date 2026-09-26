# M3CH4 k.3a.1 — Three Bare Structural Chassis (Chassis Lab Repair)

**Exact baseline:** `lowlevelwizards/M3CH4` `main` at commit `93cb7d87689641bdefd71f65bf8d93da8893b9d4` (k.3a Chassis Lab on top of the complete k.2 game). This archive contains ONLY additions/replacements. It is not a complete website. Do not create a patch-only branch and merge it over `main`; that previously deleted the working project files.

## Install

Overlay the ZIP entries onto the ROOT of the **complete existing GitHub source**, next to `index.html`. Commit the actual extracted files and the `tests/` directory, not the ZIP in place of the source. Keep every unchanged game file. Your normal game URL and save data are unaffected. Open `https://lowlevelwizards.github.io/M3CH4/chassis-preview.html` and force-refresh if an old cached page still displays the SR-01/U-2/W-3 baseline placeholders. The standalone lab has a new `k3a1` module revision.

## Precisely what was built

- **`chassisConcepts.js` — NEW.** Three independent, fully named design-only definitions: Central Hub (H1–H10), Twin-Rail (L1–L13) and Structural Tub (T1–T14). Each structural member records its exact center, size, geometric form and mechanical purpose. Each concept has a distinctly authored mobility/command/power/combat layout and optional additional structural pads. Socket data includes its exact real supporting member, contact face, normal, mounting standard and clearly PROVISIONAL capacity. Geometry continuity validation rejects unconnected structural pieces and socket centers that do not actually land on the specified support face. Game mass, frame load and economy are deliberately NOT invented.
- **`chassisConceptBuilder.js` — NEW.** Low-complexity procedural Three.js representation of those named members. One consistent dark steel / exposed machined / mustard paint / muted teal structural shell palette. Two visually supported open hip bosses per frame but exactly ONE existing paired-mobility functional mount. Each authored socket draws a small real dark/steel empty flange, even with debug disabled. No legs, cockpit, generator, gun, armor package, random decorative greeble, or finished mech anywhere in the models.
- **`chassisVisualKit.js` — REPLACED.** Deleted the earlier three arbitrary schematic block/wedge proxy builders. Only small toggleable debug rings remain. The rings sit 2.7 cm above the ACTUAL mounting face and orient to its outward normal; their enlarged invisible picking regions make the UI usable by touch. Colored overlays do not masquerade as physical structure.
- **`chassisPreview.js` / `chassis-preview.html` — REPLACED.** The lab now opens on the new Central Hub, with the Ladder and Tub as the other options. Socket overlays are OFF by default so you can judge the bare structural silhouette. Use three-quarter/front/right/top camera presets, drag to orbit, pinch/scroll to zoom, and tap a debug ring to see exactly which physical member supports it and why. Added a world-space orientation arrow for -Z front. The legacy playable frames are unchanged but are no longer shown as ugly schematic stand-ins in this preview.
- **`tests/` — NEW relative to current GitHub `main`.** Restored the three k.3a/k.2/k.1 regression test files that were in the previous k.3a ZIP but not committed to the repository, and added `chassisConcepts.test.mjs` (12 new data, geometry-continuity, simulator and preview-scoping tests). The existing `package.json` `npm test` glob now picks them up once the tests folder is committed.

## Mounting / gameplay boundaries

These are **independently authored preview shapes and socket locations**. They do not overwrite live `components.js` definitions, do not change real `assemblyGraph.js` layout, do not add parts to player inventory, and never call the garage/saves. The existing SR-01 Bruiser, U-2 Skeleton and W-3 Wedge, locomotion controllers (including H2 adapter), existing generator bracket and its damage/aiming, all arena code, enemy navigation, controls, and persistence remain completely untouched. The concept mobility socket is single and medium to match current paired-leg gameplay; the two visible hip bosses are deliberately NOT independent sockets. The new design study's additional front/left hardpoints are not yet operational equipment slots.

The exact currently authored concept socket locations intentionally differ from the live game. A later build must test installed module envelopes, clearance, parent-child graph layout, side-mounted gun muzzle, camera focus, hostile aim and local damage position before any new frame is introduced to owned inventory. Real frame mass, structural ratings, purchase cost and painted finish are still to be decided. Provisional concept socket ratings do NOT change live balancing.

## Verification

- `node --test tests/chassisConcepts.test.mjs`: all 12 new tests pass. They validate named load-bearing pieces, exact supported socket contact faces, one functional paired-mobility socket plus two visible hip bosses, different mount coordinates, prototype load figures, negative cases for floating/disconnected members, HTML isolation and a simulation of the actual Three scene builder using a minimal test stub.
- `node --check` on all new and replaced JS modules; HTML import-map parses as JSON; changed-file-only ZIP integrity verified before delivery.
- The 3 previously shipped regression suites are restored as source files; on a **complete repo checkout** run `npm test` to run all suites together. A real CDN-backed WebGL/iPhone Safari playthrough has NOT been executed here. The isolated simulated renderer is not a substitute for judging a real render.

## Mobile acceptance checks

1. Open `chassis-preview.html` and check all three choices appear; the old crude three *live frame proxies* should not be the default or available selection.
2. With debug rings OFF, inspect Hub (one compact primary center and short, structurally connected hip-to-core cross-saddle); Ladder (uninterrupted left/right LONG rails, three transverse crossmembers, open space between); Tub (joined belly, contiguous sidewalls and two end bulkheads — deliberately no hidden ladder chassis).
3. Tap Front, Right and Top. Look for unsupported floating members or ambiguous orientation. No legs/arms/cab/generator/weapons should be drawn.
4. Turn socket overlays ON; each color ring must sit on an actual metal mounting face. Tap ring and check its named support, XYZ, normal and PROVISIONAL rating; turn overlays OFF without losing any physical mounting hardware.
5. Return to the normal game. Deploy, move, aim/fire, inspect, switch generator bracket location, reload old save. Everything should behave as before because none of these live modules are in the patch.

**Next build only after screenshot review:** revise greybox dimensions and/or test the same temporary EMPTY-module envelopes against all three newly authored layouts, then integrate ONE approved frame into the live assembly graph and real renderer with an explicit persistent-inventory migration. Do not batch-add all eight structural families or new locomotion to this proof.
