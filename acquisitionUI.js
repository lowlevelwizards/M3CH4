/** k.3l.3 — compact post-bout score + physical salvage drafting.
 * Result, score and salvage are fixed-height horizontal cards. The salvage browser
 * scrolls independently from the selected physical part so the claim control never
 * falls off-screen on a phone.
 */
import { activePlayerArena } from './scene.js';
import { loadMachine, storeMachine } from './persistence.js';
import { recoverSalvage } from './acquisition.js';
import { latestBoutResult, subscribeBoutResult } from './boutSession.js';
import { partCreditValue } from './partEconomy.js';
import { createPartCard, createPartDetail, installPartGridStyles, sortPartEntries } from './partGridUI.js';
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
const pagePrev = document.querySelector('#debrief-prev');
const pageNext = document.querySelector('#debrief-next');
if (!sheet || !lines || !garage || !pages || !scorePage || !salvagePage || !pageNav || !pagePrev || !pageNext)
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
let autoGarageTimer = null;

function injectStyles() {
    installPartGridStyles();
    if (document.querySelector('#bout-stakes-styles')) return;
    const style = document.createElement('style');
    style.id = 'bout-stakes-styles';
    style.textContent = `
.debrief-content{position:relative;width:min(740px,94vw)!important;height:min(86dvh,560px);max-height:86dvh!important;overflow:hidden!important;display:flex;flex-direction:column;padding:11px 14px 10px!important}.debrief-pages{display:flex;flex:1 1 auto;min-height:0;width:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x;scrollbar-width:none}.debrief-pages::-webkit-scrollbar{display:none}.debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;padding:2px 18px 5px}.debrief-page-title{margin:0 0 4px;color:#86998a;font:800 7px/1 ui-monospace,monospace;letter-spacing:.15em}.debrief-page-result .sheet-label{font-size:8px}.debrief-page-result h1{margin:4px 0 7px;font-size:18px}.debrief-page-result .debrief-lines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 7px}.debrief-page-result .debrief-row{min-height:32px;margin:0;padding:5px 7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.debrief-page-result .debrief-row span{font-size:7px}.debrief-page-result .debrief-row strong{font-size:10px}.debrief-page-result .sheet-muted{margin:7px 0 0;font:7px/1.25 ui-monospace,monospace;color:#8f9a90}.debrief-page-nav{display:flex;justify-content:center;gap:5px;flex:0 0 auto;padding:6px 0 5px;border-top:1px solid #8a754c44}.debrief-page-nav button{min-width:68px;min-height:24px;padding:3px 7px;border:1px solid #596b60;background:#151b18;color:#87998d;font:800 7px/1 ui-monospace,monospace;letter-spacing:.08em}.debrief-page-nav button.active{border-color:#d0a95f;background:#302a1c;color:#edc77a}.debrief-edge{position:absolute;z-index:4;top:43%;width:30px;height:56px;border:1px solid #6c806f;background:#101713d9;color:#d6b871;font:900 25px/1 ui-monospace,monospace;opacity:.82}.debrief-edge:disabled{opacity:.12}.debrief-edge-left{left:5px}.debrief-edge-right{right:5px}.debrief-content>.sheet-done{flex:0 0 auto;min-height:32px;margin-top:0;padding:6px 10px;font-size:9px}
.score-layout{height:calc(100% - 13px);display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:8px}.score-card{min-width:0;min-height:0;padding:8px;border:1px solid #68776d;background:#111714;color:#d8d0b9;font:7px/1.25 ui-monospace,monospace}.score-card h2{margin:0 0 3px;color:#edc77a;font:900 11px/1.1 ui-monospace,monospace;letter-spacing:.08em}.score-kicker{color:#91aa97;margin-bottom:6px}.score-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.score-stat{min-height:39px;padding:5px;border:1px solid #59665a55;background:#171d1a}.score-stat span,.score-stat small{display:block;color:#89998e}.score-stat b{display:block;margin:2px 0;color:#e0c078;font-size:12px}.score-stat small{font-size:6px}.score-explain{margin-top:6px;padding-top:5px;border-top:1px solid #59665a42;color:#9dac9d;font-size:6.5px}.score-match-meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px}.score-match-meta div{padding:5px;border:1px solid #59665a55;background:#171d1a}.score-match-meta span,.score-match-meta b{display:block}.score-match-meta span{color:#89998e}.score-match-meta b{margin-top:2px;color:#e0c078;font-size:10px}.score-standings{border-top:1px solid #59665a42}.score-standing{display:grid;grid-template-columns:15px minmax(64px,1fr) 42px minmax(92px,1.35fr);gap:4px;align-items:center;min-height:20px;border-bottom:1px solid #59665a2b}.score-standing b{color:#e0c078}.score-standing small{color:#8d9b90;font-size:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.score-standing.low{opacity:.52}.score-standing.mvp strong:after{content:' · MVP';color:#f2c96f}.draft-order{margin-top:5px;padding:5px 6px;border:1px solid #8a754c66;color:#ccb77f;background:#26251d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.salvage-draft{height:calc(100% - 13px);display:flex;flex-direction:column;min-height:0;color:#d8d0b9;font:7px/1.25 ui-monospace,monospace}.salvage-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex:0 0 auto;padding:0 1px 5px}.salvage-head h2{margin:0;color:#edc77a;font:900 11px/1 ui-monospace,monospace;letter-spacing:.08em}.salvage-head span{color:#8fa293;font-size:6.5px;text-align:right}.salvage-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(210px,.85fr);gap:8px;flex:1 1 auto;min-height:0}.salvage-browser,.salvage-inspector{min-width:0;min-height:0;border:1px solid #68776d;background:#111714;padding:6px}.salvage-browser{display:flex;flex-direction:column}.salvage-browser .part-grid-toolbar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;flex:0 0 auto;margin:0 0 5px}.salvage-browser .part-grid-toolbar button{min-height:22px;padding:3px 2px;font-size:6px}.salvage-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-right:2px}.salvage-browser .part-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:4px}.salvage-browser .part-card{min-height:58px;aspect-ratio:1.18/1}.salvage-browser .part-card-slot{font-size:9px}.salvage-browser .part-card-value,.salvage-browser .part-card-condition,.salvage-browser .part-card-source{font-size:5.8px}.wreck-grid-section{margin-top:5px}.wreck-grid-section:first-child{margin-top:0}.wreck-grid-section>header{padding:2px 1px;font-size:7px}.wreck-grid-section>header small{font-size:5.5px}.salvage-inspector{display:flex;flex-direction:column}.salvage-inspector .part-detail{display:grid;grid-template-columns:1fr;grid-template-rows:minmax(86px,1fr) auto;gap:5px;height:100%;min-height:0;margin:0;padding:0;border:0;background:transparent}.salvage-inspector .part-detail-preview{min-height:0}.salvage-inspector .part-detail-copy{padding:4px 2px 0}.salvage-inspector .part-detail h3{font-size:10px}.salvage-inspector .part-detail-meta{font-size:6.5px;line-height:1.3}.salvage-inspector .part-detail-value{font-size:9px}.salvage-inspector .part-detail-action{min-height:31px;margin-top:5px}.salvage-empty,.salvage-placeholder{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:4px;color:#89998e;font-size:6px}.salvage-action-message{margin:5px 0 0;padding:5px 6px;border:1px solid #bb7255;color:#efb188;background:#2c1815;font:800 6.5px/1.3 ui-monospace,monospace}
@media(max-width:730px){.debrief-content{width:min(700px,96vw)!important;padding:8px 10px!important}.debrief-page{padding-left:15px;padding-right:15px}.debrief-edge{width:25px;height:48px}.score-layout,.salvage-layout{gap:6px}.score-card{padding:6px}.score-stat{min-height:34px;padding:4px}.score-stat b{font-size:10px}.score-standing{grid-template-columns:13px minmax(54px,1fr) 36px minmax(70px,1.2fr);font-size:6.5px}.salvage-browser,.salvage-inspector{padding:5px}.salvage-browser .part-card{min-height:52px}}
@media(max-height:430px){.debrief-content{height:88dvh;max-height:88dvh!important}.debrief-page-result h1{font-size:15px;margin:3px 0 5px}.debrief-page-result .debrief-row{min-height:27px;padding:4px 6px}.debrief-page-result .sheet-muted{margin-top:4px}.score-stat{min-height:31px}.score-stat b{font-size:9px}.score-explain{margin-top:4px;padding-top:3px}.score-standing{min-height:17px}.salvage-head{padding-bottom:3px}.salvage-browser .part-grid-toolbar{margin-bottom:3px}.salvage-browser .part-card{min-height:46px}.salvage-inspector .part-detail{grid-template-rows:minmax(72px,1fr) auto}.debrief-page-nav{padding:4px 0}.debrief-content>.sheet-done{min-height:28px;padding:4px 8px}}
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

function statTile(label, value, note) {
    const tile = document.createElement('div');
    tile.className = 'score-stat';
    const name = document.createElement('span'); name.textContent = label;
    const amount = document.createElement('b'); amount.textContent = value;
    const detail = document.createElement('small'); detail.textContent = note;
    tile.append(name, amount, detail);
    return tile;
}

function renderScore(result) {
    scorePage.replaceChildren();
    const title = document.createElement('div'); title.className = 'debrief-page-title'; title.textContent = '02 / SCORE';
    scorePage.append(title);
    if (!result || sheet.classList.contains('hidden')) return;
    const standings = result.score.standings ?? [];
    const player = standings.find(row => row.id === 'player');
    const rank = Math.max(1, standings.findIndex(row => row.id === 'player') + 1);
    const layout = document.createElement('div'); layout.className = 'score-layout';

    const personal = document.createElement('section'); personal.className = 'score-card score-personal';
    const personalTitle = document.createElement('h2'); personalTitle.textContent = 'YOUR BOUT';
    const personalKick = document.createElement('div'); personalKick.className = 'score-kicker';
    personalKick.textContent = player
        ? `RANK ${rank}/${standings.length}${result.score.mvp?.id === 'player' ? ' · MVP' : ''} · ${player.survived ? 'RETURNED TO BAY' : 'MISSION KILLED'}`
        : 'NO PLAYER SCORE RECORDED';
    personal.append(personalTitle, personalKick);
    if (player) {
        const grid = document.createElement('div'); grid.className = 'score-stat-grid';
        grid.append(
            statTile('TOTAL SCORE', Math.round(player.totalScore), 'combat + result + survival'),
            statTile('COMBAT SCORE', Math.round(player.combatScore), 'direct fighting contribution'),
            statTile('MISSION KILLS', player.missionKills, 'rigs made combat-ineffective'),
            statTile('DISABLES', player.disables, 'individual modules disabled'),
            statTile('ASSISTS', player.assists, 'meaningful shared takedowns'),
            statTile('BREACHES', player.breaches, 'armor sections opened'),
            statTile('INTERNAL DMG', `${Math.round(player.internalPercent)}%`, 'integrity removed across targets'),
            statTile('ARMOR STRIPPED', `${Math.round(player.armorPercent)}%`, 'armor removed across targets'),
        );
        personal.append(grid);
        const explain = document.createElement('div'); explain.className = 'score-explain';
        const draftRank = (result.score.draftOrder ?? []).indexOf('player');
        explain.textContent = draftRank >= 0
            ? `SALVAGE PRIORITY #${draftRank + 1} · score and participation determine claim order; destroying parts does not award bonus score.`
            : 'LOW PARTICIPATION CAN DROP A PILOT BEHIND QUALIFIED TEAMMATES IN SALVAGE ORDER.';
        personal.append(explain);
    }

    const match = document.createElement('section'); match.className = 'score-card score-match';
    const matchTitle = document.createElement('h2'); matchTitle.textContent = 'FIELD RESULT';
    const matchKick = document.createElement('div'); matchKick.className = 'score-kicker';
    matchKick.textContent = result.victory ? 'FRIENDLY TEAM CONTROLS THE FIELD' : 'HOSTILE TEAM CONTROLS THE FIELD';
    const meta = document.createElement('div'); meta.className = 'score-match-meta';
    const mvp = document.createElement('div'); mvp.innerHTML = `<span>MVP</span><b>${result.score.mvp?.label ?? '—'} · ${Math.round(result.score.mvp?.combatScore ?? 0)}</b>`;
    const preservation = document.createElement('div'); preservation.innerHTML = `<span>WRECK PRESERVATION</span><b>${result.victory ? `${result.wreckPreservation}%` : '—'}</b>`;
    meta.append(mvp, preservation);
    const table = document.createElement('div'); table.className = 'score-standings';
    standings.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = `score-standing${row.lowParticipation ? ' low' : ''}${row.id === result.score.mvp?.id ? ' mvp' : ''}`;
        const rankEl = document.createElement('b'); rankEl.textContent = String(index + 1);
        const name = document.createElement('strong'); name.textContent = row.label;
        const score = document.createElement('b'); score.textContent = String(Math.round(row.totalScore));
        const stats = document.createElement('small');
        stats.textContent = `${row.missionKills}K · ${row.assists}A · ${row.disables}DIS · ${row.survived ? 'RTB' : 'OUT'}${row.lowParticipation ? ' · LOW' : ''}`;
        item.append(rankEl, name, score, stats); table.append(item);
    });
    match.append(matchTitle, matchKick, meta, table);
    if (result.victory) {
        const order = document.createElement('div'); order.className = 'draft-order';
        order.textContent = `SALVAGE · ${result.score.draftOrder.map(id => actorLabel(result, id)).join(' → ')}`;
        match.append(order);
    }
    layout.append(personal, match);
    scorePage.append(layout);
}

