# M3CH4 — k.3v.5.1 Garage & Bout Fixes

Regression follow-up to k.3v.5 based on hands-on iPhone feedback.

## Corrected root causes

1. **DEV header showed a hardcoded k.3u.7** despite the page/game actually
   being k.3v.5. This patch derives the header directly from the one page
   title (now `0.0.1k.3v.5.1 — Garage & Bout Fixes`).
   Both the game entry script and garage module imports are cache-busted.

2. **Mounted modules appeared unresponsive in bays 2/3.** A repeat tap on
   an already selected station silently *cleared* selection. The garage
   also preserved scroll coordinates from the previous bay or slot, so
   new part details could appear above the current scrolled viewport.
   Selection now always opens the tapped station; there is a separate
   CLOSE PART DETAILS action. Bay/slot changes reset scroll to the top.
   The selected fitted part's detail also provides a direct REMOVE
   action. The same underlying changeInactiveBay/mountPartOnRig/
   unmountPartFromRig serial-authoritative mutation path is used.

3. **Other-machine parts looked installable.** The rack used to mix
   available and fitted-on-another-machine serialized instances with
   small badges and a disabled button. It now separates them into
   AVAILABLE / FITTED-TO-OTHER-MACHINES sections, uses an explicit BAY
   label, and provides a one-tap NAVIGATE TO OWNER BAY action.
   A physically serialized part is not transferable without first
   unmounting it from the owning machine. A frame with attached modules
   also names the required child-detachment step.

4. **Percentages appeared inconsistent in intermissions.** An internal
   component can honestly be 100% while its armor has been shot to
   12%. The station UI used to show only the intact 100% core value
   while the surrounding status was critical. Every station now
   renders separate **CORE** and **ARM** percentages. Details show the
   same serial-matched armor and internal integrity. The legacy
   sortie-selection/status adapter now uses the same `bayHealth()`
   serialized part snapshot calculation, so stripped armor no longer
   appears `OPERATIONAL` in the other entry path.

5. **Domination team wipe looked delayed.** The existing squad resolver
   already immediately registered all-hostiles-disabled. However the
   report was gated behind an unconditional 4.25s outro after victory.
   A complete side elimination now uses zero outro seconds and opens
   debrief on the same frame (barring render-cycle scheduling).
   Territory score victories retain their previous short aftermath;
   BO3, score, economy, wreck, salvage, persistent condition and field
   work still use the unchanged finishSortie authority.

## Tests and limits

- A new end-to-end data test acquires two extra physical frame serials,
  mounts then removes one on bay 2 and bay 3 independently, reloads
  local storage each time, and proves the removed serial remains owned
  but not fitted.
- Test cases verify two-pool armor/core readings, cross-bay ownership,
  actual fitted-part removal affordance, version truth, and zero-delay
  elimination outcome. The original full regression suite, generator
  study, frame-shield raycaster audit, cockpit geometry study, and
  headless 3v3 Domination compatibility remain the gate.
- Actual touch hitboxes and scroll gestures on the user's iPhone are
  not measurable with headless Node CI. Manual post-deployment iPhone
  testing is recommended. This is a bugfix, **not** a new weapon/build.
