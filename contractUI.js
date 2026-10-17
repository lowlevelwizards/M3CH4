/** k.3n.0 — tiny campaign board on the garage home surface.
 *
 * The garage is the home screen. This adapter renders an Advance-Wars-like compact
 * operation board, records bout outcomes into campaign state, mirrors the original
 * three contract clears for rollback compatibility, and leaves combat/inventory/
 * economy authority in their existing modules.
 */
import { CONTRACTS, contractById, selectContract, selectedContract } from './contracts.js';
import {
    CAMPAIGN_NODES, availableCampaignNodes, campaignNode, campaignSummary,
    loadCampaign, recordCampaignSalvage, recordCampaignSortie, resetCampaign, storeCampaign,
} from './campaign.js';
import {
    loadProgression, recordContractClear, storeProgression,
} from './progression.js';
import { latestBoutResult } from './boutSession.js';

const inspectionPanel = document.querySelector('#inspection-panel');
const garageRail = inspectionPanel?.querySelector('.garage-rail');
const targetPanel = document.querySelector('#target-panel');
const targetToggle = document.querySelector('#target-toggle');
const fieldStatus = document.querySelector('#field-status');
const debriefSheet = document.querySelector('#sortie-debrief');
const debriefLines = document.querySelector('#debrief-lines');

if (!inspectionPanel || !garageRail || !targetPanel || !targetToggle || !debriefSheet || !debriefLines)
    throw new Error('Campaign board needs the existing garage, hostile and debrief surfaces.');

const byId = new Map(CONTRACTS.map(contract => [contract.id, contract]));
let lastHandledResult = null;

function injectStyles() {
    if (document.querySelector('#campaign-board-styles')) return;
    const style = document.createElement('style');
    style.id = 'campaign-board-styles';
    style.textContent = `
body.inspecting .inspection-panel:not(.expanded){width:min(344px,45vw)}
.campaign-board{display:none;min-width:0;flex:1 1 auto;height:100%;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:9px 10px 12px;background:rgba(14,20,18,.96);border:1px solid #71866d73;border-left:0;box-shadow:10px 8px 36px #0009;color:#d7d0bd;font:7px/1.3 ui-monospace,monospace}
body.inspecting .inspection-panel:not(.expanded)>.campaign-board{display:block}
.campaign-head{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;padding-bottom:7px;margin-bottom:6px;border-bottom:1px solid #8d784743}.campaign-head strong{display:block;color:#d8b56c;font-size:11px;letter-spacing:.12em}.campaign-head small{display:block;margin-top:2px;color:#809387;font-size:6px;letter-spacing:.08em}.campaign-head span{color:#9baa9e;letter-spacing:.08em;font-size:6.5px;text-align:right}
.campaign-intro{margin:0 0 7px;color:#9baa9e;font:7px/1.35 ui-monospace,monospace}.campaign-map{position:relative;display:grid;grid-template-columns:1fr 1fr;grid-template-areas:'yard yard' 'recovery cutter' 'mule mule' 'final final';gap:7px 6px;padding:4px 0}.campaign-map:before{content:'';position:absolute;left:50%;top:17%;bottom:11%;width:1px;background:#8d784744;pointer-events:none}.campaign-map:after{content:'';position:absolute;left:24%;right:24%;top:31%;height:1px;background:#8d784744;pointer-events:none}
.campaign-node{position:relative;z-index:1;min-width:0;min-height:60px;padding:6px 7px;border:1px solid #465149;background:#1d2420;color:#bfc8bb;text-align:left;font:700 6.4px/1.2 ui-monospace,monospace;touch-action:manipulation}.campaign-node[data-node="yard-dog"]{grid-area:yard}.campaign-node[data-node="recovery-run"]{grid-area:recovery}.campaign-node[data-node="cutter"]{grid-area:cutter}.campaign-node[data-node="mule"]{grid-area:mule}.campaign-node[data-node="circuit-final"]{grid-area:final}.campaign-node strong,.campaign-node span,.campaign-node small,.campaign-node b{display:block}.campaign-node .node-stage{position:absolute;top:5px;right:6px;color:#728277;font-size:5.5px}.campaign-node strong{padding-right:24px;color:#e0c17e;font-size:9px;letter-spacing:.07em}.campaign-node .node-role{margin-top:2px;color:#93aa99}.campaign-node small{margin-top:3px;color:#899188;font-size:5.6px}.campaign-node b{margin-top:4px;color:#d7d7c6;font-size:6.5px}.campaign-node.selected{border-color:#d0a85f;background:#2a2a20;box-shadow:inset 0 0 0 1px #816d42}.campaign-node.cleared:not(.selected){border-color:#617866}.campaign-node.recovery{border-style:dashed}.campaign-node.final{border-color:#8b7243}.campaign-node.locked{border-color:#343c37;background:#151a17;color:#667168}.campaign-node.locked strong,.campaign-node.locked span,.campaign-node.locked small,.campaign-node.locked b{color:#667168}.campaign-node:disabled{opacity:1}.campaign-node.loading{opacity:.52}
.campaign-legend{display:flex;justify-content:space-between;gap:6px;margin:6px 0 0;padding-top:6px;border-top:1px solid #8d784733;color:#7f9185;font-size:5.8px}.campaign-legend b{color:#c4ad78}.campaign-summary{margin-top:8px;padding:8px;border:1px solid #987d45;background:#24231b}.campaign-summary h2{margin:0 0 3px;color:#efc774;font:900 11px/1.1 ui-monospace,monospace;letter-spacing:.08em}.campaign-summary>p{margin:0 0 6px;color:#a9b8aa}.campaign-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.campaign-summary-grid div{padding:5px;border:1px solid #58665a;background:#151b18}.campaign-summary-grid span,.campaign-summary-grid b{display:block}.campaign-summary-grid span{color:#7f9185;font-size:5.5px}.campaign-summary-grid b{margin-top:2px;color:#e4c27a;font-size:9px}.campaign-restart{width:100%;min-height:29px;margin-top:7px;border:1px solid #c29b55;background:#3a301e;color:#ebc779;font:900 7px/1 ui-monospace,monospace;letter-spacing:.08em}.debrief-row.progression strong{color:#f0ca7d}.debrief-row.progression span{color:#9eb6a2}
@media(max-width:730px){body.inspecting .inspection-panel:not(.expanded){width:min(310px,46vw)}.campaign-board{padding:7px}.campaign-node{min-height:54px;padding:5px 6px}.campaign-node strong{font-size:8px}.campaign-node small{font-size:5.2px}.campaign-summary{padding:6px}}
`;
    document.head.append(style);
}

