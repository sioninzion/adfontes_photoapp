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

  // 최종 출력물
  finalWidth: 1200,
  finalHeight: 3600,
  jpegQuality: 0.92,

  // 편집 화면 실시간 미리보기 해상도 (성능을 위해 축소 렌더링)
  previewWidth: 300,
  previewHeight: 900,

  // 완성 화면 자동 초기화 (개인정보 보호)
  resultIdleTimeoutSeconds: 60,
  resultIdleWarningSeconds: 10,

  cloudinary: {
    cloudName: "u6nkkozz",
    uploadPreset: "life4cut_unsigned",
    get uploadUrl() {
      return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    }
  },

  event: {
    title: "2026 여름수련회 인생네컷",
    footer: "2026 SUMMER RETREAT",
    subFooter: "2026 여름수련회"
  }
};

// ---------------------------------------------------------------------------
// 프레임 설정. PNG overlay를 추가하고 싶다면 assets/frames/ 에 PNG를 넣고
// overlaySrc 값을 지정하면 된다 (README 참고).
// ---------------------------------------------------------------------------
export const FRAMES = [
  {
    id: "white",
    name: "WHITE",
    background: "#ffffff",
    textColor: "#1a1a1a",
    accentColor: "#ffd400",
    overlaySrc: null
  },
  {
    id: "black",
    name: "BLACK",
    background: "#161616",
    textColor: "#ffffff",
    accentColor: "#ffd400",
    overlaySrc: null
  },
  {
    id: "blue",
    name: "BLUE",
    background: "#eaf3ff",
    textColor: "#123a6b",
    accentColor: "#3f7fd6",
    overlaySrc: null
  },
  {
    id: "pink",
    name: "PINK",
    background: "#fff0f3",
    textColor: "#7a2340",
    accentColor: "#ff8fab",
    overlaySrc: null
  },
  {
    id: "summer",
    name: "SUMMER",
    background: "#fff9e6",
    textColor: "#1f5c4d",
    accentColor: "#2fb595",
    overlaySrc: null
  }
];

// ---------------------------------------------------------------------------
// 필터 설정. Canvas의 filter 문자열을 그대로 사용한다.
// 값을 조정하면 즉시 반영된다.
// ---------------------------------------------------------------------------
export const FILTERS = [
  {
    id: "original",
    name: "ORIGINAL",
    css: "none"
  },
  {
    id: "bright",
    name: "BRIGHT",
    css: "brightness(1.12) saturate(1.05) contrast(1.02)"
  },
  {
    id: "warm",
    name: "WARM",
    css: "sepia(0.18) saturate(1.2) brightness(1.05) hue-rotate(-6deg)"
  },
  {
    id: "cool",
    name: "COOL",
    css: "saturate(1.05) brightness(1.03) hue-rotate(8deg) contrast(1.03)"
  },
  {
    id: "film",
    name: "FILM",
    css: "contrast(1.08) saturate(0.92) sepia(0.08) brightness(0.98)"
  },
  {
    id: "bw",
    name: "B&W",
    css: "grayscale(1) contrast(1.05)"
  }
];
