import { SenderUI } from './ui/senderUI.js';
import { SenderController } from './sender/sender.js';
import { ReceiverUI } from './ui/receiverUI.js';
import { ReceiverController } from './receiver/receiver.js';
import { Hud } from './ui/hud.js';

function navigate(screenId) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === screenId));
}

function showToast(message, duration = 2600) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, duration);
}

const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const debugPanel = document.getElementById('debug-panel');
const debugLines = [];

function debugLog(entry) {
  if (!DEBUG) return;
  debugPanel.hidden = false;
  const line = `[${new Date().toISOString().split('T')[1].replace('Z', '')}] ${JSON.stringify(entry)}`;
  debugLines.push(line);
  if (debugLines.length > 200) debugLines.shift();
  debugPanel.textContent = debugLines.join('\n');
  debugPanel.scrollTop = debugPanel.scrollHeight;
}

function checkBrowserSupport() {
  const missing = [];
  if (!window.isSecureContext) missing.push('HTTPS(보안 연결)');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) missing.push('카메라 API');
  if (!window.crypto || !window.crypto.subtle) missing.push('Web Crypto API');
  if (typeof window.jsQR !== 'function') missing.push('QR 디코더');
  if (typeof window.qrcode !== 'function') missing.push('QR 생성기');
  return missing;
}

function main() {
  const missing = checkBrowserSupport();
  if (missing.length) {
    showToast(`이 브라우저에서는 일부 기능을 사용할 수 없습니다: ${missing.join(', ')}`, 5000);
  }

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  const senderUI = new SenderUI();
  new SenderController({ ui: senderUI, navigate, debugLog, showToast });

  const receiverUI = new ReceiverUI();
  const hud = new Hud(document.getElementById('viewfinder'));
  new ReceiverController({ ui: receiverUI, hud, navigate, debugLog, showToast });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        // Offline shell just won't be cached; the app still works online.
      });
    });
  }
}

main();
