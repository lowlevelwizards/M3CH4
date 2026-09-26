# M3CH4 0.0.1k.1 — Universal Assembly Foundation, compatible with 0.0.1j.2

**INSTALL THIS REVISED PATCH, NOT THE ORIGINAL j.1-TARGETED STAGE 1 ZIP.** This ZIP is a changed/new-files-only overlay for the **complete** `0.0.1j.2 — Spatial Awareness` deployment. Do not deploy it onto an empty directory or first overlay the old Stage 1 `index.html`. Preserve all files not included here.

## Verified source and the j.2 merge

Audited against GitHub `lowlevelwizards/M3CH4`, `main` at commit `4b3ab2cdae81bd8d2f96129b5b34eccebb93e144` (`0.0.1j.2`). This release adds collision-aware enemy navigation, pillar collisions, obstacle avoidance, recovery, navigation diagnostics and a waypoint marker. **Do not overwrite** its `main.js`, `scene.js`, `enemyMotion.js` or `locomotion.js` with older files.

The two Stage 1 replacement modules have *exactly the same predecessor files* in j.2 and j.1:

- Original j.2 `components.js` Git blob: `0b8ccb1ae0ce641ef179064eb84367dba663ecff`.
- Original j.2 `persistence.js` Git blob: `23f8b0570743d3a0ba079bb4f0bb49368979c4c0`.

Original Stage 1's `index.html` was NOT safe to overlay onto j.2: it reverted the main, scene, enemy-motion and locomotion cache revisions to j.1. This corrected file was derived from the **byte-verified original j.2** `index.html` (Git blob `95ac89bcf31c80f511c8051dc1ba65f46d5ec577`), preserving `main.js?v=j2`, `scene.js?v=j2`, `enemyMotion.js?v=j2` and `locomotion.js?v=j2` while adding mappings for `components.js?v=k1`, `persistence.js?v=k1` and new `assemblyGraph.js?v=k1`. The original Three.js version and other asset references remain intact.

## What Stage 1 changes

- `assemblyGraph.js` introduces rooted socket-based structural attachment data with light/medium/heavy standards, stable part serials, parent-child attachment, nested adapters, yaw-quarter-turn transform composition and graph/load validation. It is data-only and does not change j.2 navigation or render transforms.
- `components.js` keeps the five legacy `installed` stations and all existing catalog IDs, owned serials and mechanical statistics as the compatibility projection. Garage swaps validate the new graph before committing. The pre-existing 110 kg H2 hip adapter is now an explicit virtual child node; its mass is counted once.
- `persistence.js` retains localStorage key `mech-arena-machine-v1`; it reads old j.2/v1 saves, migrates to v2 graph data in memory, and preserves owned identity, condition, wear, repairs, acute drive faults, armor/integrity, impacts and shot count. The first later save writes v2 to the same key. Old j.2 cannot read the v2 payload. **Back up your save before installation if you need rollback.** Do not clear Safari site data or change hosting origin.
- `index.html` is merged from actual j.2 instead of the older j.1 index. No j.2 opponent AI, locomotion, arena scene, controls or damage file is replaced.
- `package.json` and `tests/assemblyGraph.test.mjs` supply optional Node 18+ validation in the full overlaid directory (`npm test`). They are not required by the browser.

## Compatibility checks and results

1. j.2 source audit: j.2 changes `main.js`, `scene.js`, `enemyMotion.js`, `locomotion.js`, `index.html`, docs; `components.js` and `persistence.js` are unchanged from j.1. The j.2 imports from components and persistence match the replacement exports; j.2 enemy motion still gets `DEFAULT_WORLD` from j.2 locomotion and the scene still implements `updateHostileNavigation` called by j.2 main.
2. The corrected `index.html` differs from verified j.2 only by the three Stage 1 import-map additions/changes and the updated title. The original j.2 index can be reproduced exactly by reversing those changes.
3. Stage 1's **16 targeted tests pass** when overlaid with the actual GitHub j.2 `combat.js` and `functionalDamage.js` (both independently verified by Git blob SHA). The suite covers v1 migration, v2 roundtrip, structural validation, preservation of equipment and damage and all **162** legacy catalog combinations.
4. The j.2 changed scene, movement and opponent code are deliberately left untouched. A full interactive iPhone/browser playthrough was **not** performed; manually smoke-test the deployment as listed below.

## Installation and mobile smoke test

Overlay the ZIP files on your already-complete j.2 website; retain all other j.2 and earlier files, especially `main.js`, `scene.js`, `locomotion.js`, `enemyMotion.js`, `combat.js`, `functionalDamage.js`, `controls.js`, styles and asset files. Keep the same site origin. Refresh the hosted page rather than loading an old cached tab. In a complete local repo, optionally run `npm test`.

On the phone: (1) confirm the garage and existing saved parts/conditions show correctly; (2) equip each existing leg set, including the 110 kg H2 adapter, and inspect mass/power; (3) deploy, move, shoot, receive damage, repair and return to garage; (4) confirm the j.2 hostile rig avoids pillars/obstacles and its waypoint marker appears with COLLIDERS; (5) reload the page and verify the same saved serials and condition remain. An old v1 save should silently migrate in memory, then write v2 when the next save occurs.

## Scope limits / caveats

The j.2 3D renderer still uses the old five fixed visual mount positions. Stage 1 establishes a genuine validated *data* graph; it does not yet render arbitrary nested nodes, add new parts, change gait controls or expose direct socket manipulation. The legacy UI may appear to ignore an attempt to remove a parent that still supports children; removal is safely rejected, but the unchanged j.2 garage does not yet show a dedicated on-screen error toast. A legacy save with the primary frame intentionally removed migrates safely in data, but unchanged j.2 `main.js` still expects the rig to be deployable on startup (pre-existing behavior). These are next-build integration priorities, not proof of a completed universal UI.

**Next build:** have the actual 3D scene consume the graph's mounting hierarchy, expose failed attachment/removal reasons in the mobile garage, and validate a visually distinct second core with interchangeable mobility and weapons while retaining the j.2 enemy navigation.
