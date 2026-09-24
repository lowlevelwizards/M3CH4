# MECH ARENA — 0.0.1b.4 · Inspection and command-module pass

This is a DELTA update over the existing 0.0.1b.3 project, still with a flat editable directory. Install these changed files over your existing files, retaining the unchanged modules, manifest and icon. No new parts, weapons, damage, saves or economy.

## New in b.4

- Two-finger drag pans the inspection camera while pinch independently zooms; one-finger orbit is unchanged. RESET ORBIT clears accumulated pan/zoom.
- The inspection camera aims at the middle of the **visible space to the right of the parts panel**, recalculated for viewport/panel width and zoom.
- Tapping an already-selected row or 3D part deselects it. Tapping empty canvas also clears the selection without resetting the camera.
- Cyclops and Hearth pilot cabs have new lower, armored-vehicle-like silhouettes and recessed horizontal view slits (no paired cartoon eyes). Same parts, serials, masses, power and fieldability rules.

## Existing b.1–b.3 features

- **0.0.1b.1 / Physical inspection:** one-finger orbit, two-finger pinch and mouse-wheel zoom, tap a visible module or select it in the list to focus, RESET ORBIT. A refined, low-poly reference rig uses a clear hip bridge, thicker supported legs, more intentional pilot optic and mounted rear power/cooling pack.
- **0.0.1b.2 / First swaps:** five non-negotiable *functional systems*, each represented initially by one complete serviceable assembly: structure, mobility, power, command and combat provision. There are eight owned modules total: one frame, two leg assemblies, one power/cooling pack, two pilot cabs and two **inert** cannon mounts. Select a system, fit an owned alternative or remove it. Unique serial numbers survive swapping **within the running session**.
- **0.0.1b.3 / Causal inspection:** five fieldability checks (structure/mounting and loading, mobility, power budget, pilot command, inert combat provision). A specific H2 heavy-leg → U1 frame **hip adapter** is automatically fitted, weighs 110 kg and is represented visually. Real installed-part mass, actuator force, leg width, speed and turn inertia feed the existing fixed-step locomotion. An incomplete rig cannot enter pilot mode.

The training's *combat provision* check means the rig has a mounted practice weapon, **not that it can fire yet**. There is no arbitrary universal adapter system, save file, combat damage, purchasing or garage in this release.

## Mobile playtest

1. Start with your already-hosted **0.0.1b.3** flat playtest. Unzip the **0.0.1b.4 playtest PATCH** and upload its contents **over matching hosted files**. Keep unchanged b.3 files (`controls.js`, `locomotion.js`, `assemblyPhysics.js`, `manifest.webmanifest`, `app-icon.png`). New `inspectionCamera.js` belongs alongside the other JavaScript files. All files remain flat at the host root.
2. Open the site in iPhone Safari in landscape. To avoid Safari tabs, use **Share → Add to Home Screen**, enable **Open as Web App** if offered, then launch from that icon. A normal Safari tab cannot be programmatically hidden on iPhone.
3. Tap **ASSEMBLY**. Drag the 3D rig with one finger, pinch with two fingers, select a module in the list to focus, drag two fingers to pan the view, then tap the selected part again or tap empty space to deselect. Use **RESET ORBIT** to undo pan/zoom.
4. Swap the Yardwalker legs for the Hauler legs and observe the automatically fitted adapter and changed weight. Optionally fit the armored cab: its higher power demand makes the default heavy-leg/cannon combination unfieldable. Fitting the stump cannon restores the power budget.
5. Return to **PILOT VIEW** and try the different locomotion configurations.

The static playtest loads the Three.js library from jsDelivr (internet access required to load it). It does **not** require npm on the phone.

## Editable TypeScript source

Apply the **source PATCH** over the original 0.0.1b.3 flat source, leaving other files in place. On a machine with Node.js and npm connectivity, in that directory:

```sh
npm install
npm run check
npm test
npm run build
```

`npm run dev` serves the game locally. Vite outputs a conventional `dist` build folder; that generated folder is not part of the flat editable source layout. `base: './'` supports project-relative hosting.

## Verification and known limits

The assembly/locomotion rules are separate from the renderer so they can be tested without 3D or DOM access. Source includes Vitest tests for fitting, serial identity, adapter mass, power limits, mobility differences and steering, alongside the earlier locomotion tests. The packaged static playtest can be syntax- and link-checked offline; actual WebGL and iPhone behavior must be confirmed on-device. New inspection-camera math has dedicated unit tests. This development environment may be unable to contact npm, so don't interpret a missing local Vite run as a successful full-browser test.

**Next optional small build: 0.0.1b.5, five contrasting part variants, followed by 0.0.1c projectile impacts.** Don't expand the builder to arbitrary mounts before these five systems feel good to inspect and swap.
