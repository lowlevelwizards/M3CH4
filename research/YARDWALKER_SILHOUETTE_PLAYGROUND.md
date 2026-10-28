# Yardwalker silhouette playground — visual-first replacement study

Open **[yardwalker-silhouette.html](../yardwalker-silhouette.html)** from the **garage → Dev** tools.
The isolated lab does not edit production parts itself. As of the Industrial Strider promotion, the approved **Naked Industrial Strider** is the default live `legs-yard` visual on `main`; Dockyard Bruiser, Utility Hound and all experimental armor remain in this lab. The V4 JSON-backed model is retained only for the separate dev Armor Lab. Gameplay IK, catalogue ID, saves and combat remain unchanged.

## Why this lab exists

Four successive Yardwalker revisions improved surface geometry but retained the same
goalpost-like proportions. This experiment starts from **three independent parameter sets**
and *only* shares the U1 top interface and ground plane. The three prototypes:
- **A / Industrial Strider** — tall, narrow, long offset-knee linkages
- **B / Dockyard Bruiser** — squat, wide hips, huge thighs, short powerful shins
- **C / Utility Hound** — pronounced bent-knee stance, eccentric forward return

Each design consists of a compact load knot, load-transfer arms, two inclined
structural thigh/shin pairs, real-looking knee clevises, a broad boot and one
visible upper-link hydraulic mounting stage. These are **primitive proportion
studies**, not a functioning actuator or new IK solver.

## What to do

1. Inspect all three with the **real built five-part M3CH4 rig** from
   `buildExteriorRig(makeTestAssembly())`; each uses an isolated duplicate of
   the same real frame, cab, generator and weapon. The study replaces the mobility
   *visual only* inside the clone.
2. Toggle **3/4 / FRONT / SIDE / REAR**, **GARAGE / ARENA SCALE**, and
   **BLACK SILHOUETTE**. Choose **LEGS ONLY** to see the mechanism without the cab.
3. Select one of three candidates. The five sliders change **only the selected**
   study's hip span, thigh width, knee offset, thigh-versus-shin length split and
   boot scale. Neither baseline presets nor other candidates are modified.
4. On narrow phones the page starts in single-candidate focus mode. Use
   **COMPARE 3** when you want the smaller three-up visualization.
5. Judge designs specifically in front, side and quarter at arena distance,
   not on mesh count or polygon validity. Pick a candidate or hybrid before
   authoring production parts.

The lab is **NO SAVE**. Refresh or reset to return to the three baselines.
It never calls the live build registry to install these concepts. The existing
`legs-yard` remains the actual playable mobility system.

## Explicit next step, intentionally NOT included

Once a concept looks right on a complete rig, create a new articulated,
dimensioned, fixed-mount mechanical design with named hip/knee/ankle anchors,
true gait and ground contact, then independent armor silhouettes. Implement
and validate the selected design on a separate branch before any live replacement.
This lab alone does not validate collisions, motion clearance, balance or weights.

## Validation

`node --test tests/yardwalkerSilhouetteLab.test.mjs` checks candidate
independence, shared interface, stability and UI scope.
`research/yardwalkerSilhouetteBrowserSmoke.mjs` uses real WebGL to validate
desktop three-up and phone focus, user edits, camera and scale controls, and
writes same-camera full-rig screenshots to the Actions artifact.

## Armor prototype pass — all three candidates preserved

Armor has an **explicit silhouette-first vocabulary** and applies equally to
Industrial Strider, Dockyard Bruiser and Utility Hound. No candidate is deleted
or turned into a production mobility part. In the dedicated armor bar above
the viewport, switch tiers instantly for an apples-to-apples comparison.

- **0 Naked:** The original approved proportion study, unchanged.
- **1 Light:** One thin fitted, chamfered **front strike plate** on each thigh
  and each shin. No boxy hip decorations.
- **2 Heavy:** Existing front coverage becomes broader, with **outer side plates**
  on the thighs and shins. Bearings and ankles stay visible; front and side
  plates remain distinct manufactured objects.
- **3 Encased:** Replace the separate thigh plates with a **single hollow,
  open-ended, flared upper-leg enclosure** on each thigh. The structural thigh
  remains inside. Each shin gets front and outer-side protection. One small
  optional instep armor plate per boot can be toggled. The exposed knee and
  ankle are NOT bridged with floating rigid armor.

For Encased, **Box Flare** is the primary squared industrial shroud and
**Tapered Hood** exaggerates the upper-leg flare and narrows toward the knee.
Both use the same skeleton and preserve open hip/knee clearance in the neutral
pose. The shapes attach to the existing inclined link meshes in local space;
they have physically separated faces and correctly wound outward triangles,
not stacked coplanar decorative rectangles.

The browser CI now renders the three candidates at Light, Heavy, Encased Box,
Encased Taper, and optional boot-off, in addition to Naked, on desktop and
portrait mobile. It checks closed manifold surface meshes, volume orientation,
and base geometry preservation at all slider extremes. **Artistic approval and
animated collision clearance remain required before implementing live armor.**
