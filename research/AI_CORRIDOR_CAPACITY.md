# M3CH4 — k4x Shared-Corridor Capacity Research

Research-only, opt-in physical teammate coordination. Builds on
[k4w Squad Destination Planning](../research/AI_SQUAD_ARRIVALS.md).

## Purpose

Separate objective ownership from *route congestion*: three machines may
head toward completely different A/B/C objectives but share the same narrow
doorway. The k4w same-objective slot planner cannot anticipate this.

`ai/corridorCoordinator.js` samples the team's actual planned A* static
routes and identifies passages with solid static obstacles on both sides.
It groups routes that physically overlap in the constrained passage even
when the assigned objective IDs differ.

The planner reserves **upstream real-world staging points** and
absolute, bounded gate entry windows. The pilot keeps the reservation
until it expires or physical progress establishes that the gate is clear.
An actor moves under the normal `stepRig` simulation; stopping at staging
ground means braking, not an instantaneous move or a free capture.

## Policies

- `legacy` — no new coordination; the game continues to use this by default.
- `priority` — 2.7-second sequential release offsets.
- `stagger` — 5.4-second sequential release offsets.
- `clearance` — conservative 8-second spacing but can release earlier
  if a leading rig has physically cleared the shared passage.

All use unchanged vehicle speed, collision radius, traction, power,
combat, ammo and public scoring rules. No hidden enemy positions are read.
The player never receives forced orders. Protected paying anchors
are never pulled from an objective.

Research usage:

```js
const team = planTeam(snapshot, 'friendly', {
  world, corridorPolicy: 'stagger', corridorMemory,
  previousOrders
});
```

The real match simulator accepts independent `corridorFriendly` and
`corridorHostile` options. No option means `legacy`.

## Physical competency course

New tenth AI Olympics event: `corridor-crossing`. Three fitted real rigs
begin on one side of a corridor created by two industrial walls, while
their three DIFFERENT capture goals are on the far side.

```sh
node --test tests/k4xCorridors.test.mjs tests/k4wSquadArrivals.test.mjs
node research/aiOlympics.mjs \
  --events=corridor-crossing \
  --corridors=legacy,priority,stagger,clearance \
  --families=yard,kestrel,hauler \
  --profiles=baseline,cautious \
  --seeds=25 --seed=91841 \
  --out=study-results/corridor-holdout
```

The scoring circle retains its physical `4.7m` radius (3.3m
conservative chassis-centre threshold). The initial trial had a
**test-scoring defect**: it required machines to approach within
2.7m even when standing correctly inside their scoring footprints.
The test was fixed transparently; early 0% pass results must never be
treated as evidence of AI performance.

## Initial comparable Olympics: 12 seeds per cohort

288 total trials: 12 seeds × 3 mobility families × 2 pilot profiles × 4 policies.

| Policy | Physical completion | Collision impacts / trial | No-net-progress |
| --- | ---: | ---: | ---: |
| legacy | 80.6% | 1.555 | 14.32s |
| priority | 97.2% | 0.194 | 1.10s |
| stagger | 100.0% | 0.074 | 0.015s |
| clearance | 100.0% | 0.065 | 0.204s |

This is a small engineered obstacle test, **not proof** that corridor
coordination improves general match-winning behavior. No changes are
automatically promoted to the shipped AI.

## Validation gates

1. Verify the same effect on independent corridor seeds.
2. Check side-swapped actual 3v3 Domination objective scores, elimination
   results, damage and route faults, not just a synthetic course grade.
3. Check tradeoffs: deliberately waiting is not productive guarding,
   and increased time-to-objective may negate fewer collisions.
4. Confirm that static corridor detection does not invent a choke in
   open yards or when only one side has cover.
5. Test against human positioning and alternative arenas before any live
   opponent receives an optional corridor policy.

Outputs are JSON, per-trial CSV and readable Markdown in GitHub Actions
artifacts. Workflow: `k4x Shared Corridor Olympics` and
`k4x Corridor Holdout & Domination`.

## Architecture limitations

- Each replanning update samples actual path geometry, but it is still
  A* over static arena boxes rather than a full motor-level joint planner.
- Some adjacent objectives may use different routes without a real
  bottleneck; those cases should remain completely unmodified.
- Headless 3v3 projectile hits approximate Three.js raycast outcomes.
- A static gate's capacity can change if destruction or new obstacles
  are introduced; future work must invalidate stale reservations.
- Not all narrow passages need one-at-a-time queues; wider passages
  may support parallel safe travel.
- k4x is stacked on k4w, which is stacked on k4v, and must be
  reconciled with newer main before merge.
