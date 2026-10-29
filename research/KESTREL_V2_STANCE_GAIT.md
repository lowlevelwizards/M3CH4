# Kestrel V2 · Assembled stance + gait study

**Preview:** `kestrel-silhouette.html` (Garage → Dev → Kestrel)
**PR scope:** experimental. Production `legs-compact`, gameplay IK, armor, fit fixtures,
stats, inventory, collision, saved rigs and all three pre-existing Kestrel IDs unchanged.

## What changed

- Kept **Raptor Scout, Field Kestrel, Perch Runner** as independent authored
  Naked base designs. Retained their primary beam shapes, negative-space hocks,
  simple material palette and compact U1 mount.
- Reparented the existing Naked meshes to independent **thigh, shin and foot**
  groups using world-transform-preserving reparenting; rotating the hock no
  longer separates the knee bearing, casting or side-rib from its body.
- Added a pure **rearward-knee two-link IK** solver, which measures existing
  structural leg lengths from each design and then chooses the birdlike circle
  intersection at every posed step. Neither casting is stretched.
- Three posture presets: **High-Perched** (+0.115m body lift), **Balanced**
  (authored baseline), **Deep-Crouched** (−0.115m body drop).
- Lower feet remain ground-planted for the support segment of the step while
  the upper assembly advances; the other foot swings with a lift arc.
  A two-step treadmill loop can play/pause, advance by speed or be scrubbed.
  The wrap is seamless in the *body-local* coordinates, while the floor grid
  resets with the loop. This is a repeatable **visual gait demonstration**,
  not a production locomotion solver or terrain IK.
- Added slightly broader heel contact and paired ankle fork cheeks so load
  transfer from the shin to the split/toed foot reads mechanically.
- **THREE DESIGNS** shows A/B/C under a single posture. **THREE STANCES**
  uses the currently selected design in all three cells and independently
  assigns Perched/Balanced/Crouched. Full rig, legs only, front/side/rear,
  black silhouette, zoom, arena distance and edit sliders remain available.
- Phone portrait opens in single-study focus. Compare modes can expand into
  three cells. No save, sharing or catalogue promotion.

## Design acceptance

Review nine separate assembled possibilities, each at quarter, front,
side, arena distance, with the walk loop paused at 0, 25, 50 and 75%.
Check for:

1. A strong rearward knee silhouette under the entire mech body;
2. Visible hip-to-thigh load path and no false disconnected pieces;
3. Feet broad enough for the assembled mass, without becoming work boots;
4. Knees clearing the real frame and gun at compression extremes;
5. Distinct differences between three designs AND three postures;
6. No persistent ground penetration, missing backfaces or z-fighting.

If one candidate fails, adjust the candidate **here in the playground**.
Do not quietly transfer a winning snapshot to live gameplay before a real
animated clearance, collision and IK integration test.

## Files

- `research/kestrelSilhouetteKinematics.js`: dependency-free pure math
  for fixed lengths, three stances and planted-foot gait targets.
- `research/kestrelSilhouetteMotion.js`: Three.js movable groups wrapped
  around the original authored geometry.
- `research/kestrelSilhouetteLab.js`: 3×3 comparison, actual upper rig,
  camera, animation and mobile controls.
- `kestrel-silhouette-v2.css`: supplementary controls styling.
- `tests/kestrelSilhouetteLab.test.mjs`: numerical joint, contact, no-save
  and original Naked-rest invariants.
- `research/kestrelV2BrowserSmoke.mjs`: real desktop/mobile WebGL screenshots
  and interactive gait/control acceptance.

Run the GitHub Actions **Kestrel Silhouette Playground** workflow on this PR
to inspect the `kestrel-three-candidates-review` rendered screenshot bundle.
