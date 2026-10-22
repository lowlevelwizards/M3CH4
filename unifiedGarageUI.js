/** k.3s.0 — one physical three-bay garage, one contract path, one pit path.
 * Legacy q.0/q.1/q.2 adapters remain data bridges for now but own no visible UX.
 * Viewed rig changes only a Three.js preview; battle-active rig changes at DEPLOY.
 */
import { BY_ID } from './components.js';
import { stationGlyph, stationLabel, conditionFromPart, formatCondition } from './uiLanguage.js';
import { createStationFace, createConditionMeter } from './uiMeters.js';
import { loadCounter } from './usedPartsCounter.js';
import { createPartCard, createPartDetail, installPartGridStyles } from './partGridUI.js?v=k3w0';
import { partCreditValue } from './partEconomy.js';
import { activePlayerArena } from './scene.js';
import { loadMachine } from './persistence.js';
import { soundWorkshop } from './audio.js';
import { loadStable, storeStable, commissionRig, renameRig, rigById } from './stable.js';
import { loadSeries } from './series.js';
import { CAMPAIGN_NODES, availableCampaignNodes, loadCampaign } from './campaign.js';
import { contractById } from './contracts.js';
import {
    assignRigToSortie, beginSortieAssignment, cancelSortieAssignment,
    clearSortieAssignment, loadSortieAssignment,
} from './sortieAssignment.js';
import {
    applyEmergencyFieldPatch, currentIntermissionFieldAction,
    fieldPatchCandidates, fieldWorkCommitment, partLifecycle,
    triageOptions,triagePreview,applyIntermissionTriage,TRIAGE_BUDGET,
    reconcileFieldPatches, clearFieldWorkAll, clearFieldWorkSeries,
} from './fieldWork.js';
import { BAY_IDS, BAY_SLOTS, SLOT_LABELS, bayAssembly, bayPreviewAssembly, bayHealth, bayStatus, bayModuleQuote, bayGeneratorMount } from './garageBay.js';
import { createPaintBooth, clearPaintBoothDraft, togglePaintBoothSlot, paintBoothCurrentEdits } from './paintBoothUI.js';


const key = 'm3ch4-viewed-bay-v1';
const shell = document.createElement('section');
shell.id = 'unified-garage';
shell.setAttribute('aria-label','M3CH4 workspaces');
shell.innerHTML = '<div class="unified-top"></div><div class="workshop-rail" aria-label="Rig stations"></div><div class="workshop-status"></div><nav class="workshop-links" aria-label="Workspaces"></nav><div id="unified-garage-dock"></div><div id="unified-garage-shelf" aria-label="Compatible workshop parts"></div><div id="unified-garage-action"></div><div class="unified-bay-navigation"></div><div class="unified-notice" role="status" aria-live="polite"></div>';
document.body.append(shell);
installPartGridStyles();
const top = shell.querySelector('.unified-top');
const dock = shell.querySelector('#unified-garage-dock');
const rail = shell.querySelector('.workshop-rail');
const statusBar = shell.querySelector('.workshop-status');
const quickLinks = shell.querySelector('.workshop-links');
const shelf = shell.querySelector('#unified-garage-shelf');
const actionBar = shell.querySelector('#unified-garage-action');
const navigator = shell.querySelector('.unified-bay-navigation');
const notice = shell.querySelector('.unified-notice');
const sheet = document.querySelector('#sortie-debrief');
const oldDeploy = document.querySelector('#assembly-toggle');
let storage = null, session = null;
try { storage = window.localStorage; } catch { /* old storage warnings still apply */ }
try { session = window.sessionStorage; } catch { /* display a blocking action message */ }
let viewedId = loadStable(storage).stable.activeRigId || 'rig-01';
let mode = 'garage', selectedSlot = null, selectedHardwareSerial = null, selectedJobId = null;
let identityExpanded = false;
let paintExpanded = false, paintPreviewEdits = null, paintHighlightSlots = null;
let swapExpanded = false, drawerExpanded = false, detailsExpanded = false;
let triageSelected=new Set();let triageRigId=null;
let rackView = 'ready'; // available/current-bay rack, other-bay rack on demand
let selectedLotSerial=null,vendorTableSignature='',vendorShowing=false;
let inventoryFilter='all',inventorySort='station',inventorySerial=null;
let renderScheduled = false, previewSignature = '', noticeTimer = null;
try { viewedId = session?.getItem(key) || viewedId; } catch { /* optional */ }
if (!BAY_IDS.includes(viewedId)) viewedId = 'rig-01';
// A pending q.1 assignment is the authority for restoring sortie setup on reload.
// Never resurrect an already launched contract as a fresh pre-sortie selection.
const restoredAssignment = loadSortieAssignment(session);
if (restoredAssignment?.phase === 'pending' && !loadSeries(storage)) {
    const campaign = loadCampaign();
    if (availableCampaignNodes(campaign).includes(restoredAssignment.contractId)) {
        mode = 'setup';
        selectedJobId = restoredAssignment.contractId;
        if (BAY_IDS.includes(restoredAssignment.rigId)) viewedId = restoredAssignment.rigId;
    }
}

const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = String(text);
    return node;
};
const pct = v => Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 100) + '%';
const rigName = rig => rig?.name || 'RIG ' + String(rig?.bay || 1).padStart(2,'0');
function button(label, action, cls = '', disabled = false) {
    const node = el('button', cls, label);
    node.type = 'button'; node.disabled = disabled;
    node.addEventListener('click', action);
    return node;
}
function message(text, failed = false) {
    soundWorkshop(failed?'reject':'confirm');
    notice.textContent = text;
    notice.classList.toggle('error', failed);
    notice.classList.toggle('shown', true);
    if (noticeTimer !== null) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(()=>{notice.classList.remove('shown');noticeTimer=null;},2700);
}
function data() {
    const stable = loadStable(storage).stable;
    return { stable, series:loadSeries(storage), machine:loadMachine(storage),
        view:bayStatus(stable, viewedId) };
}
function actualMode(series) { return series?.phase === 'intermission' ? 'pit' : mode; }
/** One navigation authority for ordinary workspaces. Never deploy, move
 * serialized hardware, or release a pending assignment by navigating. */
