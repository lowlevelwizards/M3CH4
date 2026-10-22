/** Build 0 — exhaustive, read-only five-station catalogue balance audit.
 *
 * Every row is inspected with the shipped ownership, mounting, mass and nominal
 * power rules. This is not a simulator and does not estimate combat outcomes.
 *
 * node research/rosterBalanceAudit.mjs
 * node research/rosterBalanceAudit.mjs --json > roster.json
 * node research/rosterBalanceAudit.mjs --compare path/to/earlier-roster.json
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CATALOG, SLOTS, partsFor, makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { basePartValue } from '../partEconomy.js';

const REFERENCE_RECIPES = Object.freeze({
    'Balanced workhorse': ['frame-sr', 'legs-yard', 'power-dynamo', 'cab-cyclops', 'gun-cannon'],
    'Lightweight precision': ['frame-utility', 'legs-compact', 'power-air', 'cab-utility', 'gun-light'],
    'Heavy anchor': ['frame-wedge', 'legs-hauler', 'power-dynamo', 'cab-cyclops', 'gun-short'],
    'Lightweight raider': ['frame-utility', 'legs-compact', 'power-air', 'cab-utility', 'gun-scatter'],
    'Heavy protected command': ['frame-sr', 'legs-hauler', 'power-dynamo', 'cab-armored', 'gun-short'],
});

export function recipeKey(recipe) {
    return SLOTS.map(slot => recipe[slot]).join(' / ');
}

function inspectRecipe(recipe) {
    const installed = SLOTS.map(slot => recipe[slot]);
    const parts = installed.map(id => CATALOG.find(part => part.id === id));
    const yardValueCredits = parts.reduce((sum, part) => sum + basePartValue(part.id), 0);
    const assembly = makeTestAssembly();
    try {
        for (const slot of SLOTS) equip(assembly, slot, recipe[slot]);
        const result = inspectAssembly(assembly);
        const frame = parts.find(part => part.slot === 'structure');
        const mover = parts.find(part => part.slot === 'mobility');
        const reasons = result.checks.filter(check => !check.passes)
            .map(check => ({ check: check.id, reason: check.reason }));
        return {
            key: recipeKey(recipe), recipe, ready: result.ready,
            massKg: result.massKg,
            baseYardValueCredits: yardValueCredits,
            structuralLoadMarginKg: frame.loadLimitKg - result.massKg,
            mobilityLoadMarginKg: mover.loadLimitKg - result.massKg,
            powerDemandKw: result.powerUsedKw,
            powerAvailableKw: result.powerAvailableKw,
            nominalPowerHeadroomKw: result.powerAvailableKw - result.powerUsedKw,
            adapters: result.adapters.map(({ id, slot, massKg }) => ({ id, slot, massKg })),
            mountingValid: result.graphCheck.valid,
            reasons,
        };
    } catch (error) {
        // Invalid physical mounting is rejected, never simulated or approximated.
        return {
            key: recipeKey(recipe), recipe, ready: false,
            massKg: null, baseYardValueCredits: yardValueCredits,
            structuralLoadMarginKg: null, mobilityLoadMarginKg: null,
            powerDemandKw: null, powerAvailableKw: null, nominalPowerHeadroomKw: null,
            adapters: [], mountingValid: false,
            reasons: [{ check: 'mount', reason: error.message }],
        };
    }
}

function coverage(rows, slot) {
    return Object.fromEntries(partsFor(slot).map(part => {
        const matches = rows.filter(row => row.recipe[slot] === part.id);
        return [part.id, {
            total: matches.length,
            legal: matches.filter(row => row.ready).length,
            rejected: matches.filter(row => !row.ready).length,
        }];
    }));
}

export function runRosterBalanceAudit() {
    const choices = SLOTS.map(partsFor);
    const combinations = [];
    function traverse(depth, selected) {
        if (depth === SLOTS.length) {
            combinations.push(inspectRecipe({ ...selected }));
            return;
        }
        const slot = SLOTS[depth];
        for (const part of choices[depth]) traverse(depth + 1, { ...selected, [slot]: part.id });
    }
    traverse(0, {});
    const legal = combinations.filter(row => row.ready).length;
    const rejectionChecks = {};
    for (const row of combinations) for (const { check } of row.reasons)
        rejectionChecks[check] = (rejectionChecks[check] || 0) + 1;
    const bySlot = Object.fromEntries(SLOTS.map(slot => [slot, coverage(combinations, slot)]));
    const byKey = new Map(combinations.map(row => [row.key, row]));
    const references = Object.fromEntries(Object.entries(REFERENCE_RECIPES).map(([name, ids]) => {
        const recipe = Object.fromEntries(SLOTS.map((slot, index) => [slot, ids[index]]));
        const result = byKey.get(recipeKey(recipe));
        if (!result) throw new Error('Reference recipe missing from catalogue: ' + name);
        return [name, { recipe, ready: result.ready, massKg: result.massKg,
            headroomKw: result.nominalPowerHeadroomKw, reasons: result.reasons }];
    }));
    return {
        schemaVersion: 1,
        methodology: {
            authority: 'live CATALOG + equip + inspectAssembly + basePartValue',
            mounting: 'standard five-station mounting with real automatic adapters; no optional generator offset',
            legality: 'only inspectAssembly().ready is deployable',
            simulations: 'none — illegal assemblies receive no movement, hit or match metrics',
            evidence: 'catalogue legality only, not Three.js geometry, AI outcomes or mobile playtests',
        },
        catalogue: CATALOG.map(part => ({
            id: part.id, slot: part.slot, massKg: part.massKg,
            powerKw: part.powerKw, loadLimitKg: part.loadLimitKg ?? null,
            accepts: part.accepts, mountSize: part.mountSize,
            baseYardValueCredits: basePartValue(part.id),
        })),
        summary: { definitions: CATALOG.length, total: combinations.length,
            legal, rejected: combinations.length - legal, rejectionChecks, bySlot },
        references, combinations,
    };
}

export function compareRosterBalanceAudits(previous, current) {
    const before = new Map(previous.combinations.map(row => [row.key, row]));
    const after = new Map(current.combinations.map(row => [row.key, row]));
    const added = [], removed = [], legalityChanged = [], numericsChanged = [];
    for (const [key, row] of after) {
        const old = before.get(key);
        if (!old) { added.push(key); continue; }
        if (old.ready !== row.ready)
            legalityChanged.push({ key, from: old.ready, to: row.ready });
        for (const field of ['massKg', 'structuralLoadMarginKg', 'mobilityLoadMarginKg',
            'nominalPowerHeadroomKw', 'baseYardValueCredits']) {
            if (old[field] !== row[field]) numericsChanged.push({
                key, field, from: old[field], to: row[field],
            });
        }
    }
    for (const key of before.keys()) if (!after.has(key)) removed.push(key);
    return { from: previous.summary, to: current.summary,
        added, removed, legalityChanged, numericsChanged };
}

function tableFor(rows) {
    return [
        '| Module | Total | Legal | Rejected |',
        '| --- | ---: | ---: | ---: |',
        ...Object.entries(rows).map(([id, data]) =>
            '| ' + [id, data.total, data.legal, data.rejected].join(' | ') + ' |'),
    ];
}

export function formatRosterBalanceAudit(report = runRosterBalanceAudit()) {
    const s = report.summary;
    const lines = [
        '# M3CH4 — Build 0 Five-Station Catalogue Baseline',
        '',
        '**Evidence:** actual five-station legality, real mounting adapters, rated loads, nominal kW and authored base values.',
        '**Not evidence:** renderer mesh shielding, obstacle avoidance, tactical balance, actual repairs or iPhone performance.',
        '',
        'Definitions: ' + s.definitions + ' · combinations: ' + s.total +
            ' · legal: ' + s.legal + ' · rejected: ' + s.rejected,
        '',
        '## Legal coverage by mobility',
        ...tableFor(s.bySlot.mobility),
        '',
        '## Legal coverage by frame',
        ...tableFor(s.bySlot.structure),
        '',
        '## Legal coverage by generator',
        ...tableFor(s.bySlot.power),
        '',
        '## Legal coverage by weapon',
        ...tableFor(s.bySlot.combat),
        '',
        '## Rejection checks (a rig may fail multiple checks)',
        ...Object.entries(s.rejectionChecks).sort().map(([key, n]) => '- ' + key + ': ' + n),
        '',
        '## Fixed reference assemblies',
        '| Name | Legal | Installed mass kg | Nominal power headroom kW |',
        '| --- | --- | ---: | ---: |',
        ...Object.entries(report.references).map(([name, row]) =>
            '| ' + [name, row.ready ? 'yes' : 'NO', row.massKg ?? '—',
                row.headroomKw ?? '—'].join(' | ') + ' |'),
        '',
        'Run with --json for every inspected recipe, rejection reason, adapter and load margin.',
        'Physical, power-transient, weapon and renderer-backed studies remain separate evidence.',
    ];
    return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const report = runRosterBalanceAudit();
    const previousIndex = process.argv.indexOf('--compare');
    if (previousIndex >= 0) {
        if (!process.argv[previousIndex + 1]) throw new Error('--compare requires a JSON path');
        const previous = JSON.parse(readFileSync(process.argv[previousIndex + 1], 'utf8'));
        process.stdout.write(JSON.stringify(compareRosterBalanceAudits(previous, report), null, 2) + '\n');
    } else {
        process.stdout.write(process.argv.includes('--json')
            ? JSON.stringify(report, null, 2) + '\n'
            : formatRosterBalanceAudit(report));
    }
}
