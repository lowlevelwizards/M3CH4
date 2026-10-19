# M3CH4 — k.3v.5 Three Cockpit Identities
## Implemented October 19, 2026

### Design authority
A command module changes its **pilot's physical interior, visible readout
hierarchy, and information presentation**, not sensor capabilities, weapon
handling, sight/aim math, electrical performance, or protective hit rules.

Cab identity is selected only through `installedPart(assembly,'command')`.
The original catalogue definitions, serialized part IDs, mass, nominal kW,
loadouts, save data, controls, ballistic raycasts and combat AI are unchanged.

### Three identities
- **Cyclops**: the original chunky workhorse dashboard (retained, not
  duplicated), supplemented with one deep salvaged CRT hood and a bank of
  physical switches. High-contrast green monochrome, subsystem list and
  direct drive/generator instruments. Command damage appears as fine CRT
  scanline artifacts on its status panel.
- **Vista**: one lightweight, 14-part observation kit with narrow windshield
  stays, shallow low dashboard, open roof crosspiece and slim asymmetric
  housings. Teal numerical motion and electrical information take priority.
  Severe command wear causes small nonessential LCD interruptions.
- **Hearth**: a 13-part enclosed welded interior with broad side cheek
  supports, upper brow, heavy lower instrument recess and reinforced
  equipment panel. Large subsystem readouts and amber failure indications
  prioritize system survival; damaged presentation gains warning-edge marks.

All three assemblies retain a clear central pilot sightline. The installed
command part determines the correct kit. Only one kit is visible at once.
The cockpit's genuine gun pivot, critical warning lamps, damage material,
camera, 3D/DOM rendering and physical hit feedback remain the authority.

### Render architecture
- `cockpitProfiles.js`: one small source of truth for the three profiles,
  screen transforms, canvas dimensions, and deterministic cosmetic
  presentation of real generator/command damage.
- `cockpitDisplays.js`: canvas-only themed drawing for the *existing*
  five logical channels (systems, weapon, team, motion, drive/power).
- `cockpitIdentityScene.js`: mounts distinct static low-poly interiors,
  rescales the existing physical canvas meshes, and installs themed drawing
  via the pre-existing scene integration surface. No second WebGL renderer
  and no secondary cockpit simulation.
- `sceneAssembly.js`: calls the identity installer once at arena creation,
  and reapplies the fitted cab on legitimate garage rebuild events.
- `index.html`: new module import map and `k3v5` cache identities.

The original `scene.js` owns the cockpit, its camera-mounted combiner,
power arcs, impact shake, damage cracks, all combat trace logic, and actual
warning values. To minimize risk and prevent accidental physics regressions,
the identity layer composes with this renderer rather than rewriting it.

### Instrument clipping corrected
The existing motion screen was 220 × 56 pixels but drew a status line at
y = 65. The power/drive screen was 180 × 40 and drew actual bus / reserve
information at y = 49/67. The new fitted textures are 220 × 82 and
180 × 82 respectively. The underlying Three.js plane geometry is resized
to the same aspect ratio, so those lines are not silently clipped.

`auditCockpitLayouts()` checks all five screen rectangles in the current
68-degree camera's 16:9 landscape combiner, with no overlaps, reticle-center
incursions, or out-of-bound projected panels. This is a layout approximation,
not a substitute for iPhone screenshot inspection.

### Damage and critical information
Physical command damage, real measured bus sag, and existing weapon/mobility
fault states remain the **only** sources of failure data. The presentation
styles never overwrite a status to invent an upgrade or penalty.

The original reliable DOM weapon, damage and fault indicators remain in
place even during existing shared power-blackout effects.

### Automated verification
- Full original Node test suite + new tests for all three cab profiles,
  exact screen dimensions, preservation of original serials/catalogue,
  original compatibility checks, screen contents, damage integrity and
  module-switching hooks.
- Headless Three.js 0.186.0 geometry audit of all three cockpit interiors:
  exactly one visible kit, all five resized canvas surfaces, and no
  centerline intersection from the pilot's nominal head position.
- Existing no-renderer power/locomotion/part identity studies,
  physical shielding audit and headless 3v3 Domination compatibility.
- CI results can be seen in the `k3v5 Cockpit Identities CI` workflow.

### Remaining manual QA
Actual iPhone landscape playtesting has not been automated. Check
readability under device-safe-area cropping, camera look up/down and
free-look tether, bracing/recoil animation, exterior-to-interior matching,
battle damage, and long-session animation/render smoothness.

No actual browser screenshot or touch playtest is claimed by headless tests.
