# MECH ARENA · 0.0.1c — A SHOT HITS SOMETHING REAL

Based on **0.0.1b.6**, in two small internal stages.

### Stage c.1 · Real fire cycle
- Live-fire behavior for the existing training, stump and needle cannons; one shared ballistic model, not new equipment slots.
- Finite magazines and spare ammunition, repeat-fire cooldown, manual/empty-magazine reload, deterministic small spread.
- Big touch FIRE/RELOAD controls; F/R keyboard support; compact pilot-view ammo readout.
- Muzzle flash, impact spark, transient shot tracers and synthesized low-fi mechanical gun/reload/impact sounds.
- Recoil impulse acts on the same real mass and yaw-inertia state used by the drive simulation. Visual gun barrel responds to selection and firing.

### Stage c.2 · Physical target and local hits
- A stationary second rig built from the actual five-station catalogue, with **distinct owned serials**, placed on a marked pad in the existing warehouse.
- Line-of-sight test from camera; actual shot ray from the physical off-center muzzle; nearest hit among part-owned target meshes and warehouse solids.
- Five independently tracked local armor pools and underlying component integrity values; no generic target health bar. Underlying damage mirrors onto the target's owned part record without changing identity.
- Localized mesh darkening, limited number of small persistent impact marks, visual hit notification, optional compact TARGET diagnostics and instant target rebuild.
- Target-body obstacle added to existing warehouse movement collision rules.

### Protected scope
No enemy AI, player damage, functional failures, simulated projectile gravity, persistent career state, repairs, new part categories or generalized mounting expansion. Current iPhone steering, assembly camera and all three command × three frame options remain unchanged.

### Verification
47/47 offline test cases passed. Pure core strict TypeScript type-check passed; all TypeScript files transpiled with no syntax diagnostics. The final live rendering/build cannot be certified here due blocked package and browser-network access and needs the hosted iPhone playtest.


### 0.0.1d — Controlled functional damage
- Independently damage left and right locomotion sections inside the existing installed mobility assembly.
- Convert real owned-part condition into unequal drive forces / steering bias, damaged-generator power derating, damaged-weapon inaccuracy / slower cycling / shutdown.
- Five DEV controls to reproduce faults and reset the installed test parts. Minimal cockpit warnings and target-condition consequences.
- Deliberately no AI, garage, repair economy, player armor or persistent save format.
