# MECH ARENA — 0.0.1e.2 · Garage Interface

**Incremental update on top of 0.0.1d.1.** All project files remain flat at the root; no folder migration, no changes to the previous chassis, command modules, locomotion, aiming or weapons.

## Install on your existing static host (iPhone)

1. **Keep all of your existing 0.0.1d.1 playtest files.** Unzip `MECH_ARENA_0.0.1e1_playtest_PATCH.zip` and upload its root-level files **over** the matching existing files. `garage.js` is new. Don't delete any unchanged modules.
2. Reload the hosted game. If the old version is cached, try a one-time URL query such as `?v=e1`, or reload the Home Screen web app.
3. The game now starts in **GARAGE**. Choose **DEPLOY TO TEST RANGE** (or the top-left Deploy button). To return, tap the top-left **GARAGE** button in the arena.

For editable source, unpack `MECH_ARENA_0.0.1e1_source_PATCH.zip` over the original flat source project and run `npm install`, `npm run check`, `npm test`, and `npm run dev` as usual.

## Small test route

- Start in Garage; orbit around your assembled mech. Optionally swap any of the existing modules. Deploy into the range.
- Tap **DEV**, inject **HIT L DRIVE −25%** once or twice, then close DEV and notice the change under acceleration. The diagnostic fault strip reflects the actual power loss.
- Tap **GARAGE**. Select **MOBILITY** from the list. Check the total condition, distinct left/right drive conditions and original serial.
- Choose **REPAIR MOBILITY · NO COST (TEST)**. Both drive sections recover, and the owned part's repair count increments. Deploy again and check that movement has recovered.
- Repeat with the Generator or Weapon. You can also leave a part damaged, swap it out, and fit it again; the old part still has its original condition until specifically repaired.
- Shoot the range target and compare **ARMOR IMPACT**, **ARMOR BREACHED**, and **MODULE DISABLED** messages. Existing 3D sparks/tracers are unchanged.

## Scope of this patch

- In-session Garage ↔ Arena deployment flow using the existing Assembly inspector.
- Accurate condition/repair-count readouts, side-specific drive inspection, one-step no-cost repairs on the *actual installed serial*.
- Reloaded training ammunition and a fresh position **on each deployment**; owned part condition and repair history stay the same until page reload.
- A minimal impact-message distinction for armor vs penetration vs disabled parts.
- **Not in this stage:** browser persistence, currency or repair costs, incoming enemy fire, new smoke/explosions/debris particles, and visually modeled player damage. Closing/reloading this e.1 build restores the initial test machine; persistence is e.2.

This small patch uses the same external Three.js CDN and existing hosting setup as 0.0.1d.1. The static playtest is pre-transpiled and requires no build step once uploaded.


## 0.0.1e.2 garage interface
The long component list is replaced by a compact five-system rail. Each system icon derives its color directly from the installed component/function condition: green healthy, yellow degraded, orange damaged, red disabled, gray missing. Selecting a system opens a contextual drawer containing the installed module, repair action and currently available alternatives; selecting it again or tapping empty space collapses the drawer so the 3D machine stays dominant.
