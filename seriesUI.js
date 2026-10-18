/** k.3q.2 — BO3 garage/pit adapter.
 *
 * q.3q.1 remains the machine-assignment authority. This layer locks the contract and
 * service bay between rounds, turns each fresh q.1 assignment into the next BO3 round,
 * and presents round score without exposing contract rewards/salvage early.
 */
import { contractById } from './contracts.js';
import { subscribeBoutResult, subscribeRoundResult } from './boutSession.js';
import { loadStable, rigById, rigFieldability } from './stable.js';
import { bayHealth, SLOT_LABELS } from './garageBay.js';
import {
    beginSortieAssignment, clearSortieAssignment, loadSortieAssignment,
} from './sortieAssignment.js';
import {
    beginSeriesRound, clearSeries, loadSeries, startSeries,
} from './series.js';

const inspectionPanel = document.querySelector('#inspection-panel');
const fieldStatus = document.querySelector('#field-status');
const assemblyToggle = document.querySelector('#assembly-toggle');
const debriefSheet = document.querySelector('#sortie-debrief');
const debriefTitle = document.querySelector('#debrief-title');
const debriefLines = document.querySelector('#debrief-lines');
const debriefGarage = document.querySelector('#debrief-garage');
const sortieOutroTitle = document.querySelector('#sortie-outro-title');
const sortieOutroReason = document.querySelector('#sortie-outro-reason');
if (!inspectionPanel || !fieldStatus || !assemblyToggle || !debriefSheet || !debriefTitle || !debriefLines || !debriefGarage)
    throw new Error('BO3 series UI needs the existing garage / debrief surfaces.');

const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.href = './seriesStyles.css?v=k3s2';
document.head.append(styleLink);

let localStorageRef = null;
let sessionStorageRef = null;
try { localStorageRef = window.localStorage; } catch { /* persistence modules surface unavailable storage */ }
try { sessionStorageRef = window.sessionStorage; } catch { /* q.1 assignment UI surfaces unavailable storage */ }
let latestRound = null;
// The debrief is opened by one explicit event from main. Do not observe the
// report's descendants: rewriting rows from a subtree observer recursively
// schedules another render and prevents reliable touch/click interaction.
let debriefRenderQueued = false;
const hud = document.createElement('section');
hud.id = 'bo3-combat-hud';
hud.setAttribute('aria-label','Best of three round and match score');
hud.setAttribute('aria-live','polite');
document.body.append(hud);
function renderCombatSeries() {
    const match = activeSeries();
    const visible = match?.phase === 'round_active';
    hud.classList.toggle('hidden', !visible);
    document.body.classList.toggle('bo3-round-active',!!visible);
    if (!visible) return;
    hud.replaceChildren();
    const contract = document.createElement('strong');
    contract.textContent = contractById(match.contractId).name.toUpperCase() + ' · BEST OF THREE';
    const score = document.createElement('span');
    score.textContent = 'ROUND ' + match.roundNumber + ' / 3 · YOU ' +
        match.playerWins + ' — ' + match.enemyWins + ' HOSTILE';
    hud.append(contract,score);
}


const rigLabel = rig => rig?.name || `RIG ${String(rig?.bay ?? 0).padStart(2, '0')}`;

function announce(message, blocked = false) {
    fieldStatus.dataset.message = message;
    fieldStatus.textContent = message;
    fieldStatus.classList.add('message');
    fieldStatus.classList.toggle('blocked', blocked);
    fieldStatus.classList.toggle('ready', !blocked);
}

function activeSeries() {
    return loadSeries(localStorageRef);
}

function intermissionSeries() {
    const series = activeSeries();
    return series?.phase === 'intermission' ? series : null;
}

function lastAssignmentId(series) {
    return series?.rounds?.length ? series.rounds[series.rounds.length - 1].assignmentId : null;
}

/** q.1 changes launching -> deployed synchronously, then waits two animation frames
 * before entering combat. Because this module loads immediately afterward, the BO3
 * series can bind that exact committed assignment before the fight starts. */
