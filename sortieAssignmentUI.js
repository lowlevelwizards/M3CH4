/** k.3q.1 — explicit contract -> machine -> deploy garage flow.
 *
 * This adapter deliberately sits in front of the existing campaign click/reload and
 * DEPLOY handlers. A contract click stages intent only. DEPLOY atomically selects the
 * job, projects the chosen persistent rig into v8, reloads, then performs the existing
 * combat transition once both authorities agree on the same assignment.
 */
import { BY_ID, SLOTS } from './components.js';
import { contractById, selectContract, selectedContract } from './contracts.js';
import { loadCampaign } from './campaign.js';
import { subscribeBoutResult } from './boutSession.js';
import { activateRig, loadStable, rigById, rigFieldability } from './stable.js';
import { bayHealth } from './garageBay.js';
import {
    assignmentReady, assignRigToSortie, beginSortieAssignment, cancelSortieAssignment,
    clearSortieAssignment, loadSortieAssignment, markSortieDeployed, markSortieLaunching,
} from './sortieAssignment.js';

const inspectionPanel = document.querySelector('#inspection-panel');
const assemblyToggle = document.querySelector('#assembly-toggle');
const fieldStatus = document.querySelector('#field-status');
const targetPanel = document.querySelector('#target-panel');
const targetToggle = document.querySelector('#target-toggle');
const debriefLines = document.querySelector('#debrief-lines');
if (!inspectionPanel || !assemblyToggle || !fieldStatus || !targetPanel || !targetToggle || !debriefLines)
    throw new Error('Sortie assignment needs the existing garage / deploy surfaces.');

const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.href = './sortieAssignmentStyles.css?v=k3q1';
document.head.append(styleLink);

let localStorageRef = null;
let sessionStorageRef = null;
try { localStorageRef = window.localStorage; } catch { /* persistence already handles unavailable local storage */ }
try { sessionStorageRef = window.sessionStorage; } catch { /* assignment UI will surface the failure */ }
let resolvedAssignment = null;
let statusTimer = null;

const labels = { structure: 'FRAME', mobility: 'MOVE', power: 'POWER', command: 'CMD', combat: 'ARMS' };
const rigLabel = rig => rig?.name || `RIG ${String(rig?.bay ?? 0).padStart(2, '0')}`;

function announce(message, blocked = false) {
    fieldStatus.dataset.message = message;
    fieldStatus.textContent = message;
    fieldStatus.classList.toggle('message', true);
    fieldStatus.classList.toggle('blocked', blocked);
    fieldStatus.classList.toggle('ready', !blocked);
    if (statusTimer !== null) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
        if (fieldStatus.dataset.message === message) {
            delete fieldStatus.dataset.message;
            fieldStatus.classList.remove('message');
        }
        statusTimer = null;
    }, 3200);
}

function inventoryPart(stable, serial) {
    return stable.inventory.find(part => part.serial === serial) ?? null;
}

/** Use the same SERIAL-MATCHED live integrity and armor snapshots as the pit.
 * The former setup status called fully stripped armor "OPERATIONAL" because
 * it checked only the owned part's internal health. */
function rigHealth(stable, rig) {
    if(!rig)return { ratio:0, label:'UNKNOWN' };
    const states=bayHealth(stable,rig.id);
    const present=states.filter(x=>x.serial);
    if(!present.length)return { ratio:0, label:'EMPTY' };
    const lowest=Math.min(...states.map(x=>x.serial?Math.min(x.condition,x.armorRatio):0));
    if(present.some(x=>x.destroyed))return { ratio:lowest, label:'WRECKED' };
    if(present.some(x=>x.condition<=.001))return { ratio:lowest, label:'DISABLED' };
    if(lowest<.38)return { ratio:lowest, label:'CRITICAL' };
    if(lowest<.78)return { ratio:lowest, label:'DAMAGED' };
    if(lowest<.995)return { ratio:lowest, label:'ARMOR / CORE WORN' };
    return { ratio:lowest, label:'OPERATIONAL' };
}

function definingHardware(stable, rig) {
    const names = [];
    for (const slot of ['mobility', 'combat']) {
        const part = inventoryPart(stable, rig.installed[slot]);
        const def = part ? BY_ID.get(part.definitionId) : null;
        if (def) names.push(def.name);
    }
    return names.length ? names.join(' · ') : 'NO FIELD HARDWARE';
}

