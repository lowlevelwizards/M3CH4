/** M3CH4 universal structural assembly foundation.
 * Pure data: no Three.js, rendering, storage, or runtime locomotion dependencies.
 * The legacy five station map remains a projection for the present cockpit/garage.
 * All physical locations are defined by sockets, never inferred from meshes.
 */
export const GRAPH_VERSION = 1;
export const MOUNT_SIZES = Object.freeze(['light', 'medium', 'heavy']);
export const LEGACY_STATIONS = Object.freeze(['mobility', 'power', 'command', 'combat']);
const at = (xyz) => xyz.slice();
const goodPoint = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

// Keep the original footprint exactly where existing art, hit volumes and cockpit expect it.
// Different frames can later supply different physical stations with the same standards.
export function defaultFrameSockets(centers, frameCenter) {
    const capacities = { mobility: 2000, power: 900, command: 900, combat: 1200 };
    const sockets = LEGACY_STATIONS.map((id) => ({
        id, standard: 'medium', roleHint: id,
        position: centers[id].map((n, i) => n - frameCenter[i]),
        rotation: [0, 0, 0], maxLoadKg: capacities[id],
    }));
    sockets.push({ id: 'service-light', standard: 'light', roleHint: 'utility',
        position: [-0.65, 0.28, 0.49], rotation: [0, 0, 0], maxLoadKg: 150 });
    return sockets;
}

/** This is the pre-existing H2/U1 hardware, now a real node with an output socket.
 * Its serial is derived from the *owned leg serial*, never a throwaway mesh ID.
 * Independent adapter ownership/condition is deferred until the parts market exists.
 */
export const LEGACY_HIP_ADAPTER = Object.freeze({
    id: 'hip-h2-u1', name: 'H2/U1 hip conversion ring', slot: 'adapter',
    mountSize: 'medium', massKg: 110, loadLimitKg: 1900,
    sockets: [{ id: 'heavy-out', standard: 'heavy', position: [0, 0, 0],
        rotation: [0, 0, 0], maxLoadKg: 1900 }],
});
export const STRUCTURAL_ADAPTERS = new Map([[LEGACY_HIP_ADAPTER.id, LEGACY_HIP_ADAPTER]]);

export const emptyGraph = () => ({ version: GRAPH_VERSION, root: null, nodes: {} });
const child = (serial, definitionId, parentSerial, parentSocket, rotation = 0, extra = {}) => ({
    serial, definitionId, parentSerial, parentSocket, rotationQuarterTurns: rotation, ...extra,
});
const clone = (graph) => ({ version: graph.version, root: graph.root,
    nodes: Object.fromEntries(Object.entries(graph.nodes).map(([id, node]) => [id, { ...node }])) });
const definition = (id, byId) => byId.get(id) || STRUCTURAL_ADAPTERS.get(id);

/** Deterministic, backwards-compatible graph constructor for old five-station saves.
 * A historical frame-less garage is represented as STAGED modules; they stay owned and
 * visibly equipped in the old garage but cannot deploy until a frame is installed.
 */
export function graphFromStations(assembly, byId) {
    const graph = emptyGraph();
    const owned = new Map(assembly.owned.map((p) => [p.serial, p]));
    const frame = owned.get(assembly.installed.structure);
    if (frame && byId.get(frame.definitionId)?.slot === 'structure') {
        graph.root = frame.serial;
        graph.nodes[frame.serial] = child(frame.serial, frame.definitionId, null, null);
    }
    for (const slot of LEGACY_STATIONS) {
        const part = owned.get(assembly.installed[slot]);
        if (!part || byId.get(part.definitionId)?.slot !== slot)
            continue;
        if (slot === 'mobility' && byId.get(part.definitionId)?.mountSize === 'heavy') {
            const adapterId = `AD-${part.serial}`;
            graph.nodes[adapterId] = child(adapterId, LEGACY_HIP_ADAPTER.id,
                graph.root, graph.root ? slot : null, 0, graph.root ? { virtual: true } : { virtual: true, staged: true });
            graph.nodes[part.serial] = child(part.serial, part.definitionId, adapterId, 'heavy-out');
        } else {
            graph.nodes[part.serial] = child(part.serial, part.definitionId, graph.root,
                graph.root ? slot : null, 0, graph.root ? {} : { staged: true });
        }
    }
    return graph;
}

export function graphMatchesStations(assembly, graph, byId) {
    if (!graph || graph.version !== GRAPH_VERSION || !graph.nodes || typeof graph.nodes !== 'object') return false;
    const owned = new Map(assembly.owned.map(p => [p.serial, p]));
    for (const [slot, serial] of Object.entries(assembly.installed)) {
        if (!serial) continue;
        const instance = owned.get(serial);
        if (!instance || byId.get(instance.definitionId)?.slot !== slot) return false;
        const node = graph.nodes[serial];
        if (!node || node.serial !== serial || node.definitionId !== instance.definitionId) return false;
    }
    for (const node of Object.values(graph.nodes)) {
        const def = definition(node.definitionId, byId);
        if (!def || (!node.virtual && (!owned.has(node.serial) ||
            owned.get(node.serial).definitionId !== node.definitionId))) return false;
        if (def.slot && LEGACY_STATIONS.concat('structure').includes(def.slot) &&
            assembly.installed[def.slot] !== node.serial) return false;
    }
    return graph.root === (assembly.installed.structure || null);
}

