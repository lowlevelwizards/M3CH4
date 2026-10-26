# M3CH4 Workbench — Open Existing Parts & Assemblies

The **Open Existing Game Content** tools in `part-workbench-v2.html` use
M3CH4's real 3D builders, not re-creations or box substitutes.

## Load and edit a factory component
1. Choose a factory component from the GAME CATALOGUE list.
2. Tap **OPEN / EDIT** to open it as a separate V2 project. Your prior
   Workbench project is saved first and can be reopened from the Library.
3. The object tree contains the actual factory groups and every supported mesh.
   Parent groups preserve their source positions and rotations. Hips, knees,
   ankles and other tagged joint anchors are locked by default.
4. Tap a **MESH** row, choose **POINTS**, and select FRONT, SIDE or TOP.
   Drag an amber control point. Corresponding coincident vertices move together,
   keeping hard-edged mesh seams together. For higher precision or hidden points,
   use **IMPORTED MESH POINTS**, the point-page selector, and X/Y/Z numeric controls.
5. MOVE / ROTATE / SCALE modifies the currently selected shape or group.
   Existing authored geometry is represented by editable indexed triangles
   with its source color, local transforms and named parent hierarchy.
6. Select the imported top group and tap **SAVE AS PART** to create a new
   reusable variant in the Workbench Library. Select a subtree and **SAVE
   ASSEMBLY** to save that mechanical group.

Use **INSERT** to add another *copy* of a factory component to your current
Workbench document without abandoning the project.

## Open complete in-game mechs
- **OPEN FACTORY MECH** loads a clean default game rig built by the real engine.
- **OPEN TEST YARD LOADOUT** opens the actual parts fitted to your existing
  Test Yard loadout in this browser (read-only from the Test Yard save).

You can select the structural frame, mobility, pilot cab, power pack, weapon,
and each imported subassembly via the same hierarchy. Save any suitable group
as a reusable Part or Assembly.

## What is (and isn't) changed
This is a *copy* of the actual game geometry. Editing it cannot silently
change the installed production component, its joint definitions, damage
model, price, mass, physics, or career save. Imported meshes are editable
even when the legacy source builder is imperative JS. A saved Workbench Part
is available in your creative library immediately, not a new gameplay
catalogue definition unless separately authored/reviewed.

Imported mesh editing is direct-position triangle editing, not a lossless
conversion to easy parametric controls. Existing boxes, bearings and extruded
shells retain their real vertices and can be reshaped, but advanced automatic
parameter inference (e.g. a specific fillet radius) is not yet provided.
Surfaces are rendered using the original vertex topology, normal and main
material colors. Fine UV textures, procedural paint scarring, overlays,
mechanical moving components and non-mesh decorations may not roundtrip as
exact production geometry. Mechanism parenting is preserved as named groups,
but original gameplay animation or hitzone metadata is not reauthored from
a visual edit.

Whole imported rigs may exceed the current **Test Yard visual-only overlay**
session-storage limit, since that preview still supports just a left-knee
sandbox attachment. Full gameplay promotion remains a separate engineering
step with fit and gait checks.

Browser storage is not a durable sync service: **EXPORT PROJECT + LIBRARY**
regularly, including imported sources and any reference art.

## Validation
`research/workbenchFactoryBrowserSmoke.mjs` imports **every current game
CATALOG part** from the actual production builder and both complete rig
sources. The test checks source-backed mesh topology, point editing, reusable
library saves, and whole-rig hierarchy in a real phone-sized Chromium page.
`tests/workbenchFactoryMesh.test.mjs` guards normals, indexed faces, seam
vertex editing and invalid imports.
