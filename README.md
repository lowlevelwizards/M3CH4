# MECH ARENA 0.0.1h.1 — Your Persistent Machine

Contained update to the working **0.0.1g.1.1** mobile build. This is a compiled mobile playtest PATCH, not a stand-alone game. Overlay these flat files onto your existing installation; leave unchanged files on the host.

## New behavior
- Saves the installed loadout, every owned component's serial/condition/wear/repair count, individual left/right drive condition, and player armor/housing integrity in versioned browser storage.
- Saves automatically when you swap parts, repair, receive an incoming hit (including armor-only hits), or use developer damage controls. The game also flushes on Safari suspension/page exit.
- Reopening the same site/Home Screen web app restores your rig **in the Garage**, not in combat; ammo and the hostile test opponent reset for each deployment.
- If storage is blocked or an invalid save is encountered, a fresh test rig opens and a short status message is shown instead of crashing.

**Important:** Saves belong to the exact browser/origin where the game is hosted. A private tab, changing URLs/domains, deleting website data or installing on another device will not transfer your machine. Save export/import and backup recovery are deferred to h.2.

## Scope deliberately unchanged
No new parts, damage systems, combat controls, economy, backup UI, match history or migrations. Keep the original 0.0.1g.1.1 files except for the changed files in this ZIP.
