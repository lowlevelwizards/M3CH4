/** Persistent, append-only sporting evidence, independent of mutable rig condition.
 * No recovery/record path awards money, salvage, experience or campaign progress. */
export const COMBAT_RECORDS_KEY = 'm3ch4-combat-records-v1';
const VERSION = 1;
const MAX_RECENT_MATCHES = 30;
const MAX_RECENT_ROUNDS = 120;
const MAX_SEEN = 700;
const number = n => Number.isFinite(n) && n > 0 ? n : 0;
const count = n => Math.min(1_000_000, Math.floor(number(n)));
const id = v => typeof v === 'string' ? v.trim().slice(0, 100) : '';
const blankTotals = () => ({
    rounds:0, roundWins:0, roundLosses:0, matches:0, wins:0, losses:0, dnf:0,
    shots:0, projectiles:0, hits:0, kills:0, deaths:0, assists:0,
    breaches:0, disables:0, destroys:0, armorDamage:0, internalDamage:0, damageTaken:0,
});
export function emptyCombatRecords() {
    return { version:VERSION, totals:blankTotals(), rigs:{}, parts:{},
        recentMatches:[], recentRounds:[], seenRounds:[], seenMatches:[] };
}
export function loadCombatRecords(storage) {
    try {
        const data = JSON.parse(storage?.getItem(COMBAT_RECORDS_KEY) || 'null');
        if (data?.version === VERSION && data.totals && data.rigs && data.parts &&
            Array.isArray(data.recentMatches) && Array.isArray(data.recentRounds) &&
            Array.isArray(data.seenRounds) && Array.isArray(data.seenMatches))
            return data;
    } catch { /* corrupt/missing sidecar must never trap garage */ }
    return emptyCombatRecords();
}
function commit(storage, data) {
    try { storage?.setItem(COMBAT_RECORDS_KEY, JSON.stringify(data)); return !!storage; }
    catch { return false; }
}
export function clearCombatRecords(storage) {
    try { storage?.removeItem(COMBAT_RECORDS_KEY); return !!storage; }
    catch { return false; }
}
function add(target, changes) {
    for (const [key, amount] of Object.entries(changes)) {
        if (!(key in blankTotals())) continue;
        target[key] = number(target[key]) + number(amount);
    }
}
function entity(table, key) {
    if (!id(key)) return null;
    const clean = id(key);
    return table[clean] ||= blankTotals();
}
const shotFields = entry => ({
    shots:count(entry.shots), projectiles:count(entry.projectiles), hits:count(entry.hits),
    kills:count(entry.kills), deaths:count(entry.deaths), assists:count(entry.assists),
    breaches:count(entry.breaches), disables:count(entry.disables), destroys:count(entry.destroys),
    armorDamage:number(entry.armorDamage), internalDamage:number(entry.internalDamage),
    damageTaken:number(entry.damageTaken),
});
export function recordCombatRound(storage, entry) {
    const key = id(entry?.id);
    if (!key) return {ok:false,reason:'ROUND ID REQUIRED'};
    const data = loadCombatRecords(storage);
    if (data.seenRounds.includes(key)) return {ok:true,duplicate:true,records:data};
    const rigId = id(entry.rigId), weaponSerial = id(entry.weaponSerial);
    const fields = shotFields(entry);
    const round = {id:key,seriesId:id(entry.seriesId),contractId:id(entry.contractId),
        rigId,rigName:id(entry.rigName),number:count(entry.number),victory:!!entry.victory,
        timestamp: Number.isFinite(entry.timestamp)?entry.timestamp:Date.now(), ...fields};
    const changes = {...fields,rounds:1,roundWins:round.victory?1:0,roundLosses:round.victory?0:1};
    add(data.totals,changes);
    if (rigId) add(entity(data.rigs,rigId),changes);
    // Every equipped serial gets a deployment. Weapon receives verified offensive
    // counters; damage taken is attributed to the physically hit station/serial.
    const equipped = entry.parts && typeof entry.parts==='object' ? entry.parts : {};
    const incoming = entry.damageTakenBySlot && typeof entry.damageTakenBySlot==='object'
        ? entry.damageTakenBySlot : {};
    for (const [slot,serial] of Object.entries(equipped)) {
        if (!id(serial)) continue;
        const stats = entity(data.parts,serial);
        add(stats,{rounds:1,roundWins:changes.roundWins,roundLosses:changes.roundLosses,
            damageTaken:number(incoming[slot])});
        if (serial===weaponSerial) add(stats,{...fields,damageTaken:0});
    }
    data.recentRounds.unshift(round);
    data.recentRounds.length = Math.min(data.recentRounds.length,MAX_RECENT_ROUNDS);
    data.seenRounds.unshift(key);data.seenRounds.length=Math.min(data.seenRounds.length,MAX_SEEN);
    return {ok:commit(storage,data),duplicate:false,records:data};
}
export function recordCombatMatch(storage, entry) {
    const key=id(entry?.id);
    if (!key) return {ok:false,reason:'MATCH ID REQUIRED'};
    const data=loadCombatRecords(storage);
    if(data.seenMatches.includes(key))return {ok:true,duplicate:true,records:data};
    const outcome=entry.outcome==='W'?'W':entry.outcome==='L'?'L':'DNF';
    const match={id:key,contractId:id(entry.contractId),outcome,
        playerWins:count(entry.playerWins),enemyWins:count(entry.enemyWins),
        rounds:count(entry.rounds), timestamp:Number.isFinite(entry.timestamp)?entry.timestamp:Date.now(),
        reason:String(entry.reason||'').slice(0,120),
        rigs:Array.isArray(entry.rigs)?[...new Set(entry.rigs.map(id).filter(Boolean))].slice(0,3):[]};
    const changes={matches:1,wins:outcome==='W'?1:0,losses:outcome==='L'?1:0,dnf:outcome==='DNF'?1:0};
    add(data.totals,changes);
    for(const rigId of match.rigs)add(entity(data.rigs,rigId),changes);
    data.recentMatches.unshift(match);
    data.recentMatches.length=Math.min(data.recentMatches.length,MAX_RECENT_MATCHES);
    data.seenMatches.unshift(key);data.seenMatches.length=Math.min(data.seenMatches.length,MAX_SEEN);
    return {ok:commit(storage,data),duplicate:false,records:data};
}
export const combatAccuracy = stats => number(stats?.projectiles)
    ? Math.round(1000*Math.min(number(stats?.hits),number(stats?.projectiles))/stats.projectiles)/10 : null;