/** Only bootstrap/reconcile a legacy projection; do not use this to hide a corrupt
 * loaded graph. Persistence validates explicit new graphs before exposing them.
 * The hostile dummy deliberately renames the stock serials after makeTestAssembly.
 */
export function ensureAssemblyGraph(assembly, byId) {
    if (!graphMatchesStations(assembly, assembly.graph, byId))
        assembly.graph = graphFromStations(assembly, byId);
    return assembly.graph;
}

/** Rotations are deliberately limited to 90-degree yaw steps for the first kit.
 * Keep the general parent/child pose composition outside Three.js.
 */
export function rotatedY(p, quarterTurns) {
    let [x, y, z] = p;
    for (let i = 0; i < ((quarterTurns % 4) + 4) % 4; i++) [x, z] = [z, -x];
    return [x, y, z];
}
export function composedPose(parent, socket, turn = 0) {
    const local = rotatedY(socket.position, parent.rotationQuarterTurns);
    const socketYaw = socket.rotationQuarterTurns ?? 0;
    return { position: parent.position.map((v, i) => v + local[i]),
        rotationQuarterTurns: (parent.rotationQuarterTurns + socketYaw + turn) % 4 };
}
export function graphWorldPoses(graph, byId, frameOrigin = [0, 0, 0]) {
    const poses = new Map();
    if (!graph?.root || !graph.nodes[graph.root]) return poses;
    const visit = (id, pose, seen) => {
        if (seen.has(id)) throw new Error(`Cycle in mechanical hierarchy at ${id}`);
        seen.add(id);
        poses.set(id, pose);
        for (const node of Object.values(graph.nodes).filter(n => n.parentSerial === id)) {
            const socket = (definition(graph.nodes[id].definitionId, byId)?.sockets || [])
                .find(s => s.id === node.parentSocket);
            if (!socket) throw new Error(`Missing socket ${node.parentSocket} on ${id}`);
            // An adapter's sockets can themselves be translated and rotated later.
            const next = composedPose(pose, socket, node.rotationQuarterTurns);
            visit(node.serial, next, new Set(seen));
        }
    };
    visit(graph.root, { position: at(frameOrigin), rotationQuarterTurns: 0 }, new Set());
    return poses;
}

/** Strict graph validation. Staged, frame-less historical loadouts are preserved
 * but invalid for deployment; a user can refit a frame without losing serials.
 */
