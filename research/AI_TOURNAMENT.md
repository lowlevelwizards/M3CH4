# M3CH4 AI tournament laboratory (k4v)

Research-only strategy and difficulty experiments for 3v3 Domination.
**No experimental profile is automatically assigned to live opponents.**
This deliberately separates *discovering* strong policies from shipping them.

## What it runs

- Eight squad temperaments: `baseline`, `blitz`, `fortress`, `wolfpack`,
  `skirmish`, `cautious`, `reactive`, `opportunist`.
- Four provisional skill tiers: `rookie`, `club`, `pro`, `elite`.
  Differences are planning/perception timing, acquisition delay and shot spread;
  **never extra health, faster machines, ammunition, damage or enemy x-ray vision**.
- Three actual 60 Hz physics-controlled machines per side, meaningful movement,
  A* routes, collision bodies, capture, ammo, reload, damage and field service.
- Every matchup is run twice per seed with sides swapped. The simulation never
  modifies source policy parameters based on a trial's outcome.
- The run records *both* win outcomes and failure diagnostics. The quality
  grade is a heuristic for triage and is not a substitute for win rate.

## Local commands

Quick verified smoke:

```sh
node --test tests/k4vAiTournament.test.mjs
node research/aiTournament.mjs --quick
```

Standard 8-strategy competitive screen:

```sh
node research/aiTournament.mjs --pairs=8 --seconds=180 --accuracy=.45,.7,.9
```

Difficulty progression only (holds squad strategy constant):

```sh
node research/aiTournament.mjs --entrants=baseline@rookie,baseline@club,baseline@pro,baseline@elite --pairs=8 --seconds=180
```

Faction temperament screening at a fixed tier:

```sh
node research/aiTournament.mjs --entrants=blitz@club,fortress@club,wolfpack@club,skirmish@club,reactive@club,opportunist@club --pairs=12 --seconds=180
```

Sensitivity cohorts:

```sh
node research/aiTournament.mjs --accuracy=0,.45,.7,.9 --roster=light --pairs=4 --seconds=180 --seed=60019
```

`--roster=balanced|yard|light|heavy` controls *both* teams' machine
composition. `--wear` applies equal wear to both sides. `--capture`
switches existing research capture rules; **strict** is the authored live
contract. Tournament artifacts go to `study-results/ai-tournament/` by default:

- `summary.json`: metadata, seed, policy, side-swap results, ranking and confidence.
- `bouts.json`: all per-machine physical and combat measurements.
- `bouts.csv`: compact per-bout statistics.
- `report.md`: readable ranking, head-to-head and limitations.

## Running large jobs from GitHub

Use **Actions → k4v AI Strategy Tournament → Run workflow** once the
workflow is on `main`, or run the CLI from a checkout. Supply entrant
identifiers like `baseline@pro,fortress@club,wolfpack@elite`, the
number of side-swapped seed pairs, time limit, accuracy cohort, and
roster. Artifacts include all raw data. High samples and holdout seeds
are mandatory before any promotion recommendation.

The experimental strategy registry also describes six *future*
faction personalities in `ai/researchProfiles.js`. Those descriptors
are narrative starting points, not shipped opponent encounters.

## Fairness and limitations

- True 3D raycasts, visible rig-part damage meshes, individual pellet
  occlusion, audio, and a human opponent are **not simulated**. Hit
  resolution uses a documented probabilistic estimate against a visible
  forward target. Near-miss warnings also use approximated shot segments.
- The physical controller, real locomotion condition, damage and objective
  state use the game's shared modules. Headless dynamic bodies approximate
  the game's per-actor collision snapshot; exact browser collision timing
  should be validated in visual playtests.
- Each team's planning/perception snapshots respect separate difficulty
  cadences, but the underlying shared world-model observation pass is
  sampled on the faster team's cadence. This remains a fidelity limit.
- Opponent positions are not intentionally exposed through policy scoring.
  Candidate positions use observed contacts and public capture status.
- A lot of draws imply **no demonstrated advantage**, even if a numeric
  heuristic ranks profiles. Increase the bout time, run more seeds and
  inspect actual scoring before selecting a winner.
- Strategy outcomes are entangled with the chosen machine composition and
  scoring rules. Run multiple roster and damage cohorts.
- Confidence intervals are approximate win-equivalent indicators, *not*
  paired bootstrap intervals, and are unreliable with small sample sizes.
- Keep matched training seeds distinct from evaluation seeds. Avoid repeatedly
  tuning a profile to the same tournament set (overfitting).
- Never auto-promote a result to live play. Verify promising candidates in
  browser combat, especially human flanking, retreat, cover, and collision
  behavior. A stronger win rate can still correspond to worse gameplay.

## Promotion checklist

1. A nonzero decisive match count and stable, paired results across seed sets.
2. Improved objective/win effectiveness without large rises in route faults,
   stalled travel, friendly collisions, or inexplicable disengagement.
3. Survives accuracy sensitivity, roster, wear, and map changes.
4. Reproduces intended differentiation under human playtesting.
5. Promote **named** faction profiles only after validation, leaving the
   default unmodified until the intended contract/roster difficulty is chosen.
