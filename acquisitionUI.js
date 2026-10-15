/** k.3e.0 DOM adapter for the existing garage/debrief.
 * Keeps acquisition out of main.js: the fight settles normally, then this layer
 * offers one real enemy component and writes the recovered part through the same
 * persistence authority before reloading into the garage.
 */
import { activePlayerArena } from './scene.js';
import { makeRangeTarget, TARGET_RESILIENCE } from './combat.js';
import { SLOTS } from './components.js';
import { loadMachine, storeMachine } from './persistence.js';
import { recoverSalvage, salvageOffer } from './acquisition.js';

const sheet = document.querySelector('#sortie-debrief');
const title = document.querySelector('#debrief-title');
const lines = document.querySelector('#debrief-lines');
const garage = document.querySelector('#debrief-garage');
const targetReadout = document.querySelector('#target-readout');
const fieldStatus = document.querySelector('#field-status');
const info = document.querySelector('#part-info');

if (!sheet || !title || !lines || !garage || !targetReadout || !info)
    throw new Error('Acquisition UI needs the existing debrief and garage surfaces.');

const targetAssembly = makeRangeTarget();
let storage = null;
try { storage = window.localStorage; }
catch { /* Storage-unavailable sessions simply cannot persist salvage. */ }

function injectStyles() {
    if (document.querySelector('#acquisition-styles')) return;
    const style = document.createElement('style');
    style.id = 'acquisition-styles';
    style.textContent = `
.salvage-offer{margin-top:10px;padding:10px;border:1px solid #b98e4f;background:#211f18;color:#d9d0b8;font:9px/1.4 ui-monospace,monospace}
.salvage-offer small{display:block;color:#8fb29a;letter-spacing:.11em;margin-bottom:5px}.salvage-offer strong{display:block;color:#f0ca7d;font-size:11px}.salvage-offer p{margin:5px 0;color:#b8c1b4}.salvage-offer button{width:100%;min-height:34px;margin-top:6px;border:1px solid #d7b369;background:#caa45d;color:#172018;font:800 9px/1.2 ui-monospace,monospace}.salvage-offer button:disabled{opacity:.45}.unowned-option{display:none!important}`;
    document.head.append(style);
}

function conditionFromTargetReadout() {
    const rows = Array.from(targetReadout.querySelectorAll('.target-row')).slice(1);
    if (rows.length < SLOTS.length)
        return null;
    const parts = {};
    for (let index = 0; index < SLOTS.length; index++) {
        const slot = SLOTS[index];
        const metrics = rows[index].querySelector('b')?.textContent ?? '';
        const match = metrics.match(/(\d+)%\s*·\s*ARM\s*(\d+)/);
        const resilience = TARGET_RESILIENCE[slot];
        if (!match || !resilience)
            return null;
        const [maxIntegrity, maxArmor] = resilience;
        parts[slot] = {
            slot,
            integrity: maxIntegrity * Math.max(0, Math.min(100, Number(match[1]))) / 100,
            maxIntegrity,
            armor: Math.max(0, Math.min(maxArmor, Number(match[2]))),
            maxArmor,
        };
    }
    return { parts };
}

function announceRecovered() {
    let message = null;
    try {
        message = window.sessionStorage.getItem('m3ch4-recovered-part');
        if (message) window.sessionStorage.removeItem('m3ch4-recovered-part');
    } catch { /* no-op */ }
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
    }, 4200);
}

function renderSalvage() {
    sheet.querySelector('.salvage-offer')?.remove();
    garage.textContent = 'RETURN TO GARAGE';
    if (sheet.classList.contains('hidden') || title.textContent !== 'CONTRACT CLEARED')
        return;
    const live = activePlayerArena()?.assembly;
    const condition = conditionFromTargetReadout();
    if (!live || !condition)
        return;
    const offer = salvageOffer(live, targetAssembly, condition);
    if (!offer)
        return;

    const panel = document.createElement('section');
    panel.className = 'salvage-offer';
    const eyebrow = document.createElement('small');
    eyebrow.textContent = 'RECOVERABLE ENEMY COMPONENT';
    const name = document.createElement('strong');
    name.textContent = offer.name;
    const detail = document.createElement('p');
    detail.textContent = `${Math.round(offer.condition * 100)}% RECOVERED CONDITION · CRANE / TRANSPORT ₡${offer.recoveryFee}`;
    const hint = document.createElement('p');
    hint.textContent = 'Recovering adds this physical component to your owned garage inventory. Repair is separate.';
    const recover = document.createElement('button');
    recover.type = 'button';
    recover.textContent = `RECOVER PART · ₡${offer.recoveryFee}`;

    let state = storage ? loadMachine(storage) : null;
    const affordable = !!state && state.economy.credits >= offer.recoveryFee;
    recover.disabled = !affordable;
    if (!storage)
        recover.textContent = 'RECOVERY UNAVAILABLE · LOCAL SAVE OFFLINE';
    else if (!affordable)
        recover.textContent = `RECOVER PART · ₡${offer.recoveryFee} · INSUFFICIENT`;

    recover.addEventListener('click', () => {
        if (!storage) return;
        state = loadMachine(storage);
        if (state.economy.credits < offer.recoveryFee) return;
        const currentOffer = salvageOffer(state.assembly, targetAssembly, condition);
        if (!currentOffer || currentOffer.definitionId !== offer.definitionId) return;
        const recovered = recoverSalvage(state.assembly, currentOffer);
        if (!recovered.ok) return;
        state.economy.credits -= currentOffer.recoveryFee;
        if (!storeMachine(storage, state)) return;
        try { window.sessionStorage.setItem('m3ch4-recovered-part', recovered.definition.name); }
        catch { /* The owned part is already persisted even without sessionStorage. */ }
        window.location.reload();
    });

    panel.append(eyebrow, name, detail, hint, recover);
    lines.after(panel);
    garage.textContent = 'LEAVE SALVAGE · RETURN TO GARAGE';
}

injectStyles();
announceRecovered();
const observer = new MutationObserver(renderSalvage);
observer.observe(sheet, { attributes: true, attributeFilter: ['class'], subtree: false });
observer.observe(title, { childList: true, characterData: true, subtree: true });
renderSalvage();
