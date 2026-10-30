# Hauler H2 — Fantasy-first mobility studio

Open **Garage → Dev → Hauler H2 / Fantasy Lab**, or `hauler-fantasy-lab.html` directly.

## Decision boundary

The three Naked specimens were built from the approved three-way **Hauler H2 concept sheet**, not by modifying or importing `haulerVisual.js`, `HAULER_LAYOUT` geometry, its appearance presets, or existing live IK.

**A / Dockyard Lifter** — squat industrial dock suspension: broad stationary drive pods, short sliding compression stacks and enormous close-to-ground split shoes. Shortest heavy step and strongest planted stance.

**B / Industrial Strider** — long-travel industrial hydraulics: clearly extended vertical columns, exposed tension rod, traveling lower carriage and lighter upper pods. Longest heavy step, without becoming a Kestrel runner.

**C / Yard Crane** — mechanical leverage: a housed upper crank spindle drives a triangular lift beam, rear tension rod, compound knee and diagonal lower power brace. Strongest angular personality. Not a literal humanoid walker.

Each prototype has two independent articulated hip / knee / ankle / foot chains, is made from newly authored low-poly industrial castings, and has no cosmetic armor layers. Three **fundamentally different load paths** are the point: compression-stack / hydraulic-column / crank-linkage.

## Controls

- Three simultaneous orthographic 3D comparisons on desktop; one large focus view by default on portrait phones
- 3/4, front, side, rear camera; orbit drag, pinch/wheel zoom, two-finger pan, reset, zoom buttons
- Same actual M3CH4 upper structure cloned for all concepts when **Full Mech** is enabled; no extra test-rig gameplay actor
- Idle, heavy walk, turn, brace, play/pause and phase scrub; optional contact and joint markers
- Black silhouettes, arena-distance comparison, independent selected-concept proportions and ghosted alternates
- Reset one or all design controls; all changes are volatile and deliberately **not saved**

The animation is an art/rigging preview with rigid mechanical segments and IK distance constraints, **not** a new production controller or proof of actual ground-contact physics. Landing shoe contact labels are gait-phase previews, not authoritative game simulation.

## Shared functional constraints, not shared visuals

The existing `legs-hauler` catalogue ID stays in production (1,520 kg; 2.55 × 1.68 × 1.35 m). Its distinct H2/U1 adapter remains a functional prerequisite and its existing 110 kg adapter mass is unchanged. The lab uses the nominal +0.84 m top contact and -0.84 m sole plane and checks prototype geometric clearance against the catalogue bounding envelope. It deliberately never registers a new part or changes mass, damage, combat, saves or vendor inventory.

## Review gate

Check three front, side and quarter views, then the same models on whole assembled rigs and at arena distance. Look for believable stationary vs moving components, clear feet and physical negative space, a visually distinct heavy silhouette compared with the currently approved Yardwalker and Kestrel, and enough room for a future removable armor progression. Refit and armor must remain **deferred** until a Naked design is approved.

To verify: `node --test tests/haulerFantasyLab.test.mjs`, then `node research/haulerFantasyBrowserSmoke.mjs` while serving the repo on localhost:8765 with Playwright installed. CI publishes real WebGL review captures for all three candidates.