function readinessText(readiness) {
    if (readiness.missing.length) return `MISSING ${readiness.missing.map(slot => labels[slot]).join(' / ')}`;
    if (readiness.destroyed.length) return `DESTROYED ${readiness.destroyed.map(slot => labels[slot]).join(' / ')}`;
    if (readiness.disabled.length) return `DISABLED ${readiness.disabled.map(slot => labels[slot]).join(' / ')}`;
    const failed = readiness.inspection?.checks?.find(check => !check.passes);
    return failed?.reason?.toUpperCase() || 'NOT FIELDABLE';
}

function updateHostilePreview(contract) {
    const header = targetPanel.querySelector('header');
    const copy = targetPanel.querySelector('p');
    if (header) header.textContent = `STAGED HOSTILE · ${contract.name} · ${contract.opponentSerial}`;
    if (copy) copy.textContent = `${contract.kind} · ${contract.role} · RISK ${contract.risk}. Objective: ${contract.objective?.label ?? 'BREAK HOSTILE TEAM'}. ${contract.briefing} Known equipment: ${contract.knownEquipment.join(' · ')}.`;
    targetToggle.textContent = `HOSTILE · ${contract.name}${loadSortieAssignment(sessionStorageRef)?.phase === 'pending' ? ' · STAGED' : ''}`;
    targetToggle.title = `${contract.name} · ${contract.kind} · ₡${contract.payout}`;
}

function restoreLoadedHostilePreview() {
    updateHostilePreview(selectedContract(sessionStorageRef, null, loadCampaign()));
}

function patchCampaignNodes() {
    const assignment = loadSortieAssignment(sessionStorageRef);
    for (const button of inspectionPanel.querySelectorAll('.campaign-node')) {
        const locked = button.classList.contains('locked');
        // k.3n disabled the already-loaded contract because clicking it used to mean
        // reloading. q.1 needs every available job to be stageable, including a replay.
        button.disabled = locked;
        button.classList.toggle('sortie-pending', assignment?.phase === 'pending' && button.dataset.node === assignment.contractId);
        if (assignment?.phase === 'pending' && button.dataset.node === assignment.contractId)
            button.setAttribute('aria-pressed', 'true');
    }
}

