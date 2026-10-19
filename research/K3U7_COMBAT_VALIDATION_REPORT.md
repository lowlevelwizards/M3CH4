# k.3u.7 — Combat awareness & survival intelligence validation

Production PR: https://github.com/lowlevelwizards/M3CH4/pull/49

## Scope of implemented change
This release removes an artificial independent AI trigger cadence and lets physical fitted weapon cooldown, reload, ammunition, chassis alignment and actual damage define firing limits. The new perception loop updates observed enemy contacts every 0.15 seconds without increasing team-plan frequency. Real bullets crossing near an AI rig supply coarse threat direction (but never a hidden exact attacker position); physically acquired rear threats can interrupt movement orders to orient and seek cover. Own system plating and internal health drive targeted-system-preservation attempts, while teammates may counterflank only confirmed visible hostiles. Uncertain navigation may seek a real covered intermediate waypoint but cannot replace final objective coordinates.

Existing k3u6 scoring-anchor and BO3 contract authority is retained.

## Tests
Targeted node tests cover physical fitted-weapon cyclic rate, 60Hz rear-hit body turn, near misses restricted to finite muzzle-impact segments, blind sensor rear sector until body rotation, no leaked enemy component health, repeat-hit module protection, ally counterflank gating, covered intermediate route decisions, safe route fallback, and release JS cache correctness. Final CI: see PR #49.

## 192-bout 3v3 headless reliability study
GitHub Actions completed successfully on four distinct seed cohorts:
https://github.com/lowlevelwizards/M3CH4/actions/runs/39210717241

Each shard ran 48 games = 192 3v3 games total. The study spans 12 scenarios (strict Domination, experimental capture policies, no-damage controls, up to 40% hardware wear and light/heavy roster variants). Every core game uses real 60Hz `stepRig`, fitted weapon ammo/cooldowns, physical collision against static world, localized armor/integrity, behavior modules and score authority.

Metrics aggregated from four per-shard `FINAL_SUMMARY` log markers:
- **192 completed games**, 80 friendly wins / 63 hostile wins / 49 unresolved draws.
- **131.37 seconds average duration**, including no-damage/experimental cases.
- **2.464 average rig mission disables per game**, including zero-damage cohorts.
- **~279.08 fire-control opportunities per game** under the corrected physically ready/arc/LOS metric (not an actual emitted-shot count).
- **~114.76 actual damaging rounds per game** (scenario-level headless approximation).
- **3.50 seconds mean first visual contact**.
- **39.78 seconds mean first kill among rounds with a kill**.
- **0.276 route-failure events per game**.
- **49 timeouts**; they include the designated zero-damage strict contest controls and are not necessarily navigation failures.

### Critical interpretation boundaries
This is a **reliability and aggression smoke**, NOT a human-versus-AI challenge or a calibrated win-rate comparison against k3u6. Friendly and hostile are both AI. The research runner uses a simplified headless shot contact probability, not actual Three.js mesh hitboxes. It approximates some main.js combat decisions, and in particular it does NOT faithfully reproduce all event-driven fast sensing, real near-miss responses, ally counterflank decisions, dynamic mech-mech collisions, BO3 persistent-part state and a strategic human flanker. The dedicated module tests are stronger evidence of specific new behaviors than the aggregate AI-vs-AI wins.

These results do not establish that the AI is hard for a human. After deployment, real iPhone playtests should focus on:
- Time to first cover/turn reaction when you fire from behind
- Whether the machine retains a usable objective assignment after defending
- Actual danger from fitted weapon fire rate (may be considerably more intense)
- Repeated focus-fire on one exposed module
- Relevance/visibility of allied interception
- FPS/audio performance and browser/mobile loading
- Whether enemy sightlines are explainable and never omniscient

## Reproduction
Research branch: `research-k3u7-combat-study`.
```bash
node research/headlessDominationStudy.mjs 4 0
node research/headlessDominationStudy.mjs 4 37
node research/headlessDominationStudy.mjs 4 74
node research/headlessDominationStudy.mjs 4 111
```
Download the detailed per-shard artifacts from the linked GitHub Actions run.
