/** First touch-friendly real mounting choice, without forking the j.2 garage.
 * The native installed-part button runs the existing refresh/save flow after a
 * validated graph edit. No parallel persistence or physics state is introduced. */
import { activePlayerArena } from './scene.js';
import { generatorMount, installedPart, setGeneratorMount, partsFor, equip, inspectAssembly } from './components.js';

const info = document.querySelector('#part-info');
const status = document.querySelector('#field-status');
if (!info || !status) throw new Error('Garage mounting controls need the original garage elements.');

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
    // The normal garage may repaint this status; keep a local inline explanation too.
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
    const title = document.createElement('strong');
    title.textContent = 'PHYSICAL GENERATOR MOUNT';
    const hint = document.createElement('small');
    hint.textContent = 'Move the SAME owned generator. The left outrigger adds 85 kg and shifts its hit volume.';
    const buttons = document.createElement('div');
    buttons.className = 'mount-choices';
    const current = generatorMount(assembly);
    for (const [position, label] of [
        ['standard', 'REAR / DIRECT'],
        ['offset', 'LEFT OUTRIGGER / +85 KG'],
    ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `mount-choice ${current === position ? 'mount-selected' : ''}`;
        button.textContent = label;
        button.disabled = current === position;
        button.setAttribute('aria-pressed', String(current === position));
        button.addEventListener('click', () => {
            const result = setGeneratorMount(assembly, position);
            if (!result.ok) { announce(result.reason, true); return; }
            // Reuse the existing j.2 garage's complete physics/damage/scene/save
            // refresh by clicking its already-installed generator choice.
            const fitted = info.querySelector('.swap-option.installed-option');
            if (!fitted) {
                // Revert the speculative edit: never leave an unpersisted hidden move.
                setGeneratorMount(assembly, current);
                announce('Cannot refresh the generator station; mounting change cancelled.', true);
                return;
            }
            fitted.disabled = false;
            fitted.click();
            const after = inspectAssembly(assembly);
            const fittedMessage = position === 'offset' ? 'GENERATOR INSTALLED · LEFT OUTRIGGER' : 'GENERATOR INSTALLED · REAR DIRECT MOUNT';
            const problem = after.checks.find(check => !check.passes);
            announce(problem ? `${fittedMessage} · NOT FIELDABLE: ${problem.reason}` : fittedMessage, !!problem);
        });
        buttons.append(button);
    }
    const feedback = document.createElement('div');
    feedback.className = 'mount-feedback';
    feedback.setAttribute('aria-live', 'polite');
    controls.append(title, hint, buttons, feedback);
    const options = info.querySelector('.swap-options');
    if (options) info.insertBefore(controls, options);
    else info.append(controls);
}

// Fail closed BEFORE the original j.2 native install handler runs. Earlier
// builds threw an uncaught error on incompatible swaps, with no garage message.
info.addEventListener('click', event => {
    const button = event.target.closest?.('.swap-option');
    if (!button) return;
    const session = activePlayerArena();
    if (!session) return;
    const slot = info.querySelector('.part-model')?.textContent?.toLowerCase();
    const options = info.querySelector('.swap-options');
    const index = options ? Array.from(options.children).indexOf(button) : -1;
    const candidate = partsFor(slot)[index];
    if (!candidate) return;
    try {
        const trial = structuredClone(session.assembly);
        equip(trial, slot, candidate.id);
    } catch (error) {
        event.preventDefault();
        event.stopPropagation();
        const message = generatorMount(session.assembly) === 'offset' &&
            (slot === 'power' || slot === 'structure')
            ? 'MOVE THE GENERATOR TO REAR / DIRECT BEFORE REPLACING THIS COMPONENT.'
            : error.message || 'This component cannot be installed here.';
        session.assembly.mountNotice = message;
        let warning = info.querySelector('.mount-garage-note');
        if (!warning) {
            warning = document.createElement('p');
            warning.className = 'mount-garage-note';
            info.prepend(warning);
        }
        warning.textContent = `MOUNT BLOCKED · ${message}`;
        announce(message, true);
    }
}, true);

// The old UI ignores a failed remove() return, but still repaints the garage.
// mountPanel() surfaces the recorded notice on its next DOM mutation.
const observer = new MutationObserver(() => mountPanel());
observer.observe(info, { childList: true });
mountPanel();
