# k4w.6 — Campaign AI balance cohort (October 22, 2026)

**Evidence:** [successful GitHub Actions run](https://github.com/lowlevelwizards/M3CH4/actions/runs/39874782134) and the attached `k4w6-ai-campaign-full-data` artifact containing per-bout JSON, aggregate JSON, and this study's generated report.

## Methods and limitations

- 144 deterministic seeded 60Hz headless AI-vs-AI bouts: six actual contract objectives × three friendly equipment profiles × four paired seeds × two team-side assignments.
- Official lead + wing catalogue modules, legal power and weight, objective victory, AI behavior, ammo, field repair, and damage; proxy now advances real charge/trigger action state, Arc contact heat and electrical draw, and 32m/s rocket flight.
- Each row's **normal-side wins** are the friendly/player side without a spawn swap. Mirrors detect side asymmetry; they are not a substitute for player-side results.
- A 135-second cutoff may produce timeout draws. Wilson intervals on the eight mirrored bouts are wide. Non-domination objectives are inherently asymmetric.
- Physical line-of-sight and impact geometry are approximate in 2D. Breaker multi-surface penetration, rocket 3D cover occlusion, and true thermal mesh contact require browser-backed tests.
- Separate Monte Carlo BO3 scenarios use actual catalogue, prices, repair quotes, serialized salvage rules and stage-gated vendor, but *assume* damage and salvage eligibility; the model is not an end-to-end played campaign.

## Combat results — normal-side wins and mirrored sensitivity

| Contract | Friendly strategy | Normal-side wins | Mirrored win equivalent | 95% interval | Median bout seconds | Timeouts / 8 | Mean friendly damage taken |
|---|---|---:|---:|---|---:|---:|---:|
| yard-dog | starter-loaners | 3/4 | 62.5% | 30.6–86.3% | 92.5 | 2/8 | 3250.1 |
| yard-dog | rivet-upgrade | 2/4 | 68.8% | 35.6–89.8% | 135.0 | 5/8 | 3693.2 |
| yard-dog | specialist-fleet | 0/4 | 18.8% | 4.5–53.3% | 70.0 | 3/8 | 3787.8 |
| recovery-run | starter-loaners | 4/4 | 100.0% | 67.6–100.0% | 47.4 | 0/8 | 1293.6 |
| recovery-run | rivet-upgrade | 4/4 | 100.0% | 67.6–100.0% | 54.0 | 0/8 | 1534.6 |
| recovery-run | specialist-fleet | 4/4 | 100.0% | 67.6–100.0% | 57.2 | 0/8 | 2001.5 |
| cutter | starter-loaners | 0/4 | 37.5% | 13.7–69.4% | 60.3 | 0/8 | 2153.7 |
| cutter | rivet-upgrade | 0/4 | 18.8% | 4.5–53.3% | 52.8 | 1/8 | 1940.8 |
| cutter | specialist-fleet | 1/4 | 37.5% | 13.7–69.4% | 47.3 | 0/8 | 2089.7 |
| domination | starter-loaners | 0/4 | 25.0% | 7.1–59.1% | 91.7 | 2/8 | 2233.6 |
| domination | rivet-upgrade | 0/4 | 56.3% | 25.9–82.5% | 93.9 | 1/8 | 1975.0 |
| domination | specialist-fleet | 0/4 | 18.8% | 4.5–53.3% | 79.2 | 1/8 | 2054.5 |
| mule | starter-loaners | 2/4 | 87.5% | 52.9–97.8% | 72.9 | 2/8 | 1719.0 |
| mule | rivet-upgrade | 2/4 | 87.5% | 52.9–97.8% | 85.0 | 2/8 | 1745.4 |
| mule | specialist-fleet | 1/4 | 68.8% | 35.6–89.8% | 89.8 | 3/8 | 2144.6 |
| circuit-final | starter-loaners | 2/4 | 68.8% | 35.6–89.8% | 76.1 | 3/8 | 2418.4 |
| circuit-final | rivet-upgrade | 1/4 | 68.8% | 35.6–89.8% | 135.0 | 5/8 | 2009.2 |
| circuit-final | specialist-fleet | 1/4 | 50.0% | 21.5–78.5% | 69.9 | 0/8 | 2562.6 |

## Economy projections — 24-contract horizon, 24 seeds each

| Profile | Salvage | All required cleared | Two complete rigs | Three complete rigs | Ever stranded | Mean cash end | Mean claims | Mean garage repairs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| starter-loaners | scarce-salvage | 25.0% | 16.7% | 0.0% | 87.5% | ₡24.5 | 2.7 | ₡4703.4 |
| starter-loaners | generous-salvage | 54.2% | 58.3% | 37.5% | 54.2% | ₡15.4 | 8.9 | ₡7631.2 |
| rivet-upgrade | scarce-salvage | 25.0% | 20.8% | 4.2% | 79.2% | ₡25.2 | 3.1 | ₡5227.8 |
| rivet-upgrade | generous-salvage | 54.2% | 62.5% | 33.3% | 45.8% | ₡15.7 | 9.5 | ₡7973.8 |
| specialist-fleet | scarce-salvage | 25.0% | 25.0% | 0.0% | 79.2% | ₡26.6 | 2.0 | ₡4533.4 |
| specialist-fleet | generous-salvage | 25.0% | 33.3% | 16.7% | 83.3% | ₡30.5 | 5.0 | ₡4675.7 |

## Findings ranked by confidence and impact

1. **Early difficulty inversion (medium-priority finding, low sample confidence):** Starter-and-loaner AI won normal-side Recovery 4/4 and Yard Dog 3/4, but Cutter 0/4 and optional Three Point Lock 0/4. Later Mule and Circuit Final were both 2/4. The campaign does not look monotonic under this AI-only proxy. Increase matched seeds before retuning.
2. **Repair-versus-parts cash starvation (high impact, assumption-sensitive):** In the starter/low-salvage projection 87.5% were ever unable to field a rig, and 0% assembled three. With frequent salvage, those outcomes improved to 54.2% stranded and 37.5% three rigs. Scarcity is desirable; irreversible economic deadlocks are not.
3. **Upgraded guns are not an automatic tactical advantage:** Rivet-upgrade AI still went 0/4 normal side against Cutter and Three Point Lock; advanced specialist AI went 0/4 against Yard Dog. Needs diagnosis of engagement range, target selection, and power, not a blind damage buff.
4. **Generator stress matters:** Specialist-profile Mule battles averaged 2359.1 brownout frames per AI bout versus 354.4 for starter-and-loaner. That is an actionable probe of real power fit and shot/reload behavior, but no 3D scene is simulated.
5. **Early friendly Hauler loaner mismatch discovered:** The production friendly support helper builds `makeRangeTarget('mule')`; after the enemy Mule was given a Breaker Driver this also equips a free early-game ally with the advanced gun. The research baseline intentionally uses the earlier Stump Cannon. Correct this separately before treating proxy and production as equivalent.
6. **Counter gates are access, not guaranteed acquisition:** RR-4 can appear after Yard Dog, Arc/Breaker after Cutter, rockets after Mule. Six randomized worn lots and a roster-first budget-limited buyer leave actual purchases scarce. Compare at least two shop priorities—fleet completion versus specialty weapon acquisition—in a follow-up.

## Safe next experiments (no automatic tuning)

- Repeat two independent 8–12-pair batches focusing on Cutter, Three Point Lock, Mule, and Circuit Final, tracking winning by objectives versus elimination.
- Add renderer-backed charged penetration, rocket cover shielding, 6m thermal visibility, and brownout tests to validate proxy-to-game agreement.
- Make the early friendly Hauler loaner explicitly use Stump without changing hostile Mule signature weapon.
- Stress recovery affordability and salvage eligibility alongside a real credit reserve and alternate purchase preferences; do not increase free starter gear.

**No production weapon damage or enemy accuracy has been changed on the basis of these provisional results.**
