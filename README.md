# MECH ARENA · 0.0.1b.6 — Command + Chassis Visual Pass

**This is a small, flat-directory patch over 0.0.1b.5.1, not a standalone game.** It changes the three command-cab models, rebuilds two existing frame models, and adds one Wedge frame. It intentionally adds no new mechanical subsystem, AI, gunfire, damage, save handling or separate asset folders.

## What changed, stage by stage

**A · Command modules:** Three existing parts retain their definition IDs, ownership serials and mechanical specifications while receiving visibly different procedural geometry:

- **Cyclops single-optic cab (`cab-cyclops`):** low salvage pilot tub with one large, circular protected camera cassette, thick frame and no paired eyes.
- **Hearth integrated cab (`cab-armored`):** shallow flush-window armored enclosure with a lower front skirt, merging into the surrounding chassis rather than looking like a robot head.
- **Vista observation cab (`cab-utility`):** taller industrial vehicle cab with a wide front windshield and side glazing. Sight differences are still visual-only.

**B · Chassis:** The existing welded frame is rebuilt as the **Bruiser**, with deep trunnions, layered plates and a heavy hip bridge. The existing U-2 narrow utility hull becomes the more visibly serviceable **Skeleton** with an exposed spine, open side rails and its original outboard weapon mount. Their definition IDs, serials, weights and load limits remain unchanged. The **W-3 Wedge monocoque** is the **only newly owned part**: 1,450 kg, 4,850 kg load rating, wide tapered armored nose and low rear mounting saddle. Existing U1 stations accept all three command modules. One physical Hauler H2/U1 leg adapter remains the only automatic adapter in the prototype.

**C · Builder integration:** The same five functional stations, swappable assemblies and selection/orbit/zoom/pan controls remain. The builder now shows **3 chassis × 3 command options = 9 direct U1 pairings** with existing equipment; no preset mech is hardcoded. Changing a frame changes mass, envelope-derived yaw inertia and actual load-rating validation. The Wedge is `SR01-014`; existing `SR01-001` through `SR01-013` serial assignments are unchanged.

**D · Visual fit:** Command modules retain the same attachment center across all frames. Leg geometry, weapon mounts, generator packs, cockpit operation, camera math and mobile controls are deliberately untouched.

## iPhone installation (playtest patch)

Keep your **complete hosted 0.0.1b.5.1 flat playtest** in place. Unzip the `MECH_ARENA_0.0.1b6_playtest_PATCH.zip` and upload its root-level files **over matching existing filenames**. Upload the included `main.js` too (it refreshes the scene import). Keep unchanged `inspectionCamera.js`, `locomotion.js`, `controls.js`, `assemblyPhysics.js`, `styles.css`, `manifest.webmanifest` and `app-icon.png`. Do not upload only this patch into an empty folder. Reload Safari or relaunch your Home Screen app; to bypass an old cached HTML page you can append `?v=b6` to the hosted URL.

To work on the **source** instead, apply the source patch over the complete 0.0.1b.5.1 TypeScript tree, keeping unchanged files. With npm access: `npm install`, `npm run check`, `npm test`, `npm run build`. Both patches preserve the existing flat directory layout.

## Quick playtest

1. Enter **ASSEMBLY**, choose **COMMAND**, and cycle between Cyclops, Hearth and Vista. Check that the cockpit silhouette changes much more than the previous head-like variants.
2. Choose **STRUCTURE**, then cycle Bruiser → Skeleton → Wedge. Orbit to inspect the deep shoulder mounts, open spine, and sloped wedge shell; each should still take the same cab and training weapon.
3. Swap all three cabs onto all three frames; default Yardwalker legs + Dynamo pack + long training cannon should remain fieldable in all nine pairings.
4. Try **Skeleton + Hauler heavy legs**: its 4,120 kg frame rating is exceeded; the inspection should explain why. Swapping only the frame to Wedge or Bruiser restores fieldability, without silently changing your installed leg/cab/gun identities.
5. Compare drive handling between the 1,290 kg Skeleton and the 1,580 kg Bruiser; mass and chassis width already contribute to the existing fixed-step movement model.

## Intentional exclusions

Side Pod, recessed cockpit and sensor mast; Offset, Workhorse and Core frames; changes to locomotion, weapons or power; true freeform spatial mounting, procedurally generated universal adapters, firing or damage. The next game-mechanics milestone remains **0.0.1c: a shot hits something real**. This visual pass is designed to validate the shared design language before multiplying parts.

## Verification limits

New automated TypeScript tests cover the nine default-compatible chassis/cab combinations, part counts and serial preservation, actual mass/inertia differences, load-limit rejection and the existing H2/U1 adapter. The flat mobile JS modules can also be checked independently. Live Three.js rendering and touch behavior must still be evaluated on an iPhone; this build does not ship a vendored Three.js copy and keeps the prior CDN import map.
