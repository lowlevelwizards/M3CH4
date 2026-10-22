/** k.3q.2 — BO3 garage/pit adapter.
 *
 * q.3q.1 remains the machine-assignment authority. This layer locks the contract and
 * service bay between rounds, turns each fresh q.1 assignment into the next BO3 round,
 * and presents round score without exposing contract rewards/salvage early.
 */
import { contractById } from './contracts.js';
import { stationLabel } from './uiLanguage.js';
import { createModuleIcon } from './moduleIcons.js';
import { subscribeBoutResult, subscribeRoundResult } from './boutSession.js';
import { loadStable, rigById, rigFieldability } from './stable.js';
import { bayHealth, bayModuleQuote, SLOT_LABELS } from './garageBay.js';

import { activePlayerArena } from './scene.js';
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
styleLink.href = './seriesStyles.css?v=k4q';
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
    contract.textContent = 'ROUND '+match.roundNumber;
    const score = document.createElement('span');
    score.textContent = match.playerWins+' – '+match.enemyWins;
    hud.setAttribute('aria-label',contractById(match.contractId).name+' best of three, round '+match.roundNumber+
        ', your score '+match.playerWins+', opponents '+match.enemyWins);
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
    note.textContent = 'PIT · 4 WORK UNITS';
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

function renderRoundIntermission(series, round) {
    if (!round || series.phase !== 'intermission') return;
    const stable=loadStable(localStorageRef).stable;
    const rig=rigById(stable,round.rigId);
    const health=bayHealth(stable,round.rigId);
    const disabled=health.filter(p=>p.destroyed||p.condition<=.001);
    const critical=health.filter(p=>!p.destroyed&&p.condition>.001&&Math.min(p.condition,p.armorRatio)<.38);
    debriefSheet.classList.add('bo3-round-debrief','k4n-condition-debrief');
    debriefTitle.textContent=round.victory?'VICTORY':'DEFEAT';
    const resultPage=debriefSheet.querySelector('.debrief-page-result .debrief-page-title');
    if(resultPage)resultPage.textContent='ROUND '+round.round+' / 3';
    debriefLines.replaceChildren();
    debriefLines.className='debrief-lines k4n-report';
    const make=(tag,className,content)=>{
        const node=document.createElement(tag);
        if(className)node.className=className;
        if(content!==undefined)node.textContent=String(content);
        return node;
    };
    const overview=make('div','k4n-overview');
    const name=make('strong','',round.rigName||rigLabel(rig));
    const match=make('span','k4n-match','MATCH '+series.playerWins+' – '+series.enemyWins);
    overview.append(name,match);
    const flags=make('div','k4n-return');
    const summary=disabled.length
        ? disabled.length+' DISABLED'
        : critical.length?critical.length+' CRITICAL':'FIELDABLE';
    flags.append(make('span','',summary),make('small','',disabled.length?'PIT CREW AVAILABLE':'RETURNED TO BAY'));
    const parts=make('div','k4n-parts');
    const category=Object.fromEntries(['structure','mobility','power','command','combat'].map(slot=>[slot,stationLabel(slot)]));
    const statusOf=p=>!p.serial?'EMPTY':p.destroyed?'DESTROYED':
        p.condition<=.001?'DISABLED':Math.min(p.condition,p.armorRatio)<.38?'CRITICAL':
        Math.min(p.condition,p.armorRatio)<.995?'WORN':'OK';
    for(const p of health){
        const status=statusOf(p);
        const tile=make('div','k4n-part k4n-'+status.toLowerCase());
        const title=make('strong','',category[p.slot]);
        title.prepend(createModuleIcon(p.slot));
        const picture=make('div','k4n-part-art');
        if(p.part?.definitionId){
            const url=activePlayerArena()?.arena?.partThumbnailDataUrl?.(p.part.definitionId,{
                condition:p.condition,destroyed:p.destroyed,paint:p.part.paint
            });
            if(url){const img=document.createElement('img');img.src=url;img.alt='';img.decoding='async';picture.append(img);}
        }
        if(!picture.childElementCount)picture.append(make('span','k4n-empty-art','—'));
        const meters=make('div','k4n-meters');
        for(const [kind,value] of [['core',p.condition],['armor',p.armorRatio]]){
            const track=make('div','k4n-meter '+kind);
            const fill=make('i');
            fill.style.width=Math.round(100*Math.max(0,Math.min(1,value||0)))+'%';
            track.append(fill);meters.append(track);
        }
        const statusEl=make('small','k4n-status',status);
        const internal=Math.round(p.condition*100),armor=Math.round(p.armorRatio*100);
        tile.setAttribute('aria-label',category[p.slot]+' · '+status+' · integrity '+internal+
            ' percent, armor '+armor+' percent');
        tile.title=(p.serial||'NOT INSTALLED')+' · INT '+internal+'% · ARM '+armor+
            '% · WEAR '+Math.round(p.wear*100)+'%';
        tile.append(title,picture,meters,statusEl);
        parts.append(tile);
    }
    const legend=make('div','k4n-legend');
    legend.append(make('span','','● INTEGRITY'),make('span','','● ARMOR'));
    debriefLines.append(overview,flags,parts,legend);
    debriefGarage.textContent='CONTINUE TO PIT · ROUND '+series.roundNumber;
}
function decorateTerminalDebrief(series) {
    if (!series || series.phase !== 'complete') return;
    debriefSheet.classList.remove('bo3-round-debrief','k4n-condition-debrief');
    debriefLines.className='debrief-lines';
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
