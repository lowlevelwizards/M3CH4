# MECH ARENA 0.0.1g — First Hostile Rig

## Added
- The stationary range rig now returns fire after a short deployment delay.
- Incoming rounds are raycast against the player's actual exterior component meshes and use the same armor-first localized hit resolution as the range target.
- Mobility hits resolve to the physically struck left/right side and feed the existing asymmetric drive-damage model.
- Target weapon, generator, command and frame condition now determine whether the hostile rig can keep firing; weapon/power damage also slows and destabilizes its fire.
- Incoming shots use the existing pixel sparks/chips/smoke feedback, and player component geometry darkens with real damage for garage inspection.
- A sortie ends when frame, command, power or both drive sides become inoperable. Damage is kept when returning to the Garage; repairing the affected module restores its local range armor/integrity too.

## Scope intentionally deferred
- No locomotion/pathfinding AI, cover logic, tactical decision making, opponent repair, economy, browser persistence, networking or advanced armor model.
- The hostile rig deliberately cycles simple physical aim points; it is a mechanical test opponent, not yet a full combat AI.
