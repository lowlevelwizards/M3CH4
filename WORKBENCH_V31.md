# Workbench 3.1–3.4 — implementation review and usage

> Draft PR #216. This extends the **live M3CH4 Workbench** and preserves the existing V2 document/asset format. It is not a new constructor. All factory imports are independent editable COPIES. Career and combat data are unaffected.

## Implemented
- Gesture safety: canceling a pointer, interrupting a drag, switching tools, Escape, or losing focus restores preview geometry instead of silently committing. Slider cancellation reverts.
- Camera focus no longer resets when rebuilding a Yardwalker-context draft. Double-tap to frame all without deselecting. Point mode includes temporary PAN/ORBIT override and Focus selected vertices.
- Imported mesh logical vertex grouping is persisted at first edit, rather than re-inferred from changing XYZ positions. Legacy V2 meshes still load.
- Viewport no longer displays only a fixed page of 64 imported vertices; on-screen unselected handles are adaptively reduced while all logical vertices remain selectable.
- Group loft transforms apply each section's shared parameters once per edit. Profile points and loft sections can be inserted after the selected control.
- Point, Edge, and Face selection for imported meshes and polygon shells; direct and marquee selection maps to editable vertex groups, using the same guarded group transforms. Loft remains semantic POINT editing.
- Expandable hierarchy browser shows factory assembly structure, individual visibility toggle, phone MULTI selection, Hide Others/Show All, reparent, group, and ungroup while preserving world transforms or rejecting unrepresentable shear.
- Mirror unlinking bakes X reflection and maintains visual appearance. Mesh triangle winding and normals are handled.
- X/Y/Z group moves and per-axis scales provide exact numeric entries beside sliders.
- Library asset versions, independent OPEN, revisions and recovery, project checkpoints and atomic portable bundle backup. IndexedDB upgrades from schema 1 to 2 without deleting previous records.
- Concept sheets and module-reference images can be previewed and zoomed inside the REFS tab. Image replacement/removal and view rotation controls added.
- Comparison for factory-linked drafts: ORIGINAL OVERLAY / SIDE BY SIDE / OFF, synchronized to the editor camera and lighting.
- Test Yard visual-only left or right Yardwalker calf preview. The return link goes back to the same stored Workbench project. Comparison reports broad-phase model dimensions; no swept clearance or collision claim.

## Operator workflow
1. Open existing factory part or rig. The factory geometry is copied into a new editable Workbench project.
2. Expand the hierarchy, hide interfering housings with eye icons, use MULTI to pick several components, or use MOVE TO GROUP to reparent an object.
3. Select Points, Edges, or Faces for supported meshes. Tap or box-select, optionally use Through, then drag or enter numeric deltas in metres. For lofts, use the semantic Point handles.
4. Use PAN / ORBIT without clearing the selected vertices. FOCUS zooms to the active vertex cluster.
5. From LIBRARY save a named CHECKPOINT before major reshaping. Save as Part/Assembly or OPEN an existing library asset to edit its independent draft and SAVE ASSET REVISION. HISTORY restores earlier saved asset revisions without deleting later versions.
6. On factory-linked projects, open the precise properties drawer and cycle COMPARE ORIGINAL through overlay and side-by-side.
7. Use REFS for front/side/top calibration images or concept/module sheets.
8. Select LEFT CALF / RIGHT CALF, then TEST OVERLAY or TEST CALF SWAP. In the Test Yard choose WORKBENCH to return. Preview remains visual-only and never changes official collisions or gameplay statistics.
9. Export a bundle for an external backup, especially before clearing browser storage or switching devices.

## Compatibility and limits
- Existing Workbench document and asset formats remain V2. New optional `pointGroups` persists welded vertex membership in imported mesh geometry and is validated.
- Only imported triangle meshes and polygon shells have Edge/Face selection in this iteration. Edge/Face operations select and transform their existing vertices; they do **not** yet extrude, inset, bevel, retopologize, boolean-merge, or weld arbitrary triangulated surfaces.
- Loft parameter controls are deliberately not treated as arbitrary triangle vertices, and full topology editing of loft caps is not supported.
- Mirrored geometry with rotated nonuniform-scale ancestors can be unrepresentable as pure TRS; move/group operations reject shear rather than shifting the visible model.
- The Workbench does not yet provide fully generalized attachment slots for all mechs/weapons, swept joint collision certification, projectile hit volume rebuilding, or direct factory promotion. Yardwalker calf preview is a pilot.
- A/B comparison works on projects with a known factory part definition. Concept-sheet comparison remains in a reference viewer.
- Fine iPhone gesture/touch review and CI validation are necessary before merging.

## Roadmap not yet fulfilled by this PR
1. Multi-object joint axis manipulation and universal control surface gizmos with custom pivot/world/local modes.
2. True topology creation (edge loops, extrusion, inset, bevel, merge/weld), intelligent normal recalculation, and high-complexity mesh cleanup.
3. Full mechanical audit: disconnected islands, exposed internal faces, movement collisions, mounting dimensions and dynamic clearance.
4. Named validated visual slots for Cyclops, Stump and the remainder of the game catalogue.
5. Approved production redesigns of the Yardwalker, Cyclops and Stump Cannon, including physical/collision changes and gameplay tests.

Do not claim these remaining items are completed, and do not promote any test visual into career/combat code without explicit art and mechanical review.
