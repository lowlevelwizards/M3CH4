/** k.3q.0 — garage surface for the named three-machine stable.
 * Inactive bays are edited as persisted physical assemblies; only a commissioned,
 * fieldable bay can replace the live v8 machine projection and reload into the yard.
 * k.3q.2 records each BO3 round against its explicit rig id and contract wins once.
 */
import { BY_ID, SLOTS } from './components.js';
import { activePlayerArena } from './scene.js';
import { loadMachine } from './persistence.js';
import { subscribeBoutResult, subscribeRoundResult } from './boutSession.js';
import {
    activateRig, clearStable, commissionRig, loadStable, mountPartOnRig,
    originalPartsRemaining, recordActiveDeployment, registerAcquiredPart, renameRig,
    rigById, rigFieldability, serialOwner, storeStable, syncActiveMachineIntoStable,
    unmountPartFromRig,
} from './stable.js';

const panel = document.querySelector('#inspection-panel');
const context = document.querySelector('#garage-context');
const fieldStatus = document.querySelector('#field-status');
const partInfo = document.querySelector('#part-info');
const garageBrand = document.querySelector('.garage-brand small');
const rigTag = document.querySelector('.rig-tag');
if (!panel || !context || !fieldStatus || !partInfo)
    throw new Error('Stable garage needs the existing inspection surface.');

const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.href = './stableStyles.css?v=k3q0';
document.head.append(styleLink);

let storage = null;
try { storage = window.localStorage; }
catch { /* persistence module already handles unavailable storage */ }

let loaded = loadStable(storage);
let stable = loaded.stable;
let selectedRigId = stable.activeRigId;
let messageTimer = null;
const seenBoutResults = new WeakSet();
const seenRoundResults = new WeakSet();

const labels = { structure: 'FRAME', mobility: 'MOBILITY', power: 'POWER', command: 'COMMAND', combat: 'COMBAT' };
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
const rigLabel = rig => rig.name || `RIG ${String(rig.bay).padStart(2, '0')}`;

function statusMessage(text, blocked = false) {
    fieldStatus.dataset.message = text;
    fieldStatus.textContent = text;
    fieldStatus.classList.toggle('blocked', blocked);
    fieldStatus.classList.toggle('ready', !blocked);
    fieldStatus.classList.toggle('message', true);
    if (messageTimer !== null) window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
        delete fieldStatus.dataset.message;
        fieldStatus.classList.remove('message');
        const active = rigFieldability(stable, stable.activeRigId);
        const ready = !!active.inspection?.ready;
        fieldStatus.classList.toggle('ready', ready);
        fieldStatus.classList.toggle('blocked', !ready);
        fieldStatus.textContent = ready ? 'READY' : 'BLOCKED';
        messageTimer = null;
        document.dispatchEvent(new CustomEvent('m3ch4:stable-status-cleared'));
    }, 2800);
}

function syncFromLiveSave() {
    if (!storage) return false;
    const machine = loadMachine(storage);
    try {
        // Parked bays may be edited by the unified garage while this adapter is
        // idle. Refresh first: saving the old closure would erase those bay edits.
        loaded = loadStable(storage);
        stable = loaded.stable;
        syncActiveMachineIntoStable(stable, machine);
        return storeStable(storage, stable);
    } catch {
        loaded = loadStable(storage);
        stable = loaded.stable;
        return false;
    }
}

function saveAndRender() {
    if (storage && !storeStable(storage, stable)) {
        statusMessage('STABLE SAVE FAILED · LOCAL STORAGE UNAVAILABLE', true);
        return false;
    }
    render();
    return true;
}

const stablePanel = document.createElement('section');
stablePanel.id = 'stable-manager';
stablePanel.className = 'stable-manager';
stablePanel.setAttribute('aria-label', 'Three machine stable');
context.insertBefore(stablePanel, context.firstChild);

