/** k.3l.0 post-bout sport + salvage UI.
 *
 * The combat loop now publishes the authoritative six-actor ledger result and real
 * wreck manifests. This adapter renders that result and performs the player's scored
 * salvage-draft turn without reconstructing enemies or scraping diagnostic DOM.
 */
import { activePlayerArena } from './scene.js';
import { loadMachine, storeMachine } from './persistence.js';
import { recoverSalvage } from './acquisition.js';
import { latestBoutResult, subscribeBoutResult } from './boutSession.js';
import {
    advanceAiDraft, claimDraftEntry, claimToRecoveryOffer, currentDrafter,
    playerClaimChoices, skipDraftTurn,
} from './salvageDraft.js';

const sheet = document.querySelector('#sortie-debrief');
const lines = document.querySelector('#debrief-lines');
const garage = document.querySelector('#debrief-garage');
const fieldStatus = document.querySelector('#field-status');
if (!sheet || !lines || !garage)
    throw new Error('Bout salvage UI needs the existing debrief surface.');

let storage = null;
try { storage = window.localStorage; }
catch { /* Storage-unavailable sessions can inspect but cannot claim hardware. */ }

const glyphs = { structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' };
const actorLabel = (result, id) => result?.score?.standings?.find(row => row.id === id)?.label ?? id;
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;

function injectStyles() {
    if (document.querySelector('#bout-stakes-styles')) return;
    const style = document.createElement('style');
    style.id = 'bout-stakes-styles';
    style.textContent = `
.bout-score,.salvage-draft{margin-top:10px;padding:9px;border:1px solid #6f806f;background:#171d1a;color:#d8d0b9;font:8px/1.35 ui-monospace,monospace}.bout-score h2,.salvage-draft h2{margin:0 0 5px;color:#edc77a;font:900 10px/1.2 ui-monospace,monospace;letter-spacing:.09em}.bout-meta{color:#91aa97;margin-bottom:7px}.bout-standing{display:grid;grid-template-columns:18px minmax(80px,1fr) 52px minmax(115px,1.25fr);gap:5px;align-items:center;padding:4px 0;border-top:1px solid #59665a42}.bout-standing:first-of-type{border-top:0}.bout-standing b{color:#e0c078}.bout-standing.low{opacity:.58}.bout-standing.mvp strong:after{content:' · MVP';color:#f2c96f}.bout-standing small{color:#99a49a}.draft-order{margin:6px 0;padding:5px 6px;border:1px solid #8a754c66;color:#ccb77f;background:#26251d}.draft-pick{padding:4px 0;color:#97b59d}.wreck-card{margin-top:7px;border:1px solid #536158;background:#111714}.wreck-card>header{display:flex;justify-content:space-between;gap:8px;padding:5px 6px;background:#202721;color:#d9bc79}.wreck-card>header small{color:#8ea192;text-align:right}.wreck-part{display:grid;grid-template-columns:22px minmax(92px,1fr) 70px minmax(92px,auto);gap:5px;align-items:center;padding:5px 6px;border-top:1px solid #4d584e55}.wreck-part .glyph{font-size:14px;color:#9fcca7}.wreck-part strong{font-size:8px;color:#cdd4c9}.wreck-part span{font-size:7px;color:#9da99f}.wreck-part.destroyed{background:#080a09;color:#646a65}.wreck-part.destroyed .glyph,.wreck-part.destroyed strong{color:#555b56}.wreck-part.disabled strong{color:#d89568}.wreck-part button{min-height:30px;padding:5px 7px;border:1px solid #d0a95f;background:#b99552;color:#111914;font:900 7px/1.1 ui-monospace,monospace}.wreck-part button:disabled{opacity:.4}.salvage-note{margin:6px 0;color:#9eb0a0}.salvage-warning{color:#e0a46b}.salvage-done{color:#9fd3a6}.salvage-charter{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;padding:5px 0 7px;color:#8ea093;border-bottom:1px solid #59665a42}
@media(max-width:730px){.bout-score,.salvage-draft{padding:7px}.bout-standing{grid-template-columns:15px minmax(66px,1fr) 42px minmax(95px,1.15fr);font-size:7px}.wreck-part{grid-template-columns:18px minmax(74px,1fr) 58px minmax(80px,auto);padding:4px 5px}}
`;
    document.head.append(style);
}

function announceRecovered() {
    let message = null;
    try {
        message = window.sessionStorage.getItem('m3ch4-recovered-part');
        if (message) window.sessionStorage.removeItem('m3ch4-recovered-part');
    } catch { /* optional */ }
    if (!message || !fieldStatus) return;
    fieldStatus.dataset.message = `RECOVERED · ${message} · NOW IN YOUR GARAGE`;
    fieldStatus.textContent = fieldStatus.dataset.message;
    fieldStatus.classList.add('message');
    window.setTimeout(() => {
        if (fieldStatus.dataset.message?.startsWith('RECOVERED ·')) {
            delete fieldStatus.dataset.message;
            fieldStatus.classList.remove('message');
            fieldStatus.textContent = 'READY';
        }
    }, 4600);
}

function renderScore(result) {
    sheet.querySelector('.bout-score')?.remove();
    if (!result || sheet.classList.contains('hidden')) return;
    const box = document.createElement('section');
    box.className = 'bout-score';
    const heading = document.createElement('h2');
    heading.textContent = 'BOUT SCORECARD';
    const meta = document.createElement('div');
    meta.className = 'bout-meta';
    meta.textContent = `MVP · ${result.score.mvp?.label ?? '—'} · ${Math.round(result.score.mvp?.combatScore ?? 0)} PTS${result.victory ? ` · WRECK PRESERVATION ${result.wreckPreservation}%` : ''}`;
    box.append(heading, meta);
    result.score.standings.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = `bout-standing${row.lowParticipation ? ' low' : ''}${row.id === result.score.mvp?.id ? ' mvp' : ''}`;
        const rank = document.createElement('b'); rank.textContent = String(index + 1);
        const name = document.createElement('strong'); name.textContent = row.label;
        const score = document.createElement('b'); score.textContent = `${Math.round(row.totalScore)}`;
        const stats = document.createElement('small');
        stats.textContent = `${row.missionKills} K · ${row.assists} A · ${row.disables} DIS · INT ${Math.round(row.internalPercent)}%${row.survived ? ' · RTB' : ' · OUT'}${row.lowParticipation ? ' · LOW PARTICIPATION' : ''}`;
        item.append(rank, name, score, stats);
        box.append(item);
    });
    if (result.victory) {
        const order = document.createElement('div');
        order.className = 'draft-order';
        order.textContent = `SALVAGE ORDER · ${result.score.draftOrder.map(id => actorLabel(result, id)).join(' → ')}`;
        box.append(order);
    }
    lines.after(box);
}

