# M3CH4 0.0.1k.2 — First Real Assembly (scope-protected)

**Base:** `lowlevelwizards/M3CH4` main at Git commit `8d430596341559a9636a9906d155976ac5d32c56` — the complete 0.0.1j.2 Spatial Awareness build **with** the Stage 1 k.1 assembly patch already applied. This is a **changed/new-files-only ZIP**, NOT an entire playable site. Overlay its files on your existing complete project while keeping every unchanged file. Preserve the original `scene.js`, `main.js`, `locomotion.js`, `enemyMotion.js`, `combat.js`, `functionalDamage.js`, and all static assets.

## Actual player-visible change

In GARAGE, select POWER. Below the generator's current condition, choose **REAR / DIRECT** or **LEFT OUTRIGGER / +85 KG**. This moves the very same owned generator and its existing hit meshes to a real nested graph mount, adds an identifiable bracket to the mech, updates its mass, and runs the original j.2 garage's scene/physics/damage/save refresh. Select rear again to reverse the move. The bracket has an 800 kg parent socket, a 700 kg output, and 85 kg of physical mass; it cannot magically support unlimited equipment.

The generator's actual mesh follows the graph-composed location, so incoming fire and inspection picking use its relocated physical position. Camera inspection focus and the hostile's power-system aim use that location too. The original j.2 opponent navigation, warehouse pillars, controls, combat logic, damage mechanics and enemy scene remain unchanged; no duplicate giant scene module ships.

A single optional bracket is the deliberately narrow first interoperability proof. Five legacy equipment stations still support the existing playable systems. The next build can expand graph rendering to more arbitrary adapters and expose socket markers / ghost previews. This build does not attempt generalized quadruped locomotion or an entirely new builder UI.

## Safety and persistence

- A new v3 save is written to localStorage key `mech-arena-machine-v3`. The preexisting `mech-arena-machine-v1` v1/v2 record remains **untouched** as a rollback snapshot. First load looks for a valid v3 record; if no v3 exists, it migrates the existing v1/v2 record in memory. To roll back to k.1, restore unchanged code; it will still read the older key and older snapshot. Your progress made in k.2 **after** migration will not be reflected in the older snapshot.
- Existing owned serials, condition, wear, repairs, armor/integrity, shot counts and leg-drive faults survive migration. This release does not create independent repair history for the derived bracket.
- Removing a supporting frame with children fails safely and shows its reason in the garage. Invalid component swaps are preflighted before the old button callback, with an on-screen explanation.
- Replacing a generator or frame while the generator is offset requires returning it to REAR / DIRECT first. This protects the existing station-only workflow from flattening custom graph branches.
- An incomplete frame-less saved machine now reopens in the garage with a parked, unpowered simulation configuration rather than crashing at startup. Deployment remains blocked until the five required functions are restored.

## Install / mobile smoke test

1. Make sure your existing site is the complete k.1-on-j.2 project, **not** an empty directory. Overlay this ZIP at the project root. Keep your GitHub Pages origin unchanged; do not clear Safari website data. Replace its `index.html` so cache-busted k.2 modules load.
2. Open the garage and select POWER. Try both mount locations. Watch the generator move left, the bracket appear, and mass increase from 4,090 kg to 4,175 kg on the starter rig. The original pilot controls should be unaffected.
3. Confirm that a frame or generator cannot be replaced while the bracket is installed, and the UI explains why. Return it to REAR / DIRECT and retry the swap.
4. Deploy, fire, receive damage to the relocated generator, repair and return. Switch to Hauler legs and check that its existing H2 adapter mass is still counted separately.
5. Refresh the app. Confirm the generator remains in the same location and all damaged-component history persists. Confirm the j.2 hostile still navigates pillars and its waypoint remains visible with COLLIDERS enabled.

Run `npm test` from the complete project directory (Node 18+). The ZIP includes the previously uncommitted Stage 1 tests and added k.2 tests.

## Verification / limits

The scope-limited source tests pass: 28 tests, including the 162 legacy catalogue combinations, new nested bracket, rollback-safe v1/v2 migration, v3 round-trip, unsafe parent removal and parked incomplete machine. A separate Three-compatible scene shim test passed bracket geometry parenting, graph transforms, inspection focus and relocated hostile aim. All bundled JavaScript files pass `node --check`. A full iPhone Safari / real CDN Three.js combat smoke test was **not** possible in this environment; complete the numbered on-device test before treating it as a final stable release. The renderer bridge depends on the existing j.2 component-group naming; a future full scene refactor should integrate graph transforms directly rather than retain this temporary thin bridge. No ghost previews or direct 3D socket markers yet.
