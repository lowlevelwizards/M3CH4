# M3CH4 — PART IDENTITY MATRIX
## k.3v.0 · verified source audit, pre-gameplay identity expansion

**Source revision:** main at 9716f9546d7d522be1a03a7dcfc258e36fcf9ba8 (October 19, 2026). **Scope:** existing fourteen definition IDs only. The accompanying research/partIdentityBaseline.mjs is the executable source for headless numbers; run it whenever tuning changes. It tests legal combinations, not universal claims for every possible rig. This document distinguishes LIVE behavior from INTENDED future behavior.

### Where part data goes today

1. **Catalogue and ownership:** components.js owns part definition IDs, name, mass, envelopes, nominal kW, load rating, drive specifications and mounting compatibility. Its makeTestAssembly creates the original 14 owned serials in fixed order; equipment selection points to owned serials. stable.js/persistence.js maintain real instance condition, wear and history.
2. **Mechanical assembly:** components.js inspectAssembly counts fitted mass plus genuine H2 and generator-mount adapter mass, rejects over-rated frame/legs, nominal-power shortage and invalid graph, while assemblyGraph.js validates attachments. assemblyPhysics.js uses the inspection mass and frame/leg envelope to derive inertia and acceleration. mobilityPerformance.js applies leg temperament coefficients.
3. **Combat and damage:** combat.js WEAPONS owns 3 actual gun feed/cadence/recoil/spread profiles; fireWeapon consumes physical ammunition; applyRecoil alters mass-dependent linear velocity and yaw impulse. Three.js raycasts in scene.js choose actual slot ownership through tagged meshes, while combat.js TARGET_RESILIENCE, applyTargetHit and damageFate handle the resulting damage. All current frames share the same base structure integrity and armor pool. Mobility damageTakenScale is leg-specific.
4. **Operability:** functionalDamage.js scales powered output by generator condition and nominal fitted demand; separate left/right drive condition matters. This is not a transient reserve/overload simulation. Gun condition changes shot spread/cycle; the active weapon must be physically operational.
5. **Presentation:** scene.js has a mostly common cockpit screen layout and two fitted-cab visual toggles; damage can affect screen fidelity, but this is not three distinct cockpit instrument systems. audio.js currently plays generic fire, impact, reload and empty cues, not fitted-leg/generator signatures.
6. **Economy:** partEconomy.js assigns distinct yard valuation per definition and adjusts owned-instance value for wear/condition/destruction. economy.js repairQuote uses slot-level rates and real armor/integrity damage; service access is not currently frame-specific. Garage reads existing part mass, power, condition and costs.

## Fourteen-part identity audit

Status vocabulary: **LIVE** = mechanically supported now; **VISUAL** = model/presentation currently differs but does not grant an information or handling advantage; **GAP** = planned only. The future column is a design target, not a claim about the build.

