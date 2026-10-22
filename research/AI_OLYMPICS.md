# M3CH4 — AI Olympics (k4v.1)

A fixed-event, deterministic engineering course for validating the shared
physical opponent controller. This complements the full 3v3 strategy
tournament; it does not replace it.

## Events

| ID | Scenario | Primary measurements |
| --- | --- | --- |
| open-transit | Unobstructed long travel | Arrival, forward progress, wasted movement |
| wall-detour | Solid building spans a direct route | Actual A* travel around cover and arrival |
| ally-choke | Three real machines of a selected mobility family converge through a gap | All-machine completion, collision impacts, traffic yields |
| rear-ambush | Approximate shot bearing from behind | *Physical* chassis response, not just an UNDER FIRE UI label |
| contact-dropout | Scripted sensor loss after an initial visually observable contact | Unobserved contacts cannot remain exact targets, scanning |
| target-triage | Two legitimately observed enemies, one fires | Timely priority of observed attacker, no hidden targeting |
| objective-anchor | True authored 4.7m scoring radius | Physical arrival **inside zone** and productive hold |
| wounded-withdrawal | Real serialized structure at 25% + repeated shot cues | Withdrawal order and physical separation from danger |

All rigs move through `stepRig` with actual installed family physics.
`decidePilot`, `executeIntent`, `advanceEnemyMotion`, real A*
navigation and tactical sensor/target selectors drive the tested actor.
Choke-point cohorts use three rigs from the selected family; selecting yard,
kestrel or hauler changes real mass/handling, not merely the report label.
Peer-rig collisions are modeled as AABB dynamic bodies, with real
`stepRig` collision resolution. No success is awarded by teleportation.

## Diagnostic design

`sampleMotion` distinguishes:

- Intentional capture guarding/bracing and stationary scanning
- Legitimate chassis turning toward a route waypoint
- Actual progression along the current waypoint
- Sustained requested translation with neither progress nor useful yaw
- Obstacle-proximate, ally-proximate and unclassified stalls
- Collision impact spikes, route failures, reversals, recovery
- Separate counts of executor route changes and traffic sidesteps

A low displacement in one 60Hz tick is **never** a stall by itself.
Failure counts require sustained low progress and active motor demand.
Results therefore are not directly comparable to earlier headless
`stallSeconds` metrics, which used a different heuristic.

## Running

```sh
node --test tests/k4v1AiOlympics.test.mjs
node research/aiOlympics.mjs --quick
node research/aiOlympics.mjs --seeds=20 \
  --families=yard,kestrel,hauler --profiles=baseline,cautious
node research/aiOlympics.mjs --events=ally-choke,rear-ambush \
  --families=yard,kestrel,hauler --seeds=40 --seed=77001
```

All event/profile/family combinations use matched seeds and controlled
goals. The initial heading and lateral position vary slightly with seed.
The CI job `k4v.1 AI Olympics` runs **960 trials** by default. Manual
workflow_dispatch can change trial counts, families, profiles, skill tier
labels or initial seeds. The job archives:

- `report.md`: event/competency scores, pass rates, diagnostic caveats
- `results.json`: each trial's exact conditions, machine positions and
  failure classifications
- `results.csv`: wide per-trial view for offline analysis

## What the first Olympics actually found

Initial 192-event sweep found two 0/24 passing events:
defensive positioning and wounded escape. These revealed a mix of
*real game* problems and *evaluation* mistakes.

**Confirmed production errors repaired on this research branch:**

1. `executeIntent` treated a deliberately selected DEFEND interior
   position as a second scoring-circle centre, allowing the machine to
   stop several metres outside the real point. It now routes directly
   to the chosen safe defender position while CAPTURE and CONTEST
   retain their scoring-radius arrival behavior.
2. `advanceEnemyMotion` let generic reactive rear-fire turning
   indefinitely override an explicit `WITHDRAW` pilot order. An
   ordered emergency retreat now owns real movement, with no speed
   or damage cheating.

**Evaluation errors repaired:**

- A defender inside the actual 4.7m scoring circle was falsely failed
  for not approaching a fictional 2.7m centre threshold.
- The first survival drill used marginal 35%-health structure, which a
  non-cautious baseline pilot is *not designed* to retreat from.
  The competency drill now uses genuinely critical 25%-health
  structure, which should cause any competent pilot to withdraw.
  Separate preference tests cover marginal wear.
- A status label under fire was not enough to pass a rear ambush; the
  event now requires physical movement or yaw response.
- Scores for events not selected in a partial run are excluded from
  the partial overall average.

**Do not automatically promote profiles based on Olympic medals.**
Scores are intentionally engineering acceptance proxies, not ELO,
match wins, human-perceived intelligence or faction differentiation.

## Important scope limits

- Scripted ambush events provide uncertain shot bearings. The shooter
  is **not** materialized as a visible enemy. Contact-dropout is a
  scripted sensor interruption, not a reconstructed cloud of smoke.
- Attackers in target-triage are real positions checked via the shared
  world-model optics and visibility, but weapon hitbox/raycast
  collisions and 3D projectiles are not exercised.
- Squad traffic is a deliberate congestion case, not a full
  independently deciding three-pilot Domination match.
- Course difficulty settings are **not** a validated difficulty ladder.
  Skill-tier tuning, reload/accuracy/complex combat needs the existing
  full-match tournament and human playtests. Use `pro` for fair
  cross-profile engineering comparisons.
- Different mobility families have genuinely different masses, drive
  speeds and handling; performance differences are not automatic
  evidence that their AI reasoning is different.
- The event roster and scoring thresholds must be reviewed if rules or
  arenas change. An objective test must judge the real scoring
  footprint, not a test-invented replacement.
- A high pass rate means the narrow scripted event passed, not that
  a human cannot flank, distract or exploit this pilot.
- No changing the pilot's hardware/physics for the sake of the
  benchmark. No test failure should be "fixed" by making the test easier
  without documenting why its former standard was invalid.

## Next research questions

1. Where in full 3v3 matches do true stalls arise, rather than
   deliberate anchor time? Instrument the full tournament using the
   same motion diagnostic API.
2. Why does close-quarter squad traffic still incur contact spikes
   despite all rigs making it through?
3. Can an observed enemy force a bad target fixation through multiple
   moving threats, unlike the static two-target drill?
4. Does rear ambush reaction actually reduce damage against a mobile
   shooter with ballistic shot timing?
5. Can cautiously coordinated pilots outperform an aggressive team
   without merely camping losing objectives?

Keep this laboratory versioned and never force experimental
behaviors into the player's active contracts without validation.