function machineCard(stable, rig, assignment) {
    const readiness = rigFieldability(stable, rig.id);
    const health = rigHealth(stable, rig);
    const selectable = rig.commissioned && readiness.fieldable;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sortie-rig-card${assignment?.rigId === rig.id ? ' assigned' : ''}${selectable ? '' : ' blocked'}`;
    button.disabled = !selectable || assignment?.phase !== 'pending';
    button.dataset.rigId = rig.id;
    button.setAttribute('aria-pressed', String(assignment?.rigId === rig.id));

    const top = document.createElement('div'); top.className = 'sortie-rig-top';
    const name = document.createElement('strong'); name.textContent = rig.commissioned ? rigLabel(rig).toUpperCase() : `RIG ${String(rig.bay).padStart(2, '0')}`;
    const state = document.createElement('b');
    state.textContent = rig.commissioned ? (readiness.fieldable ? health.label : 'BLOCKED') : (Object.keys(rig.installed).length ? 'UNCOMMISSIONED' : 'EMPTY');
    top.append(name, state);

    const hardware = document.createElement('span'); hardware.textContent = definingHardware(stable, rig);
    const metrics = document.createElement('small');
    const inspection = readiness.inspection;
    metrics.textContent = inspection
        ? `${inspection.massKg.toLocaleString()} kg · ${inspection.powerUsedKw}/${inspection.powerAvailableKw} kW · ${Math.round(health.ratio * 100)}% LOWEST`
        : 'NO COMPLETE ASSEMBLY';
    const career = document.createElement('small');
    career.textContent = `${rig.career.deployments} DEPLOYMENTS · ${rig.career.roundWins}-${rig.career.roundLosses}${selectable ? '' : ` · ${readinessText(readiness)}`}`;
    button.append(top, hardware, metrics, career);

    button.addEventListener('click', () => {
        const result = assignRigToSortie(sessionStorageRef, rig.id, rigLabel(rig));
        if (!result.ok) { announce(result.reason, true); return; }
        announce(`${rigLabel(rig).toUpperCase()} ASSIGNED · PRESS DEPLOY TO COMMIT`);
        renderAssignmentPanel();
    });
    return button;
}

function renderAssignmentPanel() {
    inspectionPanel.querySelector(':scope > .sortie-assignment')?.remove();
    patchCampaignNodes();
    const campaignBoard = inspectionPanel.querySelector(':scope > .campaign-board');
    if (!campaignBoard) return;

    const assignment = loadSortieAssignment(sessionStorageRef);
    const panel = document.createElement('section');
    panel.className = 'sortie-assignment';
    panel.setAttribute('aria-label', 'Sortie machine assignment');

    const head = document.createElement('div'); head.className = 'sortie-assignment-head';
    const title = document.createElement('strong'); title.textContent = 'ASSIGN MACHINE';
    const state = document.createElement('span');
    state.textContent = !assignment ? 'NO JOB STAGED' : assignment.phase === 'pending' ? 'STAGED' : assignment.phase === 'launching' ? 'COMMITTING' : 'DEPLOYED';
    head.append(title, state); panel.append(head);

    if (!assignment) {
        const empty = document.createElement('p');
        empty.textContent = 'Select any available job above, then choose which commissioned machine will take it.';
        panel.append(empty);
        campaignBoard.after(panel);
        restoreLoadedHostilePreview();
        return;
    }

    const contract = contractById(assignment.contractId);
    const job = document.createElement('div'); job.className = 'sortie-job';
    const jobName = document.createElement('strong'); jobName.textContent = `${contract.name} · ₡${contract.payout}`;
    const jobMeta = document.createElement('small'); jobMeta.textContent = `${contract.objective?.label ?? 'ELIMINATION'} · RISK ${contract.risk} · ${contract.salvageHint}`;
    job.append(jobName, jobMeta); panel.append(job);
    updateHostilePreview(contract);

    const stable = loadStable(localStorageRef).stable;
    const grid = document.createElement('div'); grid.className = 'sortie-rig-grid';
    for (const rig of stable.rigs) grid.append(machineCard(stable, rig, assignment));
    panel.append(grid);

    const footer = document.createElement('div'); footer.className = 'sortie-assignment-footer';
    const cue = document.createElement('span');
    if (assignment.phase === 'pending')
        cue.textContent = assignment.rigId ? `${assignment.rigName || assignment.rigId} READY · DEPLOY COMMITS JOB + MACHINE` : 'CHOOSE ONE FIELDABLE MACHINE';
    else if (assignment.phase === 'launching') cue.textContent = 'PROJECTING ASSIGNED MACHINE INTO THE LIVE BAY…';
    else cue.textContent = `${assignment.rigName || assignment.rigId} COMMITTED TO ${contract.name}`;
    footer.append(cue);
    if (assignment.phase === 'pending') {
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.textContent = 'CANCEL ASSIGNMENT';
        cancel.addEventListener('click', () => {
            const result = cancelSortieAssignment(sessionStorageRef);
            if (!result.ok) { announce(result.reason, true); return; }
            announce('SORTIE ASSIGNMENT RELEASED');
            restoreLoadedHostilePreview();
            renderAssignmentPanel();
        });
        footer.append(cancel);
    }
    panel.append(footer);
    campaignBoard.after(panel);
}

// Capture campaign job clicks before k.3n's original click handler can immediately
// reload the page. The job becomes staged intent instead of a side effect.
document.addEventListener('click', event => {
    const button = event.target.closest('.campaign-node');
    if (!button || !inspectionPanel.contains(button) || button.classList.contains('locked')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const contract = contractById(button.dataset.node);
    const result = beginSortieAssignment(sessionStorageRef, contract.id);
    if (!result.ok) { announce(result.reason, true); return; }
    announce(`JOB STAGED · ${contract.name} · ASSIGN MACHINE`);
    renderAssignmentPanel();
}, true);

// DEPLOY is the only commit point. Until this capture handler succeeds, neither the
// live v8 machine projection nor the selected combat contract is changed.
assemblyToggle.addEventListener('click', event => {
    if (!document.body.classList.contains('inspecting')) return; // GARAGE while in combat remains the original behavior.
    const assignment = loadSortieAssignment(sessionStorageRef);
    if (assignment?.phase === 'deployed') return; // programmatic post-reload launch reaches main.js.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!assignment) { announce('SELECT A JOB · THEN ASSIGN A MACHINE', true); return; }
    if (assignment.phase !== 'pending') { announce('SORTIE COMMIT IN PROGRESS', true); return; }
    if (!assignmentReady(assignment)) { announce('ASSIGN A FIELDABLE MACHINE BEFORE DEPLOYING', true); return; }

    const loaded = loadStable(localStorageRef);
    const rig = rigById(loaded.stable, assignment.rigId);
    const readiness = rigFieldability(loaded.stable, assignment.rigId);
    if (!rig?.commissioned || !readiness.fieldable) {
        announce(rig ? `NOT READY · ${readinessText(readiness)}` : 'ASSIGNED MACHINE NO LONGER EXISTS', true);
        renderAssignmentPanel();
        return;
    }
    const campaign = loadCampaign();
    const activated = activateRig(localStorageRef, loaded.stable, rig.id);
    if (!activated.ok) { announce(activated.reason, true); return; }
    const contract = selectContract(assignment.contractId, sessionStorageRef, null, campaign);
    if (!contract.ok) { announce(contract.reason, true); return; }
    const launching = markSortieLaunching(sessionStorageRef, rigLabel(rig));
    if (!launching.ok) { announce(launching.reason, true); return; }
    announce(`${rigLabel(rig).toUpperCase()} COMMITTED · ${contract.contract.name.toUpperCase()}`);
    window.location.reload();
}, true);

function tryAutoLaunchCommittedSortie() {
    const assignment = loadSortieAssignment(sessionStorageRef);
    if (assignment?.phase !== 'launching') return;
    const loaded = loadStable(localStorageRef);
    const active = rigById(loaded.stable, loaded.stable.activeRigId);
    const contract = selectedContract(sessionStorageRef, null, loadCampaign());
    const readiness = rigFieldability(loaded.stable, assignment.rigId);
    if (!active || active.id !== assignment.rigId || contract.id !== assignment.contractId || !readiness.fieldable) {
        clearSortieAssignment(sessionStorageRef);
        announce('SORTIE COMMIT COULD NOT BE VERIFIED · ASSIGN AGAIN', true);
        renderAssignmentPanel();
        return;
    }
    const deployed = markSortieDeployed(sessionStorageRef);
    if (!deployed.ok) {
        clearSortieAssignment(sessionStorageRef);
        announce(deployed.reason, true);
        renderAssignmentPanel();
        return;
    }
    renderAssignmentPanel();
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        assemblyToggle.click();
        // If main rejects the combat transition for a deeper live-damage reason,
        // release the stale assignment instead of trapping the garage in COMMITTED.
        window.requestAnimationFrame(() => {
            if (document.body.classList.contains('inspecting')) {
                clearSortieAssignment(sessionStorageRef);
                announce('DEPLOYMENT BLOCKED · MACHINE REQUIRES SERVICE', true);
                renderAssignmentPanel();
            }
        });
    }));
}

function appendResolvedMachineRow() {
    if (!resolvedAssignment || !debriefLines.children.length || debriefLines.querySelector('.sortie-machine-row')) return;
    const row = document.createElement('div'); row.className = 'debrief-row progression sortie-machine-row';
    const label = document.createElement('span'); label.textContent = 'ASSIGNED MACHINE';
    const value = document.createElement('strong'); value.textContent = `${resolvedAssignment.rigName || resolvedAssignment.rigId} · ${resolvedAssignment.rigId.toUpperCase()}`;
    row.append(label, value);
    debriefLines.prepend(row);
}

// The base debrief announces completion explicitly. Observing the result-row
// subtree made legacy and BO3 adapters rebuild one another's content while the
// player was tapping the report.
document.addEventListener('m3ch4:debrief-opened', appendResolvedMachineRow);

subscribeBoutResult(result => {
    const assignment = loadSortieAssignment(sessionStorageRef);
    if (!assignment || assignment.phase !== 'deployed') return;
    // StableUI records the deployment on the active rig. q.1 guarantees the active
    // rig is the committed id for the entire sortie; retain that identity for debrief.
    const stable = loadStable(localStorageRef).stable;
    if (stable.activeRigId !== assignment.rigId) {
        announce('ASSIGNMENT IDENTITY MISMATCH · CAREER RECORD NEEDS REVIEW', true);
        return;
    }
    resolvedAssignment = { ...assignment, victory: !!result?.victory };
    try { result.assignment = { ...resolvedAssignment }; } catch { /* result identity is still retained locally */ }
    clearSortieAssignment(sessionStorageRef);
    renderAssignmentPanel();
    appendResolvedMachineRow();
});

renderAssignmentPanel();
tryAutoLaunchCommittedSortie();
