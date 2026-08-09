// QR decoding with the native BarcodeDetector API where available, falling back to the
// vendored jsQR (pure JS) everywhere else. BarcodeDetector.detect() is not universally
// supported (notably: Firefox, and older Safari), so jsQR must always be present.

export class QRDecoder {
  constructor() {
    this.detector = null;
    this.mode = 'unknown'; // 'native' | 'jsqr'
  }

  async init() {
    if (typeof window.BarcodeDetector === 'function') {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats && formats.includes('qr_code')) {
          this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          this.mode = 'native';
          return this.mode;
        }
      } catch {
        // fall through to jsQR
      }
    }
    this.mode = 'jsqr';
    return this.mode;
  }

  // canvas: an HTMLCanvasElement/OffscreenCanvas already cropped to the scan ROI.
  async decodeFromCanvas(canvas) {
    if (this.mode === 'native') {
      try {
        const results = await this.detector.detect(canvas);
        if (results && results.length > 0) return results[0].rawValue;
        return null;
      } catch {
        // Some browsers advertise the API but throw at runtime (e.g. permission/codec
        // issues) — fall back to jsQR permanently for this session.
        this.mode = 'jsqr';
      }
    }
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
  }
}
