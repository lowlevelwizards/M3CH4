/** k.3l.1 — visual post-bout salvage draft.
 *
 * Every fitted component remains visible because it physically existed on the wreck.
 * The current charter controls claim rights; condition controls what survived. Cards
 * render the same authored part geometry used in combat, and claims mutate the live
 * owned assembly before persistence so page lifecycle saves cannot erase salvage.
 */
// Import through the canonical scene specifier. index.html maps this to the same
// versioned sceneAssembly module instance used by main.js; importing sceneAssembly.js
// directly would create a second module singleton and lose activePlayerArena().
import { activePlayerArena } from './scene.js';
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
const pages = document.querySelector('#debrief-pages');
const scorePage = document.querySelector('#debrief-score-page');
const salvagePage = document.querySelector('#debrief-salvage-page');
const pageNav = document.querySelector('#debrief-page-nav');
if (!sheet || !lines || !garage || !pages || !scorePage || !salvagePage || !pageNav)
    throw new Error('Bout salvage UI needs the paged debrief surface.');
const pageButtons = [...pageNav.querySelectorAll('[data-debrief-target]')];

let storage = null;
try { storage = window.localStorage; }
catch { /* Storage-unavailable sessions can inspect but cannot claim hardware. */ }

const actorLabel = (result, id) => result?.score?.standings?.find(row => row.id === id)?.label ?? id;
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
let sortMode = 'wreck';
let claimableOnly = false;
let selectedEntryId = null;
let currentPageIndex = 0;
let lastRenderedResult = null;
let pageScrollFrame = null;

