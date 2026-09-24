const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export class Controls {
    throttle = 0;
    steer = 0;
    brake = 0;
    lookYaw = 0;
    lookPitch = 0;
    keyboard = new Set();
    drivePointer = null;
    lookPointer = null;
    lookLastX = 0;
    lookLastY = 0;
    constructor(driveZone, driveKnob, lookZone, brakeButton) {
        const driveStart = (event) => {
            if (this.drivePointer !== null)
                return;
            this.drivePointer = event.pointerId;
            driveZone.setPointerCapture(event.pointerId);
            this.updateDrive(event, driveZone, driveKnob);
        };
        driveZone.addEventListener('pointerdown', driveStart);
        driveZone.addEventListener('pointermove', (event) => {
            if (event.pointerId === this.drivePointer)
                this.updateDrive(event, driveZone, driveKnob);
        });
        const driveEnd = (event) => {
            if (event.pointerId !== this.drivePointer)
                return;
            this.drivePointer = null;
            this.throttle = 0;
            this.steer = 0;
            driveKnob.style.transform = 'translate(-50%, -50%)';
        };
        driveZone.addEventListener('pointerup', driveEnd);
        driveZone.addEventListener('pointercancel', driveEnd);
        lookZone.addEventListener('pointerdown', (event) => {
            if (this.lookPointer !== null)
                return;
            this.lookPointer = event.pointerId;
            this.lookLastX = event.clientX;
            this.lookLastY = event.clientY;
            lookZone.setPointerCapture(event.pointerId);
        });
        lookZone.addEventListener('pointermove', (event) => {
            if (event.pointerId !== this.lookPointer)
                return;
            const dx = event.clientX - this.lookLastX;
            const dy = event.clientY - this.lookLastY;
            this.lookLastX = event.clientX;
            this.lookLastY = event.clientY;
            this.lookYaw = clamp(this.lookYaw - dx * 0.0042, -0.62, 0.62);
            this.lookPitch = clamp(this.lookPitch - dy * 0.0034, -0.19, 0.16);
        });
        const lookEnd = (event) => {
            if (event.pointerId === this.lookPointer)
                this.lookPointer = null;
        };
        lookZone.addEventListener('pointerup', lookEnd);
        lookZone.addEventListener('pointercancel', lookEnd);
        const setBrake = (pressed) => {
            this.brake = pressed ? 1 : 0;
            brakeButton.classList.toggle('active', pressed);
        };
        brakeButton.addEventListener('pointerdown', (event) => {
            brakeButton.setPointerCapture(event.pointerId);
            setBrake(true);
        });
        brakeButton.addEventListener('pointerup', () => setBrake(false));
        brakeButton.addEventListener('pointercancel', () => setBrake(false));
        brakeButton.addEventListener('pointerleave', (event) => {
            if (event.buttons === 0)
                setBrake(false);
        });
        window.addEventListener('keydown', (event) => {
            this.keyboard.add(event.code);
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
                event.preventDefault();
        }, { passive: false });
        window.addEventListener('keyup', (event) => this.keyboard.delete(event.code));
        window.addEventListener('blur', () => {
            this.keyboard.clear();
            this.brake = 0;
        });
    }
    sample() {
        const forward = (this.keyboard.has('KeyW') || this.keyboard.has('ArrowUp') ? 1 : 0) - (this.keyboard.has('KeyS') || this.keyboard.has('ArrowDown') ? 1 : 0);
        const turn = (this.keyboard.has('KeyD') || this.keyboard.has('ArrowRight') ? 1 : 0) - (this.keyboard.has('KeyA') || this.keyboard.has('ArrowLeft') ? 1 : 0);
        return {
            throttle: clamp(this.throttle + forward, -1, 1),
            steer: clamp(this.steer + turn, -1, 1),
            brake: Math.max(this.brake, this.keyboard.has('Space') ? 1 : 0),
            lookYaw: this.lookYaw,
            lookPitch: this.lookPitch,
        };
    }
    recenterLook() {
        this.lookYaw = 0;
        this.lookPitch = 0;
    }
    updateDrive(event, zone, knob) {
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = Math.min(rect.width, rect.height) * 0.34;
        let dx = event.clientX - cx;
        let dy = event.clientY - cy;
        const length = Math.hypot(dx, dy);
        if (length > radius) {
            dx = (dx / length) * radius;
            dy = (dy / length) * radius;
        }
        this.steer = clamp(dx / radius, -1, 1);
        this.throttle = clamp(-dy / radius, -1, 1);
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
}
