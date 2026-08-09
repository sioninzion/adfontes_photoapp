import { formatBytes, iconForMime, setupSegmented } from './format.js';

export class SenderUI {
  constructor() {
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('file-input');
    this.fileCard = document.getElementById('file-card');
    this.fileIcon = document.getElementById('file-card-icon');
    this.fileName = document.getElementById('file-card-name');
    this.fileSub = document.getElementById('file-card-sub');
    this.photoModeGroup = document.getElementById('photo-mode-group');
    this.compressHint = document.getElementById('compress-hint');
    this.btnStart = document.getElementById('btn-start-transmit');
    this.errorText = document.getElementById('send-error');

    this.photoMode = setupSegmented(document.getElementById('photo-mode-segmented'));
    this.transferMode = setupSegmented(document.getElementById('transfer-mode-segmented'));

    this.transmitFilename = document.getElementById('transmit-filename');
    this.statusLine = document.getElementById('transmit-status-line');
    this.progressFill = document.getElementById('transmit-progress-fill');
    this.frameCounter = document.getElementById('transmit-frame-counter');
    this.cycleLabel = document.getElementById('transmit-cycle');
    this.fpsLabel = document.getElementById('transmit-fps');
    this.bytesLabel = document.getElementById('transmit-bytes');
    this.btnPause = document.getElementById('btn-pause-transmit');
    this.qrCanvas = document.getElementById('qr-canvas');
  }

  resetFileSelect() {
    this.fileCard.hidden = true;
    this.errorText.hidden = true;
    this.btnStart.disabled = true;
    this.photoModeGroup.hidden = true;
    this.compressHint.hidden = true;
    this.photoMode.setValue('original');
    this.transferMode.setValue('standard');
    this.fileInput.value = '';
  }

  showFileInfo({ name, size, mime, isImage }) {
    this.fileCard.hidden = false;
    this.fileName.textContent = name;
    this.fileSub.textContent = `${formatBytes(size)} · ${mime}`;
    this.fileIcon.textContent = iconForMime(mime);
    this.photoModeGroup.hidden = !isImage;
    this.compressHint.hidden = true;
    this.btnStart.disabled = false;
    this.errorText.hidden = true;
  }

  getSelectedPhotoMode() { return this.photoMode.getValue(); }
  getSelectedTransferMode() { return this.transferMode.getValue(); }

  showError(msg) { this.errorText.hidden = false; this.errorText.textContent = msg; }
  clearError() { this.errorText.hidden = true; }

  showCompressInfo(info) {
    if (!info) { this.compressHint.hidden = true; return; }
    this.compressHint.hidden = false;
    this.compressHint.textContent = `압축됨: ${formatBytes(info.originalSize)} → ${formatBytes(info.newSize)}`;
  }

  setTransmitFilename(name) { this.transmitFilename.textContent = name; }

  updateProgress({ dataFrameIndex, totalChunks, cycle, fps, bytesEmitted, meta }) {
    // START/END frames report dataFrameIndex = -1 — keep showing the last known chunk
    // count rather than flashing back to 0/total for that one frame.
    if (dataFrameIndex >= 0) {
      this._lastDisplayIndex = Math.min(dataFrameIndex + 1, totalChunks);
    } else if (this._lastDisplayIndex === undefined) {
      this._lastDisplayIndex = 0;
    }
    const displayIndex = this._lastDisplayIndex;
    this.frameCounter.textContent = `${displayIndex} / ${totalChunks}`;
    this.cycleLabel.textContent = `Cycle ${cycle}`;
    this.fpsLabel.textContent = `${fps} QR/s`;
    const pct = totalChunks ? Math.min(100, (displayIndex / totalChunks) * 100) : 0;
    this.progressFill.style.width = `${pct}%`;
    this.bytesLabel.textContent = `${formatBytes(Math.min(bytesEmitted, meta.fileSize))} 전송 시도됨 (원본 ${formatBytes(meta.fileSize)})`;
  }

  setPaused(paused) {
    this.btnPause.textContent = paused ? '재개' : '일시정지';
    this.statusLine.textContent = paused ? '일시정지됨' : '전송 중';
  }
}
