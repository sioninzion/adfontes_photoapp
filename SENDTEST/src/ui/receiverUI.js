import { formatBytes, formatDuration } from './format.js';

export class ReceiverUI {
  constructor() {
    this.sessionLabel = document.getElementById('scan-session-label');
    this.statusText = document.getElementById('scan-status-text');
    this.progressBlock = document.getElementById('scan-progress-block');
    this.filenameEl = document.getElementById('scan-filename');
    this.progressFill = document.getElementById('scan-progress-fill');
    this.chunkCounter = document.getElementById('scan-chunk-counter');
    this.percentEl = document.getElementById('scan-percent');
    this.receivedBytesEl = document.getElementById('scan-received-bytes');
    this.speedEl = document.getElementById('scan-speed');
    this.etaEl = document.getElementById('scan-eta');

    this.completePreview = document.getElementById('complete-preview');
    this.completeName = document.getElementById('complete-name');
    this.completeSub = document.getElementById('complete-sub');

    this._previewUrl = null;
  }

  resetScanUI() {
    this.sessionLabel.textContent = '';
    this.statusText.textContent = 'QR을 프레임 안에 맞춰주세요';
    this.progressBlock.hidden = true;
    this.progressFill.style.width = '0%';
  }

  showSessionFound(session) {
    this.sessionLabel.textContent = `세션 ${session.sessionId}`;
    this.statusText.textContent = `${session.filename} · ${formatBytes(session.fileSize)}\n수신 준비 완료`;
    this.statusText.style.whiteSpace = 'pre-line';
    this.progressBlock.hidden = false;
    this.filenameEl.textContent = session.filename;
  }

  updateReceiveProgress(stats) {
    const pct = stats.totalChunks ? (stats.receivedCount / stats.totalChunks) * 100 : 0;
    this.progressFill.style.width = `${pct}%`;
    this.chunkCounter.textContent = `${stats.receivedCount} / ${stats.totalChunks} chunks`;
    this.percentEl.textContent = `${pct.toFixed(0)}%`;
    this.receivedBytesEl.textContent = `${formatBytes(stats.receivedBytes)} / ${formatBytes(stats.fileSize)}`;
    this.speedEl.textContent = stats.speedBps > 0 ? `${(stats.speedBps / 1024).toFixed(1)} KB/s` : '측정 중...';
    this.etaEl.textContent = isFinite(stats.etaSec) && stats.etaSec > 0 ? `남은 시간 약 ${formatDuration(stats.etaSec)}` : '';
    this.statusText.textContent = '수신 중';
    this.statusText.style.whiteSpace = 'normal';
  }

  showVerifying() {
    this.statusText.textContent = '무결성 검사 중...';
  }

  showVerifyFailed() {
    this.statusText.textContent = '파일 검증에 실패했습니다.\nQR을 계속 비춰주세요.';
    this.statusText.style.whiteSpace = 'pre-line';
  }

  showComplete({ filename, mimeType, size, bytes }) {
    if (this._previewUrl) { URL.revokeObjectURL(this._previewUrl); this._previewUrl = null; }
    this.completePreview.innerHTML = '';

    const blob = new Blob([bytes], { type: mimeType });
    if (mimeType.startsWith('image/')) {
      const url = URL.createObjectURL(blob);
      this._previewUrl = url;
      const img = document.createElement('img');
      img.src = url;
      img.alt = filename;
      this.completePreview.appendChild(img);
    } else if (mimeType.startsWith('video/')) {
      const url = URL.createObjectURL(blob);
      this._previewUrl = url;
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.playsInline = true;
      this.completePreview.appendChild(video);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-generic-icon';
      icon.textContent = '📄';
      this.completePreview.appendChild(icon);
    }

    this.completeName.textContent = filename;
    this.completeSub.textContent = `${formatBytes(size)} · ${mimeType}`;
  }
}
