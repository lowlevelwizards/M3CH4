/** k.3k.0 team-combat layer, extended in k.3n.0 for campaign encounter recipes.
 *
 * This module owns formation recipes, target stickiness and team-resolution math.
 * It does not render, fire weapons or move rigs; the existing combat/physics systems
 * remain authoritative for every actor.
 */
export const PLAYER_ACTOR_ID = 'player';
export const FRIENDLY_TEAM = 'friendly';
export const HOSTILE_TEAM = 'hostile';

export const FRIENDLY_SUPPORTS = Object.freeze([
    Object.freeze({ id: 'ally-1', team: FRIENDLY_TEAM, contractId: 'cutter', x: -9, z: 21, yaw: 0, label: 'ALLY KESTREL' }),
    Object.freeze({ id: 'ally-2', team: FRIENDLY_TEAM, contractId: 'mule', x: 9, z: 21, yaw: 0, label: 'ALLY HAULER' }),
]);

export const HOSTILE_SUPPORT_SPAWNS = Object.freeze([
    Object.freeze({ id: 'enemy-1', team: HOSTILE_TEAM, x: -9, z: -21, yaw: Math.PI }),
    Object.freeze({ id: 'enemy-2', team: HOSTILE_TEAM, x: 9, z: -21, yaw: Math.PI }),
]);

const SUPPORT_RECIPES = Object.freeze({
    'yard-dog': Object.freeze(['yard-dog', 'yard-dog']),
    // Recovery work is deliberately asymmetric: three friendly rigs clearing a
    // smaller two-rig crew creates a real low-risk fallback without a new game mode.
    'recovery-run': Object.freeze(['yard-dog']),
    cutter: Object.freeze(['yard-dog', 'cutter']),
    domination: Object.freeze(['cutter', 'mule']),
    mule: Object.freeze(['yard-dog', 'cutter']),
    // Primary final opponent is the pressure lead; its wings supply the other two
    // doctrines so the finale exercises the entire existing combat vocabulary.
    'circuit-final': Object.freeze(['cutter', 'mule']),
});

export function hostileSupportRecipes(contractId) {
    return [...(SUPPORT_RECIPES[contractId] ?? SUPPORT_RECIPES['yard-dog'])];
}

const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));

/** Pick a nearby live opponent, but retain a valid current target until another
 * candidate is materially closer. This prevents actors from flickering targets
 * every fixed step while still letting a flanker or surviving opponent pull aggro. */
export function chooseSquadTarget(actor, candidates, currentId = null) {
    const live = (candidates ?? []).filter(candidate => candidate?.active !== false && candidate?.id !== actor?.id);
    if (!live.length) return null;
    let nearest = live[0];
    let nearestDistance = distance(actor?.rig ?? actor, nearest.rig ?? nearest);
    for (const candidate of live.slice(1)) {
        const candidateDistance = distance(actor?.rig ?? actor, candidate.rig ?? candidate);
        if (candidateDistance < nearestDistance) { nearest = candidate; nearestDistance = candidateDistance; }
    }
    const current = live.find(candidate => candidate.id === currentId);
    if (!current) return nearest.id;
    const currentDistance = distance(actor?.rig ?? actor, current.rig ?? current);
    return currentDistance <= nearestDistance * 1.35 + 1.5 ? current.id : nearest.id;
}

export function squadCounts(playerActive, actors) {
    let friendly = playerActive ? 1 : 0;
    let hostile = 0;
    for (const actor of actors ?? []) {
        if (actor?.active === false) continue;
        if (actor?.team === FRIENDLY_TEAM) friendly++;
        else if (actor?.team === HOSTILE_TEAM) hostile++;
    }
    return { friendly, hostile };
}

/** A team fight ends only when every combat-capable actor on one side is out. */
export function squadOutcome(playerActive, actors) {
    const counts = squadCounts(playerActive, actors);
    if (counts.hostile === 0) return { victory: true, reason: 'HOSTILE TEAM COMBAT INEFFECTIVE', counts };
    if (counts.friendly === 0) return { victory: false, reason: 'FRIENDLY TEAM COMBAT INEFFECTIVE', counts };
    return null;
}
