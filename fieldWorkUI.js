/** k.3r.0 — emergency field-work surface layered onto the q.3q.2 locked pit.
 * One disabled intact component may be patched per intermission. Taking that action
 * commits the patched machine to the next round; the normal q.1 DEPLOY remains the
 * final launch confirmation.
 */
import { BY_ID, SLOTS } from './components.js';
import {
    applyEmergencyFieldPatch, clearFieldWorkAll, clearFieldWorkSeries,
    currentIntermissionFieldAction, fieldPatchCandidates, fieldPatchEligibility,
    fieldWorkCommitment, loadFieldWorkState, partLifecycle, reconcileFieldPatches,
    FIELD_PATCH_CONDITION,
} from './fieldWork.js';
import { loadSeries } from './series.js';
import { loadStable, rigById, rigFieldability } from './stable.js';
import {
    assignRigToSortie, beginSortieAssignment, loadSortieAssignment,
} from './sortieAssignment.js';

const inspectionPanel = document.querySelector('#inspection-panel');
const fieldStatus = document.querySelector('#field-status');
if (!inspectionPanel || !fieldStatus) throw new Error('Field work needs the existing garage pit surface.');

const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.href = './fieldWorkStyles.css?v=k3r0';
document.head.append(styleLink);

let localStorageRef = null;
let sessionStorageRef = null;
try { localStorageRef = window.localStorage; } catch { /* surfaced below */ }
try { sessionStorageRef = window.sessionStorage; } catch { /* surfaced below */ }
let renderQueued = false;

const slotLabels = { structure: 'FRAME', mobility: 'MOBILITY', power: 'POWER', command: 'COMMAND', combat: 'COMBAT' };
const rigLabel = rig => rig?.name || `RIG ${String(rig?.bay ?? 0).padStart(2, '0')}`;
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;

function announce(message, blocked = false) {
    fieldStatus.dataset.message = message;
    fieldStatus.textContent = message;
    fieldStatus.classList.add('message');
    fieldStatus.classList.toggle('blocked', blocked);
    fieldStatus.classList.toggle('ready', !blocked);
}

function activeIntermission() {
    const series = loadSeries(localStorageRef);
    return series?.phase === 'intermission' ? series : null;
}

function patchBlockSummary(stable) {
    let destroyed = 0;
    let tooDamaged = 0;
    for (const rig of stable.rigs) {
        if (!rig.commissioned) continue;
        for (const slot of SLOTS) {
            const check = fieldPatchEligibility(stable, rig.id, slot);
            if (check.reason?.startsWith('DESTROYED')) destroyed++;
            else if (check.reason?.startsWith('ONE PATCH')) tooDamaged++;
        }
    }
    return { destroyed, tooDamaged };
}

function signatureFor(series, stable, action, candidates, state) {
    const patched = Object.keys(state.patches).sort().join(',');
    const candidateIds = candidates.map(item => `${item.rigId}:${item.slot}:${item.serial}`).join(',');
    const readiness = stable.rigs.map(rig => `${rig.id}:${rigFieldability(stable, rig.id).fieldable ? 1 : 0}`).join(',');
    return [series.id, series.rounds.length, action?.serial || '-', action?.rigId || '-', candidateIds, patched, readiness].join('|');
}

function line(text, className = '') {
    const row = document.createElement('div');
    row.className = `field-work-line ${className}`.trim();
    row.textContent = text;
    return row;
}

function applyCommitmentLock() {
    const commitment = fieldWorkCommitment(localStorageRef);
    for (const card of inspectionPanel.querySelectorAll('.sortie-rig-card')) {
        const wrongRig = !!commitment && card.dataset.rigId !== commitment.rigId;
        card.classList.toggle('field-work-committed-away', wrongRig);
        card.classList.toggle('field-work-patch-committed', !!commitment && card.dataset.rigId === commitment.rigId);
        if (wrongRig) {
            card.disabled = true;
            card.title = `${commitment.rigName || commitment.rigId} is committed by field patch`;
        }
    }
}

