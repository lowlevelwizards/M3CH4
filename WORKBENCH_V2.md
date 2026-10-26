## Visual-first editor (current)
The **3D model is the workspace**. On a phone, the viewport and icon tool strip stay visible as you browse a grid of actual-shape thumbnails below. You no longer need to scroll down to enter XYZ numbers for routine modeling.

1. **Tap a mesh on the model** to select that exact component (or tap its thumbnail in PARTS). Its name appears in the viewport.
2. Tap **✥ MOVE**, **⟳ ROTATE**, or **⤡ SCALE** and drag the colored XYZ gizmos on the model. You can also drag directly on a selected shape.
3. Tap **⬡ POINTS** and drag amber control points *in the 3D view*, or use Front/Right/Top for constrained axes. Production imported triangle vertices and supported parametric profile/loft points update live.
4. Use **＋ SHAPE** to open the eight visual primitive cards, or **▦ GAME PART** to browse actual in-game parts with geometric thumbnail previews.
5. Save your selection as SHAPE / PART / ASSEMBLY. The LIBRARY displays image-backed tiles for re-insertion. The precision inspector, hierarchy options and reference calibration are collapsible.
6. Use **◎** beside the selection name to focus the camera on it. Tap 3D/F/R/B/L/T to switch views. In Select mode, dragging over any model piece orbits and tapping selects.

Point sculpting updates the selected mesh in place during a gesture, committing one undoable change when the drag finishes. Existing Workbench V2 IndexedDB projects and exported blueprints remain compatible. Imported game joints stay locked by default. The older V1 editor source is retained only for legacy migration; the visible UI no longer directs the user back to it.

**Performance:** Thumbnails are made from actual triangle geometry in a CPU-backed 2D canvas instead of opening another WebGL context. Factory gallery cards are rendered lazily as they become visible, important for iPhone WebGL limits.

# M3CH4 Workbench V2 — Shapes, Parts, Assemblies, Orthos
Branch: feature/part-workbench-v2-shapes-assemblies-reference
Status: staged prototype pending real-browser smoke. Not a new constructor, and no career part migration.

## Launch
Open `part-workbench-v2.html` from Art Lab. The original calf editor is still at
`part-workbench.html`, and its `m3ch4-part-workbench-calf-v1` draft is read
and *copied* into V2 as a loft when no newer project exists.

## Current tools
- Eight reusable shapes: box, chamfer, cylinder, tube, wedge, polygon plate, taper, profile loft.
- Add, name, select in model or hierarchy, move/rotate/scale via touch drag and exact coordinates.
- Front/side/top orthographic inspection; editable polygon points and loft sections in
  relevant views; add/remove supported section or polygon points through inspector.
- Duplicate, group, ungroup identity groups, lock, hide, remove, linked X-mirror,
  unlink an independent mirrored shape. Shift-click multi-select via hierarchy on desktop.
- Save shapes, parts, assemblies in IndexedDB; reuse with INSERT, rename/delete assets,
  reopen existing projects. No saved Workbench asset receives unapproved gameplay stats.
- Reference tabs: import front/side/top image and resize/offset opacity; import
  concept/module images for later reference; paste named AI module manifest array.
- Bundle import/export as JSON (including referenced images) for moving between devices.
- TEST PROTOTYPE IN REAL YARD handoff uses `sessionStorage` in the same tab,
  and `?wb-prototype=1` as explicit opt-in. Cosmetic blueprint group is parented
  to the **actual player leftKnee** of Yardwalker after foot-ground calibration.
  Only in Test Yard; not in career, AI actor or production catalogue. Prototype meshes
  are non-raycast/visualOnly and do not alter damage, physics, mass, or power.

## Important intentional limits
- New Workbench parts are **library assets**, not immediately purchasable game components.
  Publishing new gameplay parts requires authored compatible stats, mounts and catalogue integration.
- Test Yard currently attaches V2 groups at **left knee only**; it is not a universal
  arbitrary assembly constructor. Production integration for other slots is incremental.
- Existing legacy models remain visible as context, **not universally point-editable**.
  Known primitives can be migrated to editable recipes one at a time.
- Point mode edits supported profile control points, not unrestricted mesh triangles.
- Simple mirror-link supports shape geometry sharing, not automatically mirrored complete
  joint kinematics across all nested transforms.
- Orthographic reference images are user-calibrated approximate design guides;
  AI images cannot establish exact hidden geometry or physical interfaces.
- Motion collision/attachment clearances beyond schema and envelopes still require
  mechanical checks and animation reviews; do not treat this as a certified simulator.
- IndexedDB is browser storage, not a cloud backup. Export projects regularly.
- V2 does not yet support arbitrary import/export of CAD files or direct generation
  from AI images. ChatGPT produces breakdowns and orthos separately, then users import
  their images/manifest into Reference Mode.

## Acceptance workflow
1. Open Workbench V2 from Art Lab on phone.
2. ADD an extruded plate, select POINTS+FRONT and reshape control points.
3. Add loft, edit WIDTH on FRONT and FRONT/BACK on SIDE; add a section.
4. Select shape, MOVE, mirror linked, optionally UNLINK.
5. Save a shape preset; insert a second instance from LIBRARY.
6. Group nodes; save as a part or assembly; reload page and reopen the project.
7. Import orthos into reference mode, set width and offsets, trace a piece in both views.
8. Export a JSON bundle and import on another browser/device.
9. Activate TEST IN YARD with a compatible Yardwalker test rig.
10. Confirm new cosmetic shapes move with the existing left knee while the base
    game component IDs, loadout, damage and career saves stay unchanged.

## Suggested follow-on gates
- Better object transform gizmos, touch multiselect and local/world pivot tools.
- Mechanical joint/socket authoring with explicit compatibility and gait clearance.
- Asset dependency revisions and rich thumbnails.
- Two-landmark orthographic calibration and rigorous generated view alignment.
- Stepwise migration of Kestrel/Hauler/armor/weapons into editable geometry recipes.
- Formal promotion of reviewed visual variants into production catalogued game items.

Keep stage-by-stage browser screenshots and prevent regressions to V1 or the Test Yard.
