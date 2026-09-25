# MECH ARENA · 0.0.1c — FIRST LIVE-FIRE RANGE

**Scope:** one stationary target and one ballistic weapon family, integrated with the existing five-station builder. Same flat directory. This is an incremental patch **over 0.0.1b.6**.

## Apply the patch on your phone

- **Mobile playtest PATCH:** unzip it and upload its **root-level** contents over your currently working 0.0.1b.6 hosted files. Keep every file that the patch doesn't replace. No folders or manual source editing are required.
- Safari may cache the older modules. After uploading, reload with `?v=c1` on the hosted URL, or close and relaunch your Home Screen app.
- The playtest imports Three.js 0.186.0 from jsDelivr, just like the preceding build. It must be on a network-enabled static host; opening its `index.html` from a local Files preview is not the supported path.
- **TypeScript source PATCH:** apply it to your matching flat 0.0.1b.6 source root; on a computer with package access, `npm install && npm run check && npm test && npm run build`.

## Test route: one complete shooting interaction

1. Tap **PILOT VIEW**. The range target is about eight meters straight ahead, facing you. It's a different physical assembly with its own serials, not a flat dummy or a clone sharing player identity.
2. Use the existing floating left stick to move and steer; drag the right area to aim. Hold **FIRE**, or press **F** on desktop. Fire requests consume real magazine rounds immediately; repeat-fire cooldown and reload advance on the fixed simulation tick, so quick taps register reliably.
3. Check the cartridge count and recoil. Your off-center shoulder gun produces a backwards momentum impulse and some chassis yaw; the existing frame/mobility mass affects the reaction. The three already-owned cannons use the same system with distinct magazine, damage, fire-rate, spread and impulse values.
4. Aim at the target's visible **legs, power pack, command cab, frame, or weapon**. The game rays out from the real muzzle toward your central reticle, checks intervening solid warehouse geometry and identifies the **first physical mesh hit**. A localized armor layer absorbs damage before the affected component's underlying integrity falls.
5. Use **TARGET** (top right) to view individual component serials, internal condition and remaining local armor. Hit locations darken and accumulate small impact marks. Use **REBUILD TARGET** to restore its five components and remove impact scars. **R** or the on-screen **RELOAD** button refills the magazine from the finite reserve.
6. Return to **ASSEMBLY** and change the equipped gun, frame or legs. The selected cannon actually determines live-fire behavior. Original inspection orbit, pan, zoom, highlight, selection and fieldability checks remain.

## Implemented, and deliberately *not* implemented

- **0.0.1c.1:** live weapon cycling, magazine + spare rounds, reload and rate limiting, seeded spread, trace and impact, visible breech/recoil response, synthesized mechanical sound, fixed-timestep shot scheduling.
- **0.0.1c.2:** stationary target assembled from the same parts catalogue, first-mesh intersection and obstruction, slot-level armor/integrity, unique serials and mirrored acute condition, localized darkening/scorch marks, status panel and reset.
- **Not in scope:** moving enemy/AI, gravity and simulated projectile travel (a ray represents a very fast short-range ballistic round), complex armor penetration, player taking damage, functional failures, repairs, purchases, ammo economy, or browser persistence. These are later milestones.

## Current files

All project files remain **flat**. New root modules: `combat.ts` (pure weapon/impact state), `audio.ts` (minimal Web Audio feedback), and `combat.test.ts`. Modified root files: `main.ts`, `scene.ts`, `components.ts`, `components.test.ts`, `index.html`, `styles.css`, `package.json`, `README.md` and `CHANGELOG.md`.

The static playtest patch contains transpiled `combat.js`, `audio.js`, `main.js`, `scene.js` and `components.js` instead of the corresponding TypeScript, plus the changed HTML, CSS and notes. Other unchanged `.js` modules and image/manifest must be kept from b.6.

## Verification and limitations

The pure mechanical modules type-check independently; all **47** original and new test cases passed in an offline Vitest-compatible harness (including 9 chassis/cab combinations, original controls and collisions, ammo cadence, recoil, local armor and unique target identities). Each `.ts` file also passed a TypeScript syntax/transpile check. A true `npm`/Three.js compile and live browser/device render **could not be run** in this environment because package/CDN network access and local browser navigation are restricted. Your iPhone playtest remains the final visual and gesture check.
