import { defaultFrameSockets, ensureAssemblyGraph, graphFromStations, graphMatchesStations, graphWorldPoses, proposeAttachment, proposeRemoval, validateGraph, LEGACY_HIP_ADAPTER } from './assemblyGraph.js';
export const SLOTS = ['structure', 'mobility', 'power', 'command', 'combat'];
export const SLOT_CENTERS = {
    structure: [0, 1.82, 0.13],
    mobility: [0, 1.03, 0.10],
    power: [0, 2.01, 0.86],
    command: [0, 2.43, -0.36],
    combat: [1.17, 2.03, -0.65],
};
/** The frame offers standardized ports. H2 is only one small test case of auto-fit, not universal compatibility. */
export const PORTS = {
    mobility: 'U1', power: 'U1', command: 'U1', combat: 'U1',
};
export const CATALOG = [
    { id: 'frame-sr', name: 'SR-01 Bruiser frame', slot: 'structure', massKg: 1580, center: SLOT_CENTERS.structure, envelope: [1.78, 1.0, 1.62], accepts: 'U1', description: 'Broad welded load-bearing frame with deep shoulder trunnions, layered front armor and a substantial hip bridge. U1 mounting stations.', powerKw: 0, loadLimitKg: 5100, functionReady: true },
    { id: 'legs-yard', name: 'Yardwalker paired legs', slot: 'mobility', massKg: 1240, center: SLOT_CENTERS.mobility, envelope: [2.0, 1.65, 1.18], accepts: 'U1', description: 'Paired short legs, pistons and broad feet in one serviceable walking assembly.', powerKw: -82, loadLimitKg: 4700, driveForceN: 12200, turnTorqueNm: 23000, lateralGripNsPerM: 10500, lateralDriveForceN: 21500, maxLateralSpeedMps: 2.4, maxForwardSpeedMps: 7.4, functionReady: true },
    { id: 'legs-hauler', name: 'Hauler H2 heavy legs', slot: 'mobility', massKg: 1520, center: SLOT_CENTERS.mobility, envelope: [2.55, 1.68, 1.35], accepts: 'H2', description: 'Wider industrial supports, oversized knee joints and slower, stronger drives. Requires an H2/U1 hip adapter.', powerKw: -115, loadLimitKg: 5500, driveForceN: 16200, turnTorqueNm: 19400, lateralGripNsPerM: 14400, lateralDriveForceN: 22000, maxLateralSpeedMps: 1.8, maxForwardSpeedMps: 6.2, functionReady: true },
    { id: 'power-dynamo', name: 'Dynamo G-2 power pack', slot: 'power', massKg: 510, center: SLOT_CENTERS.power, envelope: [1.12, 1.01, 0.84], accepts: 'U1', description: 'Rear generator with exposed passive fins. Generator and cooler remain one assembly at this stage.', powerKw: 145, functionReady: true },
    { id: 'cab-cyclops', name: 'Cyclops single-optic cab', slot: 'command', massKg: 350, center: SLOT_CENTERS.command, envelope: [1.24, 0.90, 1.14], accepts: 'U1', description: 'Salvaged pilot tub behind a reinforced square optical carrier. One large protected forward camera and simple controls; no humanoid face.', powerKw: -8, functionReady: true },
    { id: 'cab-armored', name: 'Hearth integrated cab', slot: 'command', massKg: 460, center: SLOT_CENTERS.command, envelope: [1.50, 1.02, 1.24], accepts: 'U1', description: 'Low-profile armored crew enclosure that overlaps the frame instead of sitting on it. Flush observation slit and thick protective flanks.', powerKw: -20, functionReady: true },
    { id: 'gun-cannon', name: 'Deactivated training cannon', slot: 'combat', massKg: 410, center: SLOT_CENTERS.combat, envelope: [0.87, 0.76, 1.69], accepts: 'U1', description: 'Long right-shoulder cannon including trunnion and breech. Live-fire range cannon, with controllable recoil and magazine.', powerKw: -18, functionReady: true },
    { id: 'gun-short', name: 'Deactivated stump cannon', slot: 'combat', massKg: 300, center: SLOT_CENTERS.combat, envelope: [0.95, 0.85, 1.19], accepts: 'U1', description: 'A short heavy-breech training gun with lower power demand. Short-barrel live-fire variant.', powerKw: -8, functionReady: true },
    // New b.5 parts append to the original eight so existing owned serials remain stable.
    { id: 'frame-utility', name: 'U-2 Skeleton frame', slot: 'structure', massKg: 1290, center: SLOT_CENTERS.structure, envelope: [1.55, 0.94, 1.46], accepts: 'U1', description: 'Exposed central spine, cross-bracing and standardized open equipment rails. The existing U-2 light frame retains its 4,120 kg load rating and weapon outrigger.', powerKw: 0, loadLimitKg: 4120, functionReady: true },
    { id: 'legs-compact', name: 'Kestrel compact articulated legs', slot: 'mobility', massKg: 1010, center: SLOT_CENTERS.mobility, envelope: [1.67, 1.55, 1.0], accepts: 'U1', description: 'Light reverse-canted knee linkage with short pistons and compact feet. Faster at speed, narrower and less planted than Yardwalkers.', powerKw: -68, loadLimitKg: 3900, driveForceN: 10900, turnTorqueNm: 24000, lateralGripNsPerM: 8100, lateralDriveForceN: 23800, maxLateralSpeedMps: 3.2, maxForwardSpeedMps: 9.3, functionReady: true },
    { id: 'power-air', name: 'Draft A-1 air-cooled generator', slot: 'power', massKg: 365, center: SLOT_CENTERS.power, envelope: [1.05, 1.28, 0.81], accepts: 'U1', description: 'Tall exposed cooling stack. 145 kg lighter than the Dynamo, but supplies only 112 kW; high-demand combinations cannot run.', powerKw: 112, functionReady: true },
    { id: 'cab-utility', name: 'Vista observation cab', slot: 'command', massKg: 295, center: SLOT_CENTERS.command, envelope: [1.14, 1.16, 1.10], accepts: 'U1', description: 'Tall utility-vehicle pilot enclosure, broad dark windshield and angled side glazing. Lighter than Cyclops; viewing advantages remain visual until sensors arrive.', powerKw: -11, functionReady: true },
    { id: 'gun-light', name: 'Deactivated needle cannon', slot: 'combat', massKg: 255, center: SLOT_CENTERS.combat, envelope: [0.76, 0.63, 2.36], accepts: 'U1', description: 'A light long-tube trial mount; saves 155 kg but has 24 kW nominal stabilizer demand. Light live-fire range variant.', powerKw: -24, functionReady: true },
    // b.6: one additional frame; earlier definition IDs, owned serials and physics are preserved.
    { id: 'frame-wedge', name: 'W-3 Wedge monocoque', slot: 'structure', massKg: 1450, center: SLOT_CENTERS.structure, envelope: [1.88, .84, 1.88], accepts: 'U1', description: 'Shallow tapered monocoque with a sloped armored nose, buried structural spine and low roof-mounted U1 station. Carries up to 4,850 kg.', powerKw: 0, loadLimitKg: 4850, functionReady: true },
];
// Independent mechanical mounting metadata; mesh geometry and hit envelopes remain unchanged.
for (const part of CATALOG) {
    part.mountSize = part.slot === 'structure' ? null : part.accepts === 'H2' ? 'heavy' : 'medium';
    part.sockets = part.slot === 'structure' ? defaultFrameSockets(SLOT_CENTERS, part.center) : [];
}
export const BY_ID = new Map(CATALOG.map(part => [part.id, part]));
export const ADAPTER_DEFINITIONS = new Map([[LEGACY_HIP_ADAPTER.id, LEGACY_HIP_ADAPTER]]);
export { graphWorldPoses, proposeAttachment, proposeRemoval, validateGraph };
export function assemblyGraph(assembly) {
    return assembly.graph || (assembly.graph = graphFromStations(assembly, BY_ID));
}
export function partsFor(slot) { return CATALOG.filter(part => part.slot === slot); }
export function makeTestAssembly() {
    const owned = CATALOG.map((part, index) => ({
        serial: `SR01-${String(index + 1).padStart(3, '0')}`,
        definitionId: part.id,
        condition: 1, wear: 0, repairs: 0,
    }));
    const serialOf = (definitionId) => owned.find(p => p.definitionId === definitionId).serial;
    const assembly = {
        serial: 'SR-01', name: 'SCRAPYARD RIG', owned,
        installed: {
            structure: serialOf('frame-sr'), mobility: serialOf('legs-yard'),
            power: serialOf('power-dynamo'), command: serialOf('cab-cyclops'),
            combat: serialOf('gun-cannon'),
        },
    };
    assembly.graph = graphFromStations(assembly, BY_ID);
    return assembly;
}
export function installedPart(assembly, slot) {
    const serial = assembly.installed[slot];
    if (!serial)
        return null;
    const instance = assembly.owned.find(part => part.serial === serial);
    const definition = instance && BY_ID.get(instance.definitionId);
    return instance && definition && definition.slot === slot ? { instance, definition } : null;
}
/** The legacy garage can only safely rewrite the original five-station shape.
 * Refuse an edit rather than erase unfamiliar nested branches or mounting rotations.
 * The direct-builder will eventually handle reparenting these branches explicitly.
 */
