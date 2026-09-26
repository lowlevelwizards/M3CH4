# M3CH4 0.0.1k.3a — Chassis Lab Foundation

**Based on the restored, complete `lowlevelwizards/M3CH4` `main` commit `d5f4e84e9bcbc848a12cf847ddc0c4f12b4ddab9` (0.0.1k.2).** This archive is **ONLY new/changed files**, not a full playable site. Overlay it at the ROOT of your existing complete k.2 game. Keep every other file, particularly `index.html`, `main.js`, `scene.js`, `sceneAssembly.js`, `components.js`, `assemblyGraph.js`, `persistence.js`, `locomotion.js`, `enemyMotion.js`, `combat.js`, and the styles and images.

## What this intentionally small build delivers

- **`chassisDefinitions.js`** creates independent, validated read-only-in-practice preview snapshots of the existing SR-01 Bruiser, U-2 Skeleton, and W-3 Wedge chassis. Their mass, envelope, name and every actual socket's location, standard, role and load limit are COPIED from the actual current catalogue. There are no alternate physics or mounting coordinates here. It also names the eight *planned* chassis families as design goals, not unlockable equipment or fabricated performance stats.
- **`chassisVisualKit.js`** defines one consistent schematic proxy builder and physical-role-colored, size-encoded socket debug gizmos. It returns a Three.js group from an audited descriptor. Three tiny unpolished proxies show the CURRENT three frames' structural vocabulary; they are not the eight new planned frames or replacements for existing artwork. Hip bosses are illustrative; paired-leg gameplay still has exactly one functional mobility attachment.
- **`chassis-preview.html` / `chassisPreview.js`** give you a standalone mobile-friendly Chassis Lab. Change between the three real existing frames, drag to rotate, pinch or scroll to zoom, tap a generously sized socket marker to inspect its real data, or hide markers to judge the bare silhouette. There are **no legs, guns, cabs, generators or combat world** in this preview. It never reads or writes localStorage and cannot change your working game.
- **`tests/`** restores the k.1/k.2 regression test files that were in the previous patch ZIP but absent from the GitHub source tree. Adds eight new preview-data and backward-compatibility tests. Updates the existing `package.json` version without changing its `npm test` command.

## Access on GitHub Pages / local dev

After overlay, open your normal game URL and change only the *end* of the URL from `index.html` to `chassis-preview.html` (or append `/chassis-preview.html` to the site directory URL). For example, if the site is `https://USERNAME.github.io/M3CH4/`, the preview is `https://USERNAME.github.io/M3CH4/chassis-preview.html`. **This is an independent page; it is deliberately not wired into the live garage yet.** The preview uses the same pinned Three.js 0.186.0 CDN as the game, so the first load needs access to that CDN. To go back, tap **Main game** in the preview header.

## Absolute scope boundaries

- No changes to the current game's loaded HTML, imported modules, rendering, AI, arena, controls, damage, assembly graph, inventory or v1/v2/v3 save keys. No migration is necessary.
- No new playable frames, independent leg modules, new authored mount positions, fake left/right leg slots, arbitrary mounting interface, new animated gait or full visual art pass.
- The three existing frames currently have the SAME authoritative mounting coordinates despite their different artwork and load capacities. The Lab reveals this constraint instead of pretending otherwise. k.3b should author and greybox the first THREE NEW chassis-only structures (Central Hub, Twin-Rail, Structural Tub) with genuinely distinct sockets, and test against the current equipment *before* making any of them playable.
- Actual game hit meshes continue to come from unchanged `scene.js`. Chassis Lab geometry is a disposable, clearly labeled schematic preview, never injected into the real combat renderer.

## Verification and manual smoke test

1. On an overlaid complete source tree with Node 18+, run `npm test` (all restored previous suites plus the new k.3a suite). For an isolated k.3a data check, run `node --test tests/chassisDefinitions.test.mjs`.
2. Browser: open `chassis-preview.html`, confirm the three existing frame choices load, rotate, zoom and show colored socket markers. Tap each colored marker: it should display the real ID, role, size, rated capacity and XYZ. Toggle marker visibility and return to the main game.
3. Main game: verify a regular arena deployment, a garage swap, the generator outrigger, enemy pillar navigation, save/reload and returning to the garage. They should work *exactly as before*, because no production modules were changed.
4. If the preview page shows nothing, first check that the new files were uploaded next to `index.html` and that your browser can load the existing Three.js CDN. A failed preview must never affect the working game.

**Next build: k.3b** — first three NEW bare, chassis-only greyboxes with genuinely different authored mounting locations (Hub, Twin-Rail and Structural Tub). Keep them in the isolated Lab until verified for clearance and connected compatibility with the four original test modules. Resist adding finished robots, legs, production inventory and save migrations in that same build.
