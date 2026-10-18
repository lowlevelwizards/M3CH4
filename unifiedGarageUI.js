/** k.3s.0 — one physical three-bay garage, one contract path, one pit path.
 * Legacy q.0/q.1/q.2 adapters remain data bridges for now but own no visible UX.
 * Viewed rig changes only a Three.js preview; battle-active rig changes at DEPLOY.
 */
import { BY_ID } from './components.js';
import { activePlayerArena } from './scene.js';
import { loadMachine } from './persistence.js';
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
    reconcileFieldPatches, clearFieldWorkAll, clearFieldWorkSeries,
} from './fieldWork.js';
import { BAY_IDS, BAY_SLOTS, SLOT_LABELS, bayAssembly, bayHealth, bayStatus, bayModuleQuote, bayGeneratorMount } from './garageBay.js';

const key = 'm3ch4-viewed-bay-v1';
const shell = document.createElement('section');
shell.id = 'unified-garage';
shell.setAttribute('aria-label','Garage and contract operations');
shell.innerHTML = '<div class="unified-top"></div><div id="unified-garage-dock"></div><div class="unified-bay-navigation"></div><div class="unified-notice" role="status" aria-live="polite"></div>';
document.body.append(shell);
const top = shell.querySelector('.unified-top');
const dock = shell.querySelector('#unified-garage-dock');
const navigator = shell.querySelector('.unified-bay-navigation');
const notice = shell.querySelector('.unified-notice');
const sheet = document.querySelector('#sortie-debrief');
const oldDeploy = document.querySelector('#assembly-toggle');
let storage = null, session = null;
try { storage = window.localStorage; } catch { /* old storage warnings still apply */ }
try { session = window.sessionStorage; } catch { /* display a blocking action message */ }
let viewedId = loadStable(storage).stable.activeRigId || 'rig-01';
let mode = 'garage', selectedSlot = null, selectedJobId = null;
let renderScheduled = false, previewSignature = '';
try { viewedId = session?.getItem(key) || viewedId; } catch { /* optional */ }
if (!BAY_IDS.includes(viewedId)) viewedId = 'rig-01';

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
    notice.textContent = text;
    notice.classList.toggle('error', failed);
    notice.classList.toggle('shown', true);
}
function data() {
    const stable = loadStable(storage).stable;
    return { stable, series:loadSeries(storage), machine:loadMachine(storage),
        view:bayStatus(stable, viewedId) };
}
function actualMode(series) { return series?.phase === 'intermission' ? 'pit' : mode; }
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
    selectedSlot = null; previewSignature = '';
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
    const id = [
        viewedId, JSON.stringify(rig.installed), JSON.stringify(rig.graph),
        JSON.stringify(rig.playerCondition?.parts),
        stable.inventory.filter(p=>Object.values(rig.installed).includes(p.serial))
            .map(p=>p.serial + ':' + p.condition + ':' + p.destroyed).join('|'),
    ].join('::');
    if (previewSignature !== id) {
        previewSignature = id;
        arena.rebuildAssembly(bayAssembly(stable, viewedId));
        if (rig.playerCondition?.parts) arena.updatePilotDamage(rig.playerCondition);
        arena.selectPart(selectedSlot);
        arena.focusPart(selectedSlot);
    } else {
        arena.selectPart(selectedSlot);
    }
}
function navRender(stable, currentMode) {
    navigator.replaceChildren();
    navigator.classList.toggle('hidden', currentMode === 'contracts');
    if (currentMode === 'contracts') return;
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
function renderTop(currentMode, series, machine) {
    top.replaceChildren();
    const title = el('strong','unified-title', currentMode === 'pit' ? 'CONTRACT PIT' :
        currentMode === 'setup' ? 'SORTIE SETUP' : currentMode === 'contracts' ? 'SCRAPYARD CIRCUIT' : 'GARAGE');
    const balance = el('small','unified-credits','₡' + Number(machine.economy?.credits ?? 0).toLocaleString());
    const actions = el('div','unified-head-actions');
    if (currentMode === 'garage') actions.append(button('CONTRACTS', () => { mode = 'contracts'; render(); }, 'unified-top-action'));
    if (currentMode === 'contracts') actions.append(button('BACK TO GARAGE', () => { mode = 'garage'; render(); }, 'unified-top-action'));
    if (currentMode === 'setup') actions.append(button('BACK TO JOBS', () => {
        cancelSortieAssignment(session); mode='contracts'; render();
    },'unified-top-action'));
    if (currentMode === 'pit') {
        const contract = contractById(series.contractId);
        const match = el('small','unified-match',contract.name.toUpperCase() + ' · ROUND ' + series.roundNumber
            + ' · YOU ' + series.playerWins + ' — ' + series.enemyWins + ' HOSTILE');
        actions.append(match);
    }
    top.append(title, balance, actions);
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
function moduleStation(view) {
    const station = el('section','unified-stations');
    for (const item of view.health) {
        const node = button('', () => { selectedSlot = item.slot; previewSignature = ''; render(); },
            'unified-station ' + (selectedSlot === item.slot ? 'selected ' : '') +
                (item.destroyed || item.condition <= .001 && item.serial ? 'critical':''));
        node.append(el('strong','',SLOT_LABELS[item.slot]), el('small','',
            item.serial ? pct(item.condition) : 'EMPTY'));
        node.setAttribute('aria-label',SLOT_LABELS[item.slot]+' '+item.label);
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
    const state = view.health.find(s => s.slot === slot);
    box.append(el('div','unified-section-name',SLOT_LABELS[slot] + ' / OWNED HARDWARE'));
    const installed = state?.part;
    box.append(el('div','unified-installed', installed
        ? (BY_ID.get(installed.definitionId)?.name || installed.definitionId) +
          ' · ' + installed.serial + ' · ' + state.label
        : 'STATION EMPTY'));
    if (installed) {
        const quote = bayModuleQuote(stable, viewedId, slot);
        if (quote && (quote.amount > 0 || state.condition < 1)) {
            const affordable = quote.destroyed || quote.amount <= machine.economy.credits;
            box.append(button(
                (quote.destroyed ? 'REBUILD' : 'SERVICE') + ' ' + SLOT_LABELS[slot] +
                ' · ₡' + quote.amount + (quote.destroyed ? ' · HOUSE GUARANTEE' : ''),
                () => {
                    const result = emitEdit('m3ch4:bay-service',{rigId:viewedId,slot});
                    message(result.ok ? (quote.destroyed ? 'REBUILT · ' : 'SERVICED · ') + installed.serial : result.reason, !result.ok);
                    if (result.ok) { previewSignature=''; render(); }
                },'unified-service',!affordable));
        }
    }
    if (installed && slot === 'power') {
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
    if (installed) box.append(button('REMOVE INSTALLED MODULE', () => editModule(slot,null), 'unified-remove'));
    const choices = el('div','unified-part-list');
    const owned = stable.inventory.filter(p=>BY_ID.get(p.definitionId)?.slot===slot);
    if (!owned.length) choices.append(el('p','unified-muted','NO OWNED MODULES FOR THIS STATION'));
    for (const part of owned) {
        const owner = stable.rigs.find(r => Object.values(r.installed).includes(part.serial));
        const isHere = installed?.serial === part.serial;
        const elsewhere = owner && owner.id !== viewedId;
        const item = button('', () => editModule(slot,part.serial), 'unified-part' + (isHere?' equipped':''),
            !!elsewhere || isHere);
        const name = BY_ID.get(part.definitionId)?.name || part.definitionId;
        const status = elsewhere ? 'INSTALLED ON '+rigName(owner).toUpperCase() :
            isHere ? 'INSTALLED HERE' : part.destroyed ? 'DESTROYED · REBUILD FIRST' :
            pct(part.condition) + ' CONDITION';
        item.append(el('strong','',name),el('small','',part.serial + ' · ' + status));
        choices.append(item);
    }
    box.append(choices);
    return box;
}
function editModule(slot,serial) {
    if (actualMode(loadSeries(storage)) !== 'garage') { message('PIT LOCKED · NO MODULE CHANGES',true);return; }
    const result=emitEdit('m3ch4:bay-module',{rigId:viewedId,slot,serial});
    message(result.ok ? (serial ? 'INSTALLED '+serial : 'MODULE REMOVED') : result.reason,!result.ok);
    if(result.ok) { previewSignature='';render(); }
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
        message('MACHINE '+(rig.commissioned?'SAVED':'COMMISSIONED'));previewSignature='';render();
    },'',!view.rig.commissioned&&!view.readiness.fieldable);
    wrap.append(input,action);
    return wrap;
}
function renderGarage(stable,machine,view) {
    dock.append(bayHeader(view), summary(view), moduleStation(view));
    if(selectedSlot) dock.append(moduleDetails(stable,view,machine));
    else dock.append(el('p','unified-muted','CHOOSE A STATION TO INSPECT, INSTALL, REMOVE OR SERVICE OWNED HARDWARE.'));
    dock.append(appendIdentityForm(view,stable));
    dock.append(el('div','unified-career',view.rig.career.deployments+' DEPLOYMENTS · '+
        view.rig.career.roundWins+' ROUND WINS · '+(view.rig.career.fieldServices||0)+' FIELD PATCHES'));
}
function renderContracts(stable) {
    const campaign=loadCampaign();
    const unlocked=availableCampaignNodes(campaign);
    const list=el('section','unified-contract-list');
    for(const node of CAMPAIGN_NODES) {
        const c=contractById(node.id),available=unlocked.includes(node.id);
        const choice=button('',()=>{selectedJobId=c.id;render();},
            'unified-contract '+(selectedJobId===c.id?'selected':'')+(available?'':' locked'),
            !available);
        choice.append(el('strong','',c.name.toUpperCase()),el('small','',
            (c.objective?.label||c.kind).toUpperCase()+' · RISK '+c.risk.toUpperCase()+' · ₡'+c.payout));
        choice.append(el('small','',!available?'LOCKED':campaign.clearedNodes.includes(c.id)?'CLEARED · REPLAY':'AVAILABLE'));
        list.append(choice);
    }
    dock.append(list);
    if(selectedJobId && unlocked.includes(selectedJobId)) {
        const c=contractById(selectedJobId);
        const detail=el('section','unified-contract-detail');
        detail.append(el('strong','',c.name.toUpperCase()));
        detail.append(el('p','',c.briefing));
        detail.append(el('div','unified-muted','KNOWN EQUIPMENT · '+c.knownEquipment.join(' / ')));
        detail.append(el('div','unified-muted','SALVAGE · '+c.salvageHint));
        detail.append(button('TAKE CONTRACT',()=>{
            const result=beginSortieAssignment(session,c.id);
            if(!result.ok) {message(result.reason,true);return;}
            mode='setup';
            assignment(stable,c.id,viewedId);
            render();
        },'unified-primary'));
        dock.append(detail);
    } else dock.append(el('p','unified-muted','CHOOSE AN AVAILABLE JOB TO READ ITS BRIEFING.'));
}
function renderSetup(stable, view) {
    if(!selectedJobId) { mode='contracts';render();return; }
    const c=contractById(selectedJobId);
    dock.append(el('div','unified-job-compact',c.name.toUpperCase() + ' · RISK ' +
        c.risk.toUpperCase() + ' · ₡' + c.payout), bayHeader(view),summary(view),moduleStation(view));
    dock.append(el('p','unified-muted','SWIPE OR USE THE ARROWS TO CHOOSE WHICH MACHINE TAKES THIS JOB. LOADOUT CHANGES REQUIRE RETURNING TO GARAGE.'));
    dock.append(button('DEPLOY '+view.name.toUpperCase(),()=>launch(stable,c.id),
        'unified-primary',!view.canDeploy));
    if(!view.canDeploy) dock.append(el('p','unified-warning',view.reason || 'MACHINE NOT COMMISSIONED'));
}
function patchInPit(stable,view,series) {
    const wrap=el('section','unified-field-work');
    const action=currentIntermissionFieldAction(storage,series);
    const committed=fieldWorkCommitment(storage);
    wrap.append(el('strong','unified-section-name',action?'FIELD WORK · SPENT':'FIELD WORK · ONE ACTION'));
    if(action) {
        const owner=rigById(stable,action.rigId);
        wrap.append(el('p','',rigName(owner).toUpperCase()+' · '+SLOT_LABELS[action.slot]+
            ' · '+action.serial+' · PATCHED TO 22% · NO ARMOR RESTORED'));
        wrap.append(el('small','unified-warning',rigName(owner).toUpperCase()+' COMMITTED TO ROUND '+series.roundNumber));
    } else {
        const choices=fieldPatchCandidates(stable).filter(c=>c.rigId===view.rig.id);
        if(!choices.length) wrap.append(el('p','unified-muted','NO SINGLE PATCH CAN RESTORE THIS MACHINE TO FIELDABLE.'));
        for(const c of choices) wrap.append(button('FIELD PATCH '+SLOT_LABELS[c.slot]+' → 22% · COMMIT '+view.name.toUpperCase(),
            ()=> {
                const assign=assignment(stable,series.contractId,c.rigId);
                if(!assign.ok){message(assign.reason,true);return;}
                const result=applyEmergencyFieldPatch(storage,{seriesId:series.id,rigId:c.rigId,slot:c.slot});
                message(result.ok?'FIELD PATCH COMPLETE · '+view.name.toUpperCase()+' COMMITTED':result.reason,!result.ok);
                if(result.ok) {
                    document.dispatchEvent(new CustomEvent('m3ch4:bay-reconcile-patch',{detail:result.action}));
                    window.location.reload();
                }
            },'unified-service'));
    }
    return wrap;
}
function renderPit(stable,view,series) {
    const contract=contractById(series.contractId);
    dock.append(el('div','unified-job-compact',contract.name.toUpperCase()+
        ' · ROUND '+series.roundNumber+' · YOU '+series.playerWins+' — '+series.enemyWins+' HOSTILE'));
    dock.append(bayHeader(view),summary(view),moduleStation(view));
    dock.append(el('p','unified-muted','PIT LOCKED · DAMAGE PERSISTS · NO LOADOUT CHANGES OR FULL REPAIRS.'));
    dock.append(patchInPit(stable,view,series));
    const committed=fieldWorkCommitment(storage);
    const canGo=view.canDeploy && (!committed || committed.rigId===viewedId);
    dock.append(button((committed?'DEPLOY ':'SEND ')+view.name.toUpperCase()+' · ROUND '+series.roundNumber,
        ()=>launch(stable,series.contractId), 'unified-primary', !canGo));
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
    const {stable,series,machine}=data();
    reconcileFieldPatches(storage,stable);
    const view=bayStatus(stable,viewedId);
    const state=actualMode(series);
    if(state==='pit') {
        const committed=fieldWorkCommitment(storage);
        if(committed && viewedId!==committed.rigId){viewedId=committed.rigId;previewSignature='';return render();}
    }
    renderTop(state,series,machine);
    dock.replaceChildren();
    if(state==='garage')renderGarage(stable,machine,view);
    else if(state==='contracts')renderContracts(stable);
    else if(state==='setup')renderSetup(stable,view);
    else if(state==='pit')renderPit(stable,view,series);
    navRender(stable,state);
    preview(stable,series);
    shell.dataset.mode=state;
}
function queueRender() {
    if(renderScheduled)return;
    renderScheduled=true;
    window.requestAnimationFrame(()=>{renderScheduled=false;render();});
}
document.addEventListener('m3ch4:assembly-mutated',()=>{previewSignature='';queueRender();});
document.addEventListener('m3ch4:inventory-changed',()=>{previewSignature='';queueRender();});
document.addEventListener('m3ch4:stable-status-cleared',queueRender);
const rootWatch=new MutationObserver(queueRender);
rootWatch.observe(document.body,{attributes:true,attributeFilter:['class']});
// Horizontal swipe across the 3D bay changes which machine is *viewed*. It never
// changes activeRigId, cannot spend an assignment, and leaves orbit/pinch intact.
let swipeStart=null;
const surface=document.querySelector('#game');
surface?.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'&&document.body.classList.contains('inspecting'))
        swipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};
},true);
surface?.addEventListener('pointerup',event=>{
    if(!swipeStart||swipeStart.id!==event.pointerId)return;
    const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;
    swipeStart=null;
    if(Math.abs(dx)>95&&Math.abs(dx)>Math.abs(dy)*1.8 &&
        actualMode(loadSeries(storage))!=='contracts')stepBay(dx<0?1:-1);
},true);
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
        mode='garage';selectedJobId=null;selectedSlot=null;
    }
},true);
queueRender();
