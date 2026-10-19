# M3CH4 — k.3v.3 Directional Physical Shielding
## Implemented and measured — October 19, 2026

### Rule
A projectile collides with the first physical mesh returned by the same
Three.js raycaster used in the game. Frame armor is not a magic modifier:
when a frame plate is in front of the cab/gun/drive/generator, the **frame**
receives the existing armor-first/integrity/destruction damage. The part
behind it takes no damage on that shot.

`frameShielding.js` only labels actual shielding evidence: the first
intersection must be tagged `structure`, and a later intersection on
that same ray must reach another fitted module of the **same actor**. A
structure hit without that second intersecting module is just a structure hit.

### Which geometry changed
- **Bruiser**: retained thick welded central and shoulder armor. Its existing
  mass, factory definition and physical shape remain intact.
- **Skeleton**: retained its exposed rails, narrow spine and low mass; no
  artificial 'take more damage' debuff was added.
- **Wedge**: added a thin low front structural drive skirt and two small
  angled upper frame cheek plates. The plates are both the visible mesh
  and the very same raycast geometry. The middle front optic, upper angles,
  and rear generator remain exposed. No invisible collider or automatic
  facing resistance.

### Representative exact Three.js raycast findings
Against Bruiser, Skeleton and Wedge assembled with the **same** Yardwalker
legs, Dynamo generator, Cyclops cab and Training Cannon, nine reproducible
rays were fired toward the cab or drive bounding region from each angle:

| Test | Bruiser | Skeleton | Wedge |
| --- | ---: | ---: | ---: |
| Frontal cab — direct module ray hits (of 9) | 7 | 7 | 3 |
| Frontal cab — verified structure-first + cab behind (of 9) | 0 | 0 | 4 |
| Frontal drive — direct module hits (of 9) | 2 | 4 | 2 |
| Frontal power — first hit structural frame (of 9) | 3 | 2 | 7 |
| Elevated frontal cab — direct hits (of 9) | 9 | 9 | 7 |
| Rear power — direct generator hits (of 9) | 9 | 9 | 9 |

These are sample-dependent **counts**, not general hit probabilities.
Some intended rays miss or intersect another module instead. Not every
structure-first hit warrants a `shieldedSlot` label. The machine's
heading, pose, elevations, loadout, weapon muzzle and actual shot spread
still determine the first real hit in battle.

### Visual and audible consequences
For physically verified shielded module shots only:
- welded armor gets an extra brief local flash and four bounded sparks;
- the existing mobile combat feed reads `FRAME SHIELDED CAB/DRIVE/WEAPON/GENERATOR`;
- the usual first-hit damage and armor visual remain unchanged;
- an additional short procedural plate ring replaces the generic impact sound.
Player and AI use the same trace/shield check and the same actual damage
functions. The player's own cab and power pack can similarly be protected.

### Verification and scope
`node research/frameShieldingAudit.mjs --assert` runs the actual exported
`buildExteriorRig` and raycasts the very meshes used at runtime using
Three.js 0.186.0 (installed **only in CI** with `npm install --no-save`).
Three.js is already loaded by the browser's import map, so no runtime
bundler/dependency was added. It audits 648 real mesh rays over 3 frames,
4 targets and 6 directions with 9 samples each and asserts the directional
tradeoffs above.

`npm test`, the existing part and mobility baselines and headless
3v3 Domination test remain the compatibility gates. Those headless combat
tests do not substitute for renderer-driven raycast checks; both run.

No new slots or part IDs, no altered weapon damage, no changed structural
armor pools, no AI target-selection rewrite, no save migrations, no
synthetic facing modifiers.

### Known limitations
- This is **module interception**, not ricochet, angle-based armor thickness,
  penetration or physically simulated plate breakup.
- Damage to armor does not yet punch literal holes in meshes. Disabled
  hardware continues to exist as physical geometry unless the current
  wreck/clearance system removes it.
- Benchmarks verify geometry, not whether the silhouette and mobile
  hit markers are visually obvious on an actual iPhone. A manual
  landscape combat check remains necessary.
