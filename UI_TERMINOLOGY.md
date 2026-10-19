# M3CH4 — Unified UI Vocabulary (k.3w.0)

This is the canonical player-facing vocabulary. Underlying station save keys (structure, mobility, power, command, combat), serialized inventories and physics are unchanged.

| Term | Meaning | Do not substitute |
|---|---|---|
| Rig | One complete named fighting machine | loadout / machine |
| Bay | Garage position occupied by a rig | stable slot |
| Station | Fixed mounting location on a rig | module slot |
| Part | One individually owned serialized equipment piece | module / hardware / component |
| Integrity | Remaining internal part condition | health or armor |
| Armor | External protective capacity remaining | integrity |
| Wear | Long-term deterioration | damage sustained in this fight |
| Fault | Actual physical functional impairment | arbitrary UI penalty |

## Five station symbols

FRAME ⬡ (structure); DRIVE ⋀ (mobility); POWER ϟ (power); CAB ◉ (command); WEAPON ✦ (combat).

The registry in uiLanguage.js is the only source of truth for station labels, symbols and UI color semantics.

Armor is displayed as an OUTER amber track and Integrity as an INNER mint/teal track. Numbers remain available by tap, tooltips or accessibility labels.

Glance = information relevant right now. Inspect = selected part, identity, current condition and actionable choice. Study = deeper specifications and history.

Keep controls touchable in landscape, preserve reliable fault visibility, and maintain machine-specific Cyclops/Vista/Hearth presentation without changing their underlying sensor/physics permissions.