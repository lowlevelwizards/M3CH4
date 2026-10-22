# M3CH4 Test Strategy (lean PR CI)

## Principle
Don't delete useful behavioral regression coverage just to speed up normal development.
The old CI duplicated `npm test` (the same ~95 test files / hundreds of cases) in
multiple unrelated historical workflows. It also ran long geometry and headless
combat studies when only `index.html` or a test assertion changed.

## On every pull request
- **M3CH4 Targeted PR Regression:** Syntax for changed JS, whitespace checks, a
  fixed safety net (machine ownership, serial inventory, economy, contracts,
  sortie assignment, round lifecycle, damage, scoring, and salvage), plus relevant
  tests chosen by changed source paths.
- Any `tests/*.test.mjs` file touched in the PR is **always** included. This is
  how a new feature can bring focused tests into its own PR without requesting
  the entire archive.
- **M3CH4 Browser Startup Smoke** for changes touching entrypoints / live
  workshop / camera: boot the real Three.js scene, Select Job, accept a contract,
  confirm the garage shows Deploy, and enter Sortie Setup.

## Relevant source changes
Historical specialized workflows retain their geometry/physics studies but run
only domain-specific regression tests. They no longer trigger because a build
label changed in index.html, a broad `tests/**` path changed, or generic main.js
UI wiring was edited. Specialized `workflow_dispatch` remains available for
situations where shared source modifications warrant deeper checks.

## Full audit
- `npm test`: **all** historical tests, locally or from the repository root.
- **M3CH4 Full Regression (weekly / manual)**: all tests and the headless
  Domination smoke, weekly on Sunday and on demand.
- **M3CH4 Browser Startup Smoke**, manual or weekly: complete garage, paint,
  vendors, audio, serialization, and browser tests plus weapon visual gallery.

Before significant releases or changes to shared runtime architecture, run the
complete manual workflows. A routine UI or cosmetic PR shouldn't need 500+
tests repeated in seven separate jobs.

## Future test guidelines
- Test **behavior**, not a literal current build version, unless the feature
  specifically concerns cache invalidation. Where freshness matters, compare
  the version references to each other rather than copying the entire build
  label into every old test.
- Add one narrow, deterministic test for each new bug or feature.
- Keep game-critical ownership, deployment, repairs, scoring, and persistence
  tests in the always-on safety net.
- If changing the shared `main.js` logic, include affected specialized tests
  in the PR description and, when appropriate, manually dispatch those studies.
- Don't delete a historical test until its exact behavior is demonstrably
  covered elsewhere. Removal should be a separate documented review.

## Useful commands

```bash
# Fast subset using the changed files relative to the target branch
GITHUB_BASE_SHA="$(git merge-base HEAD origin/main)" node research/selectRegressionTests.mjs --explain

# Full suite, on demand
npm test

# Individual feature tests
node --test tests/k4s3DeployLayout.test.mjs
```
