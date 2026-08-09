// ---------------------------------------------------------------------------
// 인생네컷 합성의 유일한 진실 소스(single source of truth).
// - 레이아웃(사진 슬롯 위치/크기)을 비율 기반으로 계산해서
//   미리보기 Canvas(작은 크기)와 최종 Canvas(1200x3600)가 항상 동일한 비율로
//   렌더링되도록 한다.
// - 촬영 비율(CONFIG.captureAspectRatio)은 이 인쇄 레이아웃과는 별개로
//   관리된다(capture.js). 촬영된 사진은 여기서 각 슬롯 모양에 맞춰
//   다시 한번 cover crop 되므로 찌그러짐 없이 항상 잘 맞는다.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { drawImageCover } from "./utils.js";

const LAYOUT_RATIOS = {
  marginX: 0.05,
  marginTop: 0.02,
  marginBottom: 0.01,
  gap: 0.012,
  footerHeight: 0.09
};

const overlayImageCache = new Map();

/** width/height 어떤 값이 오든 동일한 비율의 레이아웃을 계산한다. */
export function computeLayout(width, height) {
  const marginX = width * LAYOUT_RATIOS.marginX;
  const marginTop = height * LAYOUT_RATIOS.marginTop;
  const marginBottom = height * LAYOUT_RATIOS.marginBottom;
  const gap = height * LAYOUT_RATIOS.gap;
  const footerHeight = height * LAYOUT_RATIOS.footerHeight;

  const slotWidth = width - marginX * 2;
  const slotsAreaHeight = height - marginTop - marginBottom - footerHeight - gap * (CONFIG.selectedPhotoCount - 1);
  const slotHeight = slotsAreaHeight / CONFIG.selectedPhotoCount;

  const slots = [];
  for (let i = 0; i < CONFIG.selectedPhotoCount; i++) {
    slots.push({
      x: marginX,
      y: marginTop + i * (slotHeight + gap),
      w: slotWidth,
      h: slotHeight
    });
  }

  return {
    marginX,
    marginTop,
    marginBottom,
    gap,
    footerHeight,
    footerY: height - footerHeight - marginBottom,
    slots
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

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
 * @param {Array<HTMLImageElement|HTMLCanvasElement|null>} options.images - 길이 4, 위->아래 순서
 * @param {object} options.frame - FRAMES 항목
 * @param {string} options.filterCss - ctx.filter 값
 */
export async function renderComposite(ctx, { width, height, images, frame, filterCss }) {
  const layout = computeLayout(width, height);
  const cornerRadius = width * 0.012;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 배경
  ctx.fillStyle = frame.background;
  ctx.fillRect(0, 0, width, height);

  // 사진
  for (let i = 0; i < CONFIG.selectedPhotoCount; i++) {
    const slot = layout.slots[i];
    const image = images[i];

    ctx.save();
    roundRectPath(ctx, slot.x, slot.y, slot.w, slot.h, cornerRadius);
    ctx.clip();

    if (image) {
      ctx.filter = filterCss || "none";
      const srcW = image.naturalWidth || image.width;
      const srcH = image.naturalHeight || image.height;
      drawImageCover(ctx, image, srcW, srcH, slot.x, slot.y, slot.w, slot.h);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#d9d9d9";
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    }
    ctx.restore();

    // 슬롯 테두리
    ctx.save();
    roundRectPath(ctx, slot.x, slot.y, slot.w, slot.h, cornerRadius);
    ctx.lineWidth = Math.max(1, width * 0.003);
    ctx.strokeStyle = frame.accentColor;
    ctx.stroke();
    ctx.restore();
  }

  // PNG 오버레이 프레임 (선택 사항, 추후 확장용)
  let overlayApplied = false;
  if (frame.overlaySrc) {
    try {
      const overlayImg = await loadOverlayImage(frame.overlaySrc);
      ctx.drawImage(overlayImg, 0, 0, width, height);
      overlayApplied = true;
    } catch {
      overlayApplied = false; // 오버레이 로드 실패 시 기본 하단 텍스트로 대체
    }
  }

  if (!overlayApplied) {
    ctx.fillStyle = frame.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const footerCenterY = layout.footerY + layout.footerHeight * 0.42;
    ctx.font = `700 ${Math.round(height * 0.024)}px "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif`;
    ctx.fillText(CONFIG.event.footer, width / 2, footerCenterY);

    ctx.font = `500 ${Math.round(height * 0.015)}px "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif`;
    ctx.fillStyle = frame.accentColor;
    ctx.fillText(CONFIG.event.subFooter, width / 2, footerCenterY + height * 0.03);
  }

  ctx.restore();
}
