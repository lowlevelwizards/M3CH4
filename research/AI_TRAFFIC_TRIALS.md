# k4v.2 — Squad Traffic A/B Laboratory

**Status:** experimental; live games still use `legacy` until a policy
is shown to outperform it without creating regressions. Policy selection
does not alter machine speed, grip, impact collisions or sensor knowledge.

## Replicable contest

```sh
node --test tests/k4v2Traffic.test.mjs tests/k4v1AiOlympics.test.mjs
node research/aiOlympics.mjs \
  --events=ally-choke --families=yard,kestrel,hauler \
  --profiles=baseline,cautious \
  --traffic=legacy,zipper,lanes,hybrid,gated \
  --seeds=40 --seed=46291 \
  --out=study-results/traffic-trials
```

This is 1,200 *real physical scenario evaluations* (40 seeds × 3
families × 2 profiles × 5 policy variants). For any fixed event, seed,
family and personality the start positions and fitted rig hardware
remain identical. Three actors have real dynamic collision bodies
and proceed through the same narrow gateway.

## Candidate policies

- **legacy:** old nearest-ally local sidestep with 1.3-second waypoint
  lock. Zero live behavior change.
- **zipper:** front-to-back queue for an observed machine in the same
  corridor. The follower temporarily braces, preserving its route;
  its waiting is bounded before the legacy bypass fallback resumes.
- **lanes:** deterministic actor-identity passing side. Candidate points
  must be within the physical world, out of static obstacles and clear
  of nearby peer collision envelopes before being accepted.
- **hybrid:** bounded front-to-back queue first, then a stable passing
  candidate, followed by the legacy fallback. It is a global candidate,
  *not* the live default.
- **gated:** experimental variation on hybrid activated only when bilateral
  static geometry indicates a nearby corridor. Early trials underperformed
  severely because the constraint was detected too late. It is kept as a
  negative control rather than silently overwriting the stronger hybrid.

## What the initial experiments taught us

On the exploratory seeds, unrestricted hybrid passed 85.0% against the
legacy 78.3%. On independent seeds, unrestricted hybrid passed 92.0%
versus legacy 81.3%. The speed and precision of these narrow-passage
improvements are real, but **a 24-bout 3v3 comparison did not demonstrate
better match wins**; it reported 10 wins for hybrid and 11 for legacy,
with 3 draws, and more collisions for hybrid in open play.

A terrain-gated hybrid with a short lookahead then reduced choke success
to roughly 65–70%, while yielding near-identical 3v3 results to baseline.
Increasing lookahead alone did not recover choke success. For auditability
that failed idea is now named `gated`, and the original `hybrid` remains
separately testable. Simulator/live nearby-ally snapshots now both include
real physical ally velocity; unvalidated results must not be promoted.

## Do not optimize merely for a "high score"

The primary measure is the **whole-team completion rate**: all three
machines reach the same reachable destination before the deadline.
Secondary measures:

- Mean score /100 including actual completion progress
- Meaningful net mission advancement vs looping despite movement
- Collision impulses, especially in mixed/changing positions
- Mechanical hard stalls, recovery cycles and route failures
- Seconds waiting for a teammate (deliberate queue, NOT a legitimate
  scoring anchor). Long queues are also penalized.
- Per-family paired outcomes and worst seeds — a winner may perform
  well with Yardwalkers but fail with Haulers.

An apparent win is **not** confirmed until the same policy outperforms
legacy on a *different* seed schedule, matches the ordinary Olympics
movement/control events, and is checked in full real 3v3 battle
conditions. The comparison runner does not apply a candidate to the
production contract/AI path unless explicitly passed the optional
`{trafficPolicy}` parameter.

## Caveats

The scenario represents a controlled gate crossing, not opposing
traffic, turning through several entrances, or a complete scored
Domination encounter. The code does not implement rig-to-rig momentum
transfer beyond existing collision resolution. A queue proposal is
judgment, never a teleport or direct velocity change.

`--seeds` must be fixed for apples-to-apples comparisons; use
`--seed=77001` or another independent value as a holdout validation.
The runner produces reports at `study-results/traffic-trials`
(`report.md`, `results.json`, `results.csv`).

Workflows: **Actions → k4v.2 Squad Traffic Trials**.

**Next gate:** only promote the physically best and stable policy to
default after verifying that no adverse change to human combat,
objective defense, and other mobility families is introduced.

## Final reproducible results on experimental branch

Two seed sets were measured with 40 and 25 matched seeds respectively,
across three physical mobility families and two pilot profiles.
The corrected `loopSeconds` diagnostic does not penalize intentional
scoring holds. Per-policy completion rates for `ally-choke`:

| Policy | Exploratory 240 trials | Holdout 150 trials |
| --- | ---: | ---: |
| legacy | 78.3% | 81.3% |
| zipper | 76.7% | 77.3% |
| lanes | 74.2% | 81.3% |
| hybrid | **85.0%** | **92.0%** |
| gated | 70.0% | 69.3% |

The unrestricted `hybrid` also reduced collision event frequency in
the gate, from 0.806 to 0.119 per trial (exploratory cohort), and
no-net-objective advancement from 14.473 to 6.012 seconds.

**The 48-bout mirrored 3v3 holdout did not establish a match advantage:**
Legacy won 22, Hybrid 22, with 4 draws. Average collision counts
were higher for Hybrid (0.417 vs 0.063 per bout), even though Hybrid
had marginally more combined zone occupancy
(72.157 vs 70.450 seconds per side).

This is a **non-promotion result**. The game remains on the
`legacy` traffic default. A faction or local navigation planner may
be given an explicit traffic override only after future validation
across multiple full-match maps and human playtests.

### Experiment references

- Explorer: GitHub Actions run `39818520035`
- Independent holdout and 3v3: GitHub Actions run `39818529893`
- The holdout archives `results.json` and `report.md`.
- On a future feature branch, only promote a traffic override after
  demonstrating improved objective completion without higher
  unintended collisions or unproductive team waiting.
