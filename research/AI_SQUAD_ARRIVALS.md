# M3CH4 — k4w Squad Objective Arrival Laboratory

**Research-only, stacked on k4v / PR #91.** Do not merge this
directly into a newer `main` until that research branch's conflicts
are reconciled. No new opponent behavior is enabled by default.

## Problem

The team planner allocates capture, contest, defend, and screen
responsibilities, but historically gives multiple allies the same
objective center. Individual pilots then solve geometry independently.
This makes teammates interfere on narrow approaches and in scoring
footprints. A squad-level plan should reserve usable space while
preserving mechanical and strategic truth.

## Optional modes

- `legacy`: exactly the current planner / route executor behavior.
- `slots`: assign stable, separated physical positions inside the
  *actual* scoring circle. Capture radius stays centred on the real
  public point. DEFEND/SCREEN pilots use the reserved position.
- `lanes`: reserve different approach bearings and physically
  reachable staging points but **do not force the final capture spot**.
- `coordinated`: stage via separate lanes and enforce scoring slots
  together, to test whether combining them actually helps.

Only actors already selected for the same objective participate.
Existing paying majority anchors are not displaced. Human players
are counted as occupants but are never issued an order. Reservations
are identity-stable and consider static collision boxes and physical
clearance; poor proposals fall back to normal routing. No damage,
ammo, vehicle speed, player input, or sensors are modified.

## Research interface

`planTeam(snapshot, team, {arrivalPolicy:'lanes', world, ...})`

`runBout(seed, {arrivalFriendly:'lanes', arrivalHostile:'legacy', ...})`

`runOlympicEvent('squad-arrival', {arrivalPolicy:'lanes', ...})`

No optional argument means `legacy` in every call site.

## Validation

```sh
node --test tests/k4wSquadArrivals.test.mjs
node research/aiOlympics.mjs --events=squad-arrival \
  --arrivals=legacy,slots,lanes,coordinated \
  --families=yard,kestrel,hauler \
  --profiles=baseline,cautious \
  --seeds=40 --seed=46291 \
  --out=study-results/squad-arrivals
```

Run this again with `--seed=88127` for independent holdout
and use `research/squadArrivalDomination.mjs` for mirrored 3v3
matches under real scoring and elimination rules.

The physical `squad-arrival` drill starts three fitted rigs
in different approach lanes across a pair of static barriers.
They must enter a shared real scoring circle; the course measures
physical completion, actual separation, contact/collision impacts,
and time without net progress.

## First 960 Olympic trials (engineering scores)

240 matched trials per approach, three families, two pilot profiles:

| Policy | Pass | Mean grade | No-net-advance time |
| --- | ---: | ---: | ---: |
| legacy | 65.8% | 77.54 | 12.477s |
| slots | 65.8% | 79.78 | 1.885s |
| lanes | **88.3%** | **84.32** | **0.447s** |
| coordinated | 48.3% | 76.65 | 0.575s |

Initial result favors the *lane-only* treatment and rejects premature
combination with rigid parking spots. One measured event is not a
proof of superiority in live 3v3; do not change the production default
until holdout samples and human-vs-AI playtests confirm the benefit.

## Safety, scope, limits

- A reservation is never a teleport; `stepRig` resolves all travel.
- The true public scoring center/radius remain the authoritative state.
- Inaccessible slots fall back to ordinary safe objective routing.
- Reserving a specific point for every actor can be worse than letting
  physically compatible arrivals claim whichever open space is nearby.
- The stage heuristic uses only own-team locations and static geometry;
  enemy positions are not used to invent unseen clear routes.
- The new event does not simulate a contested firefight or precise 3D
  weapon raycasts, which remain approximations in the headless runner.
- Each variant is optional; do not auto-promote based on benchmark grade.
