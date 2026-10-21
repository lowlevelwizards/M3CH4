# M3CH4 k.4m–q — Interface Clarity Audit

This pass resolves a specific information-priority issue: the game contains accurate
simulation data, but too many screens presented it as explanatory text.

## Display contract

- **Symbol alone:** a repeated, immediately identifiable visual state. Examples:
  - A/B/C zone ownership fill; capture direction arrow; progress bar.
  - Five station integrity/armor bars. Status color supports, never replaces meaning.
  - Point/dot/shotgun ring at idle; diagonal reticle ONLY when a hit lands.
  - Camera orbit gestures, once taught in the initial garage. No separate reset
    control in spectator mode.
- **Short label:** every actionable operation, unfamiliar object, or state that can
  affect a decision. Examples: SERVICE, SWAP, CRITICAL, DISABLED, CONTESTED,
  ROUND, PAYOUT AFTER MATCH. A small × for removal still has an aria-label/title.
- **Full explanation:** only when rules are unusual or a player must make a costly,
  irreversible decision. Examples: intermission labor allocation and inability to
  remove dependent installed frame hardware. Such explanation belongs near the
  action or in accessible on-demand details, not the permanent HUD.

## Replacements and removals

| Surface | Former behavior | Current approach |
| --- | --- | --- |
| Garage camera | Part selection shifted orbit pivot; two-finger pan could leave rig off-screen | Fixed mech pivot, panel-aware parallel camera translation, rotate and pinch only |
| Paint booth | Every preview indirectly refocused the selected component | Never recenter/rezoom on palette changes |
| Spectator | Reset orbit consumed an extra row | Only prev/next ally arrows; swipe and pinch on scene |
| Round result | Long condition text hidden by accordion taps, repair rows clipped | Five exact installed-part visuals, 2 bars, status label, summary |
| Score | Eight explanatory tiles + two panels + six ranked pilots | Three key metrics + six clear leaderboard rows |
| Domination | Multiple horizontal independent banners, raw telemetry text | One unified score + ownership/contest/capture strip with small match context |
| Default aiming | A dimmed version of the hit-confirm cross | Unobtrusive dot; circular pellet-spread indicator for Scattergun |
| Hits | Overlays at point of actual verified contact | Existing diagonal category confirmations preserved |
| Salvage | Re-explained serial persistence under each recoverable part | Short affirmative action label; details remain in part inspector |

## Accessibility and validity

Physical five-part previews are the exact Three.js part meshes and are accompanied
by integrity and armor bars. Every status tile has a readable aria-label including
full numeric values; the team-zone tiles expose owner, contest, counts and progress
for assistive technologies. Crew/team allegiance remains readable without reliance
on hue alone. No gameplay scoring, damage, weapon tuning, salvage, serialized inventory
or AI behavior is modified by this UI-only pass.

## Verification

- Browser startup, paint controls, garage camera centering, zoom persistence and
  real WebGL materials.
- Existing bout, intermission, score and salvage lifecycle tests.
- Domination capture test and explicit static layout invariants.
- Landscape no-scroll reporting at a mobile-sized viewport.
