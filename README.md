# MECH ARENA 0.0.1j.2 — Spatial Awareness

This is a **flat-directory mobile playtest PATCH**. Upload only these files over your existing working **0.0.1j.1** deployment, preserving all unchanged files. Do not delete the old files or deploy this partial ZIP on an empty host.

The hostile rig now looks ahead, avoids existing walls, barriers and warehouse pillars, and physically backs up/retries if it gets stuck. It still uses the same installed machinery and damage-dependent movement. The DEV readout displays its current navigation state and waypoint; enable **COLLIDERS** to see a teal floor-ring marker at the active waypoint. There are no new touch controls and your garage save format has not changed.

This is local obstacle avoidance rather than full navigation or tactical AI. Long-range routes and purposeful circling remain later steps. The updated `index.html` launches the **compiled `main.js`**, includes the Three.js CDN import map, and cache-busts changed JavaScript modules.
