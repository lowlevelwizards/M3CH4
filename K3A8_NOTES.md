# M3CH4 — k.3a.8 Mobility Family Silhouette Separation Pass

Baseline: `main` @ `310ae4f6a997de8281249b1170cf37bd5b2f5ce4`

## Scope

Preview / authoring / diagnostic geometry only. This patch does **not** modify `components.js`, gameplay locomotion, physics, combat, damage, persistence, garage behavior, save schema, `scene.js`, `sceneAssembly.js`, or `main.js`.

## What changed

### Hauler — largest rewrite
- Fixed side pods widened to dominate the upper silhouette while remaining inside the existing 2.55 × 1.68 × 1.35 m catalogue envelope.
- Visible upper linkage narrowed/recessed so it no longer reads as a normal long thigh.
- Knee hub enlarged and lowered under the pod.
- Lower member rewritten visually as a thick compression column.
- Load shoes enlarged and split into two dominant forward load pads with a smaller rear support bridge rather than an oversized Yardwalker boot.
- H2/U1 adapter path and explicit 110 kg adapter metadata remain unchanged.

### Kestrel — reverse-knee exaggeration
- Hip/saddle narrowed.
- Knee pushed farther rearward and ankle farther forward to create an unmistakable zigzag side profile.
- Upper/lower spars, bearings, actuator and hock reduced in visual mass.
- Triangulation stay shortened so it no longer fills the signature negative-space triangle.
- Feet reduced to compact split runner toes.

### Yardwalker — neutral middle rebalance
- Moderate hip blocks retained.
- Calf shell made fuller through its upper/middle region and tapered more clearly at the ankle.
- Foot rewritten toward a continuous industrial work boot with a heel and squared twin toe pads rather than claw-like prongs.
- Remains intentionally between Kestrel and Hauler in width and footprint.

### Authoring / diagnostics
- `mobilityDefinitions.js` now exposes silhouette metrics and fail-closed cross-family separation checks.
- `chassisAudit.js` uses family-specific layout validators and updated pod/foot/member proxies.
- `mobility-anatomy.html` / `mobilityAnatomyLab.js` remain the first approval gate: equal-scale front, right-side and 3/4 views, gray by default, optional labels/envelopes.
- Chassis preview/audit HTML version tags now identify k.3a.8 and link the intended review sequence.

## Measured authored silhouette metrics

| Family | Hip span | Footprint W × D | Footprint area | Upper mass width | Side-path signature |
|---|---:|---:|---:|---:|---|
| Kestrel | 0.86 m | 1.30 × 0.54 m | 0.702 m² | 1.10 m | knee +0.33 m rearward; ankle 0.45 m forward from knee |
| Yardwalker | 1.28 m | 1.88 × 0.76 m | 1.429 m² | 1.54 m | modest 0.10 m rear / 0.10 m forward work-leg path |
| Hauler | 1.82 m | 2.54 × 1.16 m | 2.946 m² | 2.52 m pod span | only ~0.17 m upper linkage exposed below pod |

The cross-family ordering gate requires Kestrel < Yardwalker < Hauler for hip span and footprint, a strongly reverse-knee Kestrel, and dominant Hauler pod/foot mass.

## Tests

Added `tests/mobilitySilhouette.test.mjs`.

Local result:
- 6 tests
- 6 passed
- 0 failed

Checks cover:
- catalogue-linked interface/envelope facts
- mirrored anchors and guide receiver topology
- narrow / middle / heavy width and footprint ordering
- Kestrel rear-knee / forward-shin path
- Hauler pod dominance, short exposed upper linkage and oversized load shoes
- one fail-closed family-separation invariant

All changed JavaScript files also pass `node --check`.

## Important validation limit

The real preview constructors still call `assertMobilityMeshEnvelope()`, which measures each actual transformed Three.js mesh and throws if geometry exceeds the catalogue envelope. The current execution environment does not have the browser/CDN Three.js module available for a full WebGL constructor run, so that transformed-vertex assertion could not be executed headlessly here. It remains fail-closed in the delivered code and is the first browser-level check when the anatomy/chassis pages render.

This is still a **static rest-pose** review. It does not certify gait sweep, IK, balance, collision physics, load strength, or dynamic ground clearance.

## Human approval order

1. Open `mobility-anatomy.html`.
2. Keep **Gray anatomy** on and turn **Labels** off.
3. Check FRONT → RIGHT SIDE → 3/4 at equal scale.
4. Require immediate shape-only read:
   - Yardwalker = neutral utility walker
   - Kestrel = narrow reverse-knee runner
   - Hauler = squat podded load-bearer
5. Open `chassis-audit.html` and compare all 3×3 mounted combinations at the same camera/scale.
6. Reject the pass if Hauler still reads as a wider Yardwalker or Kestrel reads as an upright standard walker.

## Patch files

- `mobilityDefinitions.js`
- `mobilityVisualKit.js`
- `yardwalkerVisual.js`
- `kestrelVisual.js`
- `haulerVisual.js`
- `mobilityAnatomyLab.js`
- `mobility-anatomy.html`
- `chassisAudit.js`
- `chassis-preview.html`
- `chassis-audit.html`
- `tests/mobilitySilhouette.test.mjs`
- `K3A8_NOTES.md`