function openWorkspace(target) {
    if (actualMode(loadSeries(storage)) === 'pit') return;
    if (target === 'paint') {
        mode='garage'; paintExpanded=true;
        selectedSlot=null; selectedHardwareSerial=null;
        swapExpanded=false;drawerExpanded=false;detailsExpanded=false;
    } else {
        if (paintExpanded) {
            paintExpanded=false;paintPreviewEdits=null;paintHighlightSlots=null;
            clearPaintBoothDraft();activePlayerArena()?.arena.setPaintSelectedSlots?.(null);
        }
        mode=target;
        selectedSlot=null;selectedHardwareSerial=null;swapExpanded=false;
        drawerExpanded=false;detailsExpanded=false;identityExpanded=false;
        if (target==='vendor') selectedLotSerial=null;
        if (target==='inventory') inventorySerial=null;
        if (target==='contracts') {
            const pending=loadSortieAssignment(session);
            selectedJobId=pending?.phase==='pending'?pending.contractId:null;
        }
    }
    previewSignature='';dock.scrollTop=0;render();
}
function goBack() {
    const state=actualMode(loadSeries(storage));
    if (state==='pit') return;
    if (paintExpanded || state==='vendor' || state==='inventory') {openWorkspace('garage');return;}
    if (state==='setup') {mode='contracts';render();return;}
    if (state==='contracts' && selectedJobId) {selectedJobId=null;render();return;}
    if (state==='contracts') {openWorkspace('garage');return;}
    if (selectedSlot || identityExpanded) {
        selectedSlot=null;selectedHardwareSerial=null;swapExpanded=false;
        drawerExpanded=false;identityExpanded=false;previewSignature='';render();
    }
}
function assignment(stable, jobId, preferredRigId = viewedId) {
    const current = loadSortieAssignment(session);
    if (!session || !jobId) return { ok:false, reason:'SORTIE STORAGE UNAVAILABLE' };
    if (current?.phase !== 'pending' || current.contractId !== jobId) {
        const started = beginSortieAssignment(session, jobId);
        if (!started.ok) return started;
    }
    const committed = fieldWorkCommitment(storage);
    if (committed && committed.rigId !== preferredRigId)
        return { ok:false, reason:'FIELD PATCH COMMITTED ' + committed.rigName };
    const v = bayStatus(stable, preferredRigId);
    if (v.canDeploy) return assignRigToSortie(session, preferredRigId, v.name);
    // Important: an unavailable viewed bay must never silently deploy the previous bay.
    clearSortieAssignment(session);
    return beginSortieAssignment(session, jobId);
}
function selectBay(id) {
    if (!BAY_IDS.includes(id) || id === viewedId) return;
    const committed = fieldWorkCommitment(storage);
    if (actualMode(loadSeries(storage)) === 'pit' && committed) {
        message(committed.rigName + ' IS COMMITTED TO THIS ROUND', true);
        return;
    }
    viewedId = id;
    try { session?.setItem(key, id); } catch { /* local browsing remains possible */ }
    selectedSlot = null; selectedHardwareSerial = null; swapExpanded=false;drawerExpanded=false;detailsExpanded=false;triageSelected.clear();triageRigId=null; rackView='ready'; identityExpanded = false; previewSignature = ''; paintPreviewEdits=null;paintHighlightSlots=null; clearPaintBoothDraft();
    dock.scrollTop = 0; // New machine must never inherit the previous bay's gallery scroll.
    if (mode === 'setup') assignment(loadStable(storage).stable, selectedJobId, id);
    else if (actualMode(loadSeries(storage)) === 'pit') assignment(loadStable(storage).stable, loadSeries(storage).contractId, id);
    render();
}
function stepBay(direction) {
    selectBay(BAY_IDS[Math.max(0,Math.min(BAY_IDS.length-1,BAY_IDS.indexOf(viewedId)+direction))]);
}
function preview(stable, series) {
    if (!document.body.classList.contains('inspecting')) return;
    const arena = activePlayerArena()?.arena;
    if (!arena) return;
    const rig = rigById(stable, viewedId);
    if (!rig) return;
    const fitSerial = actualMode(series)==='garage' && !paintExpanded && swapExpanded && rackView==='ready' &&
        selectedSlot && selectedHardwareSerial && rig.installed[selectedSlot]!==selectedHardwareSerial
        ? selectedHardwareSerial : null;
    const proposed = fitSerial ? bayPreviewAssembly(stable,viewedId,selectedSlot,fitSerial) : null;
    const id = [
        viewedId, JSON.stringify(rig.installed), JSON.stringify(rig.graph),
        proposed ? selectedSlot+':'+fitSerial : '',
        JSON.stringify(rig.playerCondition?.parts),
        stable.inventory.filter(p=>Object.values(rig.installed).includes(p.serial))
            .map(p=>p.serial + ':' + p.condition + ':' + p.destroyed + ':' + JSON.stringify(p.paint)).join('|'),
        JSON.stringify(paintPreviewEdits),
    ].join('::');
    if (previewSignature !== id) {
        previewSignature = id;
        const assembly=proposed || bayAssembly(stable,viewedId);
        for(const edit of paintPreviewEdits||[]) {
            const part=assembly.owned.find(item=>item.serial===edit.serial);
            if(part) {if(edit.paint===null)delete part.paint;else part.paint={...edit.paint};}
        }
        arena.rebuildAssembly(assembly);
        if (rig.playerCondition?.parts && !proposed) arena.updatePilotDamage(rig.playerCondition);
        arena.setPreviewPart?.(proposed?selectedSlot:null);
        arena.selectPart(selectedSlot);
        arena.focusPart(selectedSlot);
    } else {
        arena.setPreviewPart?.(proposed?selectedSlot:null);
        arena.selectPart(selectedSlot);
        arena.focusPart(selectedSlot);
    }
    arena.setPaintSelectedSlots?.(paintExpanded?paintHighlightSlots:null);
}
function navRender(stable, currentMode) {
    navigator.replaceChildren();
    navigator.classList.toggle('hidden', !['garage','setup','pit'].includes(currentMode) || paintExpanded);
    if (!['garage','setup','pit'].includes(currentMode) || paintExpanded) return;
    const view = bayStatus(stable, viewedId);
    navigator.append(button('‹', () => stepBay(-1), 'bay-arrow', viewedId === BAY_IDS[0]));
    const label = el('div','bay-index');
    label.append(el('strong','',view.name.toUpperCase()), el('span','',
        'BAY ' + String(view.rig.bay).padStart(2,'0') + ' / 03 · ' + view.state));
    const dots = el('div','bay-dots');
    BAY_IDS.forEach((id,i) => {
        const dot = button(String(i+1), () => selectBay(id), id === viewedId ? 'selected' : '');
        dot.setAttribute('aria-label','View bay ' + (i+1));
        dot.setAttribute('aria-pressed',String(id===viewedId)); dots.append(dot);
    });
    label.append(dots);
    navigator.append(label,button('›', () => stepBay(1), 'bay-arrow', viewedId === BAY_IDS[2]));
}
function renderTop(currentMode,series,machine) {
    top.replaceChildren();
    const workspace=currentMode==='garage'&&paintExpanded?'paint':currentMode;
    const name=rigName(rigById(loadStable(storage).stable,viewedId)).toUpperCase();
    const heading=workspace==='garage'?name:
        workspace==='paint'?'PAINT BOOTH':workspace==='vendor'?'VENDORS':
        workspace==='inventory'?'INVENTORY':workspace==='contracts'?'SCRAPYARD CIRCUIT':
        workspace==='setup'?'SORTIE SETUP':'ROUND PIT';
    if(workspace!=='garage'&&workspace!=='pit'){
        const back=button('‹ BACK',goBack,'workshop-back');
        back.setAttribute('aria-label','Back from '+heading);top.append(back);
    }
    top.append(el('strong','unified-title',heading));
    if(workspace==='garage') {
        const rename=button('✎',()=>{
            identityExpanded=true;selectedSlot=null;swapExpanded=false;render();
            const input=dock.querySelector('.unified-identity-form input');
            input?.focus();input?.select();
        },'workshop-rename');
        rename.setAttribute('aria-label','Rename '+name);
        rename.title='Edit rig name';
        top.append(rename);
        const actions=el('nav','workshop-top-links');
        for(const [id,label] of [['paint','PAINT'],['vendor','VENDORS'],['inventory','INVENTORY']]){
            const b=button(label,()=>openWorkspace(id),'workshop-top-link');
            b.setAttribute('aria-label','Open '+label.toLowerCase());
            actions.append(b);
        }
        top.append(actions);
    }
    if(workspace==='pit'&&series) {
        const c=contractById(series.contractId);
        top.append(el('small','unified-match',c.name.toUpperCase()+' · R'+series.roundNumber+
            ' · '+series.playerWins+'–'+series.enemyWins));
    }
    top.append(el('small','unified-credits','₡'+Number(machine.economy?.credits??0).toLocaleString()));
}
function renderWorkshopChrome(stable,view) {
    rail.append(moduleStation(view));
    const reset=button('↺',()=>document.querySelector('#inspect-reset')?.click(),'workshop-reset');
    reset.setAttribute('aria-label','Reset garage camera orbit');
    reset.title='Reset camera';statusBar.append(reset);
    statusBar.append(button('◷ HISTORY',()=>{
        identityExpanded=!identityExpanded;selectedSlot=null;
        swapExpanded=false;drawerExpanded=false;render();
    },'workshop-status-action'));
    const pending=loadSortieAssignment(session);
    const job=pending?.phase==='pending'&&!loadSeries(storage)?pending.contractId:null;
    const bottom=el('div','workshop-action-lane');
    const info=el('div','workshop-readiness '+(view.canDeploy?'ready':'blocked'));
    info.append(el('strong','',view.canDeploy?'● READY':'● '+view.state));
    if(job) {
        const contract=contractById(job);
        info.append(button('JOB · '+(contract?.name.toUpperCase()||job)+' ✎',()=>{
            selectedJobId=job;mode='contracts';render();
        },'workshop-job-change'));
    } else if(!view.canDeploy){
        info.append(el('small','',view.reason||'CHECK PARTS'));
    }
    const primary=button(job?'DEPLOY':'SELECT JOB',()=>{
        if(!job) {openWorkspace('contracts');return;}
        selectedJobId=job;mode='setup';render();
    },'workshop-deploy');
    primary.setAttribute('aria-label',job?'Open sortie preparation':'Select a contract');
    bottom.append(info,primary);
    quickLinks.append(bottom);
}
function bayHeader(view) {
    const title = el('div','unified-panel-heading');
    title.append(el('div','unified-panel-name',view.name.toUpperCase()));
    title.append(el('small',view.canDeploy ? 'bay-ready' : 'bay-blocked', view.state));
    return title;
}
function summary(view) {
    const status = el('section','unified-bay-summary');
    const inspect = view.readiness.inspection;
    if (view.reason) status.append(el('div','unified-warning',view.reason));
    if (inspect) {
        const metrics = el('div','unified-metrics');
        metrics.append(el('span','',Math.round(inspect.massKg).toLocaleString() + ' KG'));
        metrics.append(el('span','',inspect.powerUsedKw + ' / ' + inspect.powerAvailableKw + ' KW'));
        status.append(metrics);
    }
    return status;
}
const STATION_GLYPHS = Object.freeze(Object.fromEntries(BAY_SLOTS.map(slot=>[slot,stationGlyph(slot)])));
function moduleStation(view) {
    const station = el('section','unified-stations');
    for (const item of view.health) {
        const weakest = Math.min(item.condition, item.armorRatio);
        const state = !item.serial ? 'empty' : item.destroyed ? 'destroyed'
            : item.condition <= .001 ? 'disabled' : weakest < .38 ? 'critical'
            : weakest < .995 ? 'damaged' : 'operational';
        const node = button('', () => {
            if (selectedSlot !== item.slot) {
                selectedHardwareSerial = null;swapExpanded=!item.serial;drawerExpanded=false;
                detailsExpanded=false;rackView='ready';
            }
            selectedSlot = item.slot; // Repeated taps always open details.
            identityExpanded=false; // Inspect and machine history never stack.
            dock.scrollTop = 0;
            render();
            if (!paintExpanded) activePlayerArena()?.arena.revealPart?.(item.slot);
        }, 'unified-station state-' + state + (selectedSlot === item.slot ? ' selected' : ''));
        node.append(createStationFace(item.slot,item));
        node.title=item.serial ? formatCondition(conditionFromPart(item)) : 'EMPTY STATION';
        node.setAttribute('aria-label',stationLabel(item.slot)+' · '+node.title);
        node.setAttribute('aria-pressed',String(selectedSlot===item.slot));
        station.append(node);
    }
    return station;
}
function emitEdit(type, info) {
    const payload = { ...info, result:null };
    document.dispatchEvent(new CustomEvent(type,{detail:payload}));
    return payload.result || { ok:false, reason:'GARAGE CONTROLS NOT READY' };
}
function moduleDetails(stable, view, machine) {
    const slot = selectedSlot;
    const box = el('section','unified-modules');
    box.classList.toggle('replacing',swapExpanded);
    box.classList.toggle('drawer-open',drawerExpanded);
    const state = view.health.find(s => s.slot === slot);
    const heading=el('div','rig-part-identity');
    const partName=state?.part?BY_ID.get(state.part.definitionId)?.name||stationLabel(slot):stationLabel(slot)+' · EMPTY MOUNT';
    const identity=el('div','workshop-part-heading');
    identity.append(el('strong','unified-section-name',partName));
    if(state?.serial)identity.append(el('small','workshop-part-serial',state.serial));
    heading.append(identity);
    heading.append(button('×',()=>{
        selectedSlot=null;selectedHardwareSerial=null;swapExpanded=false;drawerExpanded=false;detailsExpanded=false;dock.scrollTop=0;render();
    },'unified-close'));
    box.append(heading);
    const installed = state?.part;
    // Accessible details live on the selected part card, not repeated as a
    // paragraph above the rack; normal garage use needs no prose to read.
    box.dataset.station=slot;
    if (installed && !swapExpanded) {
        // Optional service action remains real and serial-authoritative.
        box.dataset.integrity=String(Math.round(state.condition*100));
        box.dataset.armor=String(Math.round(state.armorRatio*100));
        const quote = bayModuleQuote(stable, viewedId, slot);
        if (quote && (quote.amount > 0 || state.condition < 1)) {
            const affordable = quote.destroyed || quote.amount <= machine.economy.credits;
            box.append(button(
                (quote.destroyed ? 'REBUILD' : 'REPAIR') + ' · ₡' + quote.amount,
                () => {
                    const result = emitEdit('m3ch4:bay-service',{rigId:viewedId,slot});
                    message(result.ok ? (quote.destroyed ? 'REBUILT · ' : 'SERVICED · ') + installed.serial : result.reason, !result.ok);
                    if (result.ok) { soundWorkshop('service');previewSignature=''; render(); }
                },'unified-service',!affordable));
        }
    }
    if (installed && slot === 'power' && !swapExpanded) {
        const currentMount = bayGeneratorMount(stable, viewedId);
        const positions = el('section','unified-mount-options');
        positions.append(el('div','unified-section-name','PHYSICAL GENERATOR MOUNT'));
        for (const [position,label] of [['standard','REAR / DIRECT'],['offset','LEFT OUTRIGGER / +85 KG']]) {
            positions.append(button(label,()=>{
                const result=emitEdit('m3ch4:bay-generator-mount',{rigId:viewedId,position});
                message(result.ok?'GENERATOR MOUNTED · '+label:result.reason,!result.ok);
                if(result.ok){previewSignature='';render();}
            },position===currentMount?'unified-mount-selected':'',position===currentMount));
        }
        box.append(positions);
    }
    if (installed && !swapExpanded) {
        const def=BY_ID.get(installed.definitionId);
        const picture=activePlayerArena()?.arena.partThumbnailDataUrl?.(installed.definitionId,{
            condition:state.condition,destroyed:state.destroyed,paint:installed.paint,
        });
        const body=el('div','workshop-inspector-body');
        const image=el('div','workshop-part-preview');
        if(picture) {
            const img=el('img');img.src=picture;img.alt=def?.name+' 3D model';
            img.draggable=false;image.append(img);
        } else image.append(el('span','',stationGlyph(slot)));
        body.append(image);
        const readout=el('div','workshop-part-readout');
        readout.append(createConditionMeter(conditionFromPart(state),{showNumbers:true,slot}));
        readout.append(el('div','garage-spec-line',
            (def?.massKg??0)+' KG · '+Math.abs(def?.powerKw||0)+' KW'));
        body.append(readout);
        box.append(body);
        if(def?.description)box.append(el('p','garage-part-description',def.description));
        if(slot==='structure'&&Object.keys(view.rig.installed).some(key=>key!=='structure'))
            box.append(el('small','unified-owner-note','REMOVE ATTACHED PARTS BEFORE THE FRAME.'));
    }
    if(!installed&&!swapExpanded)box.append(el('small','garage-empty-label','EMPTY SOCKET · CHOOSE A PART'));
    const actions=el('div','garage-part-actions');
    actions.append(button(swapExpanded?'‹ INSPECT':installed?'REPLACE':'INSTALL',()=>{
        swapExpanded=!swapExpanded;drawerExpanded=false;selectedHardwareSerial=null;
        rackView='ready';dock.scrollTop=0;render();
    },'unified-swap-toggle'));
    if(installed&&!swapExpanded) {
        const remove=button('REMOVE',()=>editModule(slot,null),'unified-remove-icon');
        remove.setAttribute('aria-label','Remove '+installed.serial);actions.append(remove);
    }
    box.append(actions);
    if(!swapExpanded)return box;
    // Reuse the original physical part-gallery components and their cached 3D
    // gameplay-mesh thumbnails. Selection is separate from mounting: a part fitted
    // to another rig must remain inspectable but cannot be silently transferred.
    const choices = el('div','unified-part-gallery part-grid');
    if (!drawerExpanded) {
        const shelfTop=el('div','garage-shelf-title');
        shelfTop.append(el('strong','',stationLabel(slot)+' · PARTS SHELF'));
        shelfTop.append(button('ALL PARTS ↗',()=>{drawerExpanded=true;render();},'garage-shelf-expand'));
        shelf.append(shelfTop);
    } else {
        box.append(button('‹ COMPACT SHELF',()=>{drawerExpanded=false;render();},'garage-drawer-close'));
    }
    const owned = stable.inventory.filter(part => BY_ID.get(part.definitionId)?.slot === slot);
    if (selectedHardwareSerial && !owned.some(part => part.serial === selectedHardwareSerial))
        selectedHardwareSerial = null;
    if (!owned.length) choices.append(el('p','unified-muted','NO PARTS · COUNTER'));

    const ownerFor = serial => stable.rigs.find(rig =>
        Object.values(rig.installed).includes(serial));
    const ownerCondition = part => {
        const owner=ownerFor(part.serial);
        return owner ? bayHealth(stable,owner.id).find(item=>item.slot===slot&&item.serial===part.serial) : null;
    };
    const entryFor = part => {
        const definition=BY_ID.get(part.definitionId), actual=ownerCondition(part);
        return {
            id:'garage:'+part.serial, serial:part.serial, sourceSerial:part.serial,
            slot:definition.slot, definitionId:definition.id, name:definition.name,
            condition:actual?.condition ?? part.condition,
            destroyed:!!part.destroyed || !!actual?.destroyed,
            paint:part.paint,
        };
    };
    const thumbnailFor = (part, entry) =>
        activePlayerArena()?.arena.partThumbnailDataUrl?.(part.definitionId, entry) ?? null;

    // Available hardware is visually separated from another machine's fitted
    // components. Ownership is physical and exclusive; no one-tap stealing.
    const available=owned.filter(part=>{
        const owner=ownerFor(part.serial);
        return !owner || owner.id===viewedId;
    });
    const elsewhereParts=owned.filter(part=>{
        const owner=ownerFor(part.serial);
        return !!owner && owner.id!==viewedId;
    });
    const tabs=el('div','rig-gallery-tabs');
    const chooseRack=value=>{
        rackView=value;
        selectedHardwareSerial=null;
        dock.scrollTop=0;
        render();
    };
    const addTab=(value,label,count)=>{
        const node=button(label+' '+count,()=>chooseRack(value),
            rackView===value?'active':'');
        node.setAttribute('aria-pressed',String(rackView===value));
        tabs.append(node);
    };
    addTab('ready','STORED / HERE',available.length);
    addTab('other','OTHER BAYS',elsewhereParts.length);
    (drawerExpanded?box:shelf).append(tabs);
    const visibleParts=rackView==='other'?elsewhereParts:available;
    if (selectedHardwareSerial && !visibleParts.some(part=>part.serial===selectedHardwareSerial))
        selectedHardwareSerial=null;
    if(!visibleParts.length)choices.append(el('p','unified-muted',
        rackView==='other'?'NO PARTS FITTED IN OTHER BAYS':'NO AVAILABLE PARTS'));
    for (const part of visibleParts) {
        const owner = ownerFor(part.serial);
        const elsewhere = owner && owner.id !== viewedId;
        const here = installed?.serial === part.serial;
        const entry = entryFor(part);
        const definition = BY_ID.get(part.definitionId);
        const value = partCreditValue(definition, part.condition,
            { destroyed: part.destroyed, wear: part.wear });
        const card = createPartCard({
            entry, thumbnailUrl: thumbnailFor(part, entry), value,
            selected: selectedHardwareSerial === part.serial,
            source: here ? 'FITTED HERE' : elsewhere ? 'BAY '+String(owner.bay).padStart(2,'0')+' · FITTED' : 'IN STORAGE',
            onSelect: () => { selectedHardwareSerial = part.serial; render(); },
        });
        card.classList.add('unified-part-card');
        const actual=ownerCondition(part);
        card.append(createConditionMeter({
            serial:part.serial, condition:actual?.condition??part.condition,
            armorRatio:actual?.armorRatio??1,wear:part.wear,destroyed:!!part.destroyed,
        },{compact:true,slot}));
        card.title = definition.name + ' · ' + part.serial +
            (elsewhere ? ' · mounted on ' + rigName(owner) : '');
        choices.append(card);
    }
    const focused = owned.find(part => part.serial === selectedHardwareSerial);
    if (focused) {
        const owner = ownerFor(focused.serial);
        const elsewhere = owner && owner.id !== viewedId;
        const here = installed?.serial === focused.serial;
        const definition = BY_ID.get(focused.definitionId);
        const entry = entryFor(focused);
        const value = partCreditValue(definition, focused.condition,
            { destroyed: focused.destroyed, wear: focused.wear });
        const detail = createPartDetail({
            entry, thumbnailUrl: thumbnailFor(focused, entry), value,
            meta: definition.massKg + ' KG · WEAR '+
                Math.round((focused.wear??0)*100)+'%'+
                (elsewhere?' · BAY '+String(owner.bay).padStart(2,'0'):''),

            actionLabel: here ? null :
                elsewhere ? 'FITTED · BAY ' + String(owner.bay).padStart(2,'0') :
                'INSTALL · ' + focused.serial,
            actionDisabled: !!elsewhere,
            onAction: () => editModule(slot, focused.serial),
        });
        detail.classList.add('unified-part-detail','rig-part-focus');
        const info=detail.querySelector('.part-detail-meta');
        if(info)info.textContent=focused.serial+' · '+definition.massKg+' KG · WEAR '+
            Math.round((focused.wear??0)*100)+'%';
        const installedDef=installed?BY_ID.get(installed.definitionId):null;
        if(installedDef && installed?.serial!==focused.serial){
            const diffKg=definition.massKg-installedDef.massKg;
            const diffKw=definition.powerKw-installedDef.powerKw;
            const compare=el('div','rig-part-delta',
                'Δ '+(diffKg>0?'+':'')+diffKg+' KG  ·  '+
                (diffKw>0?'+':'')+diffKw+' KW');
            compare.setAttribute('aria-label','Compared to current part: mass difference '+
                diffKg+' kilograms, rated power difference '+diffKw+' kilowatts');
            detail.querySelector('.part-detail-copy')?.append(compare);
        }
        const copy=detail.querySelector('.part-detail-copy');
        if(copy){
            const condition=ownerCondition(focused);
            const meter=createConditionMeter({
                serial:focused.serial,condition:condition?.condition??focused.condition,
                armorRatio:condition?.armorRatio??1,wear:focused.wear,
                destroyed:!!focused.destroyed,
            },{showNumbers:true,slot});
            const reading=el('div','rig-selected-part');
            reading.append(meter,el('span','rig-part-meta','◉ INTEGRITY  /  ◇ ARMOR'));
            copy.insertBefore(reading,copy.querySelector('.part-detail-action'));
        }
        (drawerExpanded?box:shelf).append(detail);
        if(elsewhere) {
            box.append(el('p','unified-owner-note',
                'FITTED · '+rigName(owner).toUpperCase()+' · REMOVE THERE FIRST'));
            box.append(button('OPEN BAY '+String(owner.bay).padStart(2,'0')+' · '+rigName(owner).toUpperCase(),
                ()=>{
                    selectBay(owner.id);
                    if(viewedId===owner.id) {
                        selectedSlot=slot;selectedHardwareSerial=focused.serial;dock.scrollTop=0;render();
                    }
                },'unified-owner-action'));
        }
    }
    if (drawerExpanded) box.append(choices);
    else shelf.insertBefore(choices,shelf.querySelector('.unified-part-detail'));
    return box;
}
function editModule(slot,serial) {
    if (actualMode(loadSeries(storage)) !== 'garage') { message('PIT LOCKED · NO PART CHANGES',true);return; }
    const result=emitEdit('m3ch4:bay-module',{rigId:viewedId,slot,serial});
    message(result.ok ? (serial ? 'PART INSTALLED · '+serial : 'PART REMOVED') : result.reason,!result.ok);
    if(result.ok) {
        soundWorkshop(serial?'install':'remove');
        selectedHardwareSerial=null;rackView='ready';drawerExpanded=false;
        swapExpanded=!serial;previewSignature='';render();
    }
}
function appendIdentityForm(view, stable) {
    const wrap=el('section','unified-identity-form');
    const input=el('input');
    input.type='text';input.maxLength=32;
    input.placeholder=view.rig.commissioned?'MACHINE NAME':'NAME NEW MACHINE';
    input.value=view.rig.commissioned?view.rig.name:'';
    input.setAttribute('aria-label','Machine name');
    const action=button(view.rig.commissioned?'RENAME':'COMMISSION',()=>{
        const loaded=loadStable(storage),rig=rigById(loaded.stable,viewedId);
        const result=rig.commissioned?renameRig(loaded.stable,viewedId,input.value):
            commissionRig(loaded.stable,viewedId,input.value);
        if(!result.ok) {message(result.reason,true);return;}
        if(!storeStable(storage,loaded.stable)){message('STABLE SAVE FAILED',true);return;}
        message('RIG '+(rig.commissioned?'SAVED':'COMMISSIONED'));previewSignature='';render();
    },'',!view.rig.commissioned&&!view.readiness.fieldable);
    wrap.append(input,action);
    return wrap;
}

