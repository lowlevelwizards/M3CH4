# MECH ARENA 0.0.1j.1 — First Moving Opponent

This is a **flat-directory mobile playtest PATCH**, not a complete project. Overlay its files on your working **0.0.1i** static site. Keep all unchanged files and keep all other static files.

## Included
- Existing hostile target now owns a real `RigState` and uses the same fixed-step `stepRig` movement and installed-component locomotion properties as the player.
- Small deterministic maneuver: approach → strafe right → retreat → strafe left → brace, repeat. The heavy body turns toward your real position with limited torque and yaw inertia.
- Moving target model, actual moving component hit volumes and actual moving cannon muzzle stay synchronized. Its existing weapon only fires while you're within its forward firing arc.
- Its current pooled mobility integrity and generator condition reduce its *actual* drive and turning output; disabling mobility stops powered movement. The two leg sides remain one pooled target condition until a later build.
- Both rigs see the other as a moving solid obstacle; existing arena walls and barriers still apply.
- DEV readout shows hostile maneuver/position, and the HOSTILE panel shows maneuver and drive health.

## Explicitly deferred
No pathfinding, obstacle navigation, tactical decision-making, gait animation, separate target-side leg damage, saved enemy state or new locomotion categories. Your existing player-owned garage save format is unchanged.

## Mobile installation
Extract the **playtest PATCH** into your existing 0.0.1i hosted directory, replacing only matching files and retaining all others. Keep the same origin to preserve your Safari garage save. `index.html` must be replaced: it starts `main.js?v=j1` (not `main.ts`) and supplies the Three.js import map with a new `scene.js` revision.
