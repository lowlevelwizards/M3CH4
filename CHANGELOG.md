# MECH ARENA 0.0.1g.1 — Mobility-Aware Combat Controls

## Changed
- Left floating stick now expresses **translation intent**: forward/reverse plus left/right side-step.
- Added real lateral leg actuation with force and lateral-speed limits per installed mobility assembly.
- Yardwalker, Hauler and Kestrel legs now have distinct side-step capability rather than sharing one generic strafe speed.
- Right-thumb aim has a soft free-traverse region. Pushing aim farther to either side asks the chassis to rotate and catch up.
- Body-follow counter-rotates the aim by the chassis motion so the weapon stays on the same world-space point while the legs turn underneath it.
- Individual left/right drive damage now reduces paired side-step authority and produces direction-dependent body-turn authority.
- Pilot HUD now distinguishes FWD/REV from STEP L/STEP R and reports FREE TRAVERSE vs BODY FOLLOW.
- Garage mobility specifications now expose lateral speed alongside forward speed.

## Deliberately deferred
- Dash/surge movement.
- Tracks, wheels, quadrupeds or radial walkers.
- Touch-to-fire / firing directly from the aim surface.
- Independent torso joint simulation or hard weapon-traverse stops.
- New enemy AI behavior.
