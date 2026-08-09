// QR Beam service worker — caches the app shell so the app can be launched and used
// without a network connection. This ONLY caches app code/assets; it has no bearing on
// the actual file transfer, which never touches the network at all (screen -> camera).

const CACHE_VERSION = 'qr-beam-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './src/main.js',
  './src/styles/style.css',
  './src/protocol/protocol.js',
  './src/protocol/packet.js',
  './src/protocol/chunker.js',
  './src/protocol/crc32.js',
  './src/protocol/hash.js',
  './src/qr/encoder.js',
  './src/qr/decoder.js',
  './src/sender/sender.js',
  './src/sender/transmitter.js',
  './src/receiver/receiver.js',
  './src/receiver/scanner.js',
  './src/ui/senderUI.js',
  './src/ui/receiverUI.js',
  './src/ui/hud.js',
  './src/ui/format.js',
  './src/vendor/qrcode.js',
  './src/vendor/jsQR.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigations: try the network first (so a redeploy is picked up while online), fall
  // back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else (app scripts, styles, icons, vendor libs): cache-first, then
  // network, caching whatever comes back for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
