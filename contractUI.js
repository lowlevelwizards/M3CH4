/** k.3h.0 touch-friendly contract ladder on the garage home surface.
 *
 * The compact garage still swaps between this home panel and module details. Fresh
 * players see one available fight; first clears unlock the next authored opponent.
 * Existing pre-k.3h saves keep all three fights available. The combat loop itself
 * remains untouched: this adapter observes the existing victory debrief, records a
 * first clear, and annotates that debrief with any newly unlocked contract.
 */
import { CONTRACTS, contractById, selectContract, selectedContract } from './contracts.js';
import {
    circuitSummary, isContractCleared, isContractUnlocked, loadProgression,
    prerequisiteFor, recordContractClear, storeProgression,
} from './progression.js';

const inspectionPanel = document.querySelector('#inspection-panel');
const garageRail = inspectionPanel?.querySelector('.garage-rail');
const targetPanel = document.querySelector('#target-panel');
const targetToggle = document.querySelector('#target-toggle');
const fieldStatus = document.querySelector('#field-status');
const debriefSheet = document.querySelector('#sortie-debrief');
const debriefTitle = document.querySelector('#debrief-title');
const debriefLines = document.querySelector('#debrief-lines');

if (!inspectionPanel || !garageRail || !targetPanel || !targetToggle || !debriefSheet || !debriefTitle || !debriefLines)
    throw new Error('Contract board needs the existing garage, hostile and debrief surfaces.');

function injectStyles() {
    if (document.querySelector('#contract-board-styles')) return;
    const style = document.createElement('style');
    style.id = 'contract-board-styles';
    style.textContent = `
body.inspecting .inspection-panel:not(.expanded){width:min(300px,40vw)}
.contract-board{display:none;min-width:0;flex:1 1 auto;height:100%;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:10px;background:rgba(14,20,18,.95);border:1px solid #71866d73;border-left:0;box-shadow:10px 8px 36px #0009;color:#d7d0bd;font:8px/1.3 ui-monospace,monospace}
body.inspecting .inspection-panel:not(.expanded)>.contract-board{display:block}
.contract-board-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;padding-bottom:7px;margin-bottom:8px;border-bottom:1px solid #8d784743}.contract-board-head strong{color:#d8b56c;font-size:10px;letter-spacing:.12em}.contract-board-head span{color:#9baa9e;letter-spacing:.08em;font-size:7px;text-align:right}
.contract-board-intro{margin:0 0 8px;color:#9baa9e;font:8px/1.4 ui-monospace,monospace}
.contract-cards{display:grid;grid-template-columns:1fr;gap:6px}.contract-card{min-width:0;min-height:58px;padding:7px 8px;border:1px solid #465149;background:#202622;color:#bfc8bb;text-align:left;font:700 7px/1.25 ui-monospace,monospace;touch-action:manipulation}.contract-card strong,.contract-card span,.contract-card small{display:block}.contract-card strong{color:#e0c17e;font-size:10px;letter-spacing:.08em}.contract-card span{margin-top:2px;color:#93aa99}.contract-card small{margin-top:4px;color:#899188;font-size:6.5px}.contract-card b{display:block;margin-top:5px;color:#d7d7c6;font-size:8px}.contract-card.selected{border-color:#d0a85f;background:#2a2a20;box-shadow:inset 0 0 0 1px #816d42}.contract-card.cleared:not(.selected){border-color:#617866}.contract-card.locked{border-color:#343c37;background:#171b19;color:#707970}.contract-card.locked strong,.contract-card.locked span,.contract-card.locked small,.contract-card.locked b{color:#707970}.contract-card:disabled{opacity:1}.contract-card.loading{opacity:.55}
.debrief-row.progression strong{color:#f0ca7d}.debrief-row.progression span{color:#9eb6a2}
@media(max-width:730px){body.inspecting .inspection-panel:not(.expanded){width:min(270px,43vw)}.contract-board{padding:8px}.contract-card{padding:6px 7px}.contract-card small{font-size:6px}}
`;
    document.head.append(style);
}

function updateHostileCopy(contract) {
    const header = targetPanel.querySelector('header');
    const copy = targetPanel.querySelector('p');
    if (header) header.textContent = `CONTRACT HOSTILE · ${contract.name} · ${contract.opponentSerial}`;
    if (copy) copy.textContent = `${contract.role} · ${contract.briefing} Known equipment: ${contract.knownEquipment.join(' · ')}.`;
    targetToggle.textContent = `HOSTILE · ${contract.name}`;
    targetToggle.title = `${contract.name} · ₡${contract.payout}`;
}

function announce(contract) {
    let changed = false;
    try {
        changed = window.sessionStorage.getItem('m3ch4-contract-changed') === contract.id;
        if (changed) window.sessionStorage.removeItem('m3ch4-contract-changed');
    } catch { /* optional */ }
    if (!changed || !fieldStatus) return;
    fieldStatus.dataset.message = `CONTRACT SELECTED · ${contract.name} · ₡${contract.payout}`;
    fieldStatus.textContent = fieldStatus.dataset.message;
    fieldStatus.classList.add('message');
    window.setTimeout(() => {
        if (fieldStatus.dataset.message?.startsWith('CONTRACT SELECTED ·')) {
            delete fieldStatus.dataset.message;
            fieldStatus.classList.remove('message');
            fieldStatus.textContent = 'READY';
        }
    }, 3400);
}