function renderFieldWork() {
    const series = activeIntermission();
    const existing = inspectionPanel.querySelector(':scope > .field-work-panel');
    if (!series) {
        existing?.remove();
        document.body.classList.remove('field-work-intermission');
        return;
    }
    document.body.classList.add('field-work-intermission');
    const stable = loadStable(localStorageRef).stable;
    const state = reconcileFieldPatches(localStorageRef, stable);
    const action = currentIntermissionFieldAction(localStorageRef, series);
    const candidates = action ? [] : fieldPatchCandidates(stable);
    const signature = signatureFor(series, stable, action, candidates, state);
    if (existing?.dataset.signature === signature) {
        applyCommitmentLock();
        return;
    }

    const panel = document.createElement('section');
    panel.className = 'field-work-panel';
    panel.dataset.signature = signature;
    panel.setAttribute('aria-label', 'Emergency inter-round field work');
    const head = document.createElement('div'); head.className = 'field-work-head';
    const title = document.createElement('strong'); title.textContent = 'FIELD WORK';
    const badge = document.createElement('span'); badge.textContent = action ? 'ACTION SPENT' : '1 ACTION AVAILABLE';
    head.append(title, badge); panel.append(head);

    if (action) {
        const rig = rigById(stable, action.rigId);
        const def = BY_ID.get(stable.inventory.find(part => part.serial === action.serial)?.definitionId);
        panel.append(
            line(`${rigLabel(rig).toUpperCase()} · ${slotLabels[action.slot]} · ${def?.name || action.serial}`, 'field-work-primary'),
            line(`${action.serial} · PATCHED TO ${percent(action.restoredCondition)} · NO ARMOR RESTORED`, 'field-work-patched'),
            line(`COMMITTED TO ROUND ${series.roundNumber} · DEPLOY CONFIRMS THE LAUNCH`, 'field-work-commit'),
        );
    } else {
        const note = document.createElement('p');
        note.textContent = `One disabled intact component may be crudely returned to ${percent(FIELD_PATCH_CONDITION)}. Field work restores no armor and does not count as a shop repair. Taking it commits that machine to Round ${series.roundNumber}.`;
        panel.append(note);

        if (candidates.length) {
            const grid = document.createElement('div'); grid.className = 'field-work-grid';
            for (const candidate of candidates) {
                const rig = rigById(stable, candidate.rigId);
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'field-work-option';
                const top = document.createElement('strong');
                top.textContent = `${rigLabel(rig).toUpperCase()} · ${slotLabels[candidate.slot]}`;
                const middle = document.createElement('span'); middle.textContent = `${candidate.name} · ${candidate.serial}`;
                const bottom = document.createElement('small'); bottom.textContent = `DISABLED → FIELD PATCH ${percent(candidate.restoredCondition)} · COMMIT ROUND ${series.roundNumber}`;
                button.append(top, middle, bottom);
                button.addEventListener('click', () => {
                    const staged = beginSortieAssignment(sessionStorageRef, series.contractId);
                    if (!staged.ok) { announce(staged.reason, true); return; }
                    const assigned = assignRigToSortie(sessionStorageRef, candidate.rigId, rigLabel(rig));
                    if (!assigned.ok) { announce(assigned.reason, true); return; }
                    const result = applyEmergencyFieldPatch(localStorageRef, {
                        seriesId: series.id, rigId: candidate.rigId, slot: candidate.slot,
                    });
                    if (!result.ok) { announce(result.reason, true); queueRender(); return; }
                    announce(`${rigLabel(rig).toUpperCase()} · ${slotLabels[candidate.slot]} FIELD PATCHED · ROUND ${series.roundNumber} COMMITTED`);
                    window.location.reload();
                });
                grid.append(button);
            }
            panel.append(grid);
        } else {
            panel.append(line('NO ONE-ACTION FIELD PATCH CAN RETURN A MACHINE TO FIELDABLE', 'field-work-blocked'));
        }

        const blockers = patchBlockSummary(stable);
        if (blockers.destroyed)
            panel.append(line(`${blockers.destroyed} DESTROYED SYSTEM${blockers.destroyed === 1 ? '' : 'S'} · SHOP REBUILD REQUIRED`, 'field-work-muted'));
        if (blockers.tooDamaged)
            panel.append(line(`${blockers.tooDamaged} DISABLED SYSTEM${blockers.tooDamaged === 1 ? '' : 'S'} CANNOT BE SAVED BY THE SINGLE FIELD ACTION`, 'field-work-muted'));
        const fieldable = stable.rigs.filter(rig => rig.commissioned && rigFieldability(stable, rig.id).fieldable).length;
        if (fieldable)
            panel.append(line(`${fieldable} MACHINE${fieldable === 1 ? '' : 'S'} ALREADY FIELDABLE · YOU MAY DECLINE FIELD WORK AND ROTATE NORMALLY`, 'field-work-muted'));
    }

    existing?.replaceWith(panel);
    if (!existing) {
        const banner = inspectionPanel.querySelector(':scope > .bo3-series-banner');
        const assignment = inspectionPanel.querySelector(':scope > .sortie-assignment');
        if (banner) banner.after(panel);
        else if (assignment) assignment.before(panel);
        else inspectionPanel.append(panel);
    }
    applyCommitmentLock();
}

function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
        renderQueued = false;
        renderFieldWork();
    });
}

// A patch is a real commitment, not a suggestion. Stop q.1 machine-card/deploy events
// before they can switch to a different rig after field work has been spent.
document.addEventListener('click', event => {
    const commitment = fieldWorkCommitment(localStorageRef);
    if (!commitment) return;
    const card = event.target.closest('.sortie-rig-card');
    if (card && card.dataset.rigId !== commitment.rigId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        announce(`FIELD PATCH COMMITTED ${commitment.rigName || commitment.rigId} · CANNOT ROTATE THIS ROUND`, true);
        return;
    }
    const deploy = event.target.closest('#assembly-toggle');
    if (deploy && document.body.classList.contains('inspecting')) {
        const assignment = loadSortieAssignment(sessionStorageRef);
        if (assignment?.rigId !== commitment.rigId) {
            event.preventDefault();
            event.stopImmediatePropagation();
            announce(`FIELD PATCH COMMITTED ${commitment.rigName || commitment.rigId} · ASSIGN THAT MACHINE`, true);
        }
    }
}, true);

// Proper garage service later clears only the active PATCHED marker. The permanent
// machine/part history remains in the stable career record.
document.addEventListener('m3ch4:assembly-mutated', () => {
    const stable = loadStable(localStorageRef).stable;
    reconcileFieldPatches(localStorageRef, stable);
    queueRender();
});
document.addEventListener('m3ch4:inventory-changed', queueRender);

// Intermission return is stopped by seriesUI before this listener. Terminal return
// reaches here and releases only the per-series action ledger; patch markers persist.
document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'debrief-garage') clearFieldWorkSeries(localStorageRef);
    const confirmedWipe = button.id === 'wipe-save' && button.getAttribute('aria-pressed') === 'true';
    const campaignRestart = button.classList.contains('campaign-restart');
    if (confirmedWipe || campaignRestart) clearFieldWorkAll(localStorageRef);
}, true);

const observer = new MutationObserver(queueRender);
observer.observe(inspectionPanel, { childList: true, subtree: true });
queueRender();
