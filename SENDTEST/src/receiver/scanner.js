import { QRDecoder } from '../qr/decoder.js';
import { SCAN_FPS } from '../protocol/protocol.js';

function translateCameraError(err) {
  const name = err && err.name;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return new Error('카메라를 사용하려면 HTTPS 연결이 필요합니다.');
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new Error('사용 가능한 카메라를 찾을 수 없습니다.');
  }
  if (name === 'NotReadableError') {
    return new Error('카메라를 사용할 수 없습니다. 다른 앱이 카메라를 사용 중일 수 있습니다.');
  }
  return new Error('카메라를 시작할 수 없습니다: ' + (err && err.message ? err.message : '알 수 없는 오류'));
}

// Owns the camera stream and the scan loop. Crops the center square of the video frame
// (matching the on-screen viewfinder) into a small offscreen canvas at a fixed
// resolution, and decodes only that — cheaper than analyzing the full camera frame,
// and it's also exactly the region the user is asked to aim at.
export class Scanner {
  constructor({ video, roiCanvas, scanFps = SCAN_FPS, onDecode }) {
    this.video = video;
    this.roiCanvas = roiCanvas;
    this.scanFps = scanFps;
    this.onDecode = onDecode || (() => {});
    this.decoder = new QRDecoder();
    this.stream = null;
    this.running = false;
    this._rafId = null;
    this._lastScanTime = 0;
    this._scanning = false;
    this.roiSize = 640;
  }

  async start() {
    const decoderMode = await this.decoder.init();

    const constraints = {
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw translateCameraError(err);
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    this._lastScanTime = 0;
    this._loop();
    return decoderMode;
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  _loop(now) {
    if (!this.running) return;
    this._rafId = requestAnimationFrame((t) => this._loop(t));
    const minInterval = 1000 / this.scanFps;
    if (this._scanning || (now || 0) - this._lastScanTime < minInterval) return;
    this._lastScanTime = now || performance.now();
    this._scanFrame();
  }

  async _scanFrame() {
    if (this.video.readyState < 2) return; // < HAVE_CURRENT_DATA
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return;

    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;
    const size = this.roiSize;
    if (this.roiCanvas.width !== size || this.roiCanvas.height !== size) {
      this.roiCanvas.width = size;
      this.roiCanvas.height = size;
    }
    const ctx = this.roiCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.video, sx, sy, cropSize, cropSize, 0, 0, size, size);

    this._scanning = true;
    try {
      const text = await this.decoder.decodeFromCanvas(this.roiCanvas);
      if (text) this.onDecode(text);
    } catch {
      // Decode misses are the normal case (no QR in frame yet) — not a user-facing error.
    } finally {
      this._scanning = false;
    }
  }
}
