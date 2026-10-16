/** k.3l.1 — visual post-bout salvage draft.
 *
 * Every fitted component remains visible because it physically existed on the wreck.
 * The current charter controls claim rights; condition controls what survived. Cards
 * render the same authored part geometry used in combat, and claims mutate the live
 * owned assembly before persistence so page lifecycle saves cannot erase salvage.
 */
import { activePlayerArena } from './sceneAssembly.js';
import { loadMachine, storeMachine } from './persistence.js';
import { recoverSalvage } from './acquisition.js';
import { latestBoutResult, subscribeBoutResult } from './boutSession.js';
import { partCreditValue } from './partEconomy.js';
import {
    createPartCard, createPartDetail, installPartGridStyles, sortPartEntries,
} from './partGridUI.js';
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

const actorLabel = (result, id) => result?.score?.standings?.find(row => row.id === id)?.label ?? id;
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
let sortMode = 'wreck';
let claimableOnly = false;
let selectedEntryId = null;

function injectStyles() {
    installPartGridStyles();
    if (document.querySelector('#bout-stakes-styles')) return;
    const style = document.createElement('style');
    style.id = 'bout-stakes-styles';
    style.textContent = `
.bout-score,.salvage-draft{margin-top:10px;padding:9px;border:1px solid #6f806f;background:#171d1a;color:#d8d0b9;font:8px/1.35 ui-monospace,monospace}.bout-score h2,.salvage-draft h2{margin:0 0 5px;color:#edc77a;font:900 10px/1.2 ui-monospace,monospace;letter-spacing:.09em}.bout-meta{color:#91aa97;margin-bottom:7px}.bout-standing{display:grid;grid-template-columns:18px minmax(80px,1fr) 52px minmax(115px,1.25fr);gap:5px;align-items:center;padding:4px 0;border-top:1px solid #59665a42}.bout-standing:first-of-type{border-top:0}.bout-standing b{color:#e0c078}.bout-standing.low{opacity:.58}.bout-standing.mvp strong:after{content:' · MVP';color:#f2c96f}.bout-standing small{color:#99a49a}.draft-order{margin:6px 0;padding:5px 6px;border:1px solid #8a754c66;color:#ccb77f;background:#26251d}.draft-pick{padding:4px 0;color:#97b59d}.salvage-note{margin:6px 0;color:#9eb0a0}.salvage-done{color:#9fd3a6}.salvage-charter{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;padding:5px 0 7px;color:#8ea093;border-bottom:1px solid #59665a42}.salvage-grid-flat{margin-top:7px}.salvage-empty{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:5px;color:#89998e;font-size:7px}
@media(max-width:730px){.bout-score,.salvage-draft{padding:7px}.bout-standing{grid-template-columns:15px minmax(66px,1fr) 42px minmax(95px,1.15fr);font-size:7px}}
`;
    document.head.append(style);
}

function thumbnail(entry) {
    const session = activePlayerArena();
    return session?.arena?.partThumbnailDataUrl?.(entry.definitionId, entry) ?? null;
}

function entryValue(entry) {
    return Number.isFinite(entry?.value)
        ? entry.value
        : partCreditValue(entry?.definitionId, entry?.condition, { destroyed: entry?.destroyed });
}

function renderScore(result) {
    sheet.querySelector('.bout-score')?.remove();
    if (!result || sheet.classList.contains('hidden')) return;
    const box = document.createElement('section');
    box.className = 'bout-score';
    const heading = document.createElement('h2'); heading.textContent = 'BOUT SCORECARD';
    const meta = document.createElement('div'); meta.className = 'bout-meta';
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
        item.append(rank, name, score, stats); box.append(item);
    });
    if (result.victory) {
        const order = document.createElement('div'); order.className = 'draft-order';
        order.textContent = `SALVAGE ORDER · ${result.score.draftOrder.map(id => actorLabel(result, id)).join(' → ')}`;
        box.append(order);
    }
    lines.after(box);
}

function isClaimable(result, entry) {
    return currentDrafter(result.draft) === 'player' && !entry.destroyed && !entry.claimedBy &&
        playerClaimChoices(result.draft).some(choice => choice.id === entry.id);
}

function visibleEntries(result, entries) {
    const filtered = claimableOnly
        ? entries.filter(entry => isClaimable(result, entry))
        : entries;
    return sortMode === 'wreck' ? filtered : sortPartEntries(filtered, sortMode);
}