function updateHostileCopy(contract) {
    const header = targetPanel.querySelector('header');
    const copy = targetPanel.querySelector('p');
    if (header) header.textContent = `CONTRACT HOSTILE · ${contract.name} · ${contract.opponentSerial}`;
    if (copy) copy.textContent = `${contract.kind} · ${contract.role} · RISK ${contract.risk}. ${contract.briefing} Known equipment: ${contract.knownEquipment.join(' · ')}.`;
    targetToggle.textContent = `HOSTILE · ${contract.name}`;
    targetToggle.title = `${contract.name} · ${contract.kind} · ₡${contract.payout}`;
}

function announce(contract) {
    let changed = false;
    try {
        changed = window.sessionStorage.getItem('m3ch4-contract-changed') === contract.id;
        if (changed) window.sessionStorage.removeItem('m3ch4-contract-changed');
    } catch { /* optional */ }
    if (!changed || !fieldStatus) return;
    fieldStatus.dataset.message = `JOB SELECTED · ${contract.name} · ₡${contract.payout} · RISK ${contract.risk}`;
    fieldStatus.textContent = fieldStatus.dataset.message;
    fieldStatus.classList.add('message');
    window.setTimeout(() => {
        if (fieldStatus.dataset.message?.startsWith('JOB SELECTED ·')) {
            delete fieldStatus.dataset.message;
            fieldStatus.classList.remove('message');
            fieldStatus.textContent = 'READY';
        }
    }, 3400);
}