function assertLegacyLayout(assembly, graph) {
    const standard = graphFromStations(assembly, BY_ID);
    if (!graphMatchesStations(assembly, graph, BY_ID) || graph.root !== standard.root ||
        Object.keys(graph.nodes).length !== Object.keys(standard.nodes).length ||
        Object.entries(standard.nodes).some(([serial, expected]) => {
            const node = graph.nodes[serial];
            return !node || node.definitionId !== expected.definitionId ||
                node.parentSerial !== expected.parentSerial || node.parentSocket !== expected.parentSocket ||
                node.rotationQuarterTurns !== 0;
        })) throw new Error('Custom mounts are present. Rehome or remove them in the advanced builder before using the original station controls.');
}
/** Existing five-station garage bridge. Validate a proposed hierarchy before any
 * installed serial or graph changes. A frame swap rehomes its known legacy stations.
 * This intentionally does not yet expose arbitrary socket placement in the garage.
 */
export function equip(assembly, slot, definitionId) {
    const definition = BY_ID.get(definitionId);
    if (!definition || definition.slot !== slot)
        throw new Error(`Cannot fit ${definitionId} in ${slot}`);
    const owned = assembly.owned.find(part => part.definitionId === definitionId);
    if (!owned)
        throw new Error(`Not owned: ${definitionId}`);
    const current = ensureAssemblyGraph(assembly, BY_ID);
    assertLegacyLayout(assembly, current);
    const oldSerial = assembly.installed[slot];
    if (oldSerial && oldSerial !== owned.serial && slot !== 'structure') {
        // Never discard equipment mounted beneath a replaced module.
        const removal = proposeRemoval(current, oldSerial);
        if (!removal.ok) throw new Error(removal.reason);
    }
    // Frame swaps transfer all existing legacy stations; custom child branches must
    // be explicitly removed/reparented by a later direct-builder workflow.
    if (slot === 'structure' && oldSerial && oldSerial !== owned.serial) {
        const nodes = Object.values(current.nodes);
        const expected = new Set(Object.values(assembly.installed));
        const adapters = new Set(nodes.filter(n => n.virtual).map(n => n.serial));
        if (nodes.some(n => !expected.has(n.serial) && !adapters.has(n.serial)))
            throw new Error('This frame supports custom assemblies; remove or rehome them before swapping frames.');
    }
    const installed = { ...assembly.installed, [slot]: owned.serial };
    const candidate = { ...assembly, installed };
    const graph = graphFromStations(candidate, BY_ID);
    const verdict = validateGraph(graph, candidate, BY_ID);
    if (!verdict.valid) throw new Error(verdict.errors.join(' '));
    assembly.installed = installed;
    assembly.graph = graph;
    delete assembly.mountNotice;
    return { ok: true, serial: owned.serial };
}
/** A parent with children is never silently unequipped. Existing parts stay owned.
 * The legacy UI ignores our result for now; the inspector also surfaces the notice.
 */
