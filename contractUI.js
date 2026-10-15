/** k.3f.1 touch-friendly contract selector on the garage home surface.
 * Selecting a different opponent reloads the arena so every existing combat,
 * rendering and salvage system initializes against the same authored assembly.
 *
 * The compact garage keeps module details in a contextual drawer. Contracts live
 * beside that drawer instead: visible immediately on garage entry, replaced by
 * module details while a module is selected, and never shown during a sortie.
 */
import { CONTRACTS, selectContract, selectedContract } from './contracts.js';

const inspectionPanel = document.querySelector('#inspection-panel');
const garageRail = inspectionPanel?.querySelector('.garage-rail');
const targetPanel = document.querySelector('#target-panel');
const targetToggle = document.querySelector('#target-toggle');
const fieldStatus = document.querySelector('#field-status');

if (!inspectionPanel || !garageRail || !targetPanel || !targetToggle)
    throw new Error('Contract board needs the existing garage and hostile surfaces.');

function injectStyles() {
    if (document.querySelector('#contract-board-styles')) return;
    const style = document.createElement('style');
    style.id = 'contract-board-styles';
    style.textContent = `
body.inspecting .inspection-panel:not(.expanded){width:min(300px,40vw)}
.contract-board{display:none;min-width:0;flex:1 1 auto;height:100%;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:10px;background:rgba(14,20,18,.95);border:1px solid #71866d73;border-left:0;box-shadow:10px 8px 36px #0009;color:#d7d0bd;font:8px/1.3 ui-monospace,monospace}
body.inspecting .inspection-panel:not(.expanded)>.contract-board{display:block}
.contract-board-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;padding-bottom:7px;margin-bottom:8px;border-bottom:1px solid #8d784743}.contract-board-head strong{color:#d8b56c;font-size:10px;letter-spacing:.12em}.contract-board-head span{color:#839287;letter-spacing:.08em;font-size:7px;text-align:right}
.contract-board-intro{margin:0 0 8px;color:#9baa9e;font:8px/1.4 ui-monospace,monospace}
.contract-cards{display:grid;grid-template-columns:1fr;gap:6px}.contract-card{min-width:0;min-height:58px;padding:7px 8px;border:1px solid #465149;background:#202622;color:#bfc8bb;text-align:left;font:700 7px/1.25 ui-monospace,monospace;touch-action:manipulation}.contract-card strong,.contract-card span,.contract-card small{display:block}.contract-card strong{color:#e0c17e;font-size:10px;letter-spacing:.08em}.contract-card span{margin-top:2px;color:#93aa99}.contract-card small{margin-top:4px;color:#899188;font-size:6.5px}.contract-card b{display:block;margin-top:5px;color:#d7d7c6;font-size:8px}.contract-card.selected{border-color:#d0a85f;background:#2a2a20;box-shadow:inset 0 0 0 1px #816d42}.contract-card:disabled{opacity:1}.contract-card.loading{opacity:.55}
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
    const active = selectedContract();
    const board = document.createElement('section');
    board.className = 'contract-board';
    board.setAttribute('aria-label', 'Scrapyard contracts');

    const head = document.createElement('div');
    head.className = 'contract-board-head';
    const title = document.createElement('strong');
    title.textContent = 'SCRAPYARD CONTRACTS';
    const note = document.createElement('span');
    note.textContent = 'OPPONENT / SALVAGE ROUTE';
    head.append(title, note);

    const intro = document.createElement('p');
    intro.className = 'contract-board-intro';
    intro.textContent = 'Choose the machine you want to face next. Payout and recoverable hardware follow the selected contract.';

    const cards = document.createElement('div');
    cards.className = 'contract-cards';
    for (const contract of CONTRACTS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `contract-card ${contract.id === active.id ? 'selected' : ''}`.trim();
        button.setAttribute('aria-pressed', String(contract.id === active.id));
        button.disabled = contract.id === active.id;

        const name = document.createElement('strong');
        name.textContent = contract.name;
        const role = document.createElement('span');
        role.textContent = contract.role;
        const known = document.createElement('small');
        known.textContent = `KNOWN · ${contract.knownEquipment.join(' · ')}`;
        const payout = document.createElement('b');
        payout.textContent = contract.id === active.id ? `SELECTED · ₡${contract.payout}` : `TAKE CONTRACT · ₡${contract.payout}`;
        button.append(name, role, known, payout);

        button.addEventListener('click', () => {
            const result = selectContract(contract.id);
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

injectStyles();
renderBoard();