function nodeStatus(campaign, node, contract, selected) {
    const available = availableCampaignNodes(campaign).includes(node.id);
    const cleared = campaign.clearedNodes.includes(node.id);
    if (!available) {
        const prereq = node.prereq ? byId.get(node.prereq)?.name : null;
        return { available, cleared, line: prereq ? `LOCKED · CLEAR ${prereq}` : 'LOCKED' };
    }
    if (selected && cleared) return { available, cleared, line: `SELECTED · CLEARED · ₡${contract.payout}` };
    if (selected) return { available, cleared, line: `SELECTED · TAKE JOB · ₡${contract.payout}` };
    if (cleared) return { available, cleared, line: `REPLAY · ₡${contract.payout}` };
    if (node.id === 'recovery-run') return { available, cleared, line: `AVAILABLE · STABILIZE · ₡${contract.payout}` };
    return { available, cleared, line: `NEW · TAKE CONTRACT · ₡${contract.payout}` };
}

function makeNode(campaign, node, active) {
    const contract = contractById(node.id);
    const selected = active.id === node.id;
    const status = nodeStatus(campaign, node, contract, selected);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.node = node.id;
    button.className = `campaign-node${selected ? ' selected' : ''}${status.cleared ? ' cleared' : ''}${!status.available ? ' locked' : ''}${node.lane === 'recovery' ? ' recovery' : ''}${node.lane === 'final' ? ' final' : ''}`;
    button.disabled = selected || !status.available;
    button.setAttribute('aria-pressed', String(selected));

    const stage = document.createElement('span'); stage.className = 'node-stage'; stage.textContent = node.stage;
    const name = document.createElement('strong'); name.textContent = contract.name;
    const role = document.createElement('span'); role.className = 'node-role'; role.textContent = `${contract.kind} · RISK ${contract.risk}`;
    const reward = document.createElement('small'); reward.textContent = `${contract.salvageHint} · ${contract.knownEquipment.join(' · ')}`;
    const line = document.createElement('b'); line.textContent = status.line;
    button.append(stage, name, role, reward, line);

    button.addEventListener('click', () => {
        const result = selectContract(contract.id, undefined, null, campaign);
        if (!result.ok) return;
        button.classList.add('loading');
        line.textContent = 'LOADING JOB…';
        try { window.sessionStorage.setItem('m3ch4-contract-changed', contract.id); }
        catch { /* selection already succeeded */ }
        window.location.reload();
    });
    return button;
}

function appendCompletion(board, campaign) {
    if (campaign.status !== 'complete') return;
    const summary = document.createElement('section'); summary.className = 'campaign-summary';
    const title = document.createElement('h2'); title.textContent = 'SCRAPYARD CIRCUIT CLEARED';
    const copy = document.createElement('p'); copy.textContent = 'The machine in this bay is the result. Keep it, replay jobs, or start another circuit with the same owned rig.';
    const grid = document.createElement('div'); grid.className = 'campaign-summary-grid';
    for (const [label, value] of [
        ['SORTIES', campaign.sorties], ['VICTORIES', campaign.victories], ['DEFEATS', campaign.defeats],
        ['GROSS PAY', `₡${campaign.creditsEarned}`], ['SALVAGE', campaign.salvageRecovered], ['NODES', `${campaign.clearedRequired}/${campaign.requiredTotal}`],
    ]) {
        const cell = document.createElement('div');
        const key = document.createElement('span'); key.textContent = label;
        const amount = document.createElement('b'); amount.textContent = String(value);
        cell.append(key, amount); grid.append(cell);
    }
    const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'campaign-restart'; restart.textContent = 'RUN ANOTHER CIRCUIT · KEEP THIS RIG';
    restart.addEventListener('click', () => {
        const fresh = resetCampaign();
        try { window.sessionStorage.removeItem('m3ch4-contract-changed'); } catch { /* optional */ }
        selectContract('yard-dog', undefined, null, fresh);
        window.location.reload();
    });
    summary.append(title, copy, grid, restart); board.append(summary);
}

