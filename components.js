export const PART_DEFINITIONS = [
    { id: 'chassis', model: 'Welded SR-frame', kind: 'structure', massKg: 1350, center: [0, 1.78, 0], envelope: [1.65, 1.23, 1.65], mountedTo: null, purpose: 'Carries the cockpit and transfers loads into both legs.' },
    { id: 'left-leg', model: 'Scrapyard walking leg / L', kind: 'locomotion', massKg: 440, center: [-0.77, 0.85, 0.08], envelope: [0.76, 1.55, 1.08], mountedTo: 'chassis', purpose: 'Ground contact and support on the pilot’s left.' },
    { id: 'right-leg', model: 'Scrapyard walking leg / R', kind: 'locomotion', massKg: 440, center: [0.77, 0.85, 0.08], envelope: [0.76, 1.55, 1.08], mountedTo: 'chassis', purpose: 'Ground contact and support on the pilot’s right.' },
    { id: 'left-actuator', model: 'L-4 electric drive / L', kind: 'actuation', massKg: 160, center: [-0.84, 1.30, -0.29], envelope: [0.29, 0.85, 0.30], mountedTo: 'left-leg', purpose: 'Produces controlled force through the left leg.' },
    { id: 'right-actuator', model: 'L-4 electric drive / R', kind: 'actuation', massKg: 160, center: [0.84, 1.30, -0.29], envelope: [0.29, 0.85, 0.30], mountedTo: 'right-leg', purpose: 'Produces controlled force through the right leg.' },
    { id: 'power-unit', model: 'Dynamo G-2', kind: 'power', massKg: 460, center: [0, 1.84, 0.66], envelope: [0.92, 0.83, 0.54], mountedTo: 'chassis', purpose: 'Supplies drive and auxiliary electrical power.' },
    { id: 'radiator', model: 'Mismatch R-1 cooler', kind: 'cooling', massKg: 180, center: [0, 2.37, 0.88], envelope: [1.12, 0.64, 0.22], mountedTo: 'chassis', purpose: 'Rejects heat from the power unit and drive assemblies.' },
    { id: 'weapon-mount', model: 'Right shoulder trunnion', kind: 'mount', massKg: 200, center: [1.07, 2.15, -0.20], envelope: [0.66, 0.55, 0.73], mountedTo: 'chassis', purpose: 'Supports a future weapon and transmits recoil into the chassis.' },
    { id: 'inert-cannon', model: 'Deactivated training cannon', kind: 'weapon', massKg: 280, center: [1.22, 2.01, -1.08], envelope: [0.44, 0.46, 1.55], mountedTo: 'weapon-mount', purpose: 'Visual balance mass only. Firing begins in 0.0.1c.' },
    { id: 'camera', model: 'Used cyclops optical head', kind: 'sensor', massKg: 40, center: [0, 2.78, -0.49], envelope: [0.43, 0.36, 0.45], mountedTo: 'chassis', purpose: 'Pilot’s forward view; sensor failures come later.' },
    { id: 'front-armor', model: 'Mustard front glacis', kind: 'armor', massKg: 230, center: [0, 1.81, -0.79], envelope: [1.58, 0.88, 0.16], mountedTo: 'chassis', purpose: 'Covers the front of the frame.' },
    { id: 'left-leg-armor', model: 'Recovered blue knee plate / L', kind: 'armor', massKg: 120, center: [-0.82, 0.98, -0.49], envelope: [0.55, 0.75, 0.18], mountedTo: 'left-leg', purpose: 'Covers the left leg’s forward mechanisms.' },
    { id: 'right-leg-armor', model: 'Recovered blue knee plate / R', kind: 'armor', massKg: 120, center: [0.82, 0.98, -0.49], envelope: [0.55, 0.75, 0.18], mountedTo: 'right-leg', purpose: 'Covers the right leg’s forward mechanisms.' },
    { id: 'weapon-shroud', model: 'Riveted barrel jacket', kind: 'armor', massKg: 70, center: [1.22, 2.02, -0.76], envelope: [0.59, 0.57, 0.78], mountedTo: 'weapon-mount', purpose: 'Protects the weapon’s rear mechanism.' },
];
export const BY_ID = new Map(PART_DEFINITIONS.map((part) => [part.id, part]));
export function createTestAssembly() {
    return {
        serial: 'SR-01',
        name: 'SCRAPYARD RIG',
        parts: PART_DEFINITIONS.map((part, index) => ({
            serial: `SR01-${String(index + 1).padStart(3, '0')}`,
            definitionId: part.id,
            condition: 1,
            wear: 0,
            repairs: 0,
        })),
    };
}
export function installedDefinitions(assembly) {
    return assembly.parts.map((part) => {
        const def = BY_ID.get(part.definitionId);
        if (!def)
            throw new Error(`Unknown part definition ${part.definitionId}`);
        return def;
    });
}
export function assemblyMassKg(assembly) {
    return installedDefinitions(assembly).reduce((sum, part) => sum + part.massKg, 0);
}
export function validateAssembly(assembly) {
    const problems = [];
    const serials = new Set();
    const ids = new Set();
    for (const part of assembly.parts) {
        if (serials.has(part.serial))
            problems.push(`Duplicate serial ${part.serial}`);
        serials.add(part.serial);
        if (ids.has(part.definitionId))
            problems.push(`Duplicate installed part ${part.definitionId}`);
        ids.add(part.definitionId);
        if (!BY_ID.has(part.definitionId))
            problems.push(`Unknown definition ${part.definitionId}`);
        if (!Number.isFinite(part.condition) || part.condition < 0 || part.condition > 1)
            problems.push(`Invalid condition ${part.serial}`);
    }
    for (const instance of assembly.parts) {
        const part = BY_ID.get(instance.definitionId);
        if (!part)
            continue; // Report the unknown definition above, do not throw.
        if (part.mountedTo && !ids.has(part.mountedTo))
            problems.push(`${part.id} has no parent ${part.mountedTo}`);
        if (part.envelope.some((size) => !Number.isFinite(size) || size <= 0))
            problems.push(`Invalid envelope ${part.id}`);
        // Physical attachment hierarchy may not contain a cycle.
        const visited = new Set([part.id]);
        let parent = part.mountedTo;
        while (parent) {
            if (visited.has(parent)) {
                problems.push(`Cyclic mount ${part.id}`);
                break;
            }
            visited.add(parent);
            parent = BY_ID.get(parent)?.mountedTo ?? null;
        }
    }
    return problems;
}