| Part (definition ID) | LIVE consequences now | Existing limitation / false assumption | Next grounded differentiator and implementation authority |
|---|---|---|---|
| Bruiser SR-01 · frame-sr | 1,580 kg; 5,100 kg rated structural load; larger envelope and physical frame mesh; mass changes handling/recoil and power/mount legality indirectly | No unique structure armor/integrity value or special recoil rigidity; front protective geometry not yet independently confirmed by angle-of-attack tests | Measure front/module shielding by raycast in scene.js/sceneAssembly.js; only add protection where actual meshes obstruct shots (v.3) |
| Skeleton U-2 · frame-utility | 1,290 kg; 4,120 kg rated structural load; open visual structure, lighter load and changed frame-width contribution to yaw inertia | Exposure and accessible servicing are a visual fantasy, not a separate service-price rule or verified mesh hit probability | Quantify vulnerable module sightlines from real mesh and compare open rails, avoid unconditional damage debuff (v.3) |
| Wedge W-3 · frame-wedge | 1,450 kg; 4,850 kg structural rating; distinct low nose geometry and width-induced handling contribution | Neither a guaranteed frontal damage reduction nor increased flank damage is explicitly implemented | Validate and improve physical forward overlap before claiming asymmetric shielding (v.3) |
| Yardwalker · legs-yard | 1,240 kg; 4,700 kg load; 7.4 m/s nominal top speed, drive, lateral/turn/brake constants; balanced family profile and baseline damage sensitivity | No brace command, dedicated step sounds or actuator-body load sounds | Physically backed recoil/bracing then footwork response from actual stepRig telemetry (v.1–v.2, v.9) |
| Kestrel · legs-compact | 1,010 kg; 3,900 kg load; 9.3 m/s nominal top speed; quicker forward/turn authority, less lateral grip, 1.25× mobility damage taken; low yaw inertia | Quick does not automatically mean low real recoil on every load; installed mass and weapon change results | Record legal matched-load displacement, recovery and one-drive degradation, not canned accuracy multipliers (v.1–v.2) |
| Hauler H2 · legs-hauler | 1,520 kg plus real 110 kg H2/U1 adapter; 5,500 kg legs rating; 6.2 m/s nominal max speed, heavy grip/braking, high yaw inertia and 0.72× mobility damage taken | “Hauler is always best against recoil” needs legality- and load-matched measurement; 115 kW leg demand invalidates Draft builds | Recoil recovery, planted brace and deliberate inertia feedback; keep existing mass/adapters (v.1–v.2) |
| Dynamo G-2 · power-dynamo | 510 kg, 145 kW rated; heavy generator mass and nominal power headroom affect build options; damage linearly reduces available power | No slow spool, transient reservoir or superior sustained-load recovery yet | Deterministic sustained/transient demand and indicator tied to real output (v.4) |
| Draft A-1 · power-air | 365 kg, 112 kW rated; 145 kg lighter; high-load configurations are blocked by inspectAssembly; condition reduces available power | No implemented faster short-load response, overload reserve or unique fault behavior | Bounded deterministic transient behavior and recovery only after foundational physics (v.4) |
| Cyclops · cab-cyclops | 350 kg, 8 kW consumption; physical optic/cab model, common cockpit essentials and damage feedback | No uniquely crude analog gauges, protected sight physics or cab-specific sensor fidelity | Resilient limited-but-clear real display profile, without removing essential UX (v.5) |
| Vista · cab-utility | 295 kg, 11 kW demand; lighter machine; separate exterior and small cockpit ornament | Wider actionable field of view, true rangefinding and clearer tactical sensors are not implemented | Distinct truthful observation/diagnostic profile, assess actual camera geometry (v.5) |
| Hearth · cab-armored | 460 kg, 20 kW demand; heavier protected-looking enclosure and distinct cockpit ornament | No verified improved command subsystem hit protection, redundancy or directional damage rule | Test exterior physical shielding then resilient-warning emphasis; instrument identity (v.3/v.5) |
| Training Cannon · gun-cannon | 410 kg, 18 kW; 12+60 rounds, 2.4/s, 2.5s reload, damage 38, impulse 1,725 Ns, spread .004 radians | Generic ballistic fire/reload and audio, not distinct gun mechanical staging | Baseline reference for recoil/handling and later feed mechanism contrasts (v.1/v.6 onward) |
| Stump Cannon · gun-short | 300 kg, 8 kW; 8+48 rounds, 2.0/s, 2.1s reload, damage 47, impulse 2,550 Ns, spread .012 | Lower-mounted mass does not mean lighter kick; current short cannon is not a revolver | Make recoil consequence conspicuous; do not relabel as six-shooter (v.1/v.7) |
| Needle Cannon · gun-light | 255 kg, 24 kW; 16+80 rounds, 3.5/s, 2.8s reload, damage 28, impulse 1,050 Ns, spread .002 | Power-hungry low-recoil precision cannon exists already; no distance-falloff or proprietary sensors | Comparison against heavier weapons and weapon-system damage with honest ammo economics (v.1/v.10) |

### Concrete existing distinctions that should NOT be rebuilt

