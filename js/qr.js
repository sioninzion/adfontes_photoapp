// ---------------------------------------------------------------------------
// QR 코드 렌더링. js/vendor/qrcode.js(전역 window.qrcode)를 감싼다.
// QR에는 Cloudinary HTTPS URL 문자열만 담는다 (이미지 데이터 자체는 넣지 않음).
// ---------------------------------------------------------------------------

const DEFAULT_SIZE_PX = 320;

/**
 * containerEl 안에 QR 코드 <canvas>를 그려 넣는다.
 * @param {HTMLElement} containerEl
 * @param {string} url
 * @param {number} [sizePx]
 * @returns {HTMLCanvasElement}
 */
export function renderQrCode(containerEl, url, sizePx = DEFAULT_SIZE_PX) {
  if (typeof window.qrcode !== "function") {
    throw new Error("QR 코드 라이브러리를 불러오지 못했습니다.");
  }
  if (!url) {
    throw new Error("QR 코드를 생성할 주소가 없습니다.");
  }

  containerEl.innerHTML = "";

  // typeNumber 0 = 데이터 길이에 맞는 최소 버전을 자동 선택
  const qr = window.qrcode(0, "M");
  qr.addData(url);
  qr.make();

  const moduleCount = qr.getModuleCount();
  // ceil을 사용해 URL 길이(QR 버전)가 늘어나도 최소 크기(sizePx) 밑으로 내려가지 않게 한다
  const scale = Math.max(4, Math.ceil(sizePx / moduleCount));
  const finalSize = moduleCount * scale;

  const canvas = document.createElement("canvas");
  canvas.width = finalSize;
  canvas.height = finalSize;
  canvas.className = "qr-canvas";

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, finalSize, finalSize);
  ctx.fillStyle = "#111111";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(col * scale, row * scale, scale, scale);
      }
    }
  }

  containerEl.appendChild(canvas);
  return canvas;
}
