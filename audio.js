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