function appendToolbar(panel) {
    const toolbar = document.createElement('div'); toolbar.className = 'part-grid-toolbar';
    for (const [mode, label] of [['wreck','BY WRECK'],['value','VALUE'],['condition','CONDITION'],['type','TYPE']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.classList.toggle('active', sortMode === mode);
        button.addEventListener('click', () => { sortMode = mode; render(); });
        toolbar.append(button);
    }
    const filter = document.createElement('button'); filter.type = 'button';
    filter.textContent = claimableOnly ? 'CLAIMABLE ONLY' : 'ALL REMAINS';
    filter.classList.toggle('active', claimableOnly);
    filter.addEventListener('click', () => { claimableOnly = !claimableOnly; render(); });
    toolbar.append(filter); panel.append(toolbar);
}

function appendGrid(panel, result, entries, sourceLabel = '') {
    const list = visibleEntries(result, entries);
    if (!list.length) return;
    const grid = document.createElement('div'); grid.className = 'part-grid';
    for (const entry of list) {
        const card = createPartCard({
            entry, thumbnailUrl: thumbnail(entry), value: entryValue(entry),
            selected: selectedEntryId === entry.id,
            source: sourceLabel || entry.actorLabel || entry.actorId,
            claimed: !!entry.claimedBy,
            onSelect: () => { selectedEntryId = entry.id; render(); },
        });
        grid.append(card);
    }
    panel.append(grid);
}

function appendWreckGroups(panel, result) {
    if (sortMode !== 'wreck') {
        const wrap = document.createElement('div'); wrap.className = 'salvage-grid-flat';
        appendGrid(wrap, result, result.draft.pool);
        panel.append(wrap);
        return;
    }
    for (const manifest of result.wrecks) {
        const section = document.createElement('section'); section.className = 'wreck-grid-section';
        const head = document.createElement('header');
        const title = document.createElement('strong'); title.textContent = manifest.label;
        const contribution = result.score.contributionByVictim[manifest.actorId] ?? [];
        const detail = document.createElement('small');
        detail.textContent = contribution.length
            ? contribution.map(item => `${actorLabel(result, item.actorId)} ${item.percent}%`).join(' · ')
            : 'NO SCORED DAMAGE';
        head.append(title, detail); section.append(head);
        appendGrid(section, result, result.draft.pool.filter(entry => entry.actorId === manifest.actorId), manifest.label);
        if (section.querySelector('.part-grid')) panel.append(section);
    }
}

function appendSelection(panel, result) {
    const entry = result.draft.pool.find(item => item.id === selectedEntryId);
    if (!entry) return;
    const claimable = isClaimable(result, entry);
    const claimed = entry.claimedBy ? `CLAIMED BY ${actorLabel(result, entry.claimedBy)}` : '';
    const meta = `${entry.actorLabel ?? entry.actorId} · ${entry.slot.toUpperCase()}${claimed ? `\n${claimed}` : ''}${entry.destroyed ? '\nDESTROYED HARDWARE · SCRAP ONLY' : entry.disabled ? '\nDISABLED · REBUILDABLE' : ''}`;
    const actionLabel = entry.destroyed ? 'DESTROYED · SCRAP ONLY' : entry.claimedBy
        ? `CLAIMED · ${actorLabel(result, entry.claimedBy)}`
        : claimable ? 'CONFIRM CLAIM · FREE' : 'NOT YOUR CLAIM TURN';
    const detail = createPartDetail({
        entry, thumbnailUrl: thumbnail(entry), value: entryValue(entry), meta,
        actionLabel, actionDisabled: !claimable,
        onAction: () => claimPlayerPart(result, entry),
    });
    panel.append(detail);
    if (claimable) {
        const note = document.createElement('div'); note.className = 'salvage-confirm-note';
        note.textContent = 'SANCTIONED CLAIM · NO EXTRACTION FEE · EXACT SERIAL AND BATTLE CONDITION ENTER YOUR OWNED INVENTORY.';
        panel.append(note);
    }
}

function renderDraft(result) {
    sheet.querySelector('.salvage-draft')?.remove();
    garage.textContent = 'RETURN TO GARAGE';
    if (!result?.victory || !result.draft || sheet.classList.contains('hidden')) return;

    advanceAiDraft(result.draft, 'player');
    let choices = playerClaimChoices(result.draft);
    if (currentDrafter(result.draft) === 'player' && choices.length === 0) {
        skipDraftTurn(result.draft, 'player', 'NO RECOVERABLE HARDWARE');
        advanceAiDraft(result.draft, 'player');
        choices = [];
    }
    if (selectedEntryId && !result.draft.pool.some(entry => entry.id === selectedEntryId)) selectedEntryId = null;

    const panel = document.createElement('section'); panel.className = 'salvage-draft';
    const heading = document.createElement('h2');
    heading.textContent = currentDrafter(result.draft) === 'player' ? 'YOUR SALVAGE CLAIM' : 'SALVAGE DRAFT';
    const charter = document.createElement('div'); charter.className = 'salvage-charter';
    charter.innerHTML = `<span>${result.charter.label}</span><span>1 CLAIM / WINNING PILOT</span><span>DESTROYED · SCRAP ONLY</span><span>PERSONAL HARDWARE · PROTECTED</span>`;
    panel.append(heading, charter);

    for (const pick of result.draft.picks) {
        const row = document.createElement('div'); row.className = 'draft-pick';
        row.textContent = pick.skipped
            ? `${actorLabel(result, pick.actorId)} · PASS · ${pick.reason}`
            : `${actorLabel(result, pick.actorId)} CLAIMS · ${pick.name} · ${percent(pick.condition)}`;
        panel.append(row);
    }

    const turn = currentDrafter(result.draft);
    const note = document.createElement('p'); note.className = 'salvage-note';
    if (turn === 'player') {
        note.textContent = 'Every fitted component is shown. Tap a physical part to inspect its exact condition and yard value, then confirm your one sanctioned claim.';
        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';
    } else {
        note.classList.add('salvage-done');
        note.textContent = result.draft.picks.some(pick => pick.actorId === 'player' && !pick.skipped)
            ? 'YOUR CLAIM IS SECURED · IT IS ALREADY IN OWNED INVENTORY.'
            : 'DRAFT COMPLETE · NO PLAYER CLAIM TAKEN.';
    }
    panel.append(note);
    appendToolbar(panel);
    appendWreckGroups(panel, result);
    if (!panel.querySelector('.part-grid')) {
        const empty = document.createElement('div'); empty.className = 'salvage-empty';
        empty.textContent = claimableOnly ? 'NO CLAIMABLE HARDWARE IN THIS VIEW.' : 'NO WRECK HARDWARE RECORDED.';
        panel.append(empty);
    }
    appendSelection(panel, result);

    const scoreBox = sheet.querySelector('.bout-score');
    if (scoreBox) scoreBox.after(panel); else lines.after(panel);
}

function claimPlayerPart(result, entry) {
    if (!storage || currentDrafter(result.draft) !== 'player' || entry.destroyed || entry.claimedBy) return;
    const session = activePlayerArena();
    const liveAssembly = session?.assembly;
    if (!liveAssembly) return;
    const offer = claimToRecoveryOffer(entry);
    if (!offer) return;
    const recovered = recoverSalvage(liveAssembly, offer);
    if (!recovered.ok) return;

    // Persist the SAME live assembly that pagehide/visibilitychange will later see.
    // This closes the old race where a reload wrote new salvage, then the stale main
    // session immediately overwrote it during page lifecycle teardown.
    const state = loadMachine(storage);
    state.assembly = structuredClone(liveAssembly);
    if (!storeMachine(storage, state)) {
        liveAssembly.owned.splice(liveAssembly.owned.findIndex(part => part.serial === recovered.instance.serial), 1);
        return;
    }
    const claimed = claimDraftEntry(result.draft, 'player', entry.id);
    if (!claimed.ok) return;
    advanceAiDraft(result.draft, 'player');
    selectedEntryId = entry.id;
    document.dispatchEvent(new CustomEvent('m3ch4:inventory-changed', {
        detail: { serial: recovered.instance.serial, definitionId: recovered.definition.id },
    }));
    if (fieldStatus) {
        fieldStatus.dataset.message = `RECOVERED · ${recovered.definition.name} · ${recovered.instance.serial} · ${percent(recovered.instance.condition)}`;
        fieldStatus.textContent = fieldStatus.dataset.message;
        fieldStatus.classList.add('message');
    }
    render();
}

// Leaving during the player's turn is an explicit forfeit, never an invisible dangling claim.
garage.addEventListener('click', () => {
    const result = latestBoutResult();
    if (result?.draft && currentDrafter(result.draft) === 'player') {
        skipDraftTurn(result.draft, 'player', 'PLAYER FORFEITED CLAIM');
        advanceAiDraft(result.draft, 'player');
    }
}, true);

function render() {
    const result = latestBoutResult();
    renderScore(result);
    renderDraft(result);
}

injectStyles();
subscribeBoutResult(render);
const observer = new MutationObserver(render);
observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
render();
