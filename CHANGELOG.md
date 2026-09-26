# 0.0.1j.1 — First Moving Opponent

- Added a tiny deterministic movement controller for the hostile rig, using the player's existing locomotion physics and the opponent's installed parts.
- Synchronized moving target hit geometry, scorch marks and hostile weapon origin to its physics pose.
- Added moving two-way mech collision; existing world collisions remain enabled.
- Damage now physically derates the hostile rig's movement and turning; disabled mobility stops its maneuver.
- Kept hostile fire within a broad forward arc and exposed the maneuver in existing diagnostics.
- Refreshed mobile HTML cache revisions; unchanged player save format and unchanged touch controls.
- Scope intentionally excludes tactical AI, walking animation and independent hostile left/right actuator damage.
