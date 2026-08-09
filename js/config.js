// ---------------------------------------------------------------------------
// 전체 앱 설정. 행사명, 촬영 매수, 시간, 출력 해상도, Cloudinary, 프레임, 필터를
// 이 파일에서만 수정하면 된다. 다른 JS 파일에는 하드코딩하지 않는다.
// ---------------------------------------------------------------------------

export const CONFIG = {
  // 촬영
  photoCount: 6,
  selectedPhotoCount: 4,
  countdownSeconds: 6,
  captureFreezeMs: 550, // 촬영 직후 결과를 잠깐 보여주는 시간

  // 촬영 비율: 아이패드를 가로로 들든 세로로 들든 항상 이 "세로가 긴" 비율로
  // 찍힌다 (3/4 = 가로:세로 = 3:4, 세로가 더 긴 형태). 최종 인쇄 레이아웃의
  // 칸 비율과는 별개의 값이며, 촬영/미리보기 화면에서만 사용한다.
  captureAspectRatio: 3 / 4,

  // 촬영 이미지 메모리 최적화 (긴 변 기준 px)
  captureLongEdge: 1800,
  captureJpegQuality: 0.9,

  // 최종 출력물 - FRAMES의 PNG 프레임(971x1619)과 동일한 비율로 맞춘다(2배 확대)
  finalWidth: 1942,
  finalHeight: 3238,
  jpegQuality: 0.92,

  // 편집 화면 실시간 미리보기 해상도 (성능을 위해 축소 렌더링, 위와 동일 비율)
  previewWidth: 300,
  previewHeight: 500,

  // 완성 화면 자동 초기화 (개인정보 보호)
  resultIdleTimeoutSeconds: 60,
  resultIdleWarningSeconds: 10,

  cloudinary: {
    cloudName: "u6nkkozz",
    uploadPreset: "life4cut_unsigned",
    get uploadUrl() {
      return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    }
  }
};

// ---------------------------------------------------------------------------
// 프레임 설정. 실제 디자인된 PNG 프레임(자양교회 여름수련회 로고/문구가 이미
// 그려져 있는 2x2 그리드 형태)을 사용한다. 각 프레임은 assets/frames/의
// 투명 PNG이며, 사진이 들어갈 4개 구멍(windows)의 위치를 "PNG 원본 픽셀
// 좌표" 기준으로 갖고 있다 - renderer.js가 실제 출력 크기에 맞춰 비율대로
// 확대/축소해서 사용하므로 여기 값은 항상 overlayWidth x overlayHeight
// 기준 그대로 두면 된다.
//
// windows 배열의 순서 = 사진 배치 순서(선택 화면에서 고른 순서)
//   0: 왼쪽 위(1)   1: 오른쪽 위(2)
//   2: 왼쪽 아래(3) 3: 오른쪽 아래(4)
//
// 새 프레임을 추가하려면: assets/frames/에 PNG를 넣고, 투명 구멍 4개의
// x/y/w/h(px)를 재서 아래와 같은 형식으로 객체를 하나 추가하면 된다.
// ---------------------------------------------------------------------------
export const FRAMES = [
  {
    id: "white",
    name: "WHITE",
    overlaySrc: "assets/frames/white_frame_transparent.png",
    overlayWidth: 971,
    overlayHeight: 1619,
    windows: [
      { x: 74, y: 80, w: 397, h: 610 },
      { x: 499, y: 80, w: 397, h: 610 },
      { x: 74, y: 711, w: 397, h: 592 },
      { x: 499, y: 711, w: 397, h: 592 }
    ]
  },
  {
    id: "black",
    name: "BLACK",
    overlaySrc: "assets/frames/black_frame_transparent.png",
    overlayWidth: 971,
    overlayHeight: 1619,
    windows: [
      { x: 75, y: 89, w: 397, h: 601 },
      { x: 495, y: 89, w: 401, h: 601 },
      { x: 73, y: 713, w: 399, h: 596 },
      { x: 495, y: 713, w: 402, h: 596 }
    ]
  },
  {
    id: "blue",
    name: "BLUE",
    overlaySrc: "assets/frames/blue_frame_transparent.png",
    overlayWidth: 971,
    overlayHeight: 1619,
    windows: [
      { x: 74, y: 88, w: 401, h: 603 },
      { x: 493, y: 88, w: 402, h: 603 },
      { x: 74, y: 710, w: 401, h: 595 },
      { x: 493, y: 710, w: 402, h: 595 }
    ]
  }
];
