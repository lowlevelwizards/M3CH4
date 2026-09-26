# M3CH4 0.0.1k.2 — First Real Assembly

Changed/new-files-only patch based on `lowlevelwizards/M3CH4` main commit `8d430596341559a9636a9906d155976ac5d32c56` (the 0.0.1k.1 foundation on top of 0.0.1j.2 Spatial Awareness).

## Install
Overlay the ZIP's contents directly onto your **complete existing 0.0.1k.1 + 0.0.1j.2** deployment. Keep every file not in this archive. Do not deploy this patch as an empty website. Keep the same site origin to retain localStorage, and back up your current garage save before loading the new build. The same save key now writes v3; v1 and v2 migrate in memory, and old builds cannot read v3 on rollback. Force-refresh the Safari/Home Screen web app after upload.

## Playtest: one end-to-end mechanical construction example
Open GARAGE, choose POWER, tap PREVIEW LEFT OUTRIGGER and inspect the translucent generator + bracket ghost. Tap CONFIRM to install. A real 85 kg nested structural bracket appears on the mech's left rear; the generator moves with it and the mass changes from 4,090 kg to 4,175 kg with the default equipment. Selecting POWER focuses the actual relocated position, and the hostile's power-component aim and hit raycasts follow the moved model. Tap PREVIEW FACTORY REAR and CONFIRM to return it without changing its serial, wear or damage. Garage swap/removal failures now display their actual reasons. A saved incomplete rig can reopen in the garage instead of crashing startup.

## Scope / compatibility
The existing five legacy functions still drive pilot locomotion, first-person cockpit, recoil and component damage. The new graph drives the exterior's assembly hierarchy and the one optional generator mount. The H2 adapter still costs 110 kg; the new bracket costs 85 kg and is a derived proof-of-concept (no separate owned inventory entry or repair history yet). Bracket impacts presently count as power-system hits; independent bracket durability, clearance collision and arbitrary weapon mounts are deferred. Reset the generator to FACTORY REAR before using the legacy controls to swap its power module or frame. Leave j.2 enemyMotion.js and locomotion.js untouched; the opponent's obstacle navigation, shared pillars and waypoint marker remain intact.

## Verification
The data-layer regressions cover v1/v2 migration, v3 save/reload, damage/serial retention, heavy hip adapter combination, bad attachment rejection, non-deployable saves and all 162 existing part combinations. The modified main.js and scene.js pass JavaScript syntax parsing and retain the j.2 navigation hooks. On a complete local checkout with Node 18+, run `npm test`; this ZIP restores a runnable test file to the repository. A physical iPhone playthrough has not been executed. After overlay, manually verify POWER preview/confirm, 85 kg increase, moving-generator hostile hits, H2 legs, return-to-garage, reload and enemy obstacle avoidance.

## Deliberately deferred
No second body shape, socket-picker CAD UI, arbitrary limb placement, independent bracket damage, generalized locomotion or major visual overhaul. The next build can expand the now-visible physical mounting workflow after mobile validation.