function bindCommittedAssignment() {
    const assignment = loadSortieAssignment(sessionStorageRef);
    if (assignment?.phase !== 'deployed' || !assignment.rigId) return { advanced: false, series: activeSeries() };
    const series = activeSeries();
    if (!series || series.phase === 'complete' || series.contractId !== assignment.contractId) {
        const started = startSeries(
            localStorageRef, assignment.contractId, assignment.rigId, assignment.rigName, assignment.id,
        );
        if (!started.ok) { announce(started.reason, true); return { advanced: false, series }; }
        return { advanced: true, series: started.series };
    }
    if (series.phase === 'intermission') {
        // The deployed assignment from the round that just ended remains in session
        // storage until the player explicitly returns to the pit. Never mistake it for
        // a newly committed round.
        if (assignment.id === lastAssignmentId(series)) return { advanced: false, series };
        const next = beginSeriesRound(
            localStorageRef, assignment.rigId, assignment.rigName, assignment.id,
        );
        if (!next.ok) { announce(next.reason, true); return { advanced: false, series }; }
        return { advanced: true, series: next.series };
    }
    return { advanced: false, series };
}

function scheduleActiveRoundResume(binding) {
    const assignment = loadSortieAssignment(sessionStorageRef);
    const series = binding.series;
    if (binding.advanced || series?.phase !== 'round_active' || assignment?.phase !== 'deployed') return;
    if (series.currentAssignmentId !== assignment.id || series.currentRigId !== assignment.rigId) return;
    // q.1 schedules the initial/next-round launch when it just promoted LAUNCHING to
    // DEPLOYED. If both were already deployed before this page load, this is an
    // ordinary reload of a committed round; relaunch the same persistent machine.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (document.body.classList.contains('inspecting')) assemblyToggle.click();
    }));
}

function pitBanner(series) {
    const contract = contractById(series.contractId);
    const banner = document.createElement('section');
    banner.className = 'bo3-series-banner';
    banner.setAttribute('aria-label', 'Best of three contract status');
    const left = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `CONTRACT IN PROGRESS · ${contract.name.toUpperCase()}`;
    const meta = document.createElement('small');
    meta.textContent = `BEST OF THREE · ROUND ${series.roundNumber} · FIRST TO TWO`;
    left.append(title, meta);
    const score = document.createElement('div'); score.className = 'bo3-score';
    score.innerHTML = `<span>YOU</span><b>${series.playerWins}</b><i>—</i><b>${series.enemyWins}</b><span>HOSTILE</span>`;
    const note = document.createElement('p');
    note.textContent = 'PIT LOCKED · CHOOSE ANY COMMISSIONED FIELDABLE MACHINE BELOW. DAMAGE PERSISTS; SERVICE AND PART SWAPS RESUME AFTER THE CONTRACT.';
    banner.append(left, score, note);
    return banner;
}

function applyPitState() {
    const existingBanner = inspectionPanel.querySelector(':scope > .bo3-series-banner');
    const series = intermissionSeries();
    document.body.classList.toggle('bo3-pit-locked', !!series);
    if (!series) {
        existingBanner?.remove();
        return;
    }

    const campaign = inspectionPanel.querySelector(':scope > .campaign-board');
    if (campaign) {
        campaign.classList.add('bo3-contract-locked');
        campaign.querySelectorAll('.campaign-node').forEach(button => {
            button.disabled = true;
            button.title = 'Contract already in progress';
        });
        if (!existingBanner) campaign.after(pitBanner(series));
    }
    const assignment = inspectionPanel.querySelector(':scope > .sortie-assignment');
    if (assignment) {
        assignment.classList.add('bo3-round-assignment');
        const heading = assignment.querySelector('.sortie-assignment-head strong');
        const headingText = `CHOOSE ROUND ${series.roundNumber} MACHINE`;
        if (heading && heading.textContent !== headingText) heading.textContent = headingText;
        const cancel = [...assignment.querySelectorAll('button')].find(button => /CANCEL ASSIGNMENT|CONTRACT LOCKED/i.test(button.textContent || ''));
        if (cancel) {
            cancel.disabled = true;
            if (cancel.textContent !== 'CONTRACT LOCKED') cancel.textContent = 'CONTRACT LOCKED';
        }
    }
}

