# MECH ARENA 0.0.1i — Aim & Fire Together

- FIRE now supports captured, relative one-finger drag to aim while held; tapping still fires immediately.
- FIRE and LOOK share the exact same aim sensitivity, direction, pitch and traverse limits. Existing chassis body-follow continues to work while firing.
- A held firing touch retains control across automatic reload; shot/reload/ammunition restrictions are unchanged.
- Release, cancel, focus loss, Garage transitions and test end all clear firing state safely; keyboard F remains supported.
- Small on-button `DRAG TO AIM` label and refreshed cache-busting on the compiled mobile page.
- Added regression coverage for directional aiming, zero-jump touch start, clamp and body-follow handoff.

Deliberately deferred: opponent locomotion, movement tuning, new parts, save export, firing-mode options, and UI redesign.
