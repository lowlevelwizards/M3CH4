# M3CH4 0.0.1k.3a.2 — Universal Equipment Fit Lab

**Exact source baseline:** `lowlevelwizards/M3CH4` main commit `cda928367890dfe99afa63d03417e1e347bab24a` (the complete k.2 playable game plus the k.3a.1 approved bare-chassis lab). This ZIP contains **only new or modified files**. Extract files directly into the root of the **complete** repository next to `index.html`. Do not publish or merge a patch-only branch as the entire repository; keep all unmodified source and static assets intact.

## Player-visible result

Open `https://lowlevelwizards.github.io/M3CH4/chassis-preview.html` after committing the overlay and refreshing. The three approved bare Central Hub, Twin-Rail and Structural Tub designs are **unchanged**. New BARE / ASSEMBLED buttons allow inspection of each chassis alone or with the **same four source-backed test fixtures**: Yardwalker paired legs, Cyclops cab, Dynamo G-2 generator and training cannon. They have the same mass and bounding envelope as their existing catalogue entries. They are deliberately simplified **temporary 3D maquettes** with clearly identifiable mounting faces, not copies of the live detailed scene meshes.

Assembly placement is purely computed from each concept's authored `mobility`, `command`, `power`, and `combat` socket position and outward normal, against the fixture's local mating face. There is no chassis-specific fixture offset. The pure preview math supports all 24 right-handed cardinal 3D rotations (the actual saved gameplay graph is **not** extended in this build). Face standards and roles are validated. The camera reframes and lowers the visible floor to show the assembled legs. Toggle any of the four test fixtures on/off for visual comparison; hidden parts are **still mounted and validated**, not removed. Tap a visible part or a diagnostic entry to highlight and inspect its actual source dimensions and computed connection location. Existing three-quarter/front/right/top views, socket debug gizmos and touch orbit/zoom remain.

## Actual measured findings from pure geometry fit checks

- **All three chassis** accept the four original medium-standard functional test fixtures, and all four sources' masses are below the authored **provisional** local socket limits. Total equipment mass is **2,510 kg excluding the unbalanced concept frame**. The preview deliberately cannot certify total frame load or real deployability.
- The current central mobility flange meets its paired-leg module exactly, but the visually separate hip bosses sit above the leg envelope's top by approximately **0.12 m (Hub), 0.19 m (Ladder), and 0.14 m (Tub)**. The preview correctly raises REVIEW alerts: do not silently invent adjustable guide couplers or claim all bearing points physically mate. This is an input for the next design iteration.
- On the Ladder, the cannon's full conservative bounding envelope intersects the right hip-boss envelope. This is a REVIEW, not proof that the actual meshes collide. The barrel/breech geometry should be inspected at the authored mounting pose before changing the socket.
- `chassisFitValidation.js` separates **blocking** missing/wrong/overloaded interface errors from **review** warnings for approximate envelope overlap or unbridged guide bosses. It does not claim exact irregular-mesh intersection or simulated structural stress. The Lab never auto-adjusts an incompatible placement.

## Files in the overlay

- `chassisFitFixtures.js` NEW — the four game-catalogue-backed envelope/mass/mating-face descriptors.
- `chassisFitValidation.js` NEW — pure orientation, rigid contact placement, provisional mount-load validation, AABB clearance reviews and gap reporting.
- `chassisFitVisuals.js` NEW — restrained shared-material Three.js fixture maquettes inside their true catalogue bounding envelopes, with visible steel mounting pads and optional selected envelope outline.
- `chassisFitPreview.js` NEW — isolated Three scene controller, assembled/bare modes, touch selection, visibility-only toggles and review/error/pass diagnostics.
- `chassisPreview.js` CHANGED — integrate the fit controller into the existing approved Chassis Lab, dynamically frame assembled machines and let socket picking continue working.
- `chassis-preview.html` CHANGED — touch-friendly mode switch, fixture toggles and diagnostic panels; `k3a2` browser cache revision.
- `tests/chassisFit.test.mjs` NEW and `tests/chassisFitUI.test.mjs` NEW — checks for all 12 initial connections, 24 cardinal orientations, failing interfaces, conservative warnings, isolation, a simulated fixture-model build and simulated UI interaction.
- `tests/chassisConcepts.test.mjs` CHANGED — existing preview regression expects the new k3a2 script revision.
- `tests/assemblyGraph.test.mjs`, `tests/k2Assembly.test.mjs`, and `tests/chassisDefinitions.test.mjs` RESTORED in ZIP because `main` still lacks the earlier k.3a regression test directory. They are not modifications to the live systems.
- `K3A2_NOTES.md` NEW — this file.

No change to game `index.html`, `main.js`, `scene.js`, `sceneAssembly.js`, `components.js`, `assemblyGraph.js`, `persistence.js`, enemy AI, controls, factory catalogue or player-owned serials. No new owned frames or save-format changes. The extra design-only concept front/left hardpoints are still not live equipment stations.

## Testing and practical limits

The 12 prior bare-chassis tests, eight earlier Chassis Lab definition tests, and 17 new pure/simulated fit/UI checks run directly against the locally reconstructed source snapshot (37 tests; no test failures). The older 16 graph and 12 k.2 save/assembly tests were restored as source files but require the unmodified full game modules that are already on GitHub `main`; run `npm test` once you have overlaid this ZIP into the **full** checkout. The current execution container lacks a network-accessible copy of CDN-hosted Three.js, so it has **not** undergone a complete actual WebGL/iPhone Safari playthrough. A source-builder simulation is not a claim of visual approval.

## Mobile review checklist

1. Verify the normal arena/garage and old saves still load. They do not import any new file in this patch.
2. Open `chassis-preview.html`, confirm it initially shows the Hub with **BARE** active. Select Ladder and Tub; their approved bare meshes must remain unchanged.
3. Tap **ASSEMBLED**. Confirm the same four recognizable modules attach to each chassis at different physical positions. Change front/right/top/three-quarter views, drag and pinch. Check the grid now sits below the feet.
4. Toggle each fixture visibility separately. The diagnostic mount counts should **not** change when a fixture is hidden. Tap an installed visible component to show its real envelope, catalog mass, contact point and warnings.
5. Review the hip-boss connection gaps on all frames and the Ladder right-hip/gun clearance warning **before** committing to actual detailed geometry or live integration.
6. Optionally enable socket markers: rings should remain directly over the real metal mounting faces. They are independent of the fitting maquettes.

**Protected follow-up (k.3a.3 or k.3b):** only after screenshots, adjust real hip guide/adapter geometry and test the Hauler H2 adapter and existing generator outrigger in the same isolated lab. Then integrate **one** approved chassis into the actual saved graph and live damage/picking/aiming system. Do not create the remaining five frames or extend locomotion before this physical fit review.