function readinessText(stable, rigId) {
    const rig = rigById(stable, rigId);
    const readiness = rigFieldability(stable, rigId);
    if (!rig) return 'UNKNOWN MACHINE';
    if (readiness.fieldable) return 'FIELDABLE';
    if (readiness.destroyed.length) return `OUT · DESTROYED ${readiness.destroyed.join(' / ').toUpperCase()}`;
    if (readiness.disabled.length) return `OUT · DISABLED ${readiness.disabled.join(' / ').toUpperCase()}`;
    if (readiness.missing.length) return `OUT · MISSING ${readiness.missing.join(' / ').toUpperCase()}`;
    return 'OUT · NOT FIELDABLE';
}

function appendDebriefRow(label, value, kind = '') {
    const row = document.createElement('div');
    row.className = `debrief-row ${kind}`.trim();
    const name = document.createElement('span'); name.textContent = label;
    const amount = document.createElement('strong'); amount.textContent = value;
    row.append(name, amount); debriefLines.append(row);
}

function renderRoundIntermission(series, round) {
    if (!round || series.phase !== 'intermission') return;
    const stable = loadStable(localStorageRef).stable;
    const rig = rigById(stable, round.rigId);
    debriefSheet.classList.add('bo3-round-debrief');
    debriefTitle.textContent = `ROUND ${round.round} ${round.victory ? 'WON' : 'LOST'}`;
    debriefLines.replaceChildren();
    appendDebriefRow('ROUND RESULT', round.victory ? 'VICTORY' : 'DEFEAT', 'primary');
    appendDebriefRow('MATCH', `YOU ${series.playerWins} — ${series.enemyWins} HOSTILE`, 'primary');
    appendDebriefRow('ASSIGNED MACHINE', `${round.rigName || rigLabel(rig)} · ${round.rigId.toUpperCase()}`, 'progression');
    appendDebriefRow('RETURNED CONDITION', readinessText(stable, round.rigId), rigFieldability(stable, round.rigId).fieldable ? '' : 'repair');
    for (const part of bayHealth(stable, round.rigId)) {
        const percent = value => Math.round(Math.max(0,Math.min(1,value))*100) + '%';
        const reading = part.serial
            ? 'INT ' + percent(part.condition) + ' · ARM ' + percent(part.armorRatio) +
                ' · WEAR ' + percent(part.wear)
            : 'NOT INSTALLED';
        appendDebriefRow(SLOT_LABELS[part.slot] + ' · ' + part.label,
            reading, part.destroyed || part.condition <= .001 ? 'repair'
                : Math.min(part.condition, part.armorRatio) < .78 ? 'damage' : '');
    }
    appendDebriefRow('CONTRACT SETTLEMENT', 'DEFERRED · SERIES IN PROGRESS');
    debriefGarage.textContent = 'CONTINUE TO PIT · ROUND ' + series.roundNumber;
}

function decorateTerminalDebrief(series) {
    if (!series || series.phase !== 'complete') return;
    debriefSheet.classList.remove('bo3-round-debrief');
    debriefGarage.textContent = 'RETURN TO GARAGE';
    if (series.completionReason === 'no-fieldable-machines') {
        debriefTitle.textContent = 'CONTRACT LOST';
        const first = debriefLines.querySelector('.debrief-row strong');
        if (first) first.textContent = 'STABLE UNABLE TO CONTINUE';
    }
    if (debriefLines.querySelector('.bo3-terminal-row')) return;
    const match = document.createElement('div');
    match.className = 'debrief-row progression bo3-terminal-row';
    const label = document.createElement('span'); label.textContent = 'BEST OF THREE';
    const value = document.createElement('strong'); value.textContent = `YOU ${series.playerWins} — ${series.enemyWins} HOSTILE · ${series.rounds.length} ROUNDS`;
    match.append(label, value);
    debriefLines.append(match);
    const machines = document.createElement('div');
    machines.className = 'debrief-row progression bo3-terminal-row';
    const machineLabel = document.createElement('span'); machineLabel.textContent = 'MACHINES DEPLOYED';
    const stable = loadStable(localStorageRef).stable;
    const names = series.participatingRigIds.map(id => rigLabel(rigById(stable, id))).join(' · ');
    const machineValue = document.createElement('strong'); machineValue.textContent = names || '—';
    machines.append(machineLabel, machineValue);
    debriefLines.append(machines);
}

