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
  --traffic=legacy,zipper,lanes,hybrid \
  --seeds=40 --seed=46291 \
  --out=study-results/traffic-trials
```

This is 960 *real physical scenario evaluations* (40 seeds × 3
families × 2 profiles × 4 policy variants). For any fixed event, seed,
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
  candidate, followed by the legacy fallback.

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
