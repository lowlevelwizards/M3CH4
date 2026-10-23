/** The pilot HUD is a *near barrel clearance* cue, not a far-off
 * line-of-sight or target-acquisition indicator. All distances are measured
 * along the authoritative zero-spread muzzle ray. The AI deliberately does
 * NOT use this short HUD window. */
export const PLAYER_BLOCK_WARNING_METERS = 3.6;
export function locallyBlockedMuzzle(contact,range=PLAYER_BLOCK_WARNING_METERS){
    return !!contact?.aimObstructed &&
        Number.isFinite(contact.distance) && contact.distance>=0 &&
        contact.distance<=range;
}
