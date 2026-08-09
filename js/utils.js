// ---------------------------------------------------------------------------
// 여러 모듈에서 공통으로 쓰는 순수 유틸리티 함수 모음.
// ---------------------------------------------------------------------------

/**
 * object-fit: cover 방식으로 source 이미지를 destination 영역에 그리기 위한
 * source crop 사각형을 계산한다. 미리보기(CSS object-fit: cover)와 최종 Canvas
 * 렌더링이 항상 같은 결과를 내도록 이 함수 하나만 사용한다.
 */
export function computeCoverSourceRect(srcWidth, srcHeight, dstWidth, dstHeight) {
  const srcRatio = srcWidth / srcHeight;
  const dstRatio = dstWidth / dstHeight;

  let sx = 0;
  let sy = 0;
  let sw = srcWidth;
  let sh = srcHeight;

  if (srcRatio > dstRatio) {
    // source가 더 가로로 넓다 -> 좌우를 자른다
    sw = srcHeight * dstRatio;
    sx = (srcWidth - sw) / 2;
  } else {
    // source가 더 세로로 길다 -> 위아래를 자른다
    sh = srcWidth / dstRatio;
    sy = (srcHeight - sh) / 2;
  }

  return { sx, sy, sw, sh };
}

/** dstWidth/dstHeight 영역 안에 src 이미지를 cover 방식으로 그린다. */
export function drawImageCover(ctx, image, srcWidth, srcHeight, dx, dy, dstWidth, dstHeight) {
  const { sx, sy, sw, sh } = computeCoverSourceRect(srcWidth, srcHeight, dstWidth, dstHeight);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dstWidth, dstHeight);
}

/** HTMLCanvasElement -> Blob (Promise 래핑) */
export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas를 이미지로 변환하지 못했습니다."));
      },
      type,
      quality
    );
  });
}

/** 이미 존재하는 URL(Object URL 등)을 HTMLImageElement로 디코딩까지 대기하며 불러온다. */
export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = url;
  });
}

/** 짧은 시간 뒤에 resolve되는 Promise */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 중복 실행을 막는 간단한 잠금 래퍼. 실행 중이면 즉시 null을 반환한다. */
export function createSingleFlight() {
  let running = false;
  return async function run(fn) {
    if (running) return null;
    running = true;
    try {
      return await fn();
    } finally {
      running = false;
    }
  };
}

let uidCounter = 0;
export function nextId() {
  uidCounter += 1;
  return `${Date.now()}_${uidCounter}`;
}