function updateIdentityChrome() {
    const active = rigById(stable, stable.activeRigId);
    if (garageBrand) garageBrand.textContent = `RIG ${String(active?.bay ?? 1).padStart(2, '0')}`;
    if (rigTag && active) rigTag.textContent = `${rigLabel(active).toUpperCase()} // RIG ${String(active.bay).padStart(2, '0')}`;
}

function summaryText(rig) {
    const readiness = rigFieldability(stable, rig.id);
    if (rig.commissioned) return readiness.fieldable ? 'FIELDABLE' : 'BLOCKED';
    if (Object.keys(rig.installed).length === 0) return 'EMPTY';
    return readiness.fieldable ? 'READY TO COMMISSION' : 'INCOMPLETE';
}

function appendTabs(root) {
    const tabs = document.createElement('div');
    tabs.className = 'stable-tabs';
    tabs.setAttribute('role', 'tablist');
    for (const rig of stable.rigs) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stable-tab';
        button.classList.toggle('selected', rig.id === selectedRigId);
        button.classList.toggle('active-rig', rig.id === stable.activeRigId);
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(rig.id === selectedRigId));
        const top = document.createElement('span');
        top.textContent = rig.commissioned ? rigLabel(rig).toUpperCase() : `RIG ${String(rig.bay).padStart(2, '0')}`;
        const bottom = document.createElement('small');
        bottom.textContent = `${summaryText(rig)}${rig.id === stable.activeRigId ? ' · ACTIVE' : ''}`;
        button.append(top, bottom);
        button.addEventListener('click', () => {
            syncFromLiveSave();
            selectedRigId = rig.id;
            render();
        });
        tabs.append(button);
    }
    root.append(tabs);
}

function appendCareer(root, rig) {
    const line = document.createElement('div');
    line.className = 'stable-career';
    const original = rig.originalConfiguration ? `${originalPartsRemaining(rig)} / 5 ORIGINAL` : 'NOT COMMISSIONED';
    line.textContent = `${rig.career.deployments} DEPLOYMENTS · ${rig.career.roundWins} W · ${rig.career.roundLosses} L · ${original}`;
    root.append(line);
}

function appendRename(root, rig) {
    if (!rig.commissioned) return;
    const form = document.createElement('div');
    form.className = 'stable-name-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 32;
    input.value = rig.name;
    input.setAttribute('aria-label', `Rename ${rig.name}`);
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'RENAME';
    button.addEventListener('click', () => {
        syncFromLiveSave();
        const currentRig = rigById(stable, rig.id);
        const result = renameRig(stable, currentRig.id, input.value);
        if (!result.ok) { statusMessage(result.reason, true); return; }
        if (currentRig.id === stable.activeRigId) {
            const live = activePlayerArena()?.assembly;
            if (live) {
                live.name = result.name;
                document.dispatchEvent(new CustomEvent('m3ch4:assembly-mutated'));
            }
        }
        saveAndRender();
        statusMessage(`MACHINE RENAMED · ${result.name.toUpperCase()}`);
    });
    form.append(input, button);
    root.append(form);
}

function optionText(part, owner) {
    const def = BY_ID.get(part.definitionId);
    const ownership = owner ? ` · ${rigLabel(owner)}` : '';
    const fate = part.destroyed ? ' · DESTROYED' : ` · ${percent(part.condition)}`;
    return `${def.name} · ${part.serial}${fate}${ownership}`;
}