function renderBoard() {
    inspectionPanel.querySelector(':scope > .campaign-board')?.remove();
    const campaign = campaignSummary(loadCampaign());
    const active = selectedContract(undefined, null, campaign);
    const board = document.createElement('section');
    board.className = 'campaign-board';
    board.setAttribute('aria-label', 'Scrapyard Circuit operation board');

    const head = document.createElement('div'); head.className = 'campaign-head';
    const identity = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = 'SCRAPYARD CIRCUIT';
    const sub = document.createElement('small'); sub.textContent = 'OPERATION 01 · LOCAL YARD LEAGUE';
    identity.append(title, sub);
    const note = document.createElement('span'); note.textContent = campaign.complete ? 'CIRCUIT CLEARED' : `${campaign.clearedRequired}/${campaign.requiredTotal} MAJOR JOBS`;
    head.append(identity, note);

    const intro = document.createElement('p'); intro.className = 'campaign-intro';
    intro.textContent = campaign.complete
        ? 'Circuit complete. Replays still pay and salvage; starting another circuit keeps your machine and inventory.'
        : 'Choose the next job. Machine damage, repairs, credits and salvaged serials persist between every sortie.';

    const map = document.createElement('div'); map.className = 'campaign-map';
    for (const node of CAMPAIGN_NODES) map.append(makeNode(campaign, node, active));

    const legend = document.createElement('div'); legend.className = 'campaign-legend';
    const left = document.createElement('span'); left.innerHTML = '<b>RECOVERY</b> = OPTIONAL / LOW RISK';
    const right = document.createElement('span'); right.textContent = `${campaign.sorties} SORTIES · ${campaign.defeats} LOSSES`;
    legend.append(left, right);

    board.append(head, intro, map, legend);
    appendCompletion(board, campaign);
    garageRail.after(board);
    updateHostileCopy(active);
    announce(active);
}

function appendProgressRow(label, value) {
    const row = document.createElement('div'); row.className = 'debrief-row progression';
    const name = document.createElement('span'); name.textContent = label;
    const amount = document.createElement('strong'); amount.textContent = value;
    row.append(name, amount); debriefLines.append(row);
}

function mirrorLegacyClear(contractId) {
    if (!['yard-dog', 'cutter', 'mule'].includes(contractId)) return;
    const progression = loadProgression();
    const result = recordContractClear(progression, contractId);
    if (result.firstClear) storeProgression(progression);
}

function recordVisibleOutcome() {
    if (debriefSheet.classList.contains('hidden')) return;
    const bout = latestBoutResult();
    if (!bout || bout === lastHandledResult) return;
    lastHandledResult = bout;

    const before = loadCampaign();
    const contract = selectedContract(undefined, null, before);
    const recorded = recordCampaignSortie(before, {
        nodeId: contract.id,
        victory: !!bout.victory,
        creditsEarned: bout.victory ? contract.payout : 350,
    });
    if (!storeCampaign(recorded.state)) {
        appendProgressRow('CAMPAIGN', 'PROGRESS SAVE UNAVAILABLE');
        return;
    }
    if (bout.victory) mirrorLegacyClear(contract.id);

    if (recorded.firstClear) appendProgressRow('JOB CLEARED', contract.name);
    if (!bout.victory && recorded.newlyAvailable.includes('recovery-run'))
        appendProgressRow('RECOVERY WORK AVAILABLE', 'LOW-RISK YARD CLEANUP');
    const unlocked = recorded.newlyAvailable.filter(id => id !== 'recovery-run');
    if (unlocked.length) appendProgressRow('NEW JOB AVAILABLE', unlocked.map(id => contractById(id).name).join(' · '));
    if (recorded.becameComplete) {
        const summary = campaignSummary(recorded.state);
        appendProgressRow('SCRAPYARD CIRCUIT', `CLEARED · ${summary.victories}W / ${summary.defeats}L / ${summary.sorties} SORTIES`);
    }
    renderBoard();
}

function recordRecoveredPart() {
    const next = recordCampaignSalvage(loadCampaign(), 1);
    storeCampaign(next);
    renderBoard();
}

injectStyles();
renderBoard();
const debriefObserver = new MutationObserver(recordVisibleOutcome);
debriefObserver.observe(debriefSheet, { attributes: true, attributeFilter: ['class'] });
debriefObserver.observe(debriefLines, { childList: true, subtree: true });
document.addEventListener('m3ch4:inventory-changed', recordRecoveredPart);
recordVisibleOutcome();
