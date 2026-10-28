# Yardwalker clean anatomy / four-tier reconstruction

**Art target:** 2026-10-27 approved simplified Yardwalker lineup. Fewer,
bigger purposeful mechanical shapes; a profiled mustard carriage, forked hip yokes, custom multi-section load-bearing thigh spars, one articulated-link service strut, a recessed knee bearing with restrained orange hub, sculpted olive shin housings, and continuous faceted industrial boots.

## Single source of truth

- `yardwalker-design/master.json`: the canonical geometry, immutable original
  rest-pose joint positions, and 8 joint-parented armor identities.
- `yardwalkerDesignData.js`: generated ES module for browsers (to avoid JSON
  import-assertion compatibility); **do not edit by hand**.
- `yardwalkerWorkbenchExport.js` plus `research/exportYardwalkerDesign.mjs`:
  create/verify four independently editable Workbench V2 JSON assets.
- `yardwalkerVisual.js`: production builder reads the same shape descriptions
  and compiles them under the existing named hip, knee, ankle, foot groups.
  It is still the normal `legs-yard` shared factory model in gameplay.

Run:

```sh
node research/exportYardwalkerDesign.mjs
node research/exportYardwalkerDesign.mjs --check
node --test tests/yardwalkerRedesign.test.mjs
```

## Workbench imports

Use Workbench V2/V3 **Library > Import Part JSON** and choose:

- `workbench-assets/yardwalker/yardwalker-00-naked.asset.json`
- `workbench-assets/yardwalker/yardwalker-01-guarded.asset.json`
- `workbench-assets/yardwalker/yardwalker-02-heavy.asset.json`
- `workbench-assets/yardwalker/yardwalker-03-encased.asset.json`

These have consistent anchor/group identities and local transforms. Editable
anchor metadata alone **does not animate** inside a generic Workbench preview;
the real game restores `userData.joint` and side in its builder. Do not
replace the animated production model with a flattened Workbench mesh.

The original V1 calf-only recipe tool is retained as a legacy archive
and clearly marked as such. Current production shin geometry is authored in
the shared master JSON; V1 edits no longer affect it.

## Anatomy and deliberate simplification

The Naked core consists of 46 deliberately sculpted shapes across both articulated legs.
Each thigh and shin now has just one primary tapered load-bearing component,
a distinct knee bearing and broad, integrated work boot. The hydraulic-look
pressure cylinder and rod have two simple attachment lugs and are attached to the same moving upper-leg assembly;
they are not a simulated piston crossing two moving joints. Thus they cannot
pop apart under the existing game's IK, and no fake physics is introduced.

Configured shapes: 46 / 50 / 52 / 54 (tiers 0 / 1 / 2 / 3).
Armor identities: 0 / 4 / 6 / 8, with stronger tier geometry **replacing**
earlier shell profiles. Parent carriage for stationary hip guards, moving
hip for thigh armor, moving knee for shin and calf coverage. The joints
remain visually exposed and move freely.

Fixed catalogue identity: `legs-yard`, U1 mounting face at `[0,.825,0]`,
2 × 1.65 × 1.18 m envelope, 1,240 kg base mass. Existing mobility physics,
per-leg damage, foot contacts, gait, pilot control and career saves are
unchanged. Armor Lab masses are dev-only proposals.

## Review gates before merge

- Full deterministic JSON diff regeneration: no drift.
- All currently authored core nodes remain identical across tiers.
- Real Three.js source and all variants fit the neutral catalogue envelope.
- Walking, reverse step, strafe, compression do not break joint-parenting.
- Real browser screenshot artifacts: front / side of four tiers, gait shot.
- Actual garage and arena test with every frame family, and phone viewport
  review for leg-silhouette readability.
- Confirm hit ownership and no new accidental raycast blockers.
- Deliberate visual review against concept. Merge only once acceptable.

No feet-kit, new inventory part, serialized live armor durability,
replacement vehicle dynamics or advanced suspension is part of this change.

## V2 focused visual corrections

The first minimalist rebuild was judged too boxy and detached in actual Armor Lab
screenshots. V2 keeps all eight original armored prototype identities and exact
joint transforms but replaces the visual forms with closed custom ring-section
meshes. The body no longer relies on uniformly sized chamfered boxes; upper
and lower links, hip castings and shells now have deliberate changes in width,
front/back depth, taper, and silhouette. Orange knees are enclosed in dark
bearing housings; the large orange cylinder no longer projects as a separate
oversized puck. Boots are single faceted bodies with inset replaceable toe pads.

All sculpted surfaces are authored within the existing Workbench V2 mesh schema
and remain individually editable in point mode. The generic Workbench editor
still does not animate anchor groups: evaluate poses in production or Armor Lab.

V2 validation additionally checks normals/winding, degeneracy, exposed plate
clearance, rest envelope, and distinct silhouette occupancy. Final sign-off is
visual review of real game renders, not shape-count metrics alone.

## V3: restore Yardwalker's original offset-knee silhouette

The first two JSON rebuilds preserved the mathematical hip/knee/ankle anchors but
lost the angled appearance of the pre-JSON Yardwalker. The original build used
`taperedLink` between anchors; the new custom meshes were ring-stacked as
nearly vertical pillars. V3 follows the original opposing fore-aft vectors
(hip→knee +0.10 m Z / knee→ankle −0.10 m Z), amplifying them via purposeful
faceted upper beams, knee forks and tapered lower shins. Carriage mount, joint
centres, body envelope, paint roles, gait, and career balance remain unchanged.

Armored appearances are designed as complete leg silhouettes before separating
into fixed hip cowls, moving angled thigh fenders, moving shin greaves, and
outer calf flanks. The eight individually removable armor identities remain.
The fixed hip armor and moving thigh retain an articulation gap. Four V3
Workbench assets use exactly the same updated production shapes. Verify
side/front/rear views with `research/yardwalkerBrowserAudit.mjs` and test
full-gait movement; the JSON exporter does not replace live IK metadata.

Artistic acceptance: angled two-link profile is evident when Naked, and Heavy
and Encased read as substantially different whole-leg silhouettes at arena
size, not as sleeves or cuffs. Keep V3 in draft for actual visual approval.

### Historical side-by-side visual audit

Open `yardwalker-lineage.html` in the dev build for an equal-scale rendering
of the frozen **original pre-JSON Yardwalker** (left) versus the actual current
production V3 builder (right). Use 3D/SIDE/FRONT/REAR controls and the V3 armor
tier selector. The historical model lives at
`research/yardwalkerOriginalReference.js` and is **not** registered for
career builds, vendor inventory or any production gameplay.

The Yardwalker browser CI captures `lineage-original-v3-*-side.png` and a
three-quarter Encased comparison in addition to the standard Armor Lab images.
Artistic judgment requires looking at these rendered pictures, especially
the opposing leg angles and whether armor reads as fitted long-form panels.
