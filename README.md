# MECH ARENA — 0.0.1f · Damage Expression

**Incremental patch on top of 0.0.1e.2.** The flat-directory mobile workflow is unchanged.

## Install

1. Keep your existing 0.0.1e.2 hosted files.
2. Unzip `MECH_ARENA_0.0.1f_playtest_PATCH.zip` and upload its root-level files over the matching files. `damageVisuals.js` is new.
3. Reload the page/Home Screen app. If Safari keeps an old module, a one-time query such as `?v=f` will force a fresh document load.

The Garage now has only one Deploy control: the top-left Deploy/Garage button.

## What to test

- Fire at fresh armor and watch for a compact bright impact plus a few dark chips.
- Keep shooting the same location until armor is breached. Penetrations should read as a sharper, heavier burst with a larger local scar.
- Disable different target systems. A destroyed structural/leg/weapon assembly should fail without a generic fireball; a power-module disable gets the strongest electrical-looking burst and smoke puff because it contains stored/active energy.
- Leave a badly damaged target standing for several seconds. Intermittent sparks and coarse smoke should originate around the actual affected assembly rather than the torso at random.
- Use **REBUILD TARGET** and confirm scars and active pooled particles clear.
- Sustained fire should remain stable on iPhone; the effect pools are hard-capped rather than allocating unbounded particles.

## Causal rules in this pass

`projectile → physical hit point → armor response → penetration/disable result → local visual effect`

Persistent distress is also module-aware. Power hardware begins complaining earlier than passive structure; weapons and locomotion show stronger distress only after substantial internal damage. These are visualization rules over the existing damage authority—not a second health system.

## Scope boundary

This first expression pass is intentionally **target-side** because the stationary target is where real projectile impacts currently occur. Player damage is still injected through DEV controls, so Garage-side smoke/sparks, visible detached armor, fire, fluid leaks, and mesh fracture remain future steps. No new combat or failure mechanics were added.