function isClaimable(result, entry) {
    return currentDrafter(result.draft) === 'player' && !entry.destroyed && !entry.claimedBy &&
        playerClaimChoices(result.draft).some(choice => choice.id === entry.id);
}

function visibleEntries(result, entries) {
    const filtered = claimableOnly ? entries.filter(entry => isClaimable(result, entry)) : entries;
    return sortMode === 'wreck' ? filtered : sortPartEntries(filtered, sortMode);
}

function appendToolbar(panel) {
    const toolbar = document.createElement('div'); toolbar.className = 'part-grid-toolbar';
    for (const [mode, label] of [['wreck','WRECK'],['value','VALUE'],['condition','COND'],['type','TYPE']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.classList.toggle('active', sortMode === mode);
        button.addEventListener('click', () => { sortMode = mode; render(); });
        toolbar.append(button);
    }
    const filter = document.createElement('button'); filter.type = 'button';
    filter.textContent = claimableOnly ? 'CLAIMABLE' : 'ALL';
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
        appendGrid(panel, result, result.draft.pool);
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
    if (!entry) {
        const empty = document.createElement('div'); empty.className = 'salvage-placeholder';
        empty.textContent = 'SELECT A PHYSICAL COMPONENT'; panel.append(empty); return;
    }
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
        note.textContent = 'EXACT SERIAL + BATTLE CONDITION ENTER OWNED INVENTORY.';
        panel.append(note);
    }
}

