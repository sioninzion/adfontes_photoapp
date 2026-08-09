// ---------------------------------------------------------------------------
// 정적 리소스(App Shell)만 캐시한다. Cloudinary 업로드 등 외부 네트워크 요청은
// 절대 가로채지 않고 그대로 네트워크로 흘려보낸다 (오프라인 시 자연스럽게 실패).
//
// 파일을 추가/수정했다면 CACHE_NAME 버전을 올려서 오래된 캐시를 폐기한다.
// ---------------------------------------------------------------------------

const CACHE_NAME = "life4cut-shell-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/camera.js",
  "./js/capture.js",
  "./js/selection.js",
  "./js/editor.js",
  "./js/renderer.js",
  "./js/cloudinary.js",
  "./js/qr.js",
  "./js/app.js",
  "./js/vendor/qrcode.js",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/sounds/shutter.wav"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // GET 요청 + 같은 출처(same-origin)만 캐시 대상으로 삼는다.
  // Cloudinary 업로드(POST, 다른 출처)는 절대 가로채지 않는다.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
