import { Scanner } from './scanner.js';
import { parsePacketFromText } from '../protocol/packet.js';
import { reassemble } from '../protocol/chunker.js';
import { sha256, bytesToHex } from '../protocol/hash.js';
import { PACKET_TYPE, RECEIVER_STATE } from '../protocol/protocol.js';

const SPEED_WINDOW_MS = 4000;

export class ReceiverController {
  constructor({ ui, hud, navigate, debugLog, showToast }) {
    this.ui = ui;
    this.hud = hud;
    this.navigate = navigate;
    this.debugLog = debugLog || (() => {});
    this.showToast = showToast || (() => {});
    this.state = RECEIVER_STATE.IDLE;
    this.scanner = null;
    this.session = null;
    this.pendingFile = null;
    this.wakeLock = null;

    document.getElementById('btn-go-receive').addEventListener('click', () => this.openIntro());
    document.getElementById('btn-start-camera').addEventListener('click', () => this.startCamera());
    document.getElementById('btn-cancel-scan').addEventListener('click', () => this.cancelScan());
    document.getElementById('btn-save-file').addEventListener('click', () => this.saveFile());
    document.getElementById('btn-receive-again').addEventListener('click', () => this.openIntro());
  }

  openIntro() {
    this._teardownScanner();
    this._releaseWakeLock();
    this._resetSession();
    this.state = RECEIVER_STATE.IDLE;
    document.getElementById('receive-intro-error').hidden = true;
    this.navigate('screen-receive-intro');
  }

  async startCamera() {
    this.state = RECEIVER_STATE.CAMERA_STARTING;
    const errEl = document.getElementById('receive-intro-error');
    errEl.hidden = true;
    this._resetSession();
    this.ui.resetScanUI();
    this.hud.reset();
    this.navigate('screen-receive-scan');

    this.scanner = new Scanner({
      video: document.getElementById('camera-video'),
      roiCanvas: document.getElementById('scan-roi-canvas'),
      onDecode: (text) => this._handleDecoded(text),
    });

    try {
      const decoderMode = await this.scanner.start();
      this.debugLog({ type: 'scanner-started', decoderMode });
      this.state = RECEIVER_STATE.SCANNING;
      await this._acquireWakeLock();
    } catch (err) {
      this.state = RECEIVER_STATE.ERROR;
      this._teardownScanner();
      this.navigate('screen-receive-intro');
      errEl.hidden = false;
      errEl.textContent = err.message;
    }
  }

  cancelScan() {
    this._teardownScanner();
    this._releaseWakeLock();
    this._resetSession();
    this.state = RECEIVER_STATE.IDLE;
    this.navigate('screen-receive-intro');
  }

  _handleDecoded(text) {
    const packet = parsePacketFromText(text);
    if (!packet) {
      this.debugLog({ type: 'invalid-packet' });
      return;
    }
    this.hud.setDetected(true);
    this.hud.pulse();

    // Session lock (spec §23): once locked to a session id via its START packet, ignore
    // any packet from a different session until the user cancels / starts a new receive.
    if (this.session && packet.sessionId !== this.session.sessionId) {
      this.debugLog({ type: 'ignored-other-session', sessionId: packet.sessionId });
      return;
    }

    if (packet.type === PACKET_TYPE.START) this._handleStart(packet);
    else if (packet.type === PACKET_TYPE.DATA) this._handleData(packet);
    else if (packet.type === PACKET_TYPE.END) this._handleEnd(packet);
  }

  _handleStart(packet) {
    if (this.session) return; // metadata is immutable once locked; repeats are no-ops
    this.session = {
      sessionId: packet.sessionId,
      filename: packet.filename,
      fileSize: packet.fileSize,
      mimeType: packet.mimeType,
      totalChunks: packet.totalChunks,
      chunkSize: packet.chunkSize,
      hashHex: bytesToHex(packet.hashBytes),
      slots: new Array(packet.totalChunks).fill(null),
      receivedCount: 0,
      receivedBytes: 0,
      speedSamples: [],
      startedAt: performance.now(),
    };
    this.state = RECEIVER_STATE.SESSION_FOUND;
    this.ui.showSessionFound(this.session);
    this.debugLog({ type: 'session-locked', sessionId: this.session.sessionId, totalChunks: this.session.totalChunks, fileSize: this.session.fileSize });
  }