function appendInactiveBuilder(root, rig) {
    const rows = document.createElement('div');
    rows.className = 'stable-slot-list';
    for (const slot of SLOTS) {
        const row = document.createElement('label');
        row.className = 'stable-slot-row';
        const name = document.createElement('span');
        name.textContent = labels[slot];
        const select = document.createElement('select');
        select.setAttribute('aria-label', `${labels[slot]} for ${rigLabel(rig)}`);
        const empty = document.createElement('option');
        empty.value = ''; empty.textContent = '— EMPTY —';
        select.append(empty);
        const candidates = stable.inventory.filter(part => BY_ID.get(part.definitionId)?.slot === slot);
        for (const part of candidates) {
            const owner = serialOwner(stable, part.serial);
            const option = document.createElement('option');
            option.value = part.serial;
            option.textContent = optionText(part, owner && owner.id !== rig.id ? owner : null);
            option.disabled = !!owner && owner.id !== rig.id;
            option.selected = rig.installed[slot] === part.serial;
            select.append(option);
        }
        select.addEventListener('change', () => {
            syncFromLiveSave();
            const currentRig = rigById(stable, rig.id);
            const result = select.value
                ? mountPartOnRig(stable, currentRig.id, slot, select.value)
                : unmountPartFromRig(stable, currentRig.id, slot);
            if (!result.ok) { statusMessage(result.reason, true); render(); return; }
            saveAndRender();
            statusMessage(select.value ? `${select.value} MOUNTED · ${rigLabel(currentRig).toUpperCase()}` : `${labels[slot]} REMOVED · ${rigLabel(currentRig).toUpperCase()}`);
        });
        row.append(name, select);
        rows.append(row);
    }
    root.append(rows);
}

function readinessReason(readiness) {
    if (readiness.missing.length) return `MISSING ${readiness.missing.map(slot => labels[slot]).join(' / ')}`;
    if (readiness.destroyed.length) return `DESTROYED ${readiness.destroyed.map(slot => labels[slot]).join(' / ')}`;
    if (readiness.disabled.length) return `DISABLED ${readiness.disabled.map(slot => labels[slot]).join(' / ')}`;
    const failed = readiness.inspection?.checks?.find(check => !check.passes);
    return failed?.reason?.toUpperCase() || 'NOT FIELDABLE';
}

function appendCommission(root, rig, readiness) {
    if (rig.commissioned || !readiness.fieldable) return;
    const form = document.createElement('div');
    form.className = 'stable-commission-row';
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = 32; input.placeholder = 'MACHINE NAME';
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'COMMISSION MACHINE';
    button.addEventListener('click', () => {
        syncFromLiveSave();
        const result = commissionRig(stable, rig.id, input.value);
        if (!result.ok) { statusMessage(result.reason, true); return; }
        saveAndRender();
        statusMessage(`${result.rig.name.toUpperCase()} COMMISSIONED · RIG ${String(result.rig.bay).padStart(2, '0')}`);
    });
    form.append(input, button);
    root.append(form);
}

function appendActivate(root, rig, readiness) {
    if (!rig.commissioned || rig.id === stable.activeRigId) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stable-activate';
    button.disabled = !readiness.fieldable;
    button.textContent = readiness.fieldable ? `OPEN ${rig.name.toUpperCase()} IN GARAGE` : 'MACHINE NOT FIELDABLE';
    button.addEventListener('click', () => {
        syncFromLiveSave();
        const result = activateRig(storage, stable, rig.id);
        if (!result.ok) { statusMessage(result.reason, true); return; }
        window.location.reload();
    });
    root.append(button);
}

function render() {
    const selected = rigById(stable, selectedRigId) || rigById(stable, stable.activeRigId);
    if (!selected) return;
    stablePanel.replaceChildren();
    appendTabs(stablePanel);

    const body = document.createElement('div');
    body.className = 'stable-body';
    const head = document.createElement('div');
    head.className = 'stable-head';
    const title = document.createElement('strong');
    title.textContent = selected.commissioned ? rigLabel(selected).toUpperCase() : `RIG ${String(selected.bay).padStart(2, '0')}`;
    const readiness = rigFieldability(stable, selected.id);
    const state = document.createElement('span');
    state.textContent = summaryText(selected);
    state.className = readiness.fieldable ? 'ready' : 'blocked';
    head.append(title, state); body.append(head);

    appendCareer(body, selected);
    if (selected.id === stable.activeRigId) {
        const note = document.createElement('div');
        note.className = 'stable-note';
        note.textContent = 'ACTIVE BAY · USE THE MODULE CONTROLS BELOW TO SERVICE OR RECONFIGURE THIS MACHINE.';
        body.append(note);
    } else {
        appendInactiveBuilder(body, selected);
        const note = document.createElement('div');
        note.className = `stable-readiness ${readiness.fieldable ? 'ready' : 'blocked'}`;
        note.textContent = readiness.fieldable ? 'ALL FIVE FUNCTIONS PRESENT · MASS / POWER / MOUNTS VALID' : readinessReason(readiness);
        body.append(note);
    }
    appendCommission(body, selected, readiness);
    appendRename(body, selected);
    appendActivate(body, selected, readiness);
    stablePanel.append(body);

    panel.classList.toggle('stable-inactive-selected', selected.id !== stable.activeRigId);
    updateIdentityChrome();
}

