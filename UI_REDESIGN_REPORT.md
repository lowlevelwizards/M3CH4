# M3CH4 k.3w.0 — Unified Workshop and Cockpit Interface

Integrated redesign following the nine-step roadmap, with no changes to the existing gameplay/save/physical ownership authorities.

## Implemented scope

1. Shared terminology and glyphs in uiLanguage.js, adopted in part rack, garage, station/pit views and cockpit.
2. Reusable nested armor/integrity rings for compact station, part detail and intermission views in uiMeters.js.
3. Reusable simple DOM component and CSS hierarchy; no new framework or per-frame DOM rendering.
4. Compact iPhone landscape garage with rig preview, selected station and selected part in focus.
5. Horizontally swipeable rack, separate Stored/Here and Other Bays, exact part ownership and owning-bay navigation. Direct install/remove plus real mass/power comparisons.
6. Three physical cockpit styles retain distinct low-poly hardware while replacing repeated full-100% diagnostic prose with icons and stacked external-armor/internal-integrity rails. Shorter match/objective/ammo labels and pictographic movement hints.
7. Physical armor absorption and genuine internal-damage events now have distinct amber versus reddish instrument flash paths, aligned to the impacted station.
8. Pit and intermission report display the same serial-checked dual meters. Tap or keyboard action reveals exact integrity, armor and wear.
9. Scoped industrial styling, tighter readout geometry, permanent bay access, compact thumb-swipe rack and reduced repeated explanatory prose.

## Protected boundaries

No added weapon, heat system, sensor perk, damage pool, AI rule, currency mechanic, save format or new serialized part ID. The old gameplay input/weapon/physical-damage authorities remain untouched. No new runtime dependency, 3D texture, or WebGL pass.

The installed part integrity comes from actual live damaged condition and the armour is a separate existing combat pool. Bay condition comes from garageBay.js bayHealth with serial matching, and pit from that same serialized state.

## Automated verification

Node full regression suite, combined with Three.js geometry cockpit audit, exact frame shielding raycast audit, power model scenarios and 3v3 headless Domination smoke. New tests cover nested condition conservation, ownership, presentation mapping, swipe rack and mobile source entrypoints.

## Manual iPhone acceptance still necessary

Review landscape: station tap, selected part comparison, horizontal rack swipes, owner-bay navigation, empty rigs, very damaged rigs, mounted parent dependencies, part service, three cockpit types, armor vs integrity hits, sub-450px landscape height, BO3 intermission, after-fight status and save persistence. Automation cannot measure real iOS touch usability, screenshot aesthetic, Safari safe-area behavior or GPU frame time. These are not claimed verified.