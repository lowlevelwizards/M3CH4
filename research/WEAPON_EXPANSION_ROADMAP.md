# M3CH4 — k4w Four-Weapon Expansion (October 22, 2026)

## Contract

Deliver four **separate playable builds** from `main`, keeping every prior serial ID stable.
Each build must add its own actual combat mechanic and an authored low-poly
part, audio, live player/AI support, garage/market support, focused tests and
limited performance smoke. No fake internal damage, auto-target buffs, combat
debuff "suppression" or full-game test blast for a change that cannot affect it.

Shared principles:
- One weapon installed at the existing **combat** station; append catalogue
  entries, never reorder existing definitions or award free starter inventory.
- Physically trace every damaging impact through real target/cover geometry;
  preserve current armor-first, component serial, field-service and death rules.
- All finite resources are actually consumed. Different ammo types later need
  a settled ammo-cost manifest so rockets are not charged as 1-credit rivets.
- No new navigation omniscience for weapon AIs.
- Measured controls / slow iPhone hardware take precedence over particle density.

## k4w.1 — RR-4 Rivet Repeater (PR #113)

- New U1 serialized RR-4, ~440 kg, -24kW rated, 60/216 belt,
  8.5 Hz, 4.2s reload, 10 hit damage, 470 Ns recoil.
- Real one-per-trigger first-hit traces; immediate automatic fire, pressure via
  actual incoming-fire threat awareness, **not an imposed suppression debuff**.
- Generic optional action state for automatic weapons; bore dispersion rises
  with actual emitted rounds and recovers when firing stops. Brace mitigates
  mount wander. Old four weapons remain in existing behavior.
- Unique box receiver, side drum and cycling bolt using weaponVisualKit.
- Synthesized short mechanical report via the live weapon audio recipe and
  background worker, plus updated module cache identity.
- Tests must protect all 16 existing definitions and serials. Campaign start
  retains only the original five components.

## k4w.2 — Breaker Driver, charged physical penetration

Implement on a branch from latest `main` after k4w.1:
1. Add a `charged` fire-mode to weaponController, with hold -> pressure
   acquisition -> one shot -> press release -> long physical reload.
   Releasing before full charge cancels without consuming ammunition. No auto
   trigger from a newly held input that predates completion of reload.
2. Build `weaponPenetration.js`: accept **ordered actual Three.js intersections**
   along an actual muzzle ray; dedupe mesh overlaps by physical serial/layer;
   consume a finite penetration energy pool by physical armor/housing resistance.
   Stop at solid world cover, exhausted energy, or bounded max layer count.
   Attribute hits to the actual intersected slots. Never infer behind-a-frame
   damage from a generic "shieldedSlot" hint.
3. Use existing applyRecoil with large recoil impulse and meaningful brake/brace
   relationship to the rig's actual grip/inertia.
4. Build a unique hydraulic breech, physical recoil carriage, pressure indicator;
   synthesized pressure release, metal report and heavy return.
5. Give the AI an observable charge commitment and dodge/reposition responses.
6. Validate first frame contact, shielded generator, angled incidence, thin
   exposed Kestrel, deliberate misses, cover blocks, unloading safe cancel,
   ammo/recoil/power exactly once, preservation of ordinary hitscan behavior.

## k4w.3 — Scrap Rocket Rack, moving unguided projectile + explosion

1. `projectileSimulation.js`: spawn at **actual muzzle**, with real velocity,
   60 Hz fixed tick and swept segment collision, lifetime/despawn, owner/team
   identity, deterministic launch order, bounded pooled object budget.
2. One press = one rocket, 3 magazine, ~32m/s start and ~3.5m initial blast
   range; flight can miss, hit cover, be dodged, or hit a moving actor.
3. `explosionResolution.js`: broad-phase radius, real surface exposure and
   cover checks, per-slot bounded damage and single direct/splash accounting.
   Expose shooter and friendly rigs to safe physics and actual blast rules.
   Blast impulses are forces, not arbitrary velocity overwrites.
4. Add enemy prediction based on observed motion only; no homing/omniscience.
5. Unique welded triple tube, visible empties, rocket motor, ignition/blast SFX;
   hard cap on projectiles and fragment/smoke visual allocations.
6. Test tunneling, self-blast, solid cover, duplicate splash on multiple mesh
   pieces, simultaneous detonations and interrupted BO3 round transitions.
   Strong rocket damage can destroy parts and reduce salvage prospects.

## k4w.4 — Arc Cutter, contact-based thermal operation

1. `thermalCombat.js`: sparse heat state per actually contacted module serial,
   with heat deposited only by confirmed short-range contact; cooling on release.
   Do **not** add ambient heat HP to all components globally.
2. Continuous held fire uses thermal contact ticks at a bounded rate, each
   applying armor-first physical damage with heat-dependent material response.
   Moving out of range, moving the aim off the surface and real cover must
   break the arc immediately.
3. Use actual active electrical demand on powerDynamics. Drive/weapon draw may
   generate the expected brownout, temporarily inhibit emission, and recover.
4. One consumable electrode has finite real active cutting seconds. Overheating
   safely forces cooldown. Reload changes electrode at finite inventory cost.
5. Unique insulators, cables, heatsinks, arc head and local material heat stain;
   sizzling contact/cooling and a reduced-cost synthesized buzz.
6. Test empty electrode, head thermal cap, switching serial target, loss of
   contact, brownouts with Draft/Dynamo/Forge, disabled or destroyed gun and
   field service, frame shielding and iPhone stable frame rate.

## k4w.5 — Roster and economy closeout

- Introduce these weapons as equipment on authored opponent crews without
  destroying the user's intentional economic pressure or cheapening salvage.
- Add `ammoConsumedByType` to end-of-BO3 settlement, retaining the original
  1 credit/round default for legacy and rivets. Rockets/penetrators/electrodes
  have differentiated **measured** operational costs.
- Verify five-station loadout legality; no duplicate serials across 3 bays.
- Preserve service histories and surface scars for each physical component.
- Update headless **physical** weapon test resolver before drawing combat
  conclusions: it must implement real shot cadence, penetrations, projectile
  time of flight, blasts, continuous heat, and generator constraints.
- Mirrored spawn 3v3 tests: role matchups, hard-counters, collision/range
  distributions, real salvage availability and 30-contract economic cohorts.
- Favor scenario-specific dominance and counterplay over 50/50 every matchup.

## Release gates

At each build: changed-system unit tests, old weapon smoke, geometry physics
evidence where applicable, browser startup and focused mobile FPS/memory smoke.
Do not claim real match balance from proxy simulation that lacks the new mechanic.
