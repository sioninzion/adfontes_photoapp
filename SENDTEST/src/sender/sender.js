import { Transmitter } from './transmitter.js';
import { TRANSFER_MODES, DEFAULT_MODE, SENDER_STATE } from '../protocol/protocol.js';

export class SenderController {
  constructor({ ui, navigate, debugLog, showToast }) {
    this.ui = ui;
    this.navigate = navigate;
    this.debugLog = debugLog || (() => {});
    this.showToast = showToast || (() => {});
    this.state = SENDER_STATE.IDLE;
    this.selectedFile = null;
    this.transmitter = null;
    this.wakeLock = null;

    document.getElementById('btn-go-send').addEventListener('click', () => this.openFileSelect());
    this.ui.fileInput.addEventListener('change', (e) => this.handleFileChosen(e.target.files[0]));
    this.ui.btnStart.addEventListener('click', () => this.startTransmission());
    document.getElementById('btn-stop-transmit').addEventListener('click', () => this.stopTransmission());
    document.getElementById('btn-pause-transmit').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.state === SENDER_STATE.TRANSMITTING) {
        this._acquireWakeLock();
      }
    });
  }

  openFileSelect() {
    this.state = SENDER_STATE.IDLE;
    this.selectedFile = null;
    this.ui.resetFileSelect();
    this.navigate('screen-send-select');
  }

  handleFileChosen(file) {
    if (!file) return;
    this.selectedFile = file;
    this.state = SENDER_STATE.FILE_SELECTED;
    const isImage = !!file.type && file.type.startsWith('image/') && file.type !== 'image/gif';
    this.ui.showFileInfo({
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      isImage,
    });
  }

  async startTransmission() {
    if (!this.selectedFile) return;
    this.ui.clearError();
    this.state = SENDER_STATE.PREPARING;
    this.ui.btnStart.disabled = true;
    this.ui.btnStart.textContent = '준비 중...';

    const modeKey = this.ui.getSelectedTransferMode();
    const mode = TRANSFER_MODES[modeKey] || TRANSFER_MODES[DEFAULT_MODE];
    const compress = this.ui.getSelectedPhotoMode() === 'fast';

    this.transmitter = new Transmitter({
      canvas: this.ui.qrCanvas,
      mode,
      onFrame: (stats) => {
        this.ui.updateProgress(stats);
        this.debugLog({ type: 'sender-frame', frameIndex: stats.frameIndex, dataFrameIndex: stats.dataFrameIndex, cycle: stats.cycle });
      },
      onComplete: (info) => this.debugLog({ type: 'sender-cycle-complete', cycle: info.cycle }),
    });

    try {
      const meta = await this.transmitter.prepare(this.selectedFile, { compress });
      this.ui.showCompressInfo(meta.compressedInfo);
      this.ui.setTransmitFilename(meta.filename);
      this.debugLog({ type: 'sender-prepared', sessionId: meta.sessionId, totalChunks: meta.totalChunks, fileSize: meta.fileSize, chunkSize: meta.chunkSize });

      this.state = SENDER_STATE.TRANSMITTING;
      this.navigate('screen-send-transmit');
      this.ui.setPaused(false);
      this.transmitter.start();
      await this._acquireWakeLock();
    } catch (err) {
      this.state = SENDER_STATE.FILE_SELECTED;
      this.ui.showError(err && err.message ? err.message : '파일 처리 중 오류가 발생했습니다.');
    } finally {
      this.ui.btnStart.disabled = false;
      this.ui.btnStart.textContent = '전송 시작';
    }
  }

  togglePause() {
    if (!this.transmitter) return;
    if (this.transmitter.paused) {
      this.transmitter.resume();
      this.state = SENDER_STATE.TRANSMITTING;
      this.ui.setPaused(false);
    } else {
      this.transmitter.pause();
      this.state = SENDER_STATE.PAUSED;
      this.ui.setPaused(true);
    }
  }

  stopTransmission() {
    if (this.transmitter) {
      this.transmitter.stop();
      this.transmitter = null;
    }
    this._releaseWakeLock();
    this._exitFullscreen();
    this.state = SENDER_STATE.STOPPED;
    this.navigate('screen-send-select');
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.getElementById('screen-send-transmit').requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen is a nice-to-have; ignore if unsupported/denied.
    }
  }

  async _acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // No wake lock support/permission — transmission still works, screen may sleep.
    }
  }

  _releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  _exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
}