// Prevent the legacy active-bay picker from silently stealing a component that is
// physically mounted on another persistent machine. The stable model repeats this
// invariant at persistence time as a fail-safe.
partInfo.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const match = /INSTALL\s*·\s*(.+)$/i.exec(button.textContent || '');
    if (!match) return;
    syncFromLiveSave();
    const serial = match[1].trim();
    const owner = serialOwner(stable, serial);
    if (!owner || owner.id === stable.activeRigId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    statusMessage(`${serial} MOUNTED ON ${rigLabel(owner).toUpperCase()} · REMOVE IT THERE FIRST`, true);
}, true);

document.addEventListener('m3ch4:inventory-changed', event => {
    syncFromLiveSave();
    if (event.detail?.serial) registerAcquiredPart(stable, event.detail.serial, event.detail?.source || 'bout salvage');
    storeStable(storage, stable);
    render();
});

document.addEventListener('m3ch4:assembly-mutated', () => {
    syncFromLiveSave();
    render();
});

document.addEventListener('m3ch4:stable-status-cleared', () => render(), { passive: true });

subscribeRoundResult(result => {
    if (!result || typeof result !== 'object' || seenRoundResults.has(result) || !result.round?.rigId) return;
    seenRoundResults.add(result);
    syncFromLiveSave();
    const rig = rigById(stable, result.round.rigId);
    if (!rig?.commissioned) return;
    rig.career.deployments += 1;
    if (result.round.victory) rig.career.roundWins += 1;
    else rig.career.roundLosses += 1;
    for (const serial of Object.values(rig.installed)) {
        const history = stable.partHistory?.[serial];
        if (history) history.deployments = (Number(history.deployments) || 0) + 1;
    }
    storeStable(storage, stable);
    render();
});

subscribeBoutResult(result => {
    if (!result || typeof result !== 'object' || seenBoutResults.has(result)) return;
    seenBoutResults.add(result);
    syncFromLiveSave();
    if (result.series?.rounds) {
        if (result.victory) {
            for (const rigId of new Set(result.series.participatingRigIds || result.series.rounds.map(round => round.rigId))) {
                const rig = rigById(stable, rigId);
                if (rig?.commissioned) rig.career.contractWins += 1;
            }
        }
    } else {
        recordActiveDeployment(stable, !!result.victory);
    }
    storeStable(storage, stable);
    render();
});

// Run before main.js handles the confirmed wipe, so the sidecar registry cannot
// resurrect old rig identities after the v8 machine save is intentionally cleared.
document.addEventListener('click', event => {
    const button = event.target.closest('#wipe-save');
    if (button?.getAttribute('aria-pressed') === 'true') clearStable(storage);
}, true);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncFromLiveSave();
});
window.addEventListener('pagehide', syncFromLiveSave);

render();
if (loaded.status === 'migrated') statusMessage('STABLE CREATED · RIG 01 COMMISSIONED · RIG 02 / 03 EMPTY');
else if (loaded.status === 'recovered') statusMessage('STABLE REGISTRY REBUILT FROM ACTIVE MACHINE', true);
