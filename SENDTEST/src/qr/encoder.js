// Thin wrapper around the vendored kazuhikoarase qrcode-generator (window.qrcode).
// Renders directly to a <canvas> via getModuleCount()/isDark() instead of the library's
// own dataURL/SVG helpers, so we can control device-pixel-ratio sharpness and the quiet
// zone precisely, and avoid re-allocating an <img>/dataURL every frame.

const QUIET_ZONE_MODULES = 4;

export function buildQRMatrix(text, ecLevel) {
  // typeNumber 0 lets the library auto-select the smallest QR version that fits `text`.
  const qr = window.qrcode(0, ecLevel || 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const matrix = new Uint8Array(count * count);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      matrix[r * count + c] = qr.isDark(r, c) ? 1 : 0;
    }
  }
  return { count, matrix };
}

export function renderQRToCanvas(canvas, text, ecLevel) {
  const { count, matrix } = buildQRMatrix(text, ecLevel);
  const dpr = window.devicePixelRatio || 1;
  const cssSize = Math.min(canvas.clientWidth || 320, canvas.clientHeight || 320) || 320;
  const pixelSize = Math.round(cssSize * dpr);

  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const totalModules = count + QUIET_ZONE_MODULES * 2;
  const moduleSize = pixelSize / totalModules;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = '#000000';

  const offset = QUIET_ZONE_MODULES * moduleSize;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r * count + c]) {
        const x = Math.round(offset + c * moduleSize);
        const y = Math.round(offset + r * moduleSize);
        const w = Math.ceil(moduleSize) + 1;
        ctx.fillRect(x, y, w, w);
      }
    }
  }
  return count;
}
