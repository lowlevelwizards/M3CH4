# Kestrel · Fantasy-first Naked Legsets

> **Production decision (2026-10-29):** A / Raptor Scout is the canonical
> **Naked** live Kestrel (`legs-compact`). Its approved original casting geometry
> now drives the gameplay and vendor visual with named animated joints. The
> original Kestrel is retained for the old armor lab. B / Field Kestrel and
> C / Perch Runner remain unmodified selectable Dev studies, not additional
> inventory parts. **Split Shell** is the preferred future Encased Raptor Scout
> armor treatment; it remains inspectable/removable in the Kestrel playground,
> but is **not** installed on production mechs until armor gameplay ships.
> No gameplay parameters, physical fitting IDs, saves, or ownership change.


Open `kestrel-silhouette.html` from **Garage → Dev → Kestrel Silhouette Playground**.

## Artistic thesis

The previous production Kestrel had useful avian hock anatomy. This study deliberately
**did not modify or reshape the original live geometry during selection**. It treats the live Kestrel
as a reference for *fantasy* and the source catalogue for compact interface limits,
not as an editable geometry dependency.

Kestrel should feel like a compact avian scout/skirmisher: precise, upright, taut,
and quick-footed. Contrast with Yardwalker's heavy, workmanlike industrial stance.
The bird anatomy is an engineered rear-swept knee and long forward-return shin,
not literal feathers, claws, organic tendons, or ornamental detailing.

- **A / Raptor Scout:** Exposed high hip and sharp rear-hock break; thin upper
  casting, strong long lower tibia, sharply split wedge toes. Tall, alert, fast.
- **B / Field Kestrel:** Most balanced compact scout stance; slightly broader
  hip nacelles and clearer steel bushings; a stronger upper strut, secondary
  shin-side rib, and purposeful split traction foot. A potential default.
- **C / Perch Runner:** Lower tucked thigh, most extreme rearward knee, thinner
  lower beam, small brake heel and splayed two-point perching shoe. Most stylized.

## Geometry rules

- One principal load casting per thigh and shin. Every supplementary strut
  must communicate a distinct structural role; no nested blind cylinders.
- Explicit load path: U1 contact → central motor case → lateral transfer arm →
  rotary hip housing → swept thigh → exposed knee clevis → forward shin →
  ankle bearing → landing pads.
- Dominant lines and functional negative space at game-camera pixel scale.
- Real mirrored mechanical anatomy with enough shoulder width for front-view
  recognition, not just a good side profile.
- Flat low-poly industrial palette; form before trim, weathering or texture.
- Small split-toe or landing-wedge feet: **not** large Yardwalker construction boots.
- Use actual outward-facing triangle geometry and physically separated clearances.

The study follows Kestrel's mounting height **+0.775 m**, nominal floor
**−0.775 m**, and maximum **1.67 m width**, keeping the gameplay part
untouched.

## Interaction and visual approval

The **same upper assembly** sourced from M3CH4's `buildExteriorRig` is
displayed three times. Only the mobility visual is independently replaced in
each clone. Compare three side-by-side, focus an individual model, switch between
front / side / rear / 3/4 views, change garage vs arena scale, use black silhouette
mode, drag to orbit and pinch/scroll to zoom. Sliders change *only the currently
selected concept*, and reset returns to unmodified presets. Portrait phones
default to single model focus. No save and no catalogue operations.

Review across front, side, three-quarter, arena-scale, and full assembled-mech
views. If any candidate looks like stacks of overlapping joint cylinders,
refine the primary proportions *in this lab* before adding more detail.

## Explicitly deferred after Naked Raptor production integration

No additional `legs-compact` ID, IK rewrite, gameplay stat or weight
changes, active armor levels, new foot kits, purchasable variants, saved-build
migration, combat hitboxes or new manufacturers. These three are preserved as
independent Dev studies. Only the approved Naked Raptor is integrated into live
play, with the legacy `legs-compact` inventory ID. Encased Split Shell is an
art direction decision, not yet a new gameplay component.

Tests: `node --test tests/kestrelSilhouetteLab.test.mjs`.
Browser checks: `node research/kestrelSilhouetteBrowserSmoke.mjs` with
Playwright Chromium and static server on localhost:8765.

Production integration tests: `node --test tests/raptorScoutProduction.test.mjs`;
`node research/kestrelProductionBrowserSmoke.mjs` with Playwright and the local server.
