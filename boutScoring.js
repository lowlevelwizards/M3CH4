/** k.3l.0 — pure sporting attribution for one squad bout.
 * Team result decides field control. This module decides who actually contributed,
 * who was MVP, and the winning side's salvage draft priority.
 */
export const SCORE = Object.freeze({
    armorPercent: .25,
    internalPercent: 1.0,
    breach: 30,
    disable: 100,
    missionKill: 75,
    assist: 50,
    victory: 50,
    survived: 25,
});
export const ASSIST_SHARE = .20;
export const PARTICIPATION_SHARE = .15;

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (amount, maximum) => maximum > 0 ? Math.max(0, amount) / maximum * 100 : 0;
const actorSort = (a, b) => String(a.id).localeCompare(String(b.id));

export function createBoutLedger(roster = []) {
    const actors = roster.map(actor => ({ id: actor.id, team: actor.team, label: actor.label ?? actor.id }));
    if (new Set(actors.map(actor => actor.id)).size !== actors.length)
        throw new Error('Bout roster actor IDs must be unique.');
    return { actors, events: [] };
}

export function recordBoutHit(ledger, {
    attackerId, victimId, slot, before, after, hit, time = 0,
} = {}) {
    if (!ledger?.events || !attackerId || !victimId || !slot || !before || !after || !hit)
        return [];
    const armorDamage = Math.max(0, number(hit.armorAbsorbed));
    const internalDamage = Math.max(0, number(hit.internalDamage));
    const armorPercent = pct(armorDamage, number(before.maxArmor));
    const internalPercent = pct(internalDamage, number(before.maxIntegrity));
    const events = [];
    if (armorDamage > 0 || internalDamage > 0) {
        events.push({ type: 'damage', attackerId, victimId, slot, armorDamage, internalDamage, armorPercent, internalPercent, time });
    }
    if (number(before.armor) > 0 && number(after.armor) <= 0 && armorDamage > 0)
        events.push({ type: 'breach', attackerId, victimId, slot, time });
    if (number(before.integrity) > 0 && number(after.integrity) <= 0)
        events.push({ type: 'disable', attackerId, victimId, slot, time });
    if (!before.destroyed && !!after.destroyed)
        events.push({ type: 'destroy', attackerId, victimId, slot, time });
    ledger.events.push(...events);
    return events;
}

export function recordMissionKill(ledger, { attackerId = null, victimId, reason = '', time = 0 } = {}) {
    if (!ledger?.events || !victimId) return null;
    const event = { type: 'missionKill', attackerId, victimId, reason, time };
    ledger.events.push(event);
    return event;
}

function makeStats(actor, survived) {
    return {
        id: actor.id, team: actor.team, label: actor.label,
        armorPercent: 0, internalPercent: 0, effectiveDamage: 0,
        breaches: 0, disables: 0, destroyed: 0, missionKills: 0, assists: 0,
        combatScore: 0, totalScore: 0, survived: !!survived,
        qualified: false, lowParticipation: false,
    };
}

export function scoreBout(ledger, { winningTeam = null, survivors = {} } = {}) {
    const roster = ledger?.actors ?? [];
    const stats = new Map(roster.map(actor => [actor.id, makeStats(actor, survivors[actor.id])]));
    const contribution = new Map(); // victim -> attacker -> raw effective damage units
    const disabledVictimsByAttacker = new Map();

    const ensureVictim = victimId => {
        let map = contribution.get(victimId);
        if (!map) contribution.set(victimId, map = new Map());
        return map;
    };
    const markDisabledVictim = (attackerId, victimId) => {
        let set = disabledVictimsByAttacker.get(attackerId);
        if (!set) disabledVictimsByAttacker.set(attackerId, set = new Set());
        set.add(victimId);
    };

    for (const event of ledger?.events ?? []) {
        const row = stats.get(event.attackerId);
        if (!row) continue;
        if (event.type === 'damage') {
            const armor = number(event.armorPercent);
            const internal = number(event.internalPercent);
            const effective = armor * SCORE.armorPercent + internal * SCORE.internalPercent;
            row.armorPercent += armor;
            row.internalPercent += internal;
            row.effectiveDamage += effective;
            row.combatScore += effective;
            const map = ensureVictim(event.victimId);
            map.set(event.attackerId, (map.get(event.attackerId) ?? 0) + effective);
        }
        else if (event.type === 'breach') {
            row.breaches++;
            row.combatScore += SCORE.breach;
        }
        else if (event.type === 'disable') {
            row.disables++;
            row.combatScore += SCORE.disable;
            markDisabledVictim(event.attackerId, event.victimId);
        }
        else if (event.type === 'destroy') {
            row.destroyed++;
            // Deliberately no bonus: destruction is sometimes necessary, but the
            // physical/economic consequence is already substantial.
        }
        else if (event.type === 'missionKill') {
            row.missionKills++;
            row.combatScore += SCORE.missionKill;
        }
    }

    const killEvents = (ledger?.events ?? []).filter(event => event.type === 'missionKill');
    for (const kill of killEvents) {
        const map = contribution.get(kill.victimId) ?? new Map();
        const total = [...map.values()].reduce((sum, value) => sum + value, 0);
        for (const [attackerId, value] of map) {
            if (attackerId === kill.attackerId) continue;
            const row = stats.get(attackerId);
            if (!row) continue;
            const share = total > 0 ? value / total : 0;
            if (share >= ASSIST_SHARE || disabledVictimsByAttacker.get(attackerId)?.has(kill.victimId)) {
                row.assists++;
                row.combatScore += SCORE.assist;
            }
        }
    }

    const teamCombat = new Map();
    for (const row of stats.values())
        teamCombat.set(row.team, (teamCombat.get(row.team) ?? 0) + row.combatScore);

    for (const row of stats.values()) {
        const teamTotal = teamCombat.get(row.team) ?? 0;
        const share = teamTotal > 0 ? row.combatScore / teamTotal : 0;
        row.qualified = share >= PARTICIPATION_SHARE || row.disables > 0 || row.assists > 0 || row.missionKills > 0;
        row.lowParticipation = !row.qualified;
        row.totalScore = row.combatScore + (row.team === winningTeam ? SCORE.victory : 0) + (row.survived ? SCORE.survived : 0);
        for (const key of ['armorPercent','internalPercent','effectiveDamage','combatScore','totalScore'])
            row[key] = Math.round(row[key] * 10) / 10;
    }

    const standings = [...stats.values()].sort((a, b) =>
        b.totalScore - a.totalScore || b.internalPercent - a.internalPercent || b.disables - a.disables || actorSort(a, b));
    const mvp = [...stats.values()].sort((a, b) =>
        b.combatScore - a.combatScore || b.internalPercent - a.internalPercent || b.disables - a.disables || actorSort(a, b))[0] ?? null;
    const draftOrder = standings
        .filter(row => row.team === winningTeam)
        .sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.totalScore - a.totalScore || b.internalPercent - a.internalPercent || b.disables - a.disables || actorSort(a, b))
        .map(row => row.id);

    const contributionByVictim = {};
    for (const [victimId, map] of contribution) {
        const total = [...map.values()].reduce((sum, value) => sum + value, 0);
        contributionByVictim[victimId] = [...map.entries()]
            .map(([actorId, value]) => ({ actorId, percent: total > 0 ? Math.round(value / total * 100) : 0 }))
            .sort((a, b) => b.percent - a.percent || String(a.actorId).localeCompare(String(b.actorId)));
    }

    return { standings, mvp, draftOrder, contributionByVictim, winningTeam };
}
