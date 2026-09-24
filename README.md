# MECH ARENA — 0.0.1b.5 · Five contrasting parts

**Patch over 0.0.1b.4.** Flat root-level source and mobile playtest patches contain only changed files; keep unchanged files from b.4/b.3. This is still the **builder/locomotion test**, not a combat release.

## Exactly five new owned components

| Function | New alternative | What changes now |
|---|---|---|
| Structure | U-2 narrow utility hull | 1,290 kg vs 1,580 kg welded hull; 4,120 kg structure limit vs 5,100 kg; narrower hull modestly reduces yaw inertia. Includes a real-looking external cannon outrigger. |
| Mobility | Kestrel compact articulated legs | 1,010 kg vs 1,240 kg Yardwalkers; 3,900 kg load limit, 68 kW draw, narrower stance/lower grip and 9.3 m/s theoretical maximum; distinctive reverse-canted joints. |
| Power | Draft A-1 air-cooled generator | 365 kg vs 510 kg Dynamo; 112 kW vs 145 kW output. Exposed cooling stack, but **no heat simulation yet**. |
| Command | Vista utility observation cab | 295 kg and 11 kW draw. Tall asymmetric cab with one wide window, not a face. A different real field of view awaits the sensor stage; visibility is only visual today. |
| Combat | Deactivated needle cannon | 255 kg and 24 kW nominal load; long supported tube and distinct recoil rail. **Still cannot shoot until 0.0.1c.** |

These append to the prior eight, making **13 owned parts across the same five functional systems**. The existing SR01-001 through SR01-008 serial assignments have not changed. Components remain singly installed assemblies with ordinary U1 mount connections; the original H2→U1 Hauler adapter still adds 110 kg.

The swap options now display functional specs (load rating, speed/power, frame capacity) under each candidate, rather than listing only mass. Once installed, the existing inspection panel honestly recalculates mass, power and fieldability. The physics receives current installed mass, drive force, stance width and frame width; no new generic builder engine was invented.

### Small causal playtest scenarios

1. In **ASSEMBLY**, choose STRUCTURE and fit the **U-2 narrow hull**; orbit around the external right weapon outrigger and check the total mass drops to **3,800 kg**. Return to PILOT VIEW for different turning inertia.
2. Fit **Kestrel compact legs** alone; mass drops to **3,860 kg**, nominal top speed rises, and side grip falls. They have a different 3D stance, not just a reskinned Yardwalker.
3. Fit the **Draft A-1** generator on the starting configuration: **108/112 kW**, ready. Change the cab to the original heavy Hearth: **120/112 kW**, unfieldable. Swap to the original stump cannon: **110/112 kW**, ready again.
4. Try the Vista cab and needle cannon. Both affect mass and power; neither adds actual sensors or shooting yet.
5. Fit **all five new parts** together: **3,215 kg**, **103/112 kW**, fieldable. This should look substantially different from the original Scrapyard rig.

### Installation (iPhone / static site)

Unzip the **playtest PATCH** and upload those changed files to your existing hosted b.4 playtest **over matching filenames**. Keep everything else (including `controls.js`, `locomotion.js`, `inspectionCamera.js`, `manifest.webmanifest` and `app-icon.png`) in the same flat root directory. Because these are JS modules, update all the changed files together; don't mix `components.js` or `scene.js` across versions. If Safari shows an old version, reload the page or relaunch the Home Screen app. The hosted page needs internet to load Three.js from the existing jsDelivr import map; your phone doesn't need npm.

The editable **source PATCH** works the same way over the complete prior b.4 source. On a connected desktop, `npm install && npm run check && npm test && npm run build` builds the Vite version. TypeScript and all game files remain flat at the project root.

### Deliberately not included

No gunfire, damage, AI, repair, persistent saves, shopping, thermal calculations, universal adapter fabrication or new locomotion class. Visual inspection controls and the Home Screen web-app path from b.4 are unchanged. The five new shapes are procedural low-poly meshes, and part geometry is still tied to the existing mount centers. The next milestone is **0.0.1c: a shot hits a real part**, not another catalogue expansion.

### Verification

Pure component, load, power, serial and locomotion logic is testable offline. The `.ts` source includes Vitest cases for the new combinations. A static-playtest smoke test is included in the development verification, but actual Three.js rendering and iPhone interaction still require a device playtest when CDN access is available.
