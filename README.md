# MECH ARENA — 0.0.1g First Hostile Rig

This patch turns the existing stationary range target into the first dangerous opponent while keeping the scope deliberately small.

## Play loop
1. Configure and repair SR-01 in the Garage.
2. Tap **DEPLOY**.
3. TGT-01 begins firing after a short delay.
4. Its rounds can strike the actual frame, mobility, power, command or weapon geometry on your machine.
5. Damage immediately feeds the existing functional model: one damaged leg pulls the rig, generator damage limits power, and weapon damage compromises your gun.
6. Shoot TGT-01's weapon/power/command hardware to degrade or stop its return fire.
7. If your frame, cockpit/command, generator or both drive sides become inoperable, the test ends. Return to the Garage and repair the same installed serials.

## What is intentionally simple
TGT-01 does not move, pathfind, seek cover or make tactical choices. A deterministic training controller cycles physical aim points and fires its installed Stump cannon using the same magazine/reload rules. Damage to its weapon and generator increases trigger delay and spread before eventually shutting it down.

## Applying this patch
Overlay the flat playtest patch files on top of the working **0.0.1f** deployment. Keep every unchanged file already on the host.

This build still uses in-session state only; reloading the page resets the prototype machine.
