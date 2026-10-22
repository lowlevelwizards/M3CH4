# M3CH4 — Build 0: Mechanical balance baseline

Reference main: `cbad74e65bb2d3c23671202167589a8707e249f3` (October 22, 2026)

This phase records and tests measurements. It intentionally changes **no gameplay,
catalogue definitions, saved parts, market inventory, locomotion or weapon behavior**.

## Exhaustive catalogue legality (standard mounting)

Use Node.js 22+ from the repository root:

```sh
node --test tests/k4v0RosterBalance.test.mjs
node research/rosterBalanceAudit.mjs
node research/rosterBalanceAudit.mjs --json > /tmp/m3ch4-roster-before.json
```

`research/rosterBalanceAudit.mjs` discovers its alternatives directly from
`CATALOG` and `SLOTS`. Every five-station recipe is installed through
`equip` and judged by **live** `inspectAssembly` rules, including real H2/U1
adapter mass, graph mounting, frame/leg load and nominal electrical legality.

Each JSON row contains recipe IDs, legality, failing check and reason,
installed mass, actual adapters, structure/mobility load margins,
generator capacity, nominal demand/headroom and sum of authored base yard
values. The latter is **not** a predicted operating or repair cost.

The versioned expectation is `research/baselines/roster-cbad74e.json`.
For the initial 15-module catalogue: 216 possible recipes, 144 legal, 72
rejected; Kestrel 70/72, Yardwalker 57/72, Hauler 17/72.

**Scope caveat:** the combinatorial audit uses standard equipment station
mounting, with the actual automatic Hauler hip adapter. It does not
multiply the count for optional generator offset bracket positions or
other future custom mounting graphs. Those would be separate variations
of an installed recipe, not additional five-module choices.

When changing the catalogue, power, mass or mounting:

1. Run before and after reports against explicitly identified commits.
2. Run `node research/rosterBalanceAudit.mjs --compare /tmp/m3ch4-roster-before.json`
   to expose added/removed recipes, legality changes, mass, load, power
   and base-value changes.
3. Inspect unexpected changes and **deliberately** revise the versioned
   expectations with a new source SHA; never silently update the fixture
   to make a failing test pass.
4. Preserve the 15 original IDs and factory serial order when later
   appending Forge. Recompute all legal coverage counts with the new roster.

## Separate levels of measurement

Each command reports a different kind of evidence. Do not combine them
as though the measurements prove the same things.

| Evidence | Existing executable | What it actually measures |
| --- | --- | --- |
| Catalogue constraints | `research/rosterBalanceAudit.mjs` | 216 installed-recipe eligibility checks; **no simulated combat** |
| Deterministic handling / recoil | `research/partIdentityBaseline.mjs` and `research/mobilityTemperamentStudy.mjs` | legal configurations under 60 Hz unobstructed locomotion, steer/brake/grip and recoil |
| Deterministic power | `research/powerResponseStudy.mjs` | live generator spool, finite reserve, demand, brownout and true weapon firing |
| Deterministic weapons | `research/scattergunStudy.mjs` | pellet patterns and weapon cycles; not a proof of scene hit ownership |
| Actual Three.js contact | `research/frameShieldingAudit.mjs` and `research/scattergunGeometryAudit.mjs` | renderer-backed real mesh intersections, directional shielding |
| Tactical proxy | `research/headlessDominationStudy.mjs` | headless objective and combat tendencies; approximate parts of LOS/projectile contact |
| Human feel / usability | Manual iPhone landscape testing | controls, readable shots and warnings, perceived weight and performance |

The renderer-backed audits require the project's existing CI-style
temporary Three.js package install, e.g.:

```sh
npm install --no-save --no-package-lock three@0.186.0
node research/frameShieldingAudit.mjs --assert
```

The audit itself does **not** install Three.js as a runtime dependency.
Headless Node tests cannot attest to visual shielding or mobile UX.

## Five fixed reference machines

The roster report preserves these recipes and checks that they remain
deployable: Balanced workhorse (Bruiser/Yardwalker/Dynamo/Cyclops/Training),
Lightweight precision (Skeleton/Kestrel/Draft/Vista/Needle), Heavy anchor
(Wedge/Hauler/Dynamo/Cyclops/Stump), Lightweight raider
(Skeleton/Kestrel/Draft/Vista/S-6) and Heavy protected command
(Bruiser/Hauler/Dynamo/Hearth/Stump).

Where possible, compare a single-module replacement on an otherwise
identical **legal** assembly, and record the resulting mass, power and
load differences. An invalid recipe is never assigned simulated motion,
DPS or a win rate.

## Build 0 release gate

- [x] Enumerate standard five-station combinations from the live catalogue.
- [x] Record source-revision fixture and expected legality by family.
- [x] Include mounting failure reasons, adapter/load/power/cost data.
- [x] Provide a deterministic JSON/Markdown output and comparison command.
- [x] Add targeted regression tests without changing gameplay.
- [ ] Execute tests in GitHub CI and attach observed outputs.
- [ ] Expand the physical benchmark cohorts where existing studies do not
      yet cover all proposed reference loads, obstacles or damage conditions.
- [ ] Run/inspect actual mesh audits and initial mobile smoke before
      claiming broad mechanical acceptance.

**Do not start Build 1 mobility tuning based solely on a successful
catalogue audit.** Its measured no-change baseline and deliberate
comparison conditions must first be recorded.
