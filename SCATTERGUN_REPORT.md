# M3CH4 — k.3v.6 Scrapyard Scattergun

**Status:** Implemented on scoped feature branch; manual iPhone gameplay QA
is still a separate release/feedback gate.

## What changed

Added one new physical, serialized, purchasable U1 weapon:
`gun-scatter` — Scrapyard S-6 Scattergun.

- Mass **375 kg**, electrical demand **12 kW**, used-part base yard value
  **₡1,250**. Existing 14 definition IDs and factory SR01 serial order are
  preserved exactly; the new serial definition is appended at position 15.
- **Four-shell magazine**, **28 spare shells**, **0.82 rounds/sec**,
  **3.15-second reload**, **3550 N·s** unbraced recoil.
- **Six independent physical pellets per shell**, 13 nominal damage
  **per pellet that physically hits**, .115 radial cone.
- Authentic close-range armor stripping. The game has **NO** distance-based
  damage multiplier; any pellet must physically intersect the closest valid
  THREE mesh along its own ray and use standard armor then integrity
  authority. Cover, other rigs, true frame shielding, destroyed parts,
  field servicing, disabled module physics and first-hit identity are reused.
- One round spent, one magazine cycle, one power pulse, one recoil impulse,
  one main synthesized firing report for **the entire fired shell**, never
  one per pellet. Each separate pellet impact retains localized effects.
- Player: six independent sight/muzzle-validated `traceShot` calls,
  processed into true target serial conditions by the prior `applyTargetHit`.
- All five AI pilots: same pellet pattern and target trace through
  `traceCombatantShot`, same `applyTargetHit` / `applyAiHitToPlayer`,
  ammunition, power, brace recoil and other combat rules.
- 3D: distinct wide welded shot-choke, reinforce collars, exposed cycling
  linkage, 4-shell cassette, support braces and an actual central bore.
  Every 3D part is part of the pickable combat mount; no fake billboard hit
  proxy. Pilot cockpit has a larger reused breech/short heavy muzzle
  assembly, recoil and flash behavior.
- Audio: short gritty synthesized burst `soundScatter`, no audio assets,
  loops, or additional persistent nodes.
- Parts counter: first of the 4 used listings in each **NEW completed
  contract stock cycle** is the S-6. The other three listings remain
  deterministic rotated actual parts. Existing sold/persisted listings
  are not rewritten, old inventory isn't duplicated, and no free item
  is silently deposited in anyone's garage. Existing saves can buy a
  physical used scattergun on the **next counter rotation** after finishing
  a contract. Fresh test assemblies own one new serialized specimen at
  the end of the original 14 and can be fitted without modifying mechanics.

## Balance / range study

`node research/scattergunStudy.mjs` (or `--json`) is a reproducible
analytic *angular dispersion* study using a 0.67 m target radius; it is not
a simulated probabilistic DPS curve or a claim about actual encounter
win rate. Across sixteen six-pellet shots (96 rays) from identical aimed
positions:

| Distance | Geometric hits in 0.67m disk | Nominal sum if all hit a part |
| --- | ---: | ---: |
| 4m | 96/96 | 1,248 |
| 7m | 64/96 | 832 |
| 12m | 32/96 | 416 |
| 20m | 16/96 | 208 |
| 28m | 16/96 | 208 |

There is always one bore-centered pellet, so even a shot at range can
damage something if its aim is correct. The actual tactical game also
has cover, first physical intersections, moving rigs, frame guards, armor,
and separate part meshes; the above sums are **not** guaranteed damage.

`node research/scattergunGeometryAudit.mjs` uses THREE.Raycaster on the
genuinely authored Wedge/target body meshes at near and far ranges. It
asserts one source-owned pickable shotgun model with the expected squat
shape, and greater genuine ray-mesh intersections at close range.
The audit's exit status is hard-gated by `set -o pipefail` in CI.

## Source of authority

- `components.js`, `partEconomy.js`: physical part and value.
- `combat.js`: shell magazine, rate, reload and per-pellet physical damage.
- `scattergun.js`: deterministic independent pellet angle offsets.
- `scene.js`: same real player and AI raycasters, new gun geometry and
  expressive recoil/muzzle. No fake simplified collision test in gameplay.
- `main.js`: one shell fired; each pellet contact individually resolved,
  with one recoil/audio/power cycle.
- `usedPartsCounter.js`: guaranteed next stock rotation availability.
- `tests/k3v6Scattergun.test.mjs`: shell/trace count, immutable factory
  serials, legal mounting, range, physical damage, recoil, reload and
  player/AI authority checks.
- Full preexisting tests, armor/frame shielding geometry, mobility,
  power response and headless 3v3 Domination remain regression gates.

## Limitations and protected scope

A new weapon may require a couple of completed contracts for adequate
credits, depending on its worn physical condition and real price.
The automatic testing environment cannot physically use the user's
iPhone, test touch responsiveness, or judge mobile audio/visual feel.
No global upgrade system, new ammo types, AI role alterations, sensor
perks, heat simulation, new parts categories or save migrations.
