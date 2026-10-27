# M3CH4 Workbench 3 — Visual Part Authoring (draft PR #214)

## Goal and boundaries
This iteration improves the **existing** production-adjacent Workbench V2. It is not M3CH4Ex and does not introduce a second constructor. The editable JSON schema remains `m3ch4.workbench` v2; existing projects and factory imports remain supported. All chat-generated assets are private library **drafts**, not purchasable or physically certified modules.

## Phone navigation
- One finger orbits in 3D when using Select/Points, even if the model fills the screen.
- Pinch to zoom and slide two fingers together to pan; both work in perspective and orthographic views.
- **+ / −** provide explicit zoom; **FIT** frames the complete rig. The existing focus-selected and angle-reset controls remain.
- The selection stays available when switching camera views. Camera pan/focus is not a geometry edit.

## Mesh selection and editing
1. Select a **shape** (not a locked joint or an entire abstract assembly group).
2. Choose **POINTS**, then **TAP** or **BOX SELECT**.
3. In Tap mode, select an individual point; use **+ ADD** or **− REMOVE** to alter the set.
4. In Box mode, draw a rectangle in Front/Side/Top/3D. **VISIBLE** uses ray tests to exclude points hidden behind the mesh; **THROUGH** includes front and back positions in the rectangle.
5. Switch **SOLID / WIRE / X-RAY** as necessary. All/Ghost/Isolate still control *other objects*.
6. With two or more points selected, use relative **X/Y/Z Δ** sliders or drag the group via one point. Mesh and polygon profiles also have relative axis scales (×). These operate on the original geometry snapshot and commit as one undo step.
7. Switch views and keep the logical selection. **ALL** selects the current shape's vertices (not all nodes in the rig); **CLEAR** exits the point selection.

Imported mesh points are welded by source position for seam-safe updates. Full-marquee selection scans all logical vertices, not just the current inspector page of 64. Dense meshes may still benefit from isolating the shape; visibility ray tests and SVG controls need real-device profiling.

## Chat → library
A prompt can generate **declarative** `m3ch4.workbench.asset` version 2 JSON (shape, part or assembly). The library provides **IMPORT PART JSON** separately from project-bundle import.
- The asset must contain a valid named root, editable child shapes, legal geometry, hierarchy, and transforms.
- A chat asset is never executed as JavaScript; it is validated and cloned to an independent library identity.
- The library remains in the local browser's IndexedDB. **Export the project/library bundle for backup** before destructive browser maintenance or device changes.
- Sample: `workbench-assets/yardwalker-broad-shell-s1.json`. It is a demonstration draft, not mechanically certified or an approved production replacement.
- The current workflow is generate/download JSON → import into Library → insert/edit → save/export. A remote shared-library service is not part of this PR.

## Geometry audit
The selected editor document reports shape, vertex and triangle counts and selected advisory warnings. This is *not* mesh Boolean union, occlusion-based auto-delete, or physical fitness validation.

## Test Yard integration
**TEST OVERLAY** preserves the original knee prototype behavior.
**TEST CALF SWAP** packages an opt-in sandbox-only `replace-calf` mode. In the real Test Yard with Yardwalker installed, the preview builder finds the existing left knee, hides its named original olive calf shell, and attaches the editable candidate. If the expected production shell is absent, the test substitution fails safely without hiding anything.

Both paths:
- Keep authentic knee/ankle motion and unchanged game mechanics.
- Mark added meshes as `visualOnly`, without projectile raycasting.
- Never write owned parts, career records, vendor stock, performance rules or the production catalogue.
- **Do not** claim collision or armor coverage matches new visual geometry. That requires a later explicit production PR with fit, animated clearance and ballistic checks.

## Risks and acceptance
- The tools require iPhone portrait/landscape review, especially large imported factory meshes and mixed pointer gestures.
- Multi-selection uses welded source-group ordering; topology-changing operations beyond position edits are not supported.
- Loft section handles represent parametric dimensions, so their selections may behave differently from raw imported mesh vertices. Examine actual mesh/profile editing first.
- Browser CI includes pure geometry tests, complete legacy Workbench smoke and a new selection/import browser smoke.
- Do not merge a new visual part into factory source without visual approval, matched assembly poses, joint-clearance evidence, and appropriate collision updates.

## Next milestone: real factory redesign
1. Author/refine the Yardwalker calf draft.
2. Compare factory/draft at identical scale and view; remove overlapping unsupported pieces.
3. Preview the visual replacement walking in the real Test Yard.
4. Validate both sides, dynamic clearance, new shape bounds and mobile performance.
5. Promote **only the approved housing** to the production visual builder in a separate controlled change. Preserve a quick rollback.
6. Repeat with Cyclops cab and Stump Cannon once the first part is approved.