- **Leg behavior:** drive, damping, turning, sideways traction, speed caps and collision responses already differ through mobilityPerformance.js into deriveRigConfig/stepRig. Existing tests/mobilityPerformance.test.mjs covers basic launch, coasting, turning, braking and mobility resilience ordering.
- **Power legality:** current static 145 vs 112 kW already gates loadouts. Hauler at 115 kW nominal leg draw alone cannot operate with Draft. Do not emulate this with generic combat penalties.
- **Weapon handling:** all 3 guns already have different actual physical recoil impulse, magazine timing, damage, spread and power/mass implications. Main.js calls applyRecoil after a successfully consumed shot for player and AI.
- **Serial/economy:** preexisting CATALOG order and IDs support starter serials and saved physical inventory; per-definition resale valuation exists. Keep old IDs/order stable.

### False assumptions / not-yet-proven gameplay

- **Frames:** each fresh frame receives the same current combat.js structural base resilience: 260 integrity / 250 armor. Wedge nose and Bruiser plating are meshes, not verified automatic immunity. Per-part shielding requires scripted 3D raycast tests, which this Node-only baseline does not provide.
- **Cab performance:** there is only a shared cockpit instrument-screen system in scene.js. Some aesthetic ornaments respond to selected cab; there is not yet a command-module-specific sensor information contract.
- **Generator response:** functionalOutput computes a nominal power factor from condition and demand. Nothing in this audit establishes continuous-versus-transient reserve, spool time or thermal dynamics.
- **Damage/repair:** every slot has slot-wide resilience and repair pricing; mobility alone has family-specific damageTakenScale. No real frame accessibility premium has been established.
- **Real versus proxy:** pure Node measurements cannot measure actual Three.js mesh shielding, true camera visibility, iPhone touch/layout/audio performance, BO3 settlement or subjective weapon feel. Do not convert them into false confidence.

## Measurement procedure and reproducibility

Run **node research/partIdentityBaseline.mjs** (human-readable) or **node research/partIdentityBaseline.mjs --json** (machine-readable). The fixed 1/60s benchmark uses live functions on an empty AABB arena so walls/traffic cannot corrupt mechanical attribution.

- **27 frame × leg × gun attempts:** Dynamo and Cyclops fitted; validate full assembly before collecting 1-second launch speed/distance, 1-second sideways response, braking distance from 5 m/s, 90-degree rotation and post-shot recoil displacement/yaw. Invalid combinations are reported with real inspection reason and **no synthetic motion number**.
- **18 leg × generator × cab attempts:** Bruiser + Stump reference; validate mass, static draw and functional power factor before comparisons. No invented generator transient score or invented cockpit range score.
- **3 eight-second gun cycles:** calls real fireWeapon, advanceWeapon and startReload at 60 Hz, recording shots, reload starts and remaining bullets; not a line-of-sight or damage-to-kill estimator.
- **Repeatability/identity tests:** tests/k3v0PartIdentity.test.mjs asserts first 14 serial-definition order, 27/18 scenario coverage, all original weapons/families represented by legal examples, faithful rejection of illegal combinations and deterministic outputs.

### Quality gate

**This PR changes zero shipped game behavior.** Pure measurement and documentation are the only deliverables. k.3v.1 should first target **one physical BRACE transition in stepRig**, not new AI logic or new weapon inventory, after comparing the recorded recoil traces. Before moving forward, verify repository npm test, k3v0 CI, headless Domination smoke, and a separate manual iPhone baseline. CI passing cannot by itself establish frame geometry or phone feel.

## Smallest next change proposed for k.3v.1 (NOT included here)

Trace a consumed shot → exactly one applyRecoil → rig.vx/vz/yawRate → subsequent stepRig damping sequence for two legal machines using the same weapon. Then introduce a short fixed-step brace state to the **existing shared locomotion controller** with a mobility penalty, transition and visible release condition. Re-run the same harness to demonstrate reduced post-shot drift **without deleting linear momentum**, before adding elaborate animations, audio or AI decision making.