function renderDraft(result) {
    sheet.querySelector('.salvage-draft')?.remove();
    garage.textContent = 'RETURN TO GARAGE';
    if (!result?.victory || !result.draft || sheet.classList.contains('hidden')) return;

    advanceAiDraft(result.draft, 'player');
    const liveAssembly = activePlayerArena()?.assembly;
    const owned = new Set((liveAssembly?.owned ?? []).map(part => part.definitionId));
    let choices = playerClaimChoices(result.draft, owned);
    if (currentDrafter(result.draft) === 'player' && choices.length === 0) {
        skipDraftTurn(result.draft, 'player', 'NO UNIQUE RECOVERABLE HARDWARE');
        advanceAiDraft(result.draft, 'player');
        choices = [];
    }

    const panel = document.createElement('section');
    panel.className = 'salvage-draft';
    const heading = document.createElement('h2');
    heading.textContent = currentDrafter(result.draft) === 'player' ? 'YOUR SALVAGE CLAIM' : 'SALVAGE DRAFT';
    const charter = document.createElement('div');
    charter.className = 'salvage-charter';
    charter.innerHTML = `<span>${result.charter.label}</span><span>1 CLAIM / WINNING PILOT</span><span>DESTROYED · SCRAP ONLY</span><span>PERSONAL HARDWARE · PROTECTED</span>`;
    panel.append(heading, charter);

    for (const pick of result.draft.picks) {
        const row = document.createElement('div');
        row.className = 'draft-pick';
        row.textContent = pick.skipped
            ? `${actorLabel(result, pick.actorId)} · PASS · ${pick.reason}`
            : `${actorLabel(result, pick.actorId)} CLAIMS · ${pick.name} · ${percent(pick.condition)}`;
        panel.append(row);
    }

    const turn = currentDrafter(result.draft);
    const note = document.createElement('p');
    note.className = 'salvage-note';
    if (turn === 'player') {
        note.textContent = 'Choose one surviving physical component. Its exact battle condition and source serial come home with it; repair is separate.';
        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';
    } else {
        note.classList.add('salvage-done');
        note.textContent = result.draft.picks.some(pick => pick.actorId === 'player' && !pick.skipped)
            ? 'YOUR CLAIM IS SECURED.'
            : 'DRAFT COMPLETE · NO PLAYER CLAIM TAKEN.';
    }
    panel.append(note);

    for (const manifest of result.wrecks) {
        const card = document.createElement('section');
        card.className = 'wreck-card';
        const head = document.createElement('header');
        const name = document.createElement('strong'); name.textContent = manifest.label;
        const contribution = result.score.contributionByVictim[manifest.actorId] ?? [];
        const detail = document.createElement('small');
        detail.textContent = contribution.length
            ? contribution.map(item => `${actorLabel(result, item.actorId)} ${item.percent}%`).join(' · ')
            : 'NO SCORED DAMAGE';
        head.append(name, detail); card.append(head);
        const parts = result.draft.pool.filter(entry => entry.actorId === manifest.actorId);
        for (const entry of parts) {
            const row = document.createElement('div');
            row.className = `wreck-part ${entry.status}${entry.destroyed ? ' destroyed' : ''}`;
            const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.textContent = glyphs[entry.slot] ?? '·';
            const label = document.createElement('strong'); label.textContent = entry.name;
            const state = document.createElement('span');
            state.textContent = entry.destroyed ? 'DESTROYED · SCRAP' : `${entry.status.toUpperCase()} · ${percent(entry.condition)}`;
            const action = document.createElement('span');
            const alreadyOwned = owned.has(entry.definitionId);
            if (entry.claimedBy) {
                action.textContent = `CLAIMED · ${actorLabel(result, entry.claimedBy)}`;
            } else if (entry.destroyed) {
                action.textContent = 'NO USABLE CLAIM';
            } else if (alreadyOwned) {
                action.textContent = 'DEFINITION ALREADY OWNED';
            } else if (turn === 'player' && choices.some(choice => choice.id === entry.id)) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `CLAIM · ₡${entry.recoveryFee}`;
                const saved = storage ? loadMachine(storage) : null;
                button.disabled = !saved || saved.economy.credits < entry.recoveryFee;
                if (!storage) button.textContent = 'SAVE OFFLINE';
                else if (saved && saved.economy.credits < entry.recoveryFee) button.textContent = `NEED ₡${entry.recoveryFee}`;
                button.addEventListener('click', () => claimPlayerPart(result, entry));
                action.replaceChildren(button);
            } else {
                action.textContent = 'AVAILABLE';
            }
            row.append(glyph, label, state, action);
            card.append(row);
        }
        panel.append(card);
    }
    const scoreBox = sheet.querySelector('.bout-score');
    if (scoreBox) scoreBox.after(panel);
    else lines.after(panel);
}

function claimPlayerPart(result, entry) {
    if (!storage || currentDrafter(result.draft) !== 'player') return;
    const state = loadMachine(storage);
    if (state.assembly.owned.some(part => part.definitionId === entry.definitionId)) return;
    const offer = claimToRecoveryOffer(entry);
    if (!offer || state.economy.credits < offer.recoveryFee) return;
    const recovered = recoverSalvage(state.assembly, offer);
    if (!recovered.ok) return;
    state.economy.credits -= offer.recoveryFee;
    if (!storeMachine(storage, state)) return;
    claimDraftEntry(result.draft, 'player', entry.id);
    advanceAiDraft(result.draft, 'player');
    try {
        window.sessionStorage.setItem('m3ch4-recovered-part', `${recovered.definition.name} · ${recovered.instance.serial} · ${percent(recovered.instance.condition)}`);
    } catch { /* recovery is already persisted */ }
    window.location.reload();
}

function render() {
    const result = latestBoutResult();
    renderScore(result);
    renderDraft(result);
}

injectStyles();
announceRecovered();
subscribeBoutResult(render);
const observer = new MutationObserver(render);
observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
render();
