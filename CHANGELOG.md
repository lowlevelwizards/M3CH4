# 0.0.1f — Damage Expression

- Replaced the single generic impact sparkle with a bounded pooled pixel-particle system.
- Armor hits now throw a restrained spark/chip burst; penetrations produce a sharper, larger burst and darker scar.
- A module becoming disabled produces a one-time failure burst. Power-module disables are more energetic than inert structural failures, but nothing generically explodes just because condition reaches zero.
- Severely damaged target modules now emit intermittent local distress from their actual component position. Power hardware sparks/smokes earlier; weapon and mobility hardware become visibly distressed only at heavier damage.
- Smoke uses coarse expanding pixel blocks; debris uses small dark reusable fragments. Particle counts are capped for mobile performance.
- Existing localized damage darkening and persistent impact scars remain and now scale with outcome severity.
- Removed the redundant Deploy button at the bottom of the Garage rail. The top-left Deploy/Garage control is now the single transition control.

## Deliberately deferred

No fire propagation, fluids, mesh fracture, detached armor panels, persistent debris, player-side exterior smoke in the Garage, enemy AI, or new damage simulation categories. Visual effects do not create gameplay damage of their own.