function renderDraft(result) {
    salvagePage.replaceChildren();
    const title = document.createElement('div'); title.className = 'debrief-page-title'; title.textContent = '03 / SALVAGE';
    salvagePage.append(title);
    garage.textContent = 'RETURN TO GARAGE';
    if (!result?.victory || !result.draft || sheet.classList.contains('hidden')) return;

    advanceAiDraft(result.draft, 'player');
    const choices = playerClaimChoices(result.draft);
    if (currentDrafter(result.draft) === 'player' && choices.length === 0) {
        skipDraftTurn(result.draft, 'player', 'NO RECOVERABLE HARDWARE');
        advanceAiDraft(result.draft, 'player');
    }
    if (selectedEntryId && !result.draft.pool.some(entry => entry.id === selectedEntryId)) selectedEntryId = null;
    if (!selectedEntryId) {
        selectedEntryId = playerClaimChoices(result.draft)[0]?.id
            ?? result.draft.pool.find(entry => !entry.destroyed && !entry.claimedBy)?.id
            ?? result.draft.pool[0]?.id
            ?? null;
    }

    const panel = document.createElement('section'); panel.className = 'salvage-draft';
    const head = document.createElement('div'); head.className = 'salvage-head';
    const heading = document.createElement('h2');
    heading.textContent = currentDrafter(result.draft) === 'player' ? 'YOUR SALVAGE CLAIM' : 'SALVAGE COMPLETE';
    const rule = document.createElement('span');
    rule.textContent = '1 CLAIM / PILOT · DESTROYED = SCRAP · PERSONAL HARDWARE PROTECTED';
    head.append(heading, rule); panel.append(head);

    const layout = document.createElement('div'); layout.className = 'salvage-layout';
    const browser = document.createElement('section'); browser.className = 'salvage-browser';
    appendToolbar(browser);
    const scroll = document.createElement('div'); scroll.className = 'salvage-scroll';
    appendWreckGroups(scroll, result);
    if (!scroll.querySelector('.part-grid')) {
        const empty = document.createElement('div'); empty.className = 'salvage-empty';
        empty.textContent = claimableOnly ? 'NO CLAIMABLE HARDWARE IN THIS VIEW.' : 'NO WRECK HARDWARE RECORDED.';
        scroll.append(empty);
    }
    browser.append(scroll);

    const inspector = document.createElement('section'); inspector.className = 'salvage-inspector';
    appendSelection(inspector, result);
    layout.append(browser, inspector); panel.append(layout); salvagePage.append(panel);

    if (currentDrafter(result.draft) === 'player')
        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';
}

