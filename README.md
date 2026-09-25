# MECH ARENA — 0.0.1g.1 Mobility-Aware Combat Controls

A focused control/locomotion patch on top of **0.0.1g First Hostile Rig**.

## Mobile controls
- **Left thumb:** forward, reverse, step left, step right. Diagonals combine naturally.
- **Right thumb:** aim independently of locomotion.
- **Aim near center:** chassis orientation stays put; the weapon/camera traverses freely.
- **Aim beyond the soft edge:** the installed legs begin rotating the chassis toward the aim while the weapon stays on its world-space target.
- **FIRE / RELOAD:** unchanged in this build.

The locomotion module determines how well the same pilot request can be performed. The three current biped assemblies have different lateral forces/speeds, and damaged left/right drives degrade stepping and turning through the same functional-damage model.

## Install
Overlay the flat playtest patch files on top of the working **0.0.1g** deployment. Keep every unchanged file already on the host.

No folders are introduced. No persistence migration is required.
