/** k.3l.4 — compact post-bout score + physical salvage drafting.
 * Result, score and salvage are fixed-height horizontal cards. The salvage browser
 * scrolls independently from the selected physical part so the claim control never
 * falls off-screen on a phone.
 */
import { activePlayerArena } from './scene.js';
import { loadMachine, storeMachine } from './persistence.js';
import { recoverSalvage } from './acquisition.js';
import { latestBoutResult, latestRoundResult, subscribeBoutResult, subscribeRoundResult } from './boutSession.js';
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
// The player confirms the recovered serial and leaves when ready; no auto-exit timer.

function setGarageAction(primary, secondary = '', mode = 'return') {
    garage.replaceChildren();
    const label = document.createElement('strong');
    label.textContent = primary;
    garage.append(label);
    if (secondary) {
        const note = document.createElement('small');
        note.textContent = secondary;
        garage.append(note);
    }
    garage.dataset.mode = mode;
}

function injectStyles() {
    installPartGridStyles();
    if (document.querySelector('#bout-stakes-styles')) return;
    const style = document.createElement('style');
    style.id = 'bout-stakes-styles';
    style.textContent = `
.debrief-content{position:relative;width:min(740px,94vw)!important;height:min(86dvh,560px);max-height:86dvh!important;overflow:hidden!important;display:flex;flex-direction:column;padding:11px 14px 10px!important}.debrief-pages{display:flex;flex:1 1 auto;min-height:0;width:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x;scrollbar-width:none}.debrief-pages::-webkit-scrollbar{display:none}.debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;padding:2px 18px 5px}.debrief-page-result{display:flex;flex-direction:column}.debrief-result-summary{flex:1 1 auto;min-height:0;width:min(680px,100%);margin:0 auto;display:flex;flex-direction:column;justify-content:center;padding:0 8px 8px}.debrief-page-title{margin:0 0 4px;color:#86998a;font:800 7px/1 ui-monospace,monospace;letter-spacing:.15em}.debrief-page-result .sheet-label{font-size:8px}.debrief-page-result h1{margin:4px 0 7px;font-size:18px}.debrief-page-result .debrief-lines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 7px}.debrief-page-result .debrief-row{min-height:32px;margin:0;padding:5px 7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.debrief-page-result .debrief-row span{font-size:7px}.debrief-page-result .debrief-row strong{font-size:10px}.debrief-page-result .sheet-muted{margin:7px 0 0;font:7px/1.25 ui-monospace,monospace;color:#8f9a90}.debrief-page-nav{display:flex;justify-content:center;gap:5px;flex:0 0 auto;padding:6px 0 5px;border-top:1px solid #8a754c44}.debrief-page-nav button{min-width:68px;min-height:24px;padding:3px 7px;border:1px solid #596b60;background:#151b18;color:#87998d;font:800 7px/1 ui-monospace,monospace;letter-spacing:.08em}.debrief-page-nav button.active{border-color:#d0a95f;background:#302a1c;color:#edc77a}.debrief-edge{position:absolute;z-index:4;top:43%;width:30px;height:56px;border:1px solid #6c806f;background:#101713d9;color:#d6b871;font:900 25px/1 ui-monospace,monospace;opacity:.82}.debrief-edge:disabled{opacity:.12}.debrief-edge-left{left:5px}.debrief-edge-right{right:5px}.debrief-content>.sheet-done{flex:0 0 auto;min-height:32px;margin-top:0;padding:6px 10px;font-size:9px}#debrief-garage{display:flex;align-items:center;justify-content:center;gap:8px;min-height:27px!important;padding:4px 10px!important;border:1px solid #59675e!important;background:#151b18!important;color:#89988e!important;box-shadow:none!important;font:800 7px/1.1 ui-monospace,monospace!important;letter-spacing:.06em}#debrief-garage strong{font:inherit;color:inherit}#debrief-garage small{font:600 5.8px/1 ui-monospace,monospace;color:#6f7f75;letter-spacing:.04em}#debrief-garage[data-mode="forfeit"]{border-color:#79594a!important;background:#211917!important;color:#c39378!important}#debrief-garage[data-mode="forfeit"] small{color:#8f7465}#debrief-garage[data-mode="complete"]{border-color:#627d66!important;background:#172019!important;color:#b6d2b6!important}
.score-layout{height:calc(100% - 13px);display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:8px}.score-card{min-width:0;min-height:0;padding:8px;border:1px solid #68776d;background:#111714;color:#d8d0b9;font:7px/1.25 ui-monospace,monospace}.score-card h2{margin:0 0 3px;color:#edc77a;font:900 11px/1.1 ui-monospace,monospace;letter-spacing:.08em}.score-kicker{color:#91aa97;margin-bottom:6px}.score-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.score-stat{min-height:39px;padding:5px;border:1px solid #59665a55;background:#171d1a}.score-stat span,.score-stat small{display:block;color:#89998e}.score-stat b{display:block;margin:2px 0;color:#e0c078;font-size:12px}.score-stat small{font-size:6px}.score-explain{margin-top:6px;padding-top:5px;border-top:1px solid #59665a42;color:#9dac9d;font-size:6.5px}.score-match-meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px}.score-match-meta div{padding:5px;border:1px solid #59665a55;background:#171d1a}.score-match-meta span,.score-match-meta b{display:block}.score-match-meta span{color:#89998e}.score-match-meta b{margin-top:2px;color:#e0c078;font-size:10px}.score-standings{border-top:1px solid #59665a42}.score-standing{display:grid;grid-template-columns:15px minmax(64px,1fr) 42px minmax(92px,1.35fr);gap:4px;align-items:center;min-height:20px;border-bottom:1px solid #59665a2b}.score-standing b{color:#e0c078}.score-standing small{color:#8d9b90;font-size:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.score-standing.low{opacity:.52}.score-standing.mvp strong:after{content:' · MVP';color:#f2c96f}.draft-order{margin-top:5px;padding:6px 7px;border:1px solid #9b845477;color:#d7c18b;background:#29271d;white-space:normal;overflow:visible;font-weight:800;letter-spacing:.035em}.draft-order b{color:#f0ca78}.draft-order small{color:#8fa293;font-weight:600}
.salvage-draft{height:calc(100% - 13px);display:flex;flex-direction:column;min-height:0;color:#d8d0b9;font:7px/1.25 ui-monospace,monospace}.salvage-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex:0 0 auto;padding:0 1px 5px}.salvage-head h2{margin:0;color:#edc77a;font:900 11px/1 ui-monospace,monospace;letter-spacing:.08em}.salvage-head span{color:#8fa293;font-size:6.5px;text-align:right}.salvage-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(210px,.85fr);gap:8px;flex:1 1 auto;min-height:0}.salvage-browser,.salvage-inspector{min-width:0;min-height:0;border:1px solid #68776d;background:#111714;padding:6px}.salvage-browser{display:flex;flex-direction:column}.salvage-browser .part-grid-toolbar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;flex:0 0 auto;margin:0 0 5px}.salvage-browser .part-grid-toolbar button{min-height:22px;padding:3px 2px;font-size:6px}.salvage-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-right:2px}.salvage-browser .part-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:4px}.salvage-browser .part-card{min-height:58px;aspect-ratio:1.18/1}.salvage-browser .part-card-slot{font-size:9px}.salvage-browser .part-card-value,.salvage-browser .part-card-condition,.salvage-browser .part-card-source{font-size:5.8px}.wreck-grid-section{margin-top:5px}.wreck-grid-section:first-child{margin-top:0}.wreck-grid-section>header{padding:2px 1px;font-size:7px}.wreck-grid-section>header small{font-size:5.5px}.salvage-inspector{display:flex;flex-direction:column}.salvage-inspector .part-detail{display:grid;grid-template-columns:1fr;grid-template-rows:minmax(86px,1fr) auto;gap:5px;height:100%;min-height:0;margin:0;padding:0;border:0;background:transparent}.salvage-inspector .part-detail-preview{min-height:0}.salvage-inspector .part-detail-copy{padding:4px 2px 0}.salvage-inspector .part-detail h3{font-size:10px}.salvage-inspector .part-detail-meta{font-size:6.5px;line-height:1.3}.salvage-inspector .part-detail-value{font-size:9px}.salvage-inspector .part-detail-action{min-height:31px;margin-top:5px}.salvage-empty,.salvage-placeholder{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:4px;color:#89998e;font-size:6px}.salvage-action-message{margin:5px 0 0;padding:5px 6px;border:1px solid #bb7255;color:#efb188;background:#2c1815;font:800 6.5px/1.3 ui-monospace,monospace}
@media(max-width:730px){.debrief-content{width:min(700px,96vw)!important;padding:8px 10px!important}.debrief-page{padding-left:15px;padding-right:15px}.debrief-edge{width:25px;height:48px}.score-layout,.salvage-layout{gap:6px}.score-card{padding:6px}.score-stat{min-height:34px;padding:4px}.score-stat b{font-size:10px}.score-standing{grid-template-columns:13px minmax(54px,1fr) 36px minmax(70px,1.2fr);font-size:6.5px}.salvage-browser,.salvage-inspector{padding:5px}.salvage-browser .part-card{min-height:52px}}
@media(max-height:430px){.debrief-content{height:88dvh;max-height:88dvh!important}.debrief-result-summary{padding-bottom:1px}.debrief-page-result h1{font-size:15px;margin:3px 0 5px}.debrief-page-result .debrief-row{min-height:27px;padding:4px 6px}.debrief-page-result .sheet-muted{margin-top:4px}.score-stat{min-height:31px}.score-stat b{font-size:9px}.score-explain{margin-top:4px;padding-top:3px}.score-standing{min-height:17px}.salvage-head{padding-bottom:3px}.salvage-browser .part-grid-toolbar{margin-bottom:3px}.salvage-browser .part-card{min-height:46px}.salvage-inspector .part-detail{grid-template-rows:minmax(72px,1fr) auto}.debrief-page-nav{padding:4px 0}.debrief-content>.sheet-done{min-height:28px;padding:4px 8px}}
`;
    // A report should be touch-operable without pixel-perfect precision.
    // These scoped overrides apply after the compact landscape rules above.
    style.textContent += `
#sortie-debrief .debrief-edge{width:40px;height:58px;min-height:44px;touch-action:manipulation}
#sortie-debrief .debrief-edge-left{left:2px}
#sortie-debrief .debrief-edge-right{right:2px}
#sortie-debrief .debrief-page-nav button{min-height:36px;min-width:75px;font-size:9px;touch-action:manipulation}
#sortie-debrief .salvage-browser .part-card{min-height:58px;touch-action:manipulation}
#sortie-debrief .salvage-inspector .part-detail-action{min-height:42px;font-size:9px;touch-action:manipulation}
#sortie-debrief #debrief-garage{min-height:39px!important;font-size:9px!important;touch-action:manipulation}
@media(max-height:430px){
 #sortie-debrief .debrief-edge{width:34px;height:52px}
 #sortie-debrief .debrief-page-nav button{min-height:33px;min-width:70px}
 #sortie-debrief .salvage-inspector .part-detail-action{min-height:39px}
}
`;
    document.head.append(style);
    // One terminal report stylesheet overrides all prior prototype layouts.
    const clarity=document.createElement('link');
    clarity.rel='stylesheet';clarity.href='./reportClarity.css?v=k4o';
    document.head.append(clarity);
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
    const make=(tag,cls,content)=>{
        const node=document.createElement(tag);if(cls)node.className=cls;
        if(content!==undefined)node.textContent=String(content);
        return node;
    };
    scorePage.append(make('div','debrief-page-title','02 / SCORE'));
    if(!result||sheet.classList.contains('hidden'))return;
    const standings=result.score?.standings??[];
    const player=standings.find(row=>row.id==='player');
    const rank=standings.findIndex(row=>row.id==='player')+1;
    const root=make('section','k4o-score');
    const head=make('div','k4o-score-head');
    const heading=make('div','k4o-score-heading');
    heading.append(make('strong','',result.terminal===false?'ROUND SCORE':'MATCH SCORE'),
        make('small','',result.victory?'TEAM VICTORY':'TEAM DEFEAT'));
    const match=make('div','k4o-score-match');
    match.append(make('small','','MATCH'),
        make('strong','',result.series
            ?result.series.playerWins+' – '+result.series.enemyWins
            :result.victory?'WON':'LOST'));
    head.append(heading,match);
    root.append(head);
    const highlights=make('div','k4o-highlights');
    for(const [label,value] of [
        ['YOUR SCORE',Math.round(player?.totalScore??0)],
        ['K / A / DIS',[(player?.missionKills??0),(player?.assists??0),
            (player?.disables??0)].join(' / ')],
        ['RANK',rank?rank+' / '+standings.length:'—']
    ]){
        const tile=make('div','k4o-highlight');
        tile.append(make('span','',label),make('strong','',value));highlights.append(tile);
    }
    root.append(highlights);
    const table=make('div','k4o-standings');
    const rowHead=make('div','k4o-stand-head');
    rowHead.append(make('span','','PILOT'),make('span','','K / A / DIS'),make('span','','PTS'));
    table.append(rowHead);
    standings.forEach((row,index)=>{
        const line=make('div','k4o-standing'+(row.id==='player'?' player':'')+
            (row.id===result.score?.mvp?.id?' mvp':''));
        const name=make('span','k4o-pilot',(index+1)+'. '+row.label);
        const stats=make('span','k4o-stats',
            row.missionKills+' / '+row.assists+' / '+row.disables);
        const points=make('strong','',Math.round(row.totalScore));
        line.title=row.label+' · '+(row.survived?'RETURNED':'OUT')+
            (row.lowParticipation?' · LOW PARTICIPATION':'');
        line.setAttribute('aria-label',line.title+' · '+stats.textContent+
            ' kills assists disables · '+points.textContent+' points');
        line.append(name,stats,points);table.append(line);
    });
    root.append(table);
    if(result.terminal!==false && result.victory){
        const n=(result.score?.draftOrder??[]).indexOf('player');
        root.append(make('div','k4o-foot',n>=0?'SALVAGE PICK #'+(n+1):'TEAM SALVAGE'));
    }else if(result.terminal===false){
        root.append(make('div','k4o-foot','PAYOUT AFTER MATCH'));
    }
    scorePage.append(root);
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
    setGarageAction('RETURN TO GARAGE');
    if (!result?.victory || result.terminal === false || !result.draft ||
        sheet.classList.contains('hidden')) return;

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
    const orderIds = result.score?.draftOrder ?? [];
    const playerTurn = orderIds.indexOf('player') + 1;
    heading.textContent = currentDrafter(result.draft) === 'player'
        ? `YOUR TURN · CLAIM ${playerTurn > 0 ? playerTurn : 1} OF ${Math.max(1, orderIds.length)}`
        : 'SALVAGE COMPLETE';
    const rule = document.createElement('span');
    rule.textContent = currentDrafter(result.draft) === 'player'
        ? 'PICK 1 RECOVERABLE PART · DESTROYED = SCRAP · PERSONAL HARDWARE PROTECTED'
        : 'CLAIM ORDER COMPLETE · PERSONAL HARDWARE PROTECTED';
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
        setGarageAction('RETURN TO GARAGE', 'UNCLAIMED SALVAGE WILL BE FORFEITED', 'forfeit');
    else if (!currentDrafter(result.draft))
        setGarageAction('CLAIM SECURED · RETURN TO GARAGE', 'RECOVERED SERIALS ARE SAVED', 'complete');
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
    const hasSalvage = !!result?.victory && result.terminal !== false;
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
    // Intermediate rounds have a real scorecard, but never expose salvage.
    const result = latestBoutResult() ?? latestRoundResult();
    const newResult = !!result && result !== lastRenderedResult;
    if (newResult) selectedEntryId = null;
    renderScore(result);
    renderDraft(result);
    syncPager(result);
    if (newResult) {
        lastRenderedResult = result;
        currentPageIndex = 0;
        requestAnimationFrame(() => goToPage(0, 'auto'));
    } else if (!result) {
        lastRenderedResult = null;
        selectedEntryId = null;
     }
}

injectStyles();
subscribeBoutResult(render);
subscribeRoundResult(render);
// Report content is mounted exactly once by main.js. A declarative event avoids
// re-rendering touch targets while the player is interacting with them.
document.addEventListener('m3ch4:debrief-opened', render);
render();