function showClaimProblem(message) {
    const host = salvagePage.querySelector('.salvage-inspector') ?? salvagePage;
    let notice = host.querySelector('.salvage-action-message');
    if (!notice) {
        notice = document.createElement('div'); notice.className = 'salvage-action-message'; notice.setAttribute('role', 'status'); host.append(notice);
    }
    notice.textContent = message;
    if (fieldStatus) {
        fieldStatus.dataset.message = message; fieldStatus.textContent = message; fieldStatus.classList.add('message', 'blocked');
    }
}

function rollbackDraftClaim(draft, entry, entryId) {
    entry.claimedBy = null;
    const pickIndex = [...draft.picks].reverse().findIndex(pick => pick.actorId === 'player' && pick.entryId === entryId);
    if (pickIndex >= 0) draft.picks.splice(draft.picks.length - 1 - pickIndex, 1);
    draft.cursor = Math.max(0, draft.cursor - 1);
}

function scheduleGarageReturn(result) {
    if (autoGarageTimer !== null) window.clearTimeout(autoGarageTimer);
    garage.textContent = 'CLAIM SECURED · RETURNING TO GARAGE';
    autoGarageTimer = window.setTimeout(() => {
        autoGarageTimer = null;
        if (!sheet.classList.contains('hidden') && result === latestBoutResult() && !currentDrafter(result.draft))
            garage.click();
    }, 900);
}

