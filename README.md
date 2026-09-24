# MECH ARENA — 0.0.1b.1–b.3 · Five-system assembly test

A deliberately contained follow-up to 0.0.1b. All *editable* project files remain in one flat folder. This is an assembly-and-driving prototype, not a combat or economic game.

## Included

- **0.0.1b.1 / Physical inspection:** one-finger orbit, two-finger pinch and mouse-wheel zoom, tap a visible module or select it in the list to focus, RESET ORBIT. A refined, low-poly reference rig uses a clear hip bridge, thicker supported legs, more intentional pilot optic and mounted rear power/cooling pack.
- **0.0.1b.2 / First swaps:** five non-negotiable *functional systems*, each represented initially by one complete serviceable assembly: structure, mobility, power, command and combat provision. There are eight owned modules total: one frame, two leg assemblies, one power/cooling pack, two pilot cabs and two **inert** cannon mounts. Select a system, fit an owned alternative or remove it. Unique serial numbers survive swapping **within the running session**.
- **0.0.1b.3 / Causal inspection:** five fieldability checks (structure/mounting and loading, mobility, power budget, pilot command, inert combat provision). A specific H2 heavy-leg → U1 frame **hip adapter** is automatically fitted, weighs 110 kg and is represented visually. Real installed-part mass, actuator force, leg width, speed and turn inertia feed the existing fixed-step locomotion. An incomplete rig cannot enter pilot mode.

The training's *combat provision* check means the rig has a mounted practice weapon, **not that it can fire yet**. There is no arbitrary universal adapter system, save file, combat damage, purchasing or garage in this release.

## Mobile playtest

1. Unzip the **playtest-flat** archive and upload the **contents**, not just the zip, to the root of a static HTTPS site such as GitHub Pages. Every file belongs side-by-side; don't make subfolders.
2. Open the site in iPhone Safari in landscape. To avoid Safari tabs, use **Share → Add to Home Screen**, enable **Open as Web App** if offered, then launch from that icon. A normal Safari tab cannot be programmatically hidden on iPhone.
3. Tap **ASSEMBLY**. Drag the 3D rig with one finger, pinch with two fingers, select a module in the list to focus, and use **RESET ORBIT** as needed.
4. Swap the Yardwalker legs for the Hauler legs and observe the automatically fitted adapter and changed weight. Optionally fit the armored cab: its higher power demand makes the default heavy-leg/cannon combination unfieldable. Fitting the stump cannon restores the power budget.
5. Return to **PILOT VIEW** and try the different locomotion configurations.

The static playtest loads the Three.js library from jsDelivr (internet access required to load it). It does **not** require npm on the phone.

## Editable TypeScript source

On a machine with Node.js and npm connectivity, in the flat source directory:

```sh
npm install
npm run check
npm test
npm run build
```

`npm run dev` serves the game locally. Vite outputs a conventional `dist` build folder; that generated folder is not part of the flat editable source layout. `base: './'` supports project-relative hosting.

## Verification and known limits

The assembly/locomotion rules are separate from the renderer so they can be tested without 3D or DOM access. Source includes Vitest tests for fitting, serial identity, adapter mass, power limits, mobility differences and steering, alongside the earlier locomotion tests. The packaged static playtest can be syntax- and link-checked offline; actual WebGL and iPhone behavior must be confirmed on-device. This development environment may be unable to contact npm, so don't interpret a missing local Vite run as a successful full-browser test.

**Next milestone: 0.0.1c, projectile impacts.** Don't expand the builder to arbitrary mounts before these five systems feel good to inspect and swap.
