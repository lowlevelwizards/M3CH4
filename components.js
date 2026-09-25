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
    { id: 'legs-yard', name: 'Yardwalker paired legs', slot: 'mobility', massKg: 1240, center: SLOT_CENTERS.mobility, envelope: [2.0, 1.65, 1.18], accepts: 'U1', description: 'Paired short legs, pistons and broad feet in one serviceable walking assembly.', powerKw: -82, loadLimitKg: 4700, driveForceN: 12200, turnTorqueNm: 23000, lateralGripNsPerM: 10500, maxForwardSpeedMps: 7.4, functionReady: true },
    { id: 'legs-hauler', name: 'Hauler H2 heavy legs', slot: 'mobility', massKg: 1520, center: SLOT_CENTERS.mobility, envelope: [2.55, 1.68, 1.35], accepts: 'H2', description: 'Wider industrial supports, oversized knee joints and slower, stronger drives. Requires an H2/U1 hip adapter.', powerKw: -115, loadLimitKg: 5500, driveForceN: 16200, turnTorqueNm: 19400, lateralGripNsPerM: 14400, maxForwardSpeedMps: 6.2, functionReady: true },
    { id: 'power-dynamo', name: 'Dynamo G-2 power pack', slot: 'power', massKg: 510, center: SLOT_CENTERS.power, envelope: [1.12, 1.01, 0.84], accepts: 'U1', description: 'Rear generator with exposed passive fins. Generator and cooler remain one assembly at this stage.', powerKw: 145, functionReady: true },
    { id: 'cab-cyclops', name: 'Cyclops single-optic cab', slot: 'command', massKg: 350, center: SLOT_CENTERS.command, envelope: [1.24, 0.90, 1.14], accepts: 'U1', description: 'Salvaged pilot tub behind a reinforced square optical carrier. One large protected forward camera and simple controls; no humanoid face.', powerKw: -8, functionReady: true },
    { id: 'cab-armored', name: 'Hearth integrated cab', slot: 'command', massKg: 460, center: SLOT_CENTERS.command, envelope: [1.50, 1.02, 1.24], accepts: 'U1', description: 'Low-profile armored crew enclosure that overlaps the frame instead of sitting on it. Flush observation slit and thick protective flanks.', powerKw: -20, functionReady: true },
    { id: 'gun-cannon', name: 'Deactivated training cannon', slot: 'combat', massKg: 410, center: SLOT_CENTERS.combat, envelope: [0.87, 0.76, 1.69], accepts: 'U1', description: 'Long right-shoulder cannon including trunnion and breech. Present but deliberately inert until 0.0.1c.', powerKw: -18, functionReady: true },
    { id: 'gun-short', name: 'Deactivated stump cannon', slot: 'combat', massKg: 300, center: SLOT_CENTERS.combat, envelope: [0.95, 0.85, 1.19], accepts: 'U1', description: 'A short heavy-breech training gun with lower power demand. Still deliberately inert.', powerKw: -8, functionReady: true },
    // New b.5 parts append to the original eight so existing owned serials remain stable.
    { id: 'frame-utility', name: 'U-2 Skeleton frame', slot: 'structure', massKg: 1290, center: SLOT_CENTERS.structure, envelope: [1.55, 0.94, 1.46], accepts: 'U1', description: 'Exposed central spine, cross-bracing and standardized open equipment rails. The existing U-2 light frame retains its 4,120 kg load rating and weapon outrigger.', powerKw: 0, loadLimitKg: 4120, functionReady: true },
    { id: 'legs-compact', name: 'Kestrel compact articulated legs', slot: 'mobility', massKg: 1010, center: SLOT_CENTERS.mobility, envelope: [1.67, 1.55, 1.0], accepts: 'U1', description: 'Light reverse-canted knee linkage with short pistons and compact feet. Faster at speed, narrower and less planted than Yardwalkers.', powerKw: -68, loadLimitKg: 3900, driveForceN: 10900, turnTorqueNm: 24000, lateralGripNsPerM: 8100, maxForwardSpeedMps: 9.3, functionReady: true },
    { id: 'power-air', name: 'Draft A-1 air-cooled generator', slot: 'power', massKg: 365, center: SLOT_CENTERS.power, envelope: [1.05, 1.28, 0.81], accepts: 'U1', description: 'Tall exposed cooling stack. 145 kg lighter than the Dynamo, but supplies only 112 kW; high-demand combinations cannot run.', powerKw: 112, functionReady: true },
    { id: 'cab-utility', name: 'Vista observation cab', slot: 'command', massKg: 295, center: SLOT_CENTERS.command, envelope: [1.14, 1.16, 1.10], accepts: 'U1', description: 'Tall utility-vehicle pilot enclosure, broad dark windshield and angled side glazing. Lighter than Cyclops; viewing advantages remain visual until sensors arrive.', powerKw: -11, functionReady: true },
    { id: 'gun-light', name: 'Deactivated needle cannon', slot: 'combat', massKg: 255, center: SLOT_CENTERS.combat, envelope: [0.76, 0.63, 2.36], accepts: 'U1', description: 'A light long-tube trial mount; saves 155 kg but has 24 kW nominal stabilizer demand. Inert until the projectile milestone.', powerKw: -24, functionReady: true },
    // b.6: one additional frame; earlier definition IDs, owned serials and physics are preserved.
    { id: 'frame-wedge', name: 'W-3 Wedge monocoque', slot: 'structure', massKg: 1450, center: SLOT_CENTERS.structure, envelope: [1.88, .84, 1.88], accepts: 'U1', description: 'Shallow tapered monocoque with a sloped armored nose, buried structural spine and low roof-mounted U1 station. Carries up to 4,850 kg.', powerKw: 0, loadLimitKg: 4850, functionReady: true },
];
export const BY_ID = new Map(CATALOG.map(part => [part.id, part]));
export function partsFor(slot) { return CATALOG.filter(part => part.slot === slot); }
export function makeTestAssembly() {
    const owned = CATALOG.map((part, index) => ({
        serial: `SR01-${String(index + 1).padStart(3, '0')}`,
        definitionId: part.id,
        condition: 1, wear: 0, repairs: 0,
    }));
    const serialOf = (definitionId) => owned.find(p => p.definitionId === definitionId).serial;
    return {
        serial: 'SR-01', name: 'SCRAPYARD RIG', owned,
        installed: {
            structure: serialOf('frame-sr'), mobility: serialOf('legs-yard'),
            power: serialOf('power-dynamo'), command: serialOf('cab-cyclops'),
            combat: serialOf('gun-cannon'),
        },
    };
}
export function installedPart(assembly, slot) {
    const serial = assembly.installed[slot];
    if (!serial)
        return null;
    const instance = assembly.owned.find(part => part.serial === serial);
    const definition = instance && BY_ID.get(instance.definitionId);
    return instance && definition && definition.slot === slot ? { instance, definition } : null;
}
export function equip(assembly, slot, definitionId) {
    const definition = BY_ID.get(definitionId);
    if (!definition || definition.slot !== slot)
        throw new Error(`Cannot fit ${definitionId} in ${slot}`);
    const owned = assembly.owned.find(part => part.definitionId === definitionId);
    if (!owned)
        throw new Error(`Not owned: ${definitionId}`);
    assembly.installed[slot] = owned.serial; // installing an old part preserves its identity
}
export function remove(assembly, slot) {
    delete assembly.installed[slot];
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
    const checks = [
        { id: 'structure', label: 'Structure', passes: !!frame && noDuplicateOwnership && invalidSlotReferences.length === 0 && !repeatedInstall && mountErrors.length === 0 && massKg <= (frame?.loadLimitKg ?? 0), reason: !frame ? 'Install a connected frame.' : (!noDuplicateOwnership || invalidSlotReferences.length || repeatedInstall) ? 'Duplicate or invalid component identity.' : mountErrors.length ? `Unresolved mounts: ${mountErrors.join(', ')}.` : massKg > (frame.loadLimitKg ?? 0) ? `Frame exceeds ${frame.loadLimitKg} kg rating.` : 'Load-bearing frame and mount interfaces connected.' },
        { id: 'mobility', label: 'Mobility', passes: !!mover?.functionReady && massKg <= (mover?.loadLimitKg ?? 0), reason: !mover ? 'Install a walking or rolling assembly.' : massKg > (mover.loadLimitKg ?? 0) ? `Installed mass exceeds ${mover.loadLimitKg} kg leg rating.` : 'Powered, load-rated locomotion assembly installed.' },
        { id: 'power', label: 'Power', passes: powerAvailableKw >= powerUsedKw && powerAvailableKw > 0, reason: powerAvailableKw === 0 ? 'Install a power unit.' : powerUsedKw > powerAvailableKw ? `Demand ${powerUsedKw} kW exceeds ${powerAvailableKw} kW available.` : `${powerUsedKw}/${powerAvailableKw} kW nominal load.` },
        { id: 'command', label: 'Command', passes: !!installedPart(assembly, 'command')?.definition.functionReady, reason: installedPart(assembly, 'command') ? 'Pilot enclosure, optics and controls present.' : 'Install a pilot enclosure with controls.' },
        { id: 'combat', label: 'Combat provision', passes: !!installedPart(assembly, 'combat')?.definition.functionReady, reason: installedPart(assembly, 'combat') ? 'Weapon provision installed; weapon is still inert in this prototype.' : 'Install a weapon assembly.' },
    ];
    const warnings = adapters.map(a => `${a.description} Added to mass and hip structure.`);
    if (!noDuplicateOwnership || invalidSlotReferences.length || repeatedInstall)
        warnings.push('Component identity or installation reference is invalid.');
    if (missing.length)
        warnings.push(`Missing: ${missing.join(', ')}.`);
    if (mountErrors.length)
        warnings.push(`No adapter available for ${mountErrors.join(', ')}.`);
    return { ready: checks.every(check => check.passes), checks, warnings, adapters, massKg, powerUsedKw, powerAvailableKw };
}