function claimPlayerPart(result, entry) {
    if (currentDrafter(result.draft) !== 'player' || entry.destroyed || entry.claimedBy) {
        showClaimProblem('CLAIM NO LONGER AVAILABLE · REFRESHED DRAFT STATE'); return;
    }
    if (!storage) { showClaimProblem('CLAIM BLOCKED · LOCAL SAVE UNAVAILABLE'); return; }
    const session = activePlayerArena();
    const liveAssembly = session?.assembly;
    if (!liveAssembly) { showClaimProblem('CLAIM BLOCKED · LIVE GARAGE ASSEMBLY NOT CONNECTED'); return; }
    const offer = claimToRecoveryOffer(entry);
    if (!offer) { showClaimProblem('CLAIM BLOCKED · INVALID SALVAGE RECORD'); return; }
    const recovered = recoverSalvage(liveAssembly, offer);
    if (!recovered.ok) { showClaimProblem(`CLAIM BLOCKED · ${recovered.reason}`); return; }
    const removeRecovered = () => {
        const index = liveAssembly.owned.findIndex(part => part.serial === recovered.instance.serial);
        if (index >= 0) liveAssembly.owned.splice(index, 1);
    };
    const claimed = claimDraftEntry(result.draft, 'player', entry.id);
    if (!claimed.ok) { removeRecovered(); showClaimProblem(`CLAIM BLOCKED · ${claimed.reason}`); return; }
    const state = loadMachine(storage);
    state.assembly = structuredClone(liveAssembly);
    if (!storeMachine(storage, state)) {
        removeRecovered(); rollbackDraftClaim(result.draft, entry, entry.id);
        showClaimProblem('CLAIM NOT SAVED · LOCAL STORAGE WRITE FAILED · TRY AGAIN'); return;
    }
    advanceAiDraft(result.draft, 'player');
    selectedEntryId = entry.id;
    document.dispatchEvent(new CustomEvent('m3ch4:inventory-changed', {
        detail: { serial: recovered.instance.serial, definitionId: recovered.definition.id },
    }));
    if (fieldStatus) {
        fieldStatus.dataset.message = `RECOVERED · ${recovered.definition.name} · ${recovered.instance.serial} · ${percent(recovered.instance.condition)}`;
        fieldStatus.textContent = fieldStatus.dataset.message;
        fieldStatus.classList.remove('blocked'); fieldStatus.classList.add('message');
    }
    render();
    if (!currentDrafter(result.draft)) scheduleGarageReturn(result);
}

