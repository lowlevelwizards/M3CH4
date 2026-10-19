# M3CH4 research: k.3u.2 versus pre-rewrite AI

## Executive finding

In **600 matched-side armed proxy BO3 series**, the k.3u.2 tactical AI won **596**, the pre-k.3u.1 legacy AI won **4**, and **0** were unresolved. New-AI BO3 win share was **99.33%**. There were **1244 armed rounds**; 1240 resolved on territory and 4 timed out.

In **120 zero-damage control series**, neither side reached two round victories; **1 of 360 rounds** produced a territory decision, **359** timed out, and all 120 BO3 series remained unresolved. This isolates a persistent uncontested-scoring stalemate that tactical movement improvements did not independently solve.

**Source run:** https://github.com/lowlevelwizards/M3CH4/actions/runs/39182167327  
**Research branch:** `research-k3u3-ai-generation-study` (based on `main` commit `93286524dfdec43c89b2d8b26aca8126e0dfac59`)  
**Legacy reference:** `b0569641792a449c608dde883409374c4d76f955`

## Controlled design

- 60 Hz discrete stepRig locomotion, obstacle checks, identical mixed Yardwalker/Kestrel/Hauler rosters, the same weapons, ammunition, localized armor/internal integrity, fault/service rules, and live **strict** three-point Domination scoring.
- Both generations are present within each simulated 3v3 round (rather than benchmarking themselves in separate games).
- Same spawn-offset seed tested with **new AI on both friendly and hostile sides**; four Actions shards each contain 75 two-side armed pairs and 15 two-side no-damage pairs.
- **New AI:** production k.3u.2 team planning, world model, commitments, positioning, routing, steering, strategy.
- **Legacy AI:** exact pre-rewrite `enemyMotion.js` plus its historical fixed machine-ID point assignment and the retained `squadIntent` function, at approximately 0.24–0.32 s replanning.
- Headless firing uses the same weapon transactions and physical ammo and armor effects for both sides, with approximate geometric/probabilistic hit resolution (70% base accuracy with range/spread reductions), rather than Three.js mesh raycasts.
- **BO3 proxy, not full game:** each series ends when one side wins two of up to three rounds. Machines begin each round in fresh condition. Garage machine assignment, carried wear/damage, intermission emergency repairs, player inputs, interactive dynamic actor collisions, graphics and actual Three.js contact tests are **not reproduced**.

## Armed performance totals (1,244 rounds)

| Metric | k.3u.2 new AI | Pre-rewrite AI | Interpretation |
|---|---:|---:|---|
| BO3 series wins | 596 | 4 | New win share 99.33% |
| Credited objective captures | 3,752 | 777 | New 4.83x |
| Seconds occupying scoring zones | 187,729.71 | 62,896.5 | New 2.98x |
| Meters travelled, total | 131,118.7 | 248,861.49 | New 47.3% less |
| Movement recovery events | 371 | 8,171 | New 95.5% fewer |
| Shots spent | 94,707 | 90,049 | Same shared headless weapon transaction |
| Hits | 63,388 | 60,107 | Both use approximated raycast |
| Total damage | 2,426,377.86 | 2,303,766.42 | New 5.3% higher |
| Kills | 407 | 489 | Old actually kills more |
| Weapon recoveries | 44 | 28 | Rare in this cohort |

Mean armed round duration **70.05 s**. Mean contested zone time **28.66 s**. Mean no-scoring time **26.81 s**. The new system reported 159 planner route failures; the legacy system does not emit the same route-failure diagnostic, so comparing this count across generations is invalid. The `goals` instrument counts raw legacy replan cycles but new-AI decision-history entries; it is **not** a directly comparable count of actual tactical objective changes.

## No-damage control (360 rounds)

| Metric | Result |
|---|---:|
| BO3 winners | New 0, old 0, unresolved 120 |
| Rounds ending by score | 1 |
| Timed-out rounds | 359 |
| Mean round time | 209.58 s |
| Mean contested-zone time | 192.60 s |
| Mean no-scoring time | 196.00 s |
| New/old credited captures | 751 / 746 |

These controls are **not** evidence that the new AI is worse at capture; they demonstrate that under strict uncontested-zone scoring, direct objective occupation by two intact teams frequently produces a permanent stalemate. Any alternative capture rule remains strictly experimental; no production scoring change was made.

## Reliability and qualifications

The directional competitive result is unusually large, but the old side is a reconstructed headless integration of the historical logic, **not** a historical browser executable. Legacy contact acquisition uses nearest active enemy; player targeting, precise live squad-screen coordination and dynamic rig-to-rig collision are not fully recreated. Both sides are AI-controlled. Additionally, these 600 side-swapped series are paired and therefore not 600 statistically independent worlds. A naïve independent-binomial Wilson 95% interval is roughly **98.3–99.7%**, and should *not* be treated as a rigorous paired-seed uncertainty interval.

These numbers validate tactical behavior in this controlled model; they do not establish 99% wins in live iPhone gameplay, or validate long-run wear/economy balance.

## Highest-value next experiments

1. **Stalemate interventions:** test live-rule-neutral AI rotation, outside-zone screening, forced disengagement/contingent focus, then deliberately opt-in contested-pressure scoring only if tactics alone cannot break no-damage deadlocks. Success target: material reduction in 210-second timeouts without artificial wins.
2. **Actual device acceptance:** test six-rig collisions, expensive A* routing, performance, third-person spectacle, cover/fire lanes, targeting, and meaningful team contests with a human ally.
3. **True BO3 persistence:** extend research to carry serialized part health, ammunition, machine swaps, and legal emergency repairs between rounds before tuning durability or economy.
4. **Adversarial validity:** test new versus a legacy side with different targeting and roster arrangements; the 99.33% win share may overstate performance against tuned, unfamiliar opponents.

## Reproduction

Run the versioned Actions workflow in `.github/workflows/ai-generation-bo3.yml` or locally:
```sh
node research/generationBo3Study.mjs 0 75 15
```
All four per-shard raw series JSON files and their JSON summaries are stored as run artifacts named `ai-generation-bo3-0` through `ai-generation-bo3-3` in the Actions run linked above. None of this research branch was merged into production `main`.
