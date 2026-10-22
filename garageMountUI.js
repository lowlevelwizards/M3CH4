/** Touch-friendly physical generator mounting on top of the serial-authoritative garage.
 * Inventory cards now represent owned instances directly, so this adapter only owns
 * the special generator station choice and its validation feedback. */
import { activePlayerArena } from './scene.js';
import { generatorMount, installedPart, setGeneratorMount, inspectAssembly } from './components.js';
import { clearSortieAssignment } from './sortieAssignment.js';
import './acquisitionUI.js?v=k4o';
import './contractUI.js?v=k3t1';
import './stableUI.js?v=k3t0';
import './sortieAssignmentUI.js?v=k3v5p1';
import './seriesUI.js?v=k4q';
import './unifiedGarageUI.js?v=k4s3';

const info = document.querySelector('#part-info');
const status = document.querySelector('#field-status');
if (!info || !status) throw new Error('Garage mounting controls need the original garage elements.');

const bayLabel = document.querySelector('#garage-context header small');
if (bayLabel) bayLabel.textContent = 'INSTALLED / OWNED';

function announce(message, error = false) {
    status.dataset.message = message;
    status.classList.toggle('blocked', error);
    status.textContent = message;
    status.title = message;
    window.setTimeout(() => {
        if (status.dataset.message !== message) return;
        delete status.dataset.message;
        const inspection = activePlayerArena() ? inspectAssembly(activePlayerArena().assembly) : null;
        status.textContent = inspection?.ready ? 'READY' : 'BLOCKED';
        status.classList.toggle('blocked', !inspection?.ready);
    }, 2700);
    const readout = info.querySelector('.mount-feedback');
    if (readout) {
        readout.textContent = message;
        readout.classList.toggle('mount-error', error);
    }
}

function mountPanel() {
    if (info.querySelector('.mount-panel')) return;
    const session = activePlayerArena();
    if (!session) return;
    const { assembly } = session;
    const currentSection = info.querySelector('.part-model')?.textContent;
    const priorNote = assembly.mountNotice;
    if (priorNote && !info.querySelector('.mount-garage-note')) {
        const warning = document.createElement('p');
        warning.className = 'mount-garage-note';
        warning.textContent = `MOUNT BLOCKED · ${priorNote}`;
        info.prepend(warning);
    }
    if (currentSection !== 'POWER' || !installedPart(assembly, 'power')) return;

    const controls = document.createElement('section');
    controls.className = 'mount-panel';
    controls.setAttribute('aria-label', 'Generator mounting station');
    const title = document.createElement('strong'); title.textContent = 'PHYSICAL GENERATOR MOUNT';
    const hint = document.createElement('small');
    hint.textContent = 'Move this exact owned generator. The left outrigger adds 85 kg and shifts its physical hit volume.';
    const buttons = document.createElement('div'); buttons.className = 'mount-choices';
    const current = generatorMount(assembly);

    for (const [position, label] of [['standard', 'REAR / DIRECT'], ['offset', 'LEFT OUTRIGGER / +85 KG']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `mount-choice ${current === position ? 'mount-selected' : ''}`;
        button.textContent = label;
        button.disabled = current === position;
        button.setAttribute('aria-pressed', String(current === position));
        button.addEventListener('click', () => {
            const before = generatorMount(assembly);
            const result = setGeneratorMount(assembly, position);
            if (!result.ok) { announce(result.reason, true); return; }
            const after = inspectAssembly(assembly);
            const problem = after.checks.find(check => !check.passes);
            if (problem) {
                setGeneratorMount(assembly, before);
                announce(`MOUNT BLOCKED · ${problem.reason}`, true);
                return;
            }
            document.dispatchEvent(new CustomEvent('m3ch4:assembly-mutated'));
            announce(position === 'offset' ? 'GENERATOR INSTALLED · LEFT OUTRIGGER' : 'GENERATOR INSTALLED · REAR DIRECT MOUNT');
        });
        buttons.append(button);
    }

    const feedback = document.createElement('div'); feedback.className = 'mount-feedback'; feedback.setAttribute('aria-live', 'polite');
    controls.append(title, hint, buttons, feedback);
    const options = info.querySelector('.swap-options');
    if (options) info.insertBefore(controls, options); else info.append(controls);
}

const observer = new MutationObserver(() => mountPanel());
observer.observe(info, { childList: true, subtree: true });
mountPanel();

// Session-scoped planning state must never survive actions that deliberately replace
// the campaign/machine context. Capture runs before the older handlers reload/reset.
document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    const confirmedWipe = target.id === 'wipe-save' && target.getAttribute('aria-pressed') === 'true';
    const campaignRestart = target.classList.contains('campaign-restart');
    if (!confirmedWipe && !campaignRestart) return;
    try { clearSortieAssignment(window.sessionStorage); } catch { /* reset continues even if session storage is unavailable */ }
}, true);
