import { makeLiveWeaponAudio } from './liveWeaponAudio.js';
import { makeLiveSystemsAudio } from './liveSystemsAudio.js';
import { hitSoundPlan } from './liveSystemsEvents.js';
/** Small synthesized industrial range feedback, no downloaded audio assets. */
let audio = null;
function context() {
    try {
        if (!audio)
            audio = new AudioContext();
        if (audio.state === 'suspended')
            void audio.resume();
        return audio;
    }
    catch {
        return null;
    }
}
function tone(frequency, endFrequency, duration, volume, kind) {
    const ctx = context();
    if (!ctx)
        return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + .01);
}
export function soundFire() { tone(112, 39, .22, .21, 'sawtooth'); tone(210, 70, .08, .055, 'triangle'); }
/** One heavy shell report per trigger, not a sound per pellet. Synthesized on demand,
 * leaves no persistent nodes and gracefully ignores unavailable mobile audio. */
export function soundScatter() {
    tone(82,32,.37,.21,'sawtooth');
    tone(235,62,.17,.09,'square');
    tone(520,105,.095,.035,'triangle');
}
export function soundImpact() { tone(340, 80, .13, .09, 'square'); }
export function soundReload() { tone(480, 190, .12, .045, 'triangle'); }
export function soundEmpty() { tone(550, 370, .06, .025, 'square'); }

/** Low, short hydraulic foot-lock cue; emitted only on a real brace transition.
 * No persistent nodes, random variation, or sound needed to understand the state. */
export function soundBrace() {
    tone(94, 48, .16, .08, 'triangle');
    tone(185, 88, .08, .035, 'square');
}

/** Event sounds, not loops: audible warning at the moment traction slips and
 * on a hard drive load-up. The simulation owns all thresholds/cooldowns. */
export function soundFootScrape() {
    tone(215, 95, .10, .028, 'sawtooth');
    tone(94, 62, .15, .020, 'triangle');
}
export function soundDriveStrain() {
    tone(83, 120, .17, .035, 'sawtooth');
    tone(143, 87, .12, .018, 'triangle');
}

/** Slightly hollow welded-plate ring, only when a real structure mesh
 * intercepted a downstream fitted module on the same actual shot ray. */
export function soundShield() {
    tone(385, 145, .11, .065, 'triangle');
    tone(167, 92, .17, .044, 'square');
}

/** k3w7: selected real combat weapon sounds. Only call after a round is
 * physically consumed; blast and mechanism are ONE buffer per trigger.
 * A failed or missing browser audio device never changes weapon physics.
 */
const weaponBus=makeLiveWeaponAudio(context);
export function soundWeaponShot(weaponId,options={}) {
    return weaponBus.play(weaponId,options);
}

/** Live systems soundscape. The same unlocked audio context services weapons,
 * impacts and machinery. This bus never touches the old laboratory presets. */
const systemsBus=makeLiveSystemsAudio(context);
let acousticOrdinal=0;
export function soundSystemEvent(id,options={}) {
    return systemsBus.play(id,options);
}
export function soundCombatImpact(hit,options={}) {
    const soundOrdinal=acousticOrdinal++;
    const plan=hitSoundPlan(hit,{...options,ordinal:soundOrdinal});
    for(const entry of plan)systemsBus.play(entry.id,{
        variant:entry.variant,distance:options.distance??0,
        cockpit:!!options.cockpit,strength:entry.strength,
    });
    return plan;
}
