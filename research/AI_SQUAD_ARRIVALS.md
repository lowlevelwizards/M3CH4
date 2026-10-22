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

## Independent-seed holdout and 3v3 decision

A second course experiment used new seeds `88127` with 30 seeds × 3
families × 2 profiles, **180 physical trials per candidate**:

| Policy | Independent pass rate | Mean grade | No-net-advance |
| --- | ---: | ---: | ---: |
| legacy | 72.2% | 79.05 | 12.237s |
| slots | 57.8% | 77.54 | 3.971s |
| lanes | **76.7%** | **82.58** | **0.903s** |
| coordinated | 51.1% | 76.74 | 1.299s |

Lane staging generalizes to the new seed set, but with a smaller
completion-margin (4.5 percentage points versus 22.5 previously).
This is expected under broader physical spawn/handling variations
and argues against prematurely declaring a best universal policy.

**Full scored 3v3:** 20 side-swapped seed pairs / 40 bouts resulted
in **18 legacy wins, 18 lanes wins, 4 draws**. Team time on objectives
averaged 71.343s (legacy) versus 69.623s (lanes). There is no
demonstrated match advantage. Real objective allocation often spreads
the squad across different zones, while k4w intervenes only when
two or more rigs are assigned the **same** objective.

**Promotion decision:** Keep `arrivalPolicy:'legacy'` live. The
separated-lane candidate remains accessible for scenario experiments
and potential future faction behavior. The tight-space trial appears
to benefit, but there is no mandate to globally replace a policy
that can perform equally well in ordinary battles.

Workflow evidence:
- Initial Olympics: GitHub Actions `39821610495`
- Independent holdout and full 3v3: GitHub Actions `39822035895`
- The workflow archives readable reports and per-trial JSON.

### Next hypothesis suggested by results

Synchronous routes **to different objectives** can still pass through
the same constricted entrance. A future planner could reserve corridor
capacity at the team scale independently of objective ownership,
e.g., stagger entry commitments for nearby machines whose physically
validated routes overlap. This is distinct from rigidly prescribing
exact final scoring slots, which the Olympics rejected.

Separate competency, difficulty and faction personality decisions.
Do not use stage times as magical speed upgrades.
