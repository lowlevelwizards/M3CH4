# MECH ARENA 0.0.1e.1 — First Garage

## New and changed

- Renamed and repurposed Assembly as the main **Garage** screen; it opens on launch.
- Added **Deploy** inside the Garage and on the top toolbar, plus **Garage** return in the arena.
- Entering the range respawns the pilot rig at the training start and refills the current weapon's test ammunition; it does **not** repair, replace, or recreate any owned component.
- The existing parts list shows condition. Selecting a part shows its serial, condition bar, accumulated wear, repair count, current consequences, and a repair button when damaged.
- Mobility inspection shows **independent left/right drive condition** within its one physical paired-leg assembly. Repair restores both sections and preserves the existing part identity.
- Other equipped modules repair independently; damaged spares remain damaged until reinstalled and repaired. Healthy parts cannot accrue fake repairs.
- Shot feedback now separates armor impacts, penetrations, and disabled target modules; all existing 3D effects remain.
- Added a small, pure `garage.ts` service module with targeted unit tests.

## Deliberately deferred

Versioned saves, repair economy, incoming fire, additional parts, new 3D damage particles, persistent scorch/debris and advanced thermal failures. Existing 0.0.1d.1 failure logic remains unchanged.
