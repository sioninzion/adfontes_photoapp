// Controls the camera viewfinder's visual state — corner brackets that turn green and
// pulse when a QR frame is successfully decoded. Deliberately CSS-driven (not canvas)
// so it costs nothing on the frame budget that scanning needs.

export class Hud {
  constructor(viewfinderEl) {
    this.el = viewfinderEl;
    this._pulseTimer = null;
  }

  setDetected(detected) {
    this.el.classList.toggle('detected', !!detected);
  }

  pulse() {
    this.el.classList.remove('pulse');
    // Force reflow so the animation restarts even if pulse() is called again quickly.
    void this.el.offsetWidth;
    this.el.classList.add('pulse');
    clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => this.el.classList.remove('pulse'), 400);
  }

  reset() {
    this.el.classList.remove('detected', 'pulse');
  }
}