export function remove(assembly, slot) {
    const fitted = installedPart(assembly, slot);
    if (!fitted) return { ok: true, detached: [] };
    const graph = ensureAssemblyGraph(assembly, BY_ID);
    try { assertLegacyLayout(assembly, graph); }
    catch (error) { assembly.mountNotice = error.message; return { ok: false, reason: error.message }; }
    const node = graph.nodes[fitted.instance.serial];
    const relevant = node && slot === 'mobility' && node.parentSerial?.startsWith('AD-')
        ? node.parentSerial : fitted.instance.serial;
    const result = proposeRemoval(graph, relevant);
    // The legacy interface has no reparent confirmation yet; fail closed.
    if (!result.ok) {
        assembly.mountNotice = result.reason;
        return result;
    }
    // Removing a frame with empty child sockets is safe; other legacy stations
    // remain absent by construction because removal of occupied parents fails.
    const installed = { ...assembly.installed };
    delete installed[slot];
    const candidate = { ...assembly, installed };
    const next = graphFromStations(candidate, BY_ID);
    const verdict = validateGraph(next, candidate, BY_ID);
    if (!verdict.valid) return { ok: false, reason: verdict.errors.join(' ') };
    assembly.installed = installed;
    assembly.graph = next;
    delete assembly.mountNotice;
    return { ok: true, detached: result.detached };
}
/** One explicit, inspectable adapter proof. Never silently fabricate arbitrary universal geometry. */
export function adapterFor(assembly, slot) {
    const part = installedPart(assembly, slot);
    if (!part || part.definition.accepts === PORTS[slot])
        return null;
    if (slot === 'mobility' && PORTS[slot] === 'U1' && part.definition.accepts === 'H2') {
        return { id: 'hip-h2-u1', serial: `AD-${part.instance.serial}`, slot, massKg: 110, description: 'H2/U1 hip conversion ring: 110 kg of real mounting hardware.' };
    }
    return null;
}
export function inspectAssembly(assembly) {
    const fitted = SLOTS.map(slot => installedPart(assembly, slot));
    const adapters = Object.keys(PORTS)
        .map(slot => adapterFor(assembly, slot)).filter((item) => item !== null);
    const massKg = fitted.reduce((sum, part) => sum + (part?.definition.massKg ?? 0), 0)
        + adapters.reduce((sum, adapter) => sum + adapter.massKg, 0);
    const powerAvailableKw = Math.max(0, installedPart(assembly, 'power')?.definition.powerKw ?? 0);
    const powerUsedKw = fitted.reduce((sum, part) => sum + Math.max(0, -(part?.definition.powerKw ?? 0)), 0);
    const frame = installedPart(assembly, 'structure')?.definition;
    const mover = installedPart(assembly, 'mobility')?.definition;
    const missing = SLOTS.filter(slot => !installedPart(assembly, slot));
    const validSerials = new Set(assembly.owned.map(part => part.serial));
    const noDuplicateOwnership = validSerials.size === assembly.owned.length;
    const installedSerials = Object.values(assembly.installed).filter((serial) => !!serial);
    const repeatedInstall = new Set(installedSerials).size !== installedSerials.length;
    const invalidSlotReferences = installedSerials.filter(serial => !validSerials.has(serial));
    const mountErrors = Object.keys(PORTS).filter(slot => {
        const part = installedPart(assembly, slot);
        return part && part.definition.accepts !== PORTS[slot] && !adapterFor(assembly, slot);
    });
    // Check the authoritative structural graph alongside the legacy station view.
    // Only old objects without a graph are migrated here; malformed graphs fail closed.
    const graph = assemblyGraph(assembly);
    const graphCheck = validateGraph(graph, assembly, BY_ID);
    const checks = [
        { id: 'structure', label: 'Structure', passes: !!frame && noDuplicateOwnership && invalidSlotReferences.length === 0 && !repeatedInstall && mountErrors.length === 0 && graphCheck.valid && massKg <= (frame?.loadLimitKg ?? 0), reason: !frame ? 'Install a connected frame.' : (!noDuplicateOwnership || invalidSlotReferences.length || repeatedInstall) ? 'Duplicate or invalid component identity.' : mountErrors.length ? `Unresolved mounts: ${mountErrors.join(', ')}.` : !graphCheck.valid ? graphCheck.errors[0] : assembly.mountNotice ? assembly.mountNotice : massKg > (frame.loadLimitKg ?? 0) ? `Frame exceeds ${frame.loadLimitKg} kg rating.` : 'Load-bearing frame and mount interfaces connected.' },
        { id: 'mobility', label: 'Mobility', passes: !!mover?.functionReady && massKg <= (mover?.loadLimitKg ?? 0), reason: !mover ? 'Install a walking or rolling assembly.' : massKg > (mover.loadLimitKg ?? 0) ? `Installed mass exceeds ${mover.loadLimitKg} kg leg rating.` : 'Powered, load-rated locomotion assembly installed.' },
        { id: 'power', label: 'Power', passes: powerAvailableKw >= powerUsedKw && powerAvailableKw > 0, reason: powerAvailableKw === 0 ? 'Install a power unit.' : powerUsedKw > powerAvailableKw ? `Demand ${powerUsedKw} kW exceeds ${powerAvailableKw} kW available.` : `${powerUsedKw}/${powerAvailableKw} kW nominal load.` },
        { id: 'command', label: 'Command', passes: !!installedPart(assembly, 'command')?.definition.functionReady, reason: installedPart(assembly, 'command') ? 'Pilot enclosure, optics and controls present.' : 'Install a pilot enclosure with controls.' },
        { id: 'combat', label: 'Combat provision', passes: !!installedPart(assembly, 'combat')?.definition.functionReady, reason: installedPart(assembly, 'combat') ? 'Installed weapon can fire in the live-fire range.' : 'Install a weapon assembly.' },
    ];
    const warnings = adapters.map(a => `${a.description} Added to mass and hip structure.`);
    if (!noDuplicateOwnership || invalidSlotReferences.length || repeatedInstall)
        warnings.push('Component identity or installation reference is invalid.');
    if (missing.length)
        warnings.push(`Missing: ${missing.join(', ')}.`);
    if (mountErrors.length)
        warnings.push(`No adapter available for ${mountErrors.join(', ')}.`);
    warnings.push(...graphCheck.errors);
    if (assembly.mountNotice) warnings.push(assembly.mountNotice);
    return { ready: checks.every(check => check.passes), checks, warnings, adapters, graphCheck, massKg, powerUsedKw, powerAvailableKw };
}