function injectStyles() {
    installPartGridStyles();
    if (document.querySelector('#bout-stakes-styles')) return;
    const style = document.createElement('style');
    style.id = 'bout-stakes-styles';
    style.textContent = `
.bout-score,.salvage-draft{margin-top:10px;padding:9px;border:1px solid #6f806f;background:#171d1a;color:#d8d0b9;font:8px/1.35 ui-monospace,monospace}.bout-score h2,.salvage-draft h2{margin:0 0 5px;color:#edc77a;font:900 10px/1.2 ui-monospace,monospace;letter-spacing:.09em}.bout-meta{color:#91aa97;margin-bottom:7px}.bout-standing{display:grid;grid-template-columns:18px minmax(80px,1fr) 52px minmax(115px,1.25fr);gap:5px;align-items:center;padding:4px 0;border-top:1px solid #59665a42}.bout-standing:first-of-type{border-top:0}.bout-standing b{color:#e0c078}.bout-standing.low{opacity:.58}.bout-standing.mvp strong:after{content:' · MVP';color:#f2c96f}.bout-standing small{color:#99a49a}.draft-order{margin:6px 0;padding:5px 6px;border:1px solid #8a754c66;color:#ccb77f;background:#26251d}.draft-pick{padding:4px 0;color:#97b59d}.salvage-note{margin:6px 0;color:#9eb0a0}.salvage-done{color:#9fd3a6}.salvage-charter{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;padding:5px 0 7px;color:#8ea093;border-bottom:1px solid #59665a42}.salvage-grid-flat{margin-top:7px}.salvage-empty{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:5px;color:#89998e;font-size:7px}.salvage-action-message{margin:7px 0 0;padding:6px 7px;border:1px solid #bb7255;color:#efb188;background:#2c1815;font:800 7px/1.35 ui-monospace,monospace}.debrief-content{width:min(700px,92vw)!important;max-height:min(88dvh,720px)!important;overflow:hidden!important;display:flex;flex-direction:column;padding:14px!important}.debrief-pages{display:flex;flex:1 1 auto;min-height:0;width:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;scrollbar-width:none}.debrief-pages::-webkit-scrollbar{display:none}.debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow-y:auto;scroll-snap-align:start;scroll-snap-stop:always;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;padding:2px 4px 8px}.debrief-page-nav{display:flex;justify-content:center;gap:5px;flex:0 0 auto;padding:8px 0 6px;border-top:1px solid #8a754c44}.debrief-page-nav button{min-width:72px;min-height:26px;padding:4px 8px;border:1px solid #596b60;background:#151b18;color:#87998d;font:800 7px/1 ui-monospace,monospace;letter-spacing:.08em}.debrief-page-nav button.active{border-color:#d0a95f;background:#302a1c;color:#edc77a}.debrief-page .sheet-muted{margin:10px 0 4px}.debrief-content>.sheet-done{flex:0 0 auto;margin-top:2px}.debrief-page .bout-score,.debrief-page .salvage-draft{margin-top:0}.debrief-page-title{margin:0 0 6px;color:#86998a;font:800 7px/1 ui-monospace,monospace;letter-spacing:.15em}
@media(max-width:730px){.bout-score,.salvage-draft{padding:7px}.bout-standing{grid-template-columns:15px minmax(66px,1fr) 42px minmax(95px,1.15fr);font-size:7px}.debrief-content{width:min(660px,94vw)!important;padding:9px!important}.debrief-page-nav{padding:6px 0 5px}.debrief-page-nav button{min-width:64px;min-height:24px;padding:3px 6px}}
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
    scorePage.replaceChildren();
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
    scorePage.append(box);
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
    salvagePage.replaceChildren();
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

    salvagePage.append(panel);
}

function showClaimProblem(message) {
    const host = salvagePage.querySelector('.salvage-draft') ?? salvagePage;
    let notice = host.querySelector('.salvage-action-message');
    if (!notice) {
        notice = document.createElement('div');
        notice.className = 'salvage-action-message';
        notice.setAttribute('role', 'status');
        host.append(notice);
    }
    notice.textContent = message;
    if (fieldStatus) {
        fieldStatus.dataset.message = message;
        fieldStatus.textContent = message;
        fieldStatus.classList.add('message', 'blocked');
    }
}

function rollbackDraftClaim(draft, entry, entryId) {
    entry.claimedBy = null;
    const pickIndex = [...draft.picks].reverse().findIndex(pick => pick.actorId === 'player' && pick.entryId === entryId);
    if (pickIndex >= 0) draft.picks.splice(draft.picks.length - 1 - pickIndex, 1);
    draft.cursor = Math.max(0, draft.cursor - 1);
}

function claimPlayerPart(result, entry) {
    if (currentDrafter(result.draft) !== 'player' || entry.destroyed || entry.claimedBy) {
        showClaimProblem('CLAIM NO LONGER AVAILABLE · REFRESHED DRAFT STATE');
        return;
    }
    if (!storage) {
        showClaimProblem('CLAIM BLOCKED · LOCAL SAVE UNAVAILABLE');
        return;
    }
    const session = activePlayerArena();
    const liveAssembly = session?.assembly;
    if (!liveAssembly) {
        showClaimProblem('CLAIM BLOCKED · LIVE GARAGE ASSEMBLY NOT CONNECTED');
        return;
    }
    const offer = claimToRecoveryOffer(entry);
    if (!offer) {
        showClaimProblem('CLAIM BLOCKED · INVALID SALVAGE RECORD');
        return;
    }
    const recovered = recoverSalvage(liveAssembly, offer);
    if (!recovered.ok) {
        showClaimProblem(`CLAIM BLOCKED · ${recovered.reason}`);
        return;
    }
    const removeRecovered = () => {
        const index = liveAssembly.owned.findIndex(part => part.serial === recovered.instance.serial);
        if (index >= 0) liveAssembly.owned.splice(index, 1);
    };

    const claimed = claimDraftEntry(result.draft, 'player', entry.id);
    if (!claimed.ok) {
        removeRecovered();
        showClaimProblem(`CLAIM BLOCKED · ${claimed.reason}`);
        return;
    }

    // Persist the SAME live assembly that pagehide/visibilitychange will later see.
    // If persistence fails, roll both ownership and the draft back atomically instead
    // of leaving a button that appears to have succeeded but loses the physical part.
    const state = loadMachine(storage);
    state.assembly = structuredClone(liveAssembly);
    if (!storeMachine(storage, state)) {
        removeRecovered();
        rollbackDraftClaim(result.draft, entry, entry.id);
        showClaimProblem('CLAIM NOT SAVED · LOCAL STORAGE WRITE FAILED · TRY AGAIN');
        return;
    }

    advanceAiDraft(result.draft, 'player');
    selectedEntryId = entry.id;
    document.dispatchEvent(new CustomEvent('m3ch4:inventory-changed', {
        detail: { serial: recovered.instance.serial, definitionId: recovered.definition.id },
    }));
    if (fieldStatus) {
        fieldStatus.dataset.message = `RECOVERED · ${recovered.definition.name} · ${recovered.instance.serial} · ${percent(recovered.instance.condition)}`;
        fieldStatus.textContent = fieldStatus.dataset.message;
        fieldStatus.classList.remove('blocked');
        fieldStatus.classList.add('message');
    }
    render();
}

function syncPageNav() {
    const width = Math.max(1, pages.clientWidth);
    const maxIndex = pageButtons.reduce((max, button) => button.hidden ? max : Math.max(max, Number(button.dataset.debriefTarget) || 0), 0);
    currentPageIndex = Math.max(0, Math.min(maxIndex, Math.round(pages.scrollLeft / width)));
    for (const button of pageButtons) {
        const active = Number(button.dataset.debriefTarget) === currentPageIndex;
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
    }
}

function goToPage(index, behavior = 'smooth') {
    const button = pageButtons.find(item => Number(item.dataset.debriefTarget) === index && !item.hidden);
    if (!button) return;
    currentPageIndex = index;
    pages.scrollTo({ left: pages.clientWidth * index, top: 0, behavior });
    syncPageNav();
}

function syncPager(result) {
    const hasSalvage = !!result?.victory;
    salvagePage.hidden = !hasSalvage;
    const salvageButton = pageButtons.find(button => Number(button.dataset.debriefTarget) === 2);
    if (salvageButton) salvageButton.hidden = !hasSalvage;
    if (!hasSalvage && currentPageIndex === 2) currentPageIndex = 1;
    syncPageNav();
}

pageNav.addEventListener('click', event => {
    const button = event.target.closest('[data-debrief-target]');
    if (!button || button.hidden) return;
    goToPage(Number(button.dataset.debriefTarget));
});
pages.addEventListener('scroll', () => {
    if (pageScrollFrame !== null) return;
    pageScrollFrame = requestAnimationFrame(() => {
        pageScrollFrame = null;
        syncPageNav();
    });
}, { passive: true });

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
    const newResult = !!result && result !== lastRenderedResult;
    renderScore(result);
    renderDraft(result);
    syncPager(result);
    if (newResult) {
        lastRenderedResult = result;
        currentPageIndex = 0;
        requestAnimationFrame(() => goToPage(0, 'auto'));
    } else if (!result) {
        lastRenderedResult = null;
    }
}

injectStyles();
subscribeBoutResult(render);
const observer = new MutationObserver(render);
observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
render();
