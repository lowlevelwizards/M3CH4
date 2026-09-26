# MECH ARENA 0.0.1i — Aim & Fire Together

Flat-directory compiled **mobile playtest patch** for the working 0.0.1h.1 project. Overlay these files on that version; keep all other files. The separate source ZIP contains editable TypeScript for Vite (`npm install` and `npm run dev`).

## What to test on an iPhone (landscape)

1. Deploy from the Garage. Move/strafe with the left thumb as before.
2. Use the right LOOK area to aim without shooting; this is unchanged.
3. **Touch FIRE and keep holding.** The cannon fires immediately, then continues at its normal rate. **Drag that same thumb anywhere**, including beyond the visible button, to track the target while firing. Drag left/right to traverse and up/down to adjust elevation. Your aim must not jump when your thumb first touches FIRE.
4. At the horizontal traverse edge, the chassis should rotate to follow just as it does when dragging LOOK. Release FIRE to stop shooting without recentering the view.
5. Test holding FIRE through an automatic reload, canceling a drag, and returning to the Garage. Keyboard F, separate LOOK, BRAKE and RELOAD remain available.

This patch changes only combat touch ergonomics and the FIRE hint. It does not change locomotion, enemy behavior, damage, persistence, part definitions, or the flat-directory layout. Reload and empty-ammo restrictions still apply to the weapon itself, even while you keep aiming.

**Installation:** The mobile playtest ZIP is an incremental patch, not a complete game. Upload it over the *working 0.0.1h.1 deployment* on the same static host, preserving unchanged files and the existing browser save. If Safari serves cached scripts, reload the URL (or add `?v=i1` to the URL).
