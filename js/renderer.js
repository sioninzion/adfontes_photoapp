// ---------------------------------------------------------------------------
// 인생네컷 합성의 유일한 진실 소스(single source of truth).
// - FRAMES(config.js)의 각 프레임은 실제 디자인된 PNG(2x2 그리드, 사진이
//   들어갈 4개의 투명 구멍 + 로고/문구가 이미 그려져 있음)이다.
// - 각 프레임의 windows 좌표는 PNG 원본 픽셀 기준이므로, 요청받은 출력
//   width/height에 맞춰 비율대로 확대/축소해서 사용한다. 이 스케일 계산을
//   미리보기 Canvas(작은 크기)와 최종 Canvas가 동일하게 공유하므로 항상
//   같은 구도로 보인다.
// ---------------------------------------------------------------------------

import { drawImageCover } from "./utils.js";

const overlayImageCache = new Map();

function loadOverlayImage(src) {
  if (overlayImageCache.has(src)) return overlayImageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`프레임 이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });
  overlayImageCache.set(src, promise);
  return promise;
}

/**
 * 인생네컷을 캔버스에 그린다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {Array<HTMLImageElement|HTMLCanvasElement|null>} options.images - 길이 4
 *   (0:왼쪽위 1:오른쪽위 2:왼쪽아래 3:오른쪽아래 순서, 선택한 순서와 동일)
 * @param {object} options.frame - FRAMES 항목 (overlaySrc/overlayWidth/overlayHeight/windows)
 */
export async function renderComposite(ctx, { width, height, images, frame }) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const scaleX = width / frame.overlayWidth;
  const scaleY = height / frame.overlayHeight;

  frame.windows.forEach((win, i) => {
    const image = images[i];
    const dx = win.x * scaleX;
    const dy = win.y * scaleY;
    const dw = win.w * scaleX;
    const dh = win.h * scaleY;

    if (image) {
      const srcW = image.naturalWidth || image.width;
      const srcH = image.naturalHeight || image.height;
      drawImageCover(ctx, image, srcW, srcH, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#d9d9d9";
      ctx.fillRect(dx, dy, dw, dh);
    }
  });

  try {
    const overlayImg = await loadOverlayImage(frame.overlaySrc);
    ctx.drawImage(overlayImg, 0, 0, width, height);
  } catch {
    // 프레임 이미지 로드에 실패해도 사진은 그대로 보여준다 (흰 화면으로 멈추지 않음)
  }

  ctx.restore();
}