function renderSeriesDebrief() {
    if (debriefSheet.classList.contains('hidden')) return;
    const series = activeSeries();
    if (!series) return;
    const round = latestRound?.round ?? series.rounds[series.rounds.length - 1] ?? null;
    if (series.phase === 'intermission') renderRoundIntermission(series, round);
    else if (series.phase === 'complete') decorateTerminalDebrief(series);
}

function queueDebriefRender() {
    if (debriefRenderQueued) return;
    debriefRenderQueued = true;
    window.requestAnimationFrame(() => {
        debriefRenderQueued = false;
        renderSeriesDebrief();
    });
}

subscribeRoundResult(result => {
    if (!result?.series) return;
    latestRound = result;
    if (result.series.completionReason === 'no-fieldable-machines') {
        window.requestAnimationFrame(() => {
            if (sortieOutroTitle) sortieOutroTitle.textContent = 'STABLE UNABLE TO CONTINUE';
            if (sortieOutroReason) sortieOutroReason.textContent = 'NO COMMISSIONED FIELDABLE MACHINES REMAIN';
        });
    }
    queueDebriefRender();
    renderCombatSeries();
});

subscribeBoutResult(result => {
    if (!result?.series) return;
    queueDebriefRender();
    renderCombatSeries();
});

// main.js emits this once the result rows exist. Neither the BO3 decorator
// nor the salvage gallery observes its own DOM mutations.
document.addEventListener('m3ch4:debrief-opened', () => {
    renderSeriesDebrief();
    renderCombatSeries();
});

// Round intermission returns to a locked pit, not the unrestricted garage. A fresh
// q.1 pending assignment is created for the same contract and only its rig is mutable.
document.addEventListener('click', event => {
    const button = event.target.closest('#debrief-garage');
    if (!button) return;
    const series = activeSeries();
    if (series?.phase === 'intermission') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const staged = beginSortieAssignment(sessionStorageRef, series.contractId);
        if (!staged.ok) { announce(staged.reason, true); return; }
        window.location.reload();
        return;
    }
    if (series?.phase === 'complete') {
        clearSeries(localStorageRef);
        clearSortieAssignment(sessionStorageRef);
    }
}, true);

// During the pit interval the only allowed operation is choosing the next q.1 machine.
// Keep the physical stable visible for context, but reject service, mounting, naming,
// commissioning and manual active-bay switching until the contract is settled.
function blockPitEdit(event) {
    if (!intermissionSeries()) return;
    const control = event.target.closest('#garage-context button, #garage-context select, #garage-context input');
    if (!control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    announce('CONTRACT IN PROGRESS · PIT SERVICE LOCKED · CHOOSE NEXT MACHINE', true);
}
document.addEventListener('click', blockPitEdit, true);
document.addEventListener('change', blockPitEdit, true);

// Clear series state whenever the player deliberately replaces the campaign/save.
document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const confirmedWipe = button.id === 'wipe-save' && button.getAttribute('aria-pressed') === 'true';
    const campaignRestart = button.classList.contains('campaign-restart');
    if (confirmedWipe || campaignRestart) clearSeries(localStorageRef);
}, true);

const pitObserver = new MutationObserver(applyPitState);
pitObserver.observe(inspectionPanel, { childList: true, subtree: true });

const binding = bindCommittedAssignment();
applyPitState();
renderCombatSeries();
scheduleActiveRoundResume(binding);
