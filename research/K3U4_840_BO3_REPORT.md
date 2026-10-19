# k.3u.4 AI verification — 840 matched-side 3v3 BO3 Domination series

**Executed successfully:** [GitHub Actions run #39188264953](https://github.com/lowlevelwizards/M3CH4/actions/runs/39188264953). Four successful independently scheduled shards, full JSON per-round/series logs and summary artifacts: `k3u4-bo3-0` through `k3u4-bo3-3`.

**New tactical generation:** k.3u.3 AI as shipped through k.3u.4 on production main commit `4db042147bb12f90e211f98c557669f2f9a5f971`.

**Opponent:** Exact archived k.3u.2 `strategicState.js`, `teamPlanner.js`, `pilotBrain.js`, `intentExecutor.js`, `positioning.js`, and `navigation.js` from historical main commit `93286524dfdec43c89b2d8b26aca8126e0dfac59`. Other unchanged physical modules are common to both; the updated team also exercises live main's observed target priority, shot gating, subsystem aim and teammate traffic/staging.

## BO3 outcomes

| Cohort | Series | Individual rounds | k3u4 wins | k3u2 wins | unresolved | Decisive new-AI win % |
|---|---:|---:|---:|---:|---:|---:|
| Balanced armed, matched hardware | 600 | 1,432 | 481 | 109 | 10 | 81.53% |
| No damage, territory only | 120 | 243 | 0 | 120 | 0 | 0.00% |
| Both teams equally worn by 25% | 120 | 283 | 106 | 13 | 1 | 89.08% |
| **Total** | **840** | **1,958** | **587** | **242** | **11** | Mixed-cohort aggregate not a meaningful single effectiveness score |

There are 420 paired random seeds, each exercised twice with the generations assigned to opposite spawn sides: 300 armed seed pairs, 60 no-damage seed pairs and 60 worn seed pairs. Each BO3 series ends with two wins or after at most three rounds. Series with insufficient wins remain unresolved, including drawn rounds.

## Armed metrics (1,432 rounds, 4,296 rigs per generation)

| Statistic | Latest k3u4 tactical AI | Previous k3u2 AI | Change |
|---|---:|---:|---:|
| Credited objective captures | 5,824 | 4,847 | +20.2% |
| Accumulated seconds inside zones | 278,346 | 247,317 | +12.5% |
| Distance travelled (m) | 400,062 | 220,599 | +81.4% |
| Armor + internal damage | 3,449,142 | 3,567,324 | -3.3% |
| Credited opponent disables | 3,371 | 1,074 | 3.14x |
| Actual rounds spent | 140,167 | 137,028 | +2.3% |
| Headless approximate direct hits | 94,313 | 92,420 | +2.0% |
| Hits/rounds fired | 67.29% | 67.45% | Essentially unchanged |
| Surviving rigs at round end | 3,222 | 925 | 75.0% vs 21.5% |
| Route failure events | 3,705 | 1,569 | +136.1% |
| Movement recovery events | 976 | 2,164 | -54.9% |
| Tactical decision history entries | 65,916 | 25,626 | +157.2%; not identical commitment semantics |
| Successful field services | 145 | 1,601 | Far fewer faults requiring service in new-AI survivors |
| New-AI assault staging seconds | 73,726 | not applicable | ~17.2 seconds per new rig |
| New-AI traffic-yield ticks | 847,020 | not instrumented | ~9.9 aggregate mech-seconds per round |

Armed bouts averaged **121.13 seconds**, **54.53 seconds contested**, **66.25 seconds without scoring**, **7.45 captures**, **3.86 recaptures** and **3.10 total disables per round**. There were **1,412 scoring outcomes** and **20 timeouts**.

**Interpretation:** decisive improvement at completing subsystem disables and maintaining surviving armed machines despite near-identical headless weapon hit probabilities and slightly lower raw damage. However, excessive motion and A* replans/failed routes indicate a significant efficiency regression. Higher route errors and fewer movement recoveries are not contradictory: those instruments measure different stages of navigation.

## No-damage territory-only control (243 rounds)

| Metric | Latest k3u4 | k3u2 |
|---|---:|---:|
| Captures | 214 | 763 |
| Zone occupancy seconds | 51,396 | 80,792 |
| Distance travelled (m) | 80,909 | 27,125 |
| Route failures | 620 | 0 |
| Tactical decision history entries | 10,868 | 2,362 |
| New-AI staging seconds | 21,267 | not applicable |

New-AI captures were **72.0% lower**, scoring-zone occupation **36.4% lower**, travel **198.3% higher**, and new-AI assault staging averaged **29.2 seconds per rig**. The previous k3u2 AI won **120/120 series**. **240 rounds** reached a territorial score result, **3 timed out**. The rounds averaged **124.21 seconds**, **108.55 seconds with a contest**, **74.86 seconds without scoring**.

**Primary regression:** newer objective escalation, flank/staging and traffic behaviors displace pilots from reliable scoring footprints. A no-damage strict-control opponent can win territory through patient positioning and holding. This does **not** prove every possible undamageable matchup is resolvable; it proves the latest AI is currently worse than its predecessor in these matched worlds. Investigate staging/rotation repetition, capture-anchor commitment, and local-detour oscillation before adding more tactics.

## Symmetric 25% wear (283 rounds)

Both teams began with an equally sampled 25% impairment to internal integrity and armor; this cohort does **not** handicap only one AI generation. New AI captured **1,192** versus **891**, scored **699 disables** versus **159**, and won **106** BO3 series against **13** (1 unresolved). Average bout time **118.39 seconds**, **280** scoring resolutions and **3** timeouts.

## Credibility & limitations

- The same current physical `stepRig` integrator, static arena collisions, hardware families, weapon transaction, per-part armor/internal damage, actual ammo consumption, functional degradation, repair-service rules and live **strict** Domination scoring were called for both sides.
- The exact historical k3u2 tactical modules were preserved in `research/baselineK3u2/` and integrated in the current headless harness. The k3u4 opponent also calls the actual currently shipped targeting/staging/traffic functions.
- Realtime Three.js mesh raycast contact is approximated with probabilistic shots at a shared .70 initial hit sensitivity with spread/range reductions. This is **not** browser-accurate ballistics, live device performance, or visual validation.
- Fresh rig condition is restored at the start of each BO3 round. BO3 machine swapping, intermission patches, persistent serial/part wear, economy, optional human teammate decisions and collision between dynamic rigs are not fully replayed.
- All match outcomes intentionally used the *old* strict-Domination terminal rule, held equal between generations; the independently shipped [k3u5 elimination-end change](https://github.com/lowlevelwizards/M3CH4/pull/46) is **not** baked into these results. New-game true elimination ending will shorten some armed rounds and requires a separate matched sensitivity run.
- Paired seed swaps are not independent random worlds. Do not treat a naïve 600-trial binomial confidence interval as accounting for within-pair correlation.
- Research branch was not promoted to `main`; runtime mechanics remain production source of truth.

## Highest-impact follow-up engineering

1. **Reduce over-staging and anchor abandonment:** after a team establishes a paying point, prohibit abandoning it for a low-confidence flank unless the projected net match score improves. Stage only with an actual nearby co-attacker and a realistic chance to dislodge the defender. Track per-point scoring loss caused by an assault.
2. **Stalemate escalation should be *score-aware* instead of simply movement-heavy:** separate the defensive-anchor obligation from an assault group; when score is already advancing, do not trigger another cross-map rotation. In no-damage contexts, an impossible kill-focused assault must not override known scoring ground.
3. **Tame local traffic yielding and speculative route changes:** bound lateral displacement and add time-based hysteresis; count wasted detour metres, time off point, failed paths and real physical teammate collisions. The no-damage control's **620 versus 0** route errors is a compelling diagnostic.
4. **Keep effective subsystem focus:** the newer AI disabled enemy machines 3.14 times as often in armed combat with the same approximate hit rate. Protect this advantage while lowering route cost and unnecessary ammo.
5. **Re-test under new live elimination-end condition:** matched rollout of both versions with this outcome rule, then confirm in actual iPhone gameplay including camera, repairs, BO3 attrition, and frame pacing.

## Reproduction

Run GitHub Actions workflow `.github/workflows/k3u4-comparison.yml`, or locally:

```bash
node research/k3u4MatchedBo3.mjs 0 75 15 15
```

The command arguments are shard number, balanced armed seed-pair count, no-damage seed-pair count, worn seed-pair count. Each shard writes one series-level JSON archive and one summary JSON in `study-results/`. The linked run contains raw artifacts for all four shards.
