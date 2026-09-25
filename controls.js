const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/** Convert mech-relative aim offset into body-turn intent. Right aim is negative
 * camera yaw in Three.js, while positive physics yaw turns the body right. */
export function bodyFollowSteer(lookYaw) {
    const magnitude = Math.abs(lookYaw);
    if (magnitude <= BODY_FOLLOW_START)
        return 0;
    const normalized = clamp((magnitude - BODY_FOLLOW_START) / (AIM_YAW_LIMIT - BODY_FOLLOW_START), 0, 1);
    return -Math.sign(lookYaw) * normalized;
}
export const AIM_YAW_LIMIT = 0.92;
export const BODY_FOLLOW_START = 0.42;
/** Pure joystick mapping: displacement from touch-down, never absolute screen position. */
export function stickAxes(dxPx, dyPx, radiusPx) {
    const length = Math.hypot(dxPx, dyPx);
    const factor = length > radiusPx ? radiusPx / length : 1;
    const dx = dxPx * factor / radiusPx;
    const dy = dyPx * factor / radiusPx;
    const deadZone = 0.12;
    const axis = (value) => Math.abs(value) <= deadZone ? 0 : Math.sign(value) * (Math.abs(value) - deadZone) / (1 - deadZone);
    return { throttle: axis(-dy), strafe: axis(dx) };
}
export class Controls {
    throttle = 0;
    strafe = 0;
    brake = 0;
    lookYaw = 0;
    lookPitch = 0;
    keyboard = new Set();
    drivePointer = null;
    lookPointer = null;
    driveOriginX = 0;
    driveOriginY = 0;
    lookLastX = 0;
    lookLastY = 0;
    enabled = true;
    driveRing;
    driveKnob;
    constructor(driveZone, driveKnob, lookZone, brakeButton) {
        const ring = driveZone.querySelector('.stick-ring');
        if (!ring)
            throw new Error('Drive ring is required');
        this.driveRing = ring;
        this.driveKnob = driveKnob;
        // Floating neutral point: wherever the thumb first lands is 0/0.
        // This prevents touching above the decorative ring from secretly commanding reverse.
        driveZone.addEventListener('pointerdown', (event) => {
            if (!this.enabled || this.drivePointer !== null)
                return;
            event.preventDefault();
            this.drivePointer = event.pointerId;
            this.driveOriginX = event.clientX;
            this.driveOriginY = event.clientY;
            const bounds = driveZone.getBoundingClientRect();
            ring.style.left = `${event.clientX - bounds.left}px`;
            ring.style.top = `${event.clientY - bounds.top}px`;
            ring.style.bottom = 'auto';
            ring.style.transform = 'translate(-50%, -50%)';
            driveZone.setPointerCapture(event.pointerId);
            this.updateDrive(event);
        });
        driveZone.addEventListener('pointermove', (event) => {
            if (event.pointerId === this.drivePointer)
                this.updateDrive(event);
        });
        const driveEnd = (event) => {
            if (event.pointerId !== this.drivePointer)
                return;
            this.clearDrive();
        };
        driveZone.addEventListener('pointerup', driveEnd);
        driveZone.addEventListener('pointercancel', driveEnd);
        driveZone.addEventListener('lostpointercapture', driveEnd);
        lookZone.addEventListener('pointerdown', (event) => {
            if (!this.enabled || this.lookPointer !== null)
                return;
            event.preventDefault();
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
            // Three's negative camera yaw looks right; dragging right should look right.
            this.lookYaw = clamp(this.lookYaw - dx * 0.0042, -AIM_YAW_LIMIT, AIM_YAW_LIMIT);
            this.lookPitch = clamp(this.lookPitch - dy * 0.0034, -0.19, 0.16);
        });
        const lookEnd = (event) => {
            if (event.pointerId === this.lookPointer)
                this.lookPointer = null;
        };
        lookZone.addEventListener('pointerup', lookEnd);
        lookZone.addEventListener('pointercancel', lookEnd);
        lookZone.addEventListener('lostpointercapture', lookEnd);
        const setBrake = (pressed) => {
            this.brake = pressed && this.enabled ? 1 : 0;
            brakeButton.classList.toggle('active', this.brake > 0);
        };
        brakeButton.addEventListener('pointerdown', (event) => {
            if (!this.enabled)
                return;
            event.preventDefault();
            brakeButton.setPointerCapture(event.pointerId);
            setBrake(true);
        });
        brakeButton.addEventListener('pointerup', () => setBrake(false));
        brakeButton.addEventListener('pointercancel', () => setBrake(false));
        brakeButton.addEventListener('lostpointercapture', () => setBrake(false));
        window.addEventListener('keydown', (event) => {
            if (!this.enabled)
                return;
            this.keyboard.add(event.code);
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
                event.preventDefault();
        }, { passive: false });
        window.addEventListener('keyup', (event) => this.keyboard.delete(event.code));
        window.addEventListener('blur', () => {
            this.keyboard.clear();
            this.clearDrive();
            this.lookPointer = null;
            setBrake(false);
        });
    }
    sample() {
        const forward = Number(this.keyboard.has('KeyW') || this.keyboard.has('ArrowUp')) - Number(this.keyboard.has('KeyS') || this.keyboard.has('ArrowDown'));
        const lateral = Number(this.keyboard.has('KeyD')) - Number(this.keyboard.has('KeyA'));
        const manualTurn = Number(this.keyboard.has('ArrowRight')) - Number(this.keyboard.has('ArrowLeft'));
        return {
            throttle: this.enabled ? clamp(this.throttle + forward, -1, 1) : 0,
            strafe: this.enabled ? clamp(this.strafe + lateral, -1, 1) : 0,
            steer: this.enabled ? clamp(manualTurn, -1, 1) : 0,
            brake: this.enabled ? Math.max(this.brake, this.keyboard.has('Space') ? 1 : 0) : 1,
            lookYaw: this.lookYaw,
            lookPitch: this.lookPitch,
        };
    }
    /** Preserve world aim while the chassis rotates to catch up with an aimed weapon. */
    compensateBodyTurn(deltaPhysicsYaw) {
        this.lookYaw = clamp(this.lookYaw + deltaPhysicsYaw, -AIM_YAW_LIMIT, AIM_YAW_LIMIT);
    }
    recenterLook() {
        this.lookYaw = 0;
        this.lookPitch = 0;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.clearDrive();
            this.lookPointer = null;
            this.brake = 0;
            this.keyboard.clear();
        }
    }
    clearDrive() {
        this.drivePointer = null;
        this.throttle = 0;
        this.strafe = 0;
        this.driveKnob.style.transform = 'translate(-50%, -50%)';
        this.driveRing.style.left = '';
        this.driveRing.style.top = '';
        this.driveRing.style.bottom = '';
        this.driveRing.style.transform = '';
    }
    updateDrive(event) {
        const rect = this.driveRing.getBoundingClientRect();
        const radius = Math.min(rect.width, rect.height) * 0.35;
        const dx = event.clientX - this.driveOriginX;
        const dy = event.clientY - this.driveOriginY;
        const length = Math.hypot(dx, dy);
        const factor = length > radius ? radius / length : 1;
        const axes = stickAxes(dx, dy, radius);
        this.strafe = axes.strafe;
        this.throttle = axes.throttle;
        this.driveKnob.style.transform = `translate(calc(-50% + ${dx * factor}px), calc(-50% + ${dy * factor}px))`;
    }
}