export function validateGraph(graph, assembly, byId, { allowStaged = true } = {}) {
    const errors = [];
    if (!graph || graph.version !== GRAPH_VERSION || !graph.nodes || typeof graph.nodes !== 'object')
        return { valid: false, errors: ['Unknown structural graph format.'] };
    const nodes = Object.values(graph.nodes);
    const owned = new Map(assembly.owned.map(p => [p.serial, p]));
    const root = graph.root && graph.nodes[graph.root];
    if (graph.root && (!root || root.parentSerial !== null ||
        byId.get(root.definitionId)?.slot !== 'structure'))
        errors.push('Structural root must be an owned, parentless frame.');
    if (!graph.root && nodes.length && !allowStaged) errors.push('Install a primary frame first.');
    for (const [key, node] of Object.entries(graph.nodes)) {
        const def = definition(node.definitionId, byId);
        if (!node || key !== node.serial || !def) { errors.push(`Unknown or mismatched installed node: ${key}.`); continue; }
        const ownedPart = owned.get(key);
        if (!node.virtual && (!ownedPart || ownedPart.definitionId !== node.definitionId))
            errors.push(`Installed node ${key} is not a known owned part.`);
        if (node.virtual && (node.definitionId !== LEGACY_HIP_ADAPTER.id ||
            graph.nodes[`AD-${Object.values(graph.nodes).find(n => n.parentSerial === key)?.serial}`]?.serial !== key))
            errors.push(`Unrecognized virtual adapter ${key}.`);
        if (!Number.isInteger(node.rotationQuarterTurns) || node.rotationQuarterTurns < 0 || node.rotationQuarterTurns > 3)
            errors.push(`Invalid mounting rotation on ${key}.`);
        if (key === graph.root) continue;
        if (!node.parentSerial) {
            if (!allowStaged || !node.staged || graph.root) errors.push(`Orphaned component ${key}.`);
            continue;
        }
        if (node.parentSerial === key) { errors.push(`Part ${key} cannot mount to itself.`); continue; }
        const parent = graph.nodes[node.parentSerial];
        if (!parent) { errors.push(`Missing parent ${node.parentSerial} for ${key}.`); continue; }
        if (!node.parentSocket && node.staged && !graph.root) continue;
        const socket = (definition(parent.definitionId, byId)?.sockets || []).find(s => s.id === node.parentSocket);
        if (!socket) { errors.push(`Socket ${node.parentSocket} is absent on ${node.parentSerial}.`); continue; }
        if (!MOUNT_SIZES.includes(socket.standard) || socket.standard !== def.mountSize)
            errors.push(`${def.name || key} requires ${def.mountSize}, but ${node.parentSocket} is ${socket.standard}.`);
        if (!goodPoint(socket.position)) errors.push(`Invalid socket transform: ${node.parentSerial}/${socket.id}.`);
        if (socket.maxLoadKg && subtreeMass(graph, key, byId, new Set()) > socket.maxLoadKg)
            errors.push(`Socket ${node.parentSocket} on ${node.parentSerial} exceeds its ${socket.maxLoadKg} kg load rating.`);
    }
    for (const node of nodes) {
        if (!node.parentSerial || node.staged) continue;
        const siblings = nodes.filter(n => n.parentSerial === node.parentSerial && n.parentSocket === node.parentSocket);
        if (siblings.length > 1) errors.push(`Socket ${node.parentSocket} on ${node.parentSerial} is occupied twice.`);
    }
    // Catch cycles, including disconnected loops that the single-root traversal cannot reach.
    for (const node of nodes) {
        const visited = new Set([node.serial]); let cursor = node;
        while (cursor?.parentSerial) {
            if (visited.has(cursor.parentSerial)) { errors.push(`Cycle at ${node.serial}.`); break; }
            visited.add(cursor.parentSerial); cursor = graph.nodes[cursor.parentSerial];
        }
    }
    if (root) {
        const reachable = new Set([graph.root]); let grew = true;
        while (grew) {
            grew = false;
            for (const node of nodes) if (reachable.has(node.parentSerial) && !reachable.has(node.serial)) {
                reachable.add(node.serial); grew = true;
            }
        }
        for (const node of nodes) if (!reachable.has(node.serial)) errors.push(`Unconnected part ${node.serial}.`);
    }
    if (!graphMatchesStations(assembly, graph, byId)) errors.push('Installed stations do not agree with structural nodes.');
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
function subtreeMass(graph, id, byId, seen) {
    if (seen.has(id)) return Infinity;
    seen.add(id);
    const node = graph.nodes[id];
    let mass = definition(node?.definitionId, byId)?.massKg || 0;
    for (const child of Object.values(graph.nodes).filter(n => n.parentSerial === id))
        mass += subtreeMass(graph, child.serial, byId, new Set(seen));
    return mass;
}

/** Safe graph edit primitive for future direct 3D placement. Callers receive a
 * proposed graph; the live assembly is changed only after every check succeeds.
 * Slot projection remains handled by the legacy garage bridge for now.
 */
export function proposeAttachment(assembly, byId, serial, parentSerial, socketId, rotationQuarterTurns = 0) {
    const old = ensureAssemblyGraph(assembly, byId);
    const own = assembly.owned.find(p => p.serial === serial);
    if (!own) return { ok: false, reason: `No owned component ${serial}.` };
    if (old.nodes[serial]) return { ok: false, reason: `${serial} is already attached; detach it first.` };
    if (!old.nodes[parentSerial]) return { ok: false, reason: `Missing parent ${parentSerial}.` };
    const def = byId.get(own.definitionId);
    const parent = definition(old.nodes[parentSerial].definitionId, byId);
    const socket = parent?.sockets?.find(s => s.id === socketId);
    if (!socket) return { ok: false, reason: `Unknown socket ${socketId} on ${parentSerial}.` };
    if (socket.standard !== def?.mountSize)
        return { ok: false, reason: `${def?.name || serial} needs a ${def?.mountSize} mount, not ${socket.standard}.` };
    if (Object.values(old.nodes).some(n => n.parentSerial === parentSerial && n.parentSocket === socketId))
        return { ok: false, reason: `Socket ${socketId} on ${parentSerial} is occupied.` };
    const graph = clone(old);
    graph.nodes[serial] = child(serial, own.definitionId, parentSerial, socketId, rotationQuarterTurns);
    // A non-legacy socket is allowed in the structural data layer even if the current
    // five-station pilot deployment UI does not yet understand its function.
    const verdict = validateGraph(graph, assembly, byId);
    if (!verdict.valid) return { ok: false, reason: verdict.errors.join(' '), errors: verdict.errors };
    return { ok: true, graph };
}
export function proposeRemoval(graph, serial, { cascade = false } = {}) {
    if (!graph?.nodes[serial]) return { ok: false, reason: `Unknown component ${serial}.` };
    const descendants = new Set(); let frontier = [serial];
    while (frontier.length) {
        const id = frontier.pop();
        for (const node of Object.values(graph.nodes).filter(n => n.parentSerial === id)) {
            descendants.add(node.serial); frontier.push(node.serial);
        }
    }
    if (descendants.size && !cascade) {
        return { ok: false, reason: `${serial} supports ${descendants.size} attached component(s). Remove children first.`,
            children: [...descendants] };
    }
    const next = clone(graph);
    for (const id of [serial, ...descendants]) delete next.nodes[id];
    if (next.root === serial) next.root = null;
    return { ok: true, graph: next, detached: [serial, ...descendants] };
}
