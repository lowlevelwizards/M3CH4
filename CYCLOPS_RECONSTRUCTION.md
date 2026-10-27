# Cyclops — approved-concept visual reconstruction

This branch rebuilds the **existing** `cab-cyclops`, not a new purchasable part.
The target is the user-approved October 27, 2026 concept sheet: a chunky, inexpensive
industrial single-optic command capsule progressing from a bare workhorse to a broad,
fully encased armored shell. Low-poly block silhouettes, large mechanical connections,
limited paint channels, and a deliberately recessed faceted lens are intentional.

## Source of truth and editing

- `cyclopsDesign.js`: **master** 42 permanent core shapes, 8 independently addressed
  armor plates, and tier-dependent replacement profiles. All dimensions in metres.
- `cyclopsVisual.js`: production Three.js renderer using **that exact data** and
  the same mesh compiler as Workbench. Preserve the existing command-cab catalogue
  ID, mount, mass and power. No legacy factory cheek meshes on the bare core.
- `armorPrototype.js`: Armor Lab receives the same eight shells from the master,
  with one pickable mesh per plate. Tier 2/3 replace earlier plate geometry rather
  than stacking coplanar tiers.
- `cyclopsWorkbenchExport.js`: deterministic translation into valid
  `m3ch4.workbench.asset` version 2 documents. Every shape is independently
  selectable; hierarchical groups aid ghost/isolate/point editing.

### Editable JSON exports

1. `workbench-assets/cyclops/cyclops-00-naked.asset.json`
2. `workbench-assets/cyclops/cyclops-01-light.asset.json`
3. `workbench-assets/cyclops/cyclops-02-armored.asset.json`
4. `workbench-assets/cyclops/cyclops-03-encased.asset.json`

In the Part Workbench V2/V3, use **Library → Import Part JSON**, then insert
the chosen variant into a project. Back up with Export Bundle. These are editable
visual drafts, **not** new inventory items or altered career saves.

To rebuild exports after editing the master:

```bash
node research/exportCyclopsWorkbench.mjs
node research/exportCyclopsWorkbench.mjs --check
node --test tests/cyclopsConcept.test.mjs
```

Do not hand-edit the four generated JSON files independently. Change
`cyclopsDesign.js` then regenerate, to prevent core drift between tiers.

## Shared anatomy and tier design

- **Core**: squat steel pilot tub, visible support rails, ochre front optical
  load bridge, one side access hatch, rear teal electronics cassette, roof
  equipment and handle, underside U1 structural collar.
- **Optics**: black squared carrier, machined twelve-facet retaining annulus,
  recessed dark well, teal objective, and small non-glowing central aperture.
- **Level 0**: exposed complete industrial command capsule, no baked-on cheeks.
- **Level 1**: two asymmetrical bolted cream flank plates.
- **Level 2**: thicker tapered cheeks plus heavy front brow and chin, producing
  a pronounced protected recess around the same optic.
- **Level 3**: broad heavy cheeks, sloped roof plate, wraparound rear side plates
  and rear shell. The optic stays readable; the inner machine stays unchanged.

The eight original Armor Lab plate IDs and 0/2/4/8 tier counts are retained.

## Fit, performance, and game safety

Production catalogue: 1.24 × 0.90 × 1.14 m, 350 kg, 8 kW demand,
U1 underside command mount. All target meshes must satisfy the original
conservative command envelope and preserve pickable command ownership.

This work changes **geometry only**. Armor Lab plate HP, masses, repair
behavior and visibility are its existing prototypes. **There is no new
live gameplay armor durability or armor save-state system.** Introducing
physically effective armor tiers into career combat is separate scope:
raycast shielding, mass changes, hit ownership, repair economy and
frame collision require explicit validation first.

The proposed changes intentionally depend on the existing Workbench
primitive-geometry compiler so that Workbench renders and production
render the same surface topology. All production material meshes continue
to use shared part material roles and owner-paint channels.

## Review gates before merge

- `node research/exportCyclopsWorkbench.mjs --check` and
  `tests/cyclopsConcept.test.mjs` pass.
- `research/cyclopsConceptBrowserAudit.mjs` renders each tier front/side and
  captures real Three.js bounding evidence on mobile-sized Chromium.
- Existing command cab, plate budget, and Armor Lab regressions pass.
- Inspect the naked, light, armored, encased renders next to the approved
  concept reference, including garage placement and real mech silhouette.
- Visually verify in iPhone portrait and landscape, and with each frame
  family: Bruiser, Skeleton and Wedge.
- Review actual cover/shielding impact from altered production mesh
  intersections; no unintentional targeting changes.
- Merge only after model and integration review. The original implementation
  remains available from the base/main commit for rollback.

For concept fidelity, assess silhouette and position of the optical assembly,
then armor mass and profile, then secondary detailing. Avoid adding tiny
greebles or texture work to compensate for unclear big shapes.