function renderGarage(stable,machine,view) {
    if(paintExpanded) {
        dock.append(createPaintBooth({
            stable,rigId:viewedId,storage,
            onPreview:edits=>{paintPreviewEdits=edits;previewSignature='';preview(stable,loadSeries(storage));},
            onRefresh:()=>render(),
            onSaved:()=>{
                soundWorkshop('paint');
                document.dispatchEvent(new CustomEvent('m3ch4:paint-committed'));
                paintPreviewEdits=null;previewSignature='';render();
            },
            onTeamSaved:()=>document.dispatchEvent(new CustomEvent('m3ch4:team-livery-committed')),
            onMessage:message,
            thumbnailFor:(id,state)=>activePlayerArena()?.arena.partThumbnailDataUrl?.(id,state),
            rigThumbnailFor:assembly=>activePlayerArena()?.arena.rigThumbnailDataUrl?.(assembly),
            onSelection:slots=>{
                paintHighlightSlots=slots;
                activePlayerArena()?.arena.setPaintSelectedSlots?.(slots);
            },
        }));
        return;
    }
    if (selectedSlot) dock.append(moduleDetails(stable,view,machine));
    if (!identityExpanded) return;
    const title=el('div','workshop-machine-heading');
    title.append(el('strong','',view.name.toUpperCase()),
        button('×',()=>{identityExpanded=false;render();},'unified-close'));
    dock.append(title,summary(view));
    const quotes=view.health.filter(item=>item.part&&!item.destroyed)
        .map(item=>({item,quote:bayModuleQuote(stable,viewedId,item.slot)}))
        .filter(row=>row.quote?.amount>0);
    if(quotes.length>=2){
        const total=quotes.reduce((sum,row)=>sum+row.quote.amount,0);
        const serviceAll=button('REPAIR '+quotes.length+' PARTS · ₡'+total,()=>{
            const current=data();
            const fresh=quotes.map(row=>bayModuleQuote(current.stable,viewedId,row.item.slot));
            const amount=fresh.reduce((sum,q)=>sum+(q?.amount||0),0);
            if(amount>current.machine.economy.credits){message('NOT ENOUGH CREDITS',true);return;}
            let repaired=0,problem=null;
            for(const row of quotes){
                const result=emitEdit('m3ch4:bay-service',{rigId:viewedId,slot:row.item.slot});
                if(!result.ok){problem=result.reason;break;}
                repaired++;
            }
            message(problem?'SERVICED '+repaired+' · '+problem:'SERVICED '+repaired+' PARTS',!!problem);
            if(repaired){soundWorkshop('service');previewSignature='';render();}
        },'unified-service unified-service-all',total>machine.economy.credits);
        dock.append(serviceAll);
    }
    const completed=view.health.filter(item=>!!item.serial).length;
    const history=el('div','workshop-machine-history');
    history.append(el('small','',completed+' / 5 STATIONS · '+
        view.rig.career.deployments+' DEPLOYMENTS · '+
        view.rig.career.roundWins+' WINS · '+
        (view.rig.career.fieldServices||0)+' FIELD PATCHES'));
    dock.append(history,appendIdentityForm(view,stable));
}
function renderCounter(machine) {
    const campaign=loadCampaign(storage);
    const {stock,persisted}=loadCounter(storage,campaign.sorties);
    const offers=stock.offers;
    const viewing=offers.find(item=>item.serial===selectedLotSerial);
    if(!viewing) selectedLotSerial=(offers.find(item=>!item.sold)||offers[0]).serial;
    const chosen=offers.find(item=>item.serial===selectedLotSerial);
    const heading=el('section','counter-intro');
    heading.append(el('strong','','THE BACKLOT PARTS COUNTER'));
    heading.append(el('p','','FOUR AS-IS LOTS. NO GUARANTEES. NO REFUNDS.'));
    heading.append(el('small','',
        'NEW STOCK AFTER YOUR NEXT COMPLETED CONTRACT · LOT '+String(campaign.sorties+1).padStart(2,'0')));
    dock.append(heading);
    const tiles=el('section','counter-lots part-grid');
    const arena=activePlayerArena()?.arena;
    for (const offer of offers) {
        const def=BY_ID.get(offer.definitionId);
        const card=createPartCard({
            entry:{id:offer.id,sourceSerial:offer.serial,definitionId:offer.definitionId,
                name:def.name,slot:def.slot,condition:offer.condition,
                destroyed:false},
            thumbnailUrl:arena?.partThumbnailDataUrl?.(offer.definitionId,offer)??null,
            value:offer.price,source:offer.sold?'SOLD':'AS-IS',
            selected:offer.serial===selectedLotSerial,claimed:offer.sold,
            onSelect:()=>{selectedLotSerial=offer.serial;render();},
        });
        card.classList.add('counter-lot');
        card.setAttribute('aria-label',def.name+' · '+offer.serial+' · '+
            Math.round(offer.condition*100)+' percent · ₡'+offer.price+
            (offer.sold?' · sold':' · for sale'));
        tiles.append(card);
    }
    dock.append(tiles);
    const def=BY_ID.get(chosen.definitionId);
    const yardValue=partCreditValue(def,chosen.condition,{wear:chosen.wear});
    const details=createPartDetail({
        entry:{id:chosen.id,sourceSerial:chosen.serial,name:def.name,
            definitionId:def.id,slot:def.slot,condition:chosen.condition},
        thumbnailUrl:arena?.partThumbnailDataUrl?.(chosen.definitionId,chosen)??null,
        value:chosen.price,
        meta:'CONDITION '+pct(chosen.condition)+' · WEAR '+pct(chosen.wear)+
            '\nPRIOR REPAIRS '+chosen.repairs+' · YARD VALUE ≈ ₡'+yardValue+
            '\nASKING ₡'+chosen.price+' · SOLD AS-IS'+
            (chosen.sold?'\nSOLD · EMPTY TABLE SLOT':''),
        actionLabel:chosen.sold?'SOLD OUT':!persisted?'COUNTER UNAVAILABLE':
            machine.economy.credits<chosen.price?
                'NEED ₡'+(chosen.price-machine.economy.credits)+' MORE':
                'BUY SERIAL '+chosen.serial+' · ₡'+chosen.price,
        actionDisabled:chosen.sold||!persisted||machine.economy.credits<chosen.price,
        onAction:()=>{
            const result=emitEdit('m3ch4:counter-buy',{serial:chosen.serial});
            message(result.ok?
                'PURCHASED '+chosen.serial+' · STORED IN PARTS RACK':result.reason,!result.ok);
            if(result.ok) {vendorTableSignature='';render();}
        },
    });
    details.classList.add('counter-lot-detail');
    const asking=details.querySelector('.part-detail-value');
    if(asking) asking.textContent='ASKING PRICE · ₡'+chosen.price.toLocaleString();
    dock.append(details);
    dock.append(el('p','unified-muted',
        stock.offers.every(lot=>lot.sold)
            ? 'SOLD OUT. NEW LOTS AFTER YOUR NEXT COMPLETED CONTRACT.'
            : 'SOME PARTS COST MORE TO REPAIR THAN THEY ARE WORTH. INSPECT BEFORE BUYING.'));
    const visualKey=stock.cycle+':'+offers.map(offer=>offer.serial+':'+offer.sold).join('|');
    if(arena) {
        if(visualKey!==vendorTableSignature){
            arena.setVendorStock(offers);
            vendorTableSignature=visualKey;
        }
        arena.selectVendorLot(selectedLotSerial);
    }
}
function takeContract(stable,jobId) {
    const result=beginSortieAssignment(session,jobId);
    if (!result.ok) {message(result.reason,true);return;}
    selectedJobId = jobId;
    assignment(stable,jobId,viewedId);
    // Choosing a job returns to workshop, deployment commits in sortie setup.
    mode='garage';dock.scrollTop=0;render();
}
function renderContracts(stable) {
    const campaign=loadCampaign();
    const unlocked=availableCampaignNodes(campaign);
    if (selectedJobId && unlocked.includes(selectedJobId)) {
        const c=contractById(selectedJobId);
        const detail=el('section','unified-contract-detail');
        detail.append(el('small','unified-muted','CONTRACT BRIEFING'));
        detail.append(el('strong','',c.name.toUpperCase()));
        detail.append(el('div','unified-job-compact',
            c.objective.label + ' · RISK ' + c.risk.toUpperCase() + ' · ₡' + c.payout));
        detail.append(el('p','',c.briefing));
        detail.append(el('div','unified-muted','OBJECTIVE · ' + c.objective.description));
        /* Opposing crew palettes belong on the battlefield, not on the job briefing. */
        /* const crew=contractCrew(c.id);
        const livery=el('div','unified-contract-livery');
        const band=el('div','unified-crew-swatches');
        for(const color of Object.values(crew.colors)){
            const swatch=el('i');swatch.style.background=color;band.append(swatch);
        }
        livery.append(el('small','','OPPOSING CREW · '+crew.name),band);
        detail.append(livery); */
        detail.append(el('div','unified-muted','KNOWN EQUIPMENT · '+c.knownEquipment.join(' / ')));
        detail.append(el('div','unified-muted','SALVAGE · '+c.salvageHint));
        dock.append(detail);
        setPrimary('TAKE CONTRACT · ₡' + c.payout,()=>takeContract(stable,c.id));
        return;
    }
    selectedJobId = null;
    // Keep this as a genuine unlock graph, not a flat list. All links are
    // derived from prereqs in campaign.js; coordinates are presentation only.
    const list=el('section','unified-campaign-map');
    list.setAttribute('aria-label','Connected Scrapyard Circuit contracts');
    const locations={
        'yard-dog':[150,38], 'recovery-run':[49,140], cutter:[150,140],
        domination:[251,140], mule:[150,244], 'circuit-final':[150,347],
    };
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 300 385');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('aria-hidden','true');
    for(const node of CAMPAIGN_NODES) {
        if(!node.prereq)continue;
        const origin=locations[node.prereq],end=locations[node.id];
        if(!origin||!end)continue;
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d','M '+origin[0]+' '+(origin[1]+25)+' V '+(end[1]-50)+
            ' H '+end[0]+' V '+(end[1]-26));
        path.setAttribute('class','campaign-link'+
            (campaign.clearedNodes.includes(node.prereq)?' unlocked':''));
        svg.append(path);
    }
    list.append(svg);
    for(const node of CAMPAIGN_NODES) {
        const c=contractById(node.id),available=unlocked.includes(node.id);
        const choice=button('',()=>{selectedJobId=c.id;dock.scrollTop=0;render();},
            'unified-contract '+(available?'':' locked'), !available);
        choice.dataset.node=node.id;
        choice.classList.add('campaign-node-tile');
        choice.append(el('span','node-stage',node.stage));
        choice.append(el('strong','',c.name.toUpperCase()),el('small','',
            c.objective.label.toUpperCase()+' · RISK '+c.risk.toUpperCase()+' · ₡'+c.payout));
        choice.append(el('small','',!available?'LOCKED':campaign.clearedNodes.includes(c.id)?'CLEARED · REPLAY':'AVAILABLE'));
        if(!node.required)choice.append(el('small','node-optional','OPTIONAL'));
        list.append(choice);
    }
    dock.append(list);
}
function renderStationReadout(view) {
    if (!selectedSlot) return null;
    const current=view.health.find(item=>item.slot===selectedSlot);
    if(!current) return null;
    const group=el('div','unified-station-readout');
    const partName=current.part ? BY_ID.get(current.part.definitionId)?.name ??
        current.part.definitionId : 'EMPTY STATION';
    group.append(el('strong','',stationLabel(selectedSlot)+' · '+partName));
    if(current.serial) {
        const line=el('div','rig-recovery-line');
        line.append(createConditionMeter(conditionFromPart(current),{compact:true,slot:selectedSlot}));
        line.append(el('small','',current.serial+' · '+current.label));
        group.append(line);
    }
    return group;
}
function renderSetup(stable, view) {
    if (!selectedJobId) {mode='contracts';render();return;}
    const c=contractById(selectedJobId);
    dock.append(el('div','unified-job-compact',c.name.toUpperCase()+' · RISK '+
        c.risk.toUpperCase()+' · ₡'+c.payout),bayHeader(view),summary(view),moduleStation(view));
    const readout=renderStationReadout(view);
    if (readout) dock.append(readout);
    // Bay navigation is always visible; the inspection is contextual.
    if (!view.canDeploy) dock.append(el('p','unified-warning',view.reason || 'MACHINE NOT COMMISSIONED'));
    // Repairs are made in the real garage, not by a shadow setup editor.
    // Keep the pending contract when returning to work on the rig.
    dock.append(button('‹ WORK ON RIG',()=>openWorkspace('garage'),'unified-secondary workshop-return-to-rig'));
    setPrimary('DEPLOY '+view.name.toUpperCase(),()=>launch(stable,c.id),!view.canDeploy);
}
function patchInPit(stable,view,series) {
    const wrap=el('section','unified-field-work');
    const action=currentIntermissionFieldAction(storage,series);
    const committed=fieldWorkCommitment(storage);
    wrap.append(el('strong','unified-section-name',action?'PIT CREW · COMMITTED':'PIT CREW · TRIAGE'));
    if(action){
        const owner=rigById(stable,action.rigId);
        const repairs=action.type==='triage'?(action.repairs||[]):[action];
        wrap.append(el('p','unified-patch-proof',rigName(owner).toUpperCase()+' · '+
            repairs.map(r=>SLOT_LABELS[r.slot]+' '+pct(r.restoredCondition??action.restoredCondition)).join(' / ')));
        wrap.append(el('small','unified-warning','COMMITTED TO ROUND '+series.roundNumber));
        return wrap;
    }
    if(triageRigId!==viewedId){
        triageRigId=viewedId;triageSelected.clear();
        let units=TRIAGE_BUDGET;
        const candidates=triageOptions(stable,viewedId).sort((a,b)=>
            (a.condition<=.001?0:1)-(b.condition<=.001?0:1)||a.condition-b.condition);
        for(const c of candidates)if(c.cost<=units){triageSelected.add(c.slot);units-=c.cost;}
    }
    const options=triageOptions(stable,viewedId);
    if(!options.length){
        wrap.append(el('small','unified-muted','NO REPAIRABLE CRITICAL SYSTEMS · SEND MACHINE AS IS'));
        return wrap;
    }
    const plan=triagePreview(stable,viewedId,[...triageSelected]);
    wrap.append(el('div','unified-pit-budget','WORK UNITS · '+plan.cost+' / '+TRIAGE_BUDGET+
        ' · '+(plan.fieldable?'FIELDABLE AFTER SERVICE':'NOT READY')));
    for(const candidate of options){
        const selected=triageSelected.has(candidate.slot);
        const b=button((selected?'☑ ':'☐ ')+SLOT_LABELS[candidate.slot]+' · '+
            pct(candidate.condition)+' → 30% · '+candidate.cost+' UNIT'+(candidate.cost===1?'':'S'),()=>{
            if(selected)triageSelected.delete(candidate.slot);
            else triageSelected.add(candidate.slot);
            render();
        },'unified-triage-choice'+(selected?' active':''));
        b.setAttribute('aria-pressed',String(selected));wrap.append(b);
    }
    wrap.append(el('small','unified-muted','LIMITED LABOR · 18% ARMOR FLOOR ON SERVICED PARTS · NO SHOP REBUILDS'));
    const commit=button('COMMIT TRIAGE · '+plan.cost+' / '+TRIAGE_BUDGET,()=>{
        const selected=[...triageSelected];
        const check=triagePreview(stable,viewedId,selected);
        if(!check.valid||!check.fieldable){message('TRIAGE MUST RESTORE A FIELDABLE MACHINE',true);return;}
        const assign=assignment(stable,series.contractId,viewedId);
        if(!assign.ok){message(assign.reason,true);return;}
        const result=applyIntermissionTriage(storage,{seriesId:series.id,rigId:viewedId,slots:selected});
        message(result.ok?'PIT TRIAGE COMPLETE · ROUND '+series.roundNumber+' COMMITTED':result.reason,!result.ok);
        if(result.ok){
            soundWorkshop('service');
            document.dispatchEvent(new CustomEvent('m3ch4:bay-reconcile-patch',{detail:result.action}));
            window.location.reload();
        }
    },'unified-service',!plan.valid||!plan.fieldable||!!committed);
    wrap.append(commit);
    return wrap;
}
function renderPit(stable,view,series) {
    const patch=currentIntermissionFieldAction(storage,series);
    if(patch?.rigId===viewedId && !selectedSlot)selectedSlot=patch.slot;
    const contract=contractById(series.contractId);
    // The contract and score are already shown in the fixed top bar.
    dock.append(bayHeader(view),summary(view),moduleStation(view));
    const readout=renderStationReadout(view);
    if (readout) dock.append(readout);
    dock.append(el('small','unified-pit-lock','🔒 PIT · FOUR WORK UNITS · NO PART SWAPS'));
    dock.append(patchInPit(stable,view,series));
    const committed=fieldWorkCommitment(storage);
    const canGo=view.canDeploy && (!committed || committed.rigId===viewedId);
    setPrimary((committed?'DEPLOY ':'SEND ')+view.name.toUpperCase()+' · ROUND '+series.roundNumber,
        ()=>launch(stable,series.contractId), !canGo);
}
function setPrimary(label,callback,disabled=false) {
    actionBar.replaceChildren(button(label,callback,'unified-primary',disabled));
}
function launch(stable,jobId) {
    const series=loadSeries(storage);
    const current=bayStatus(stable,viewedId);
    if(!current.canDeploy){message(current.reason||'MACHINE IS NOT FIELDABLE',true);return;}
    const committed=fieldWorkCommitment(storage);
    if(committed && committed.rigId!==viewedId){message('PATCH COMMITTED '+committed.rigName,true);return;}
    const result=assignment(stable,jobId,viewedId);
    if(!result.ok){message(result.reason,true);return;}
    if(!oldDeploy){message('DEPLOY CONTROL UNAVAILABLE',true);return;}
    // The q.1 boundary remains the single persistence/contract commit authority.
    // It projects the exact rig, verifies the commitment after reload, then launches.
    oldDeploy.click();
}
function render() {
    if(!document.body.classList.contains('inspecting'))return;
    // Keep the focused gallery and its installation action in view when the
    // selected serial changes; rebuilding the DOM must not jump back to the top.
    const previousScroll = dock.scrollTop;
    const {stable,series,machine}=data();
    reconcileFieldPatches(storage,stable);
    const view=bayStatus(stable,viewedId);
    const state=actualMode(series);
    if(state!=='garage' && paintPreviewEdits){paintPreviewEdits=null;previewSignature='';}
    if(state==='pit') {
        const committed=fieldWorkCommitment(storage);
        if(committed && viewedId!==committed.rigId){viewedId=committed.rigId;previewSignature='';return render();}
    }
    renderTop(state,series,machine);
    actionBar.replaceChildren();
    dock.replaceChildren();
    shelf.replaceChildren();
    rail.replaceChildren();statusBar.replaceChildren();quickLinks.replaceChildren();
    const selling=state==='vendor';
    const arena=activePlayerArena()?.arena;
    if(selling!==vendorShowing) {
        arena?.setVendorMode(selling);
        vendorShowing=selling;
        previewSignature='';
    }
    if(state==='garage') {
        if(!paintExpanded)renderWorkshopChrome(stable,view);
        renderGarage(stable,machine,view);
    }
    else if(state==='contracts')renderContracts(stable);
    else if(state==='setup')renderSetup(stable,view);
    else if(state==='pit')renderPit(stable,view,series);
    else if(state==='vendor')renderCounter(machine);
    else if(state==='inventory')renderInventory(stable);
    navRender(stable,state);
    if (!selling) preview(stable,series);
    dock.scrollTop = previousScroll;
    shell.classList.toggle('has-primary',actionBar.childElementCount>0);
    shell.dataset.mode=state;
    shell.dataset.workspace=state==='garage' && paintExpanded?'paint':state;
    shell.classList.toggle('tool-open',state==='garage'&&!paintExpanded&&(!!selectedSlot||identityExpanded));
    shell.classList.toggle('replacing',state==='garage'&&!paintExpanded&&!!selectedSlot&&swapExpanded);
    shell.classList.toggle('drawer-open',state==='garage'&&!paintExpanded&&drawerExpanded);
    document.dispatchEvent(new CustomEvent('m3ch4:workspace-layout',{detail:{workspace:shell.dataset.workspace}}));
    shell.classList.toggle('has-selection',!!selectedSlot && !paintExpanded && state==='garage');
    shell.classList.toggle('painting',paintExpanded && state==='garage');
    shelf.classList.toggle('shown',state==='garage' && !paintExpanded && swapExpanded && !drawerExpanded && !!selectedSlot);
}
function queueRender() {
    if(renderScheduled)return;
    renderScheduled=true;
    window.requestAnimationFrame(()=>{renderScheduled=false;render();});
}
document.addEventListener('m3ch4:assembly-mutated',()=>{previewSignature='';queueRender();});
document.addEventListener('m3ch4:inventory-changed',()=>{previewSignature='';queueRender();});
document.addEventListener('m3ch4:counter-picked',event=>{
    if(actualMode(loadSeries(storage))!=='vendor') return;
    selectedLotSerial=event.detail?.serial??selectedLotSerial;render();
});
document.addEventListener('m3ch4:stable-status-cleared',queueRender);
document.addEventListener('m3ch4:bay-picked',event=>{
    if(actualMode(loadSeries(storage))!=='garage')return;
    const slot=event.detail?.slot;
    // The physical canvas is the home surface: tapping a clear patch dismisses
    // the toolbox and any uncommitted fit preview without changing inventory.
    if (!slot) {
        if(!paintExpanded && selectedSlot){
            selectedSlot=null;selectedHardwareSerial=null;swapExpanded=false;
            drawerExpanded=false;detailsExpanded=false;previewSignature='';render();
        }
        return;
    }
    if(paintExpanded && togglePaintBoothSlot(loadStable(storage).stable,viewedId,slot)){
        paintPreviewEdits=paintBoothCurrentEdits();previewSignature='';render();return;
    }
    if(selectedSlot!==slot) {
        selectedHardwareSerial = null;swapExpanded=!bayStatus(loadStable(storage).stable,viewedId).health.find(item=>item.slot===slot)?.serial;
        drawerExpanded=false;detailsExpanded=false;rackView='ready';
    }
    selectedSlot = slot;
    identityExpanded=false; // A physical tap replaces the previous toolbox.
    dock.scrollTop = 0;
    render();
});
const rootWatch=new MutationObserver(queueRender);
rootWatch.observe(document.body,{attributes:true,attributeFilter:['class']});
// Only swiping over the dedicated bay strip changes machines. A drag over
// the 3D surface is always orbit/pan/pinch, regardless of its distance.
// Ignore gestures started on actionable arrow/dot buttons.
let swipeStart=null;
navigator.addEventListener('pointerdown',event=>{
    if (event.pointerType!=='touch' || event.target.closest('button')) return;
    swipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};
});
navigator.addEventListener('pointerup',event=>{
    if (!swipeStart || swipeStart.id!==event.pointerId) return;
    const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;
    swipeStart=null;
    if (Math.abs(dx)>44 && Math.abs(dx)>Math.abs(dy)*1.35) stepBay(dx<0?1:-1);
});
navigator.addEventListener('pointercancel',()=>{swipeStart=null;});
document.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target)return;
    const wipe=target.id==='wipe-save'&&target.getAttribute('aria-pressed')==='true';
    const restart=target.classList.contains('campaign-restart');
    if(wipe||restart){
        clearFieldWorkAll(storage);
        try{session?.removeItem(key);}catch{}
    } else if(target.id==='debrief-garage'&&loadSeries(storage)?.phase!=='intermission') {
        clearFieldWorkSeries(storage);
        mode='garage';selectedJobId=null;selectedSlot=null;identityExpanded=false;paintPreviewEdits=null;previewSignature='';
    }
},true);
queueRender();