function visiblePageIndices() {
    return pageButtons.filter(button => !button.hidden).map(button => Number(button.dataset.debriefTarget));
}

function syncPageNav() {
    const width = Math.max(1, pages.clientWidth);
    const visible = visiblePageIndices();
    const maxIndex = visible.length ? Math.max(...visible) : 0;
    currentPageIndex = Math.max(0, Math.min(maxIndex, Math.round(pages.scrollLeft / width)));
    for (const button of pageButtons) {
        const active = Number(button.dataset.debriefTarget) === currentPageIndex;
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
    }
    const position = visible.indexOf(currentPageIndex);
    pagePrev.disabled = position <= 0;
    pageNext.disabled = position < 0 || position >= visible.length - 1;
}

function goToPage(index, behavior = 'smooth') {
    const button = pageButtons.find(item => Number(item.dataset.debriefTarget) === index && !item.hidden);
    if (!button) return;
    currentPageIndex = index;
    pages.scrollTo({ left: pages.clientWidth * index, top: 0, behavior });
    syncPageNav();
}

function movePage(direction) {
    const visible = visiblePageIndices();
    const position = visible.indexOf(currentPageIndex);
    const next = visible[Math.max(0, Math.min(visible.length - 1, position + direction))];
    if (next !== undefined) goToPage(next);
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
pagePrev.addEventListener('click', () => movePage(-1));
pageNext.addEventListener('click', () => movePage(1));
pages.addEventListener('scroll', () => {
    if (pageScrollFrame !== null) return;
    pageScrollFrame = requestAnimationFrame(() => { pageScrollFrame = null; syncPageNav(); });
}, { passive: true });

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
        selectedEntryId = null;
        currentPageIndex = 0;
        requestAnimationFrame(() => goToPage(0, 'auto'));
    } else if (!result) {
        lastRenderedResult = null;
        selectedEntryId = null;
        if (autoGarageTimer !== null) { window.clearTimeout(autoGarageTimer); autoGarageTimer = null; }
    }
}

injectStyles();
subscribeBoutResult(render);
const observer = new MutationObserver(render);
observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
render();