function renderBoard() {
    inspectionPanel.querySelector(':scope > .contract-board')?.remove();
    const progression = loadProgression();
    const active = selectedContract(undefined, progression);
    const circuit = circuitSummary(progression);
    const board = document.createElement('section');
    board.className = 'contract-board';
    board.setAttribute('aria-label', 'Scrapyard circuit contracts');

    const head = document.createElement('div');
    head.className = 'contract-board-head';
    const title = document.createElement('strong');
    title.textContent = 'SCRAPYARD CIRCUIT';
    const note = document.createElement('span');
    note.textContent = `${circuit.clearedCount}/${circuit.total} CLEARED`;
    head.append(title, note);

    const intro = document.createElement('p');
    intro.className = 'contract-board-intro';
    intro.textContent = circuit.complete
        ? 'Circuit cleared. Replay any opponent for payout and recoverable hardware.'
        : 'First clears unlock the next machine. Salvage remains optional; victories advance the circuit.';

    const cards = document.createElement('div');
    cards.className = 'contract-cards';
    for (const contract of CONTRACTS) {
        const unlocked = isContractUnlocked(progression, contract.id);
        const cleared = isContractCleared(progression, contract.id);
        const selected = contract.id === active.id;
        const prereq = prerequisiteFor(contract.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `contract-card${selected ? ' selected' : ''}${cleared ? ' cleared' : ''}${!unlocked ? ' locked' : ''}`;
        button.setAttribute('aria-pressed', String(selected));
        button.disabled = selected || !unlocked;

        const name = document.createElement('strong');
        name.textContent = contract.name;
        const role = document.createElement('span');
        role.textContent = contract.role;
        const known = document.createElement('small');
        known.textContent = unlocked ? `KNOWN · ${contract.knownEquipment.join(' · ')}` : 'OPPONENT DOSSIER LOCKED';
        const payout = document.createElement('b');
        if (!unlocked) {
            const priorName = prereq ? contractById(prereq).name : 'PRIOR CONTRACT';
            payout.textContent = `LOCKED · CLEAR ${priorName}`;
        } else if (selected && cleared) {
            payout.textContent = `SELECTED · CLEARED · ₡${contract.payout}`;
        } else if (selected) {
            payout.textContent = `SELECTED · NEW · ₡${contract.payout}`;
        } else if (cleared) {
            payout.textContent = `REPLAY · CLEARED · ₡${contract.payout}`;
        } else {
            payout.textContent = `NEW · TAKE CONTRACT · ₡${contract.payout}`;
        }
        button.append(name, role, known, payout);

        button.addEventListener('click', () => {
            const result = selectContract(contract.id, undefined, progression);
            if (!result.ok) return;
            button.classList.add('loading');
            payout.textContent = 'LOADING OPPONENT…';
            try { window.sessionStorage.setItem('m3ch4-contract-changed', contract.id); }
            catch { /* selection itself already succeeded */ }
            window.location.reload();
        });
        cards.append(button);
    }
    board.append(head, intro, cards);
    garageRail.after(board);
    updateHostileCopy(active);
    announce(active);
}

function appendProgressRow(label, value) {
    const row = document.createElement('div');
    row.className = 'debrief-row progression';
    const name = document.createElement('span');
    name.textContent = label;
    const amount = document.createElement('strong');
    amount.textContent = value;
    row.append(name, amount);
    debriefLines.append(row);
}

let handledVisibleDebrief = false;
function recordVisibleVictory() {
    if (debriefSheet.classList.contains('hidden')) {
        handledVisibleDebrief = false;
        return;
    }
    if (handledVisibleDebrief) return;
    handledVisibleDebrief = true;
    if (debriefTitle.textContent !== 'CONTRACT CLEARED') return;

    const progression = loadProgression();
    const contract = selectedContract(undefined, progression);
    const result = recordContractClear(progression, contract.id);
    if (!result.firstClear) return;

    if (!storeProgression(progression)) {
        appendProgressRow('FIRST CLEAR', `${contract.name} · PROGRESS SAVE UNAVAILABLE`);
        return;
    }
    appendProgressRow('FIRST CLEAR', contract.name);
    if (result.unlockedContractId)
        appendProgressRow('NEW CONTRACT AVAILABLE', contractById(result.unlockedContractId).name);
    if (result.circuitCleared)
        appendProgressRow('SCRAPYARD CIRCUIT', 'CLEARED');
    renderBoard();
}

injectStyles();
renderBoard();
const debriefObserver = new MutationObserver(recordVisibleVictory);
debriefObserver.observe(debriefSheet, { attributes: true, attributeFilter: ['class'] });
debriefObserver.observe(debriefTitle, { childList: true, characterData: true, subtree: true });
recordVisibleVictory();