  _handleData(packet) {
    if (!this.session) return; // haven't seen START yet — wait for the next cycle
    if (packet.totalChunks !== this.session.totalChunks) return;
    if (!packet.crcValid) {
      this.debugLog({ type: 'crc-invalid', chunkIndex: packet.chunkIndex });
      return;
    }
    if (packet.chunkIndex < 0 || packet.chunkIndex >= this.session.totalChunks) return;

    if (this.session.slots[packet.chunkIndex] !== null) {
      this.debugLog({ type: 'duplicate-chunk', chunkIndex: packet.chunkIndex });
      return;
    }

    this.session.slots[packet.chunkIndex] = packet.payload;
    this.session.receivedCount++;
    this.session.receivedBytes += packet.payload.length;

    const now = performance.now();
    this.session.speedSamples.push({ t: now, bytes: this.session.receivedBytes });
    const cutoff = now - SPEED_WINDOW_MS;
    while (this.session.speedSamples.length > 2 && this.session.speedSamples[0].t < cutoff) {
      this.session.speedSamples.shift();
    }

    this.state = RECEIVER_STATE.RECEIVING;
    this.ui.updateReceiveProgress(this._buildProgressStats());

    if (this.session.receivedCount === this.session.totalChunks) {
      this._verifyAndFinish();
    }
  }

  _handleEnd() {
    if (!this.session) return;
    if (this.session.receivedCount === this.session.totalChunks && this.state !== RECEIVER_STATE.COMPLETE) {
      this._verifyAndFinish();
    }
  }

  _buildProgressStats() {
    const s = this.session;
    let speedBps = 0;
    if (s.speedSamples.length >= 2) {
      const first = s.speedSamples[0];
      const last = s.speedSamples[s.speedSamples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) speedBps = (last.bytes - first.bytes) / dt;
    }
    const remainingBytes = Math.max(0, s.fileSize - s.receivedBytes);
    const etaSec = speedBps > 0 ? remainingBytes / speedBps : NaN;
    return {
      totalChunks: s.totalChunks,
      receivedCount: s.receivedCount,
      fileSize: s.fileSize,
      receivedBytes: s.receivedBytes,
      speedBps,
      etaSec,
    };
  }

  async _verifyAndFinish() {
    this.state = RECEIVER_STATE.VERIFYING;
    this.ui.showVerifying();
    const fileBytes = reassemble(this.session.slots, this.session.fileSize);
    const actualHex = bytesToHex(await sha256(fileBytes));

    if (actualHex === this.session.hashHex) {
      this.state = RECEIVER_STATE.COMPLETE;
      this._teardownScanner();
      this._releaseWakeLock();
      this.pendingFile = { bytes: fileBytes, filename: this.session.filename, mimeType: this.session.mimeType };
      this.ui.showComplete({ filename: this.session.filename, mimeType: this.session.mimeType, size: this.session.fileSize, bytes: fileBytes });
      this.navigate('screen-receive-complete');
      this.debugLog({ type: 'transfer-complete', sessionId: this.session.sessionId });
    } else {
      this.debugLog({ type: 'hash-mismatch', expected: this.session.hashHex, actual: actualHex });
      this.state = RECEIVER_STATE.RECEIVING;
      this.ui.showVerifyFailed();
      // Stay locked to this session and keep scanning — the sender repeats the whole
      // cycle indefinitely, so listening longer is the recovery path in v1.
    }
  }

  saveFile() {
    if (!this.pendingFile) return;
    const { bytes, filename, mimeType } = this.pendingFile;
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  _teardownScanner() {
    if (this.scanner) {
      this.scanner.stop();
      this.scanner = null;
    }
  }

  _resetSession() {
    this.session = null;
    this.pendingFile = null;
    this.hud.reset();
  }

  async _acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // No wake lock support/permission — receiving still works, screen may sleep.
    }
  }

  _releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}
