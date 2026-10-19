# k.3u.6 objective discipline — k.3u.3 matched 3v3 BO3 validation

## Status
- Tuned k3u6 benchmark GitHub Actions: https://github.com/lowlevelwizards/M3CH4/actions/runs/39194467921 — **all four shards successful**.
- Untuned first-pass k3u6: https://github.com/lowlevelwizards/M3CH4/actions/runs/39193675599 — all four shards successful, but **armed regressions**; do not promote that version.
- Full tuned production tests: https://github.com/lowlevelwizards/M3CH4/actions/runs/39194377341 — **324/324 passing**, including new majority/contesting tests.
- Production PR: https://github.com/lowlevelwizards/M3CH4/pull/48

## Experiment
A genuine historical k3u3 tactical-code baseline frozen from `82f42bb` and current k3u6 source were used in the same 60Hz headless fight simulation. All generations use the **production k3u5 elimination-end condition**, the same publicly visible objective rules, physics integration and approximate direct-hit policy. Side-swapped seeds, equal families/conditions for both opponents. BO3 reset hardware per round. Node cannot reproduce browser mesh raycasts, dynamic rig-to-rig physical collisions, iPhone latency or inter-round repairs.

### Tuned results: 480 BO3 series, 1,240 rounds

| Scenario | Series | k3u6 wins | k3u3 wins | Unresolved |
|---|---:|---:|---:|---:|
| Balanced armed | 288 | **147** | 132 | 9 |
| No-damage | 96 | 1 | 0 | **95** |
| Both teams 25%-worn | 96 | **52** | 43 | 1 |
| Total | 480 | 200 | 175 | 105 |

The armed decisive win rate is 52.69%, and worn decisive win rate is 54.74%. These are **modest point estimates, not clear statistical proof of superior armed win rate**. The objective-discipline win-rate target is best interpreted as **no observed large regression**; substantial efficacy claims require additional trials under full browser physics.

### Armed efficiency over 714 rounds

| Counter (generation total) | k3u6 | historical k3u3 | Change |
|---|---:|---:|---:|
| Zone occupancy seconds | 143,714 | 122,229 | **+17.6%** |
| Travel metres | 166,606 | 195,982 | **-15.0%** |
| Route failure events | 588 | 1,764 | **-66.7%** |
| Assault-stage seconds | 1,668 | 31,972 | **-94.8%** |
| Goal-change history entries | 19,626 | 31,174 | **-37.0%** |
| Credited captures | 3,051 | 3,175 | -3.9% |
| Credited disables | 1,009 | 978 | +3.2% |
| Damage dealt | 1,849,117 | 1,757,846 | +5.2% |
| Surviving rigs | 1,164 | 1,133 | +2.7% |

This is exactly the intended physical efficiency improvement: substantially more useful occupation with less movement and significantly fewer navigation incidents.

### No-damage control over 288 rounds

- **95/96 BO3 series unresolved** (no conclusive efficacy claim from win rates).
- **263/288 rounds timed out** under strict contested-point capture; 25 resolved by score.
- k3u6 versus k3u3 zone occupancy **135,299 vs 107,591 seconds (+25.8%)**.
- Captures **2,760 vs 2,298 (+20.1%)**.
- Distance **122,107 vs 180,762 metres (-32.5%)**.
- Route failures **45 vs 1,417 (-96.8%)**.
- Assault staging **1,575 vs 45,249 seconds (-96.5%)**.

The AI is much more territorial and much less aimlessly mobile, but still cannot consistently clear an enemy unit physically contesting the zone without dealing damage. No artificial or unearned scoring was introduced.

### Equally worn machines over 238 rounds

- **k3u6 52 wins, k3u3 43, one unresolved**, but the modest difference has uncertainty.
- k3u6 versus k3u3 zone occupancy **48,114 vs 41,688 seconds (+15.4%)**.
- Travel **50,696 vs 58,736 metres (-13.7%)**.
- Route errors **201 vs 655 (-69.3%)**.
- Staging **583 vs 9,957 seconds (-94.1%)**.
- Disables **388 vs 342 (+13.5%)**.

### What failed initially, and the targeted fix
First-pass 680-series result: k3u6 **194 vs k3u3 240 armed series** (6 unresolved), worn **36 vs 58** (2 unresolved), no-damage 144 unresolved. This was a real regression despite better zone occupancy. The initial implementation reserved every owned point even if the team had no paying majority, and marked contested approach arrivals as stationary once they entered the zone.

Fix: hard reserve anchors only after a *real uncontested two-point majority* has been established, and let attackers retain maneuvering orders if the destination is contested. The tuned matched study recovered an approximate parity-to-slight-advantage armed win rate without losing the large reductions in route churn and staging. The two studies have different paired-seed selections; do not represent them as identical-world ablation.

## Source, release and limitations
Actual production modules: `ai/objectiveDiscipline.js`, `ai/teamPlanner.js`, `ai/strategicState.js`, `ai/pilotBrain.js`, `ai/intentExecutor.js`, `ai/positioning.js`, `ai/adaptiveTactics.js`, `ai/worldModel.js`, `ai/debug.js`, plus one integration to `main.js`. No physics/damage/score code rewrite. The research comparison sources and historical AI copies are confined to branch `research-k3u6-objective-study`, not promoted in production PR #48. The built Pages version is `0.0.1k.3u.6` once merged and deployed.

Artifacts are available from GitHub Actions (one series archive and one summary per shard, all four successful). To reproduce on this **research branch**:
```bash
node research/k3u6MatchedBo3.mjs 0 36 12 12
```
Shards 0..3 cover 288 armed, 96 no-damage, 96 worn series (480 total), each with side swap.
