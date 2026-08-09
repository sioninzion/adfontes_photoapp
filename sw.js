// ---------------------------------------------------------------------------
// 정적 리소스(App Shell)만 캐시한다. Cloudinary 업로드 등 외부 네트워크 요청은
// 절대 가로채지 않고 그대로 네트워크로 흘려보낸다 (오프라인 시 자연스럽게 실패).
//
// 중요: 네트워크가 되는 한 항상 "네트워크 우선(network-first)"으로 최신 파일을
// 가져온다. 예전 버전(cache-first)은 sw.js 자체 내용이 바뀌지 않으면 브라우저가
// 업데이트를 아예 감지하지 못해, 코드를 아무리 고쳐서 배포해도 아이패드에는
// 영원히 예전 버전이 캐시된 채로 남는 문제가 있었다. 파일을 추가/수정했다면
// CACHE_NAME 버전을 올려서 오래된 캐시를 확실히 폐기한다.
// ---------------------------------------------------------------------------

const CACHE_NAME = "life4cut-shell-v10";

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
  "./js/driveSave.js",
  "./js/vendor/qrcode.js",
  "./assets/fonts/OkDanDan-Bold.ttf",
  "./assets/fonts/OngeulipUiyeon-Regular.ttf",
  "./assets/frames/white_frame_transparent.png",
  "./assets/frames/black_frame_transparent.png",
  "./assets/frames/blue_frame_transparent.png",
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

  // 네트워크 우선: 온라인이면 항상 최신 파일을 받아오고 캐시를 갱신한다.
  // 오프라인이거나 요청이 실패할 때만 캐시로 대체한다(행사장 네트워크 문제 대비).
  // cache: "no-store"로 브라우저 HTTP 캐시까지 완전히 건너뛴다 - 그렇지 않으면
  // fetch()가 자체적으로 HTTP 캐시(디스크/메모리)를 먼저 참조해버려서, 서버
  // 파일이 바뀌어도 "네트워크 우선"이 무색해지고 예전 응답을 계속 받을 수 있다.
  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
