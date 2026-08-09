# 2026 여름수련회 인생네컷

iPad Safari에서 터치만으로 끝까지 진행하는 인생네컷 포토부스 웹앱입니다.
백엔드 서버 없이 정적 파일만으로 동작하며, GitHub Pages에 그대로 올리면 됩니다.

흐름: **시작 → 6장 자동 촬영 → 4장 선택 → 프레임/필터 → 합성 → Cloudinary 업로드 → QR 표시**

---

## 1. 로컬에서 실행하기

카메라(getUserMedia)는 "보안 컨텍스트"에서만 동작합니다. `file://`로 열면 카메라가 막히므로 반드시 로컬 웹 서버로 열어야 합니다. `localhost`는 예외적으로 HTTP여도 보안 컨텍스트로 취급되므로 아래처럼 실행하면 됩니다.

```bash
# 프로젝트 폴더에서
python -m http.server 8080
# 또는
npx serve .
```

브라우저에서 `http://localhost:8080` 접속 → 데스크톱 크롬/사파리에서는 카메라 권한을 물어보면 허용합니다.
iPad 실기기 테스트는 아래 3번(GitHub Pages 배포) 방식을 권장합니다. 같은 Wi-Fi에서 PC의 로컬 서버에 iPad로 접속하는 것은 HTTPS가 아니라서 대부분 카메라가 막힙니다(localhost가 아니므로).

## 2. 아이패드에서 테스트하려면 (HTTPS 필요)

- 가장 간단한 방법: 3번의 GitHub Pages 배포 후 그 주소로 iPad Safari에서 접속
- 또는 `ngrok http 8080` 같은 HTTPS 터널을 로컬 서버에 연결해서 임시로 테스트

## 3. GitHub Pages에 배포하기

1. 이 폴더를 GitHub 저장소에 그대로 push 합니다. (별도 빌드 과정 없음)
2. 저장소 Settings → Pages → Source를 "Deploy from a branch"로 설정하고, 브랜치/루트(`/`)를 선택합니다.
3. 몇 분 후 `https://<사용자명>.github.io/<저장소명>/` 주소로 접속됩니다.
4. 모든 리소스 경로가 상대경로(`./`, `css/...`, `js/...`)로 되어 있어서, 저장소 이름이 붙는 하위 경로(`/저장소명/`)에 배포되어도 그대로 동작합니다.

배포 후에는 반드시 iPad Safari로 실제 접속해서 카메라 권한 요청 → 촬영 → 업로드 → QR까지 한 번 확인해보세요.

## 4. Cloudinary 설정

Cloudinary 관련 값은 **`js/config.js` 한 곳**에만 있습니다.

```js
// js/config.js
cloudinary: {
  cloudName: "u6nkkozz",
  uploadPreset: "life4cut_unsigned",
}
```

- 이 앱은 **Unsigned Upload Preset**만 사용합니다. API Key/Secret은 코드 어디에도 없고 필요하지도 않습니다.
- Cloudinary 대시보드(Settings → Upload → Upload presets)에서 `life4cut_unsigned` 프리셋이 **Unsigned**로 설정되어 있어야 하고, Asset Folder가 `summer-retreat-2026`으로 지정되어 있어야 합니다(이 프리셋 설정 자체는 Cloudinary 콘솔에서 미리 해두는 것이며, 이 저장소 코드로 만들 수 있는 부분이 아닙니다).
- 다른 Cloudinary 계정을 쓰려면 `cloudName`, `uploadPreset` 값만 바꾸면 됩니다.

## 5. 프레임 추가/수정 방법

프레임은 `js/config.js`의 `FRAMES` 배열 하나로 관리됩니다.

```js
export const FRAMES = [
  {
    id: "white",          // 내부 식별자 (중복 금지)
    name: "WHITE",        // 버튼에 표시될 이름
    background: "#ffffff",// 사진 사이 여백/배경 색
    textColor: "#1a1a1a", // 하단 문구 색
    accentColor: "#ffd400",// 사진 테두리 색
    overlaySrc: null      // PNG 프레임을 쓰려면 경로를 지정 (아래 참고)
  },
];
```

- 배열에 객체를 하나 추가하면 편집 화면에 버튼이 자동으로 생기고, 최종 합성 Canvas에도 즉시 반영됩니다. 다른 파일을 손댈 필요가 없습니다.
- **PNG 프레임을 쓰고 싶다면**: `assets/frames/` 폴더에 PNG를 넣고 `overlaySrc: "assets/frames/내파일.png"`로 지정하세요. 이 PNG는 최종 Canvas 크기(1200×3600 비율)에 맞춰 캔버스 전체에 그려지며, 사진 위에 오버레이로 얹힙니다. **PNG 오버레이를 사용하는 프레임은 프로그램이 자동으로 그리는 하단 문구(“2026 SUMMER RETREAT”)를 그리지 않으므로**, 문구가 필요하면 PNG 디자인 안에 미리 포함시켜야 합니다.
- 이 저장소에는 실제 PNG 프레임 파일이 들어있지 않습니다(`assets/frames/`는 비어 있음). 기본 5종(White/Black/Blue/Pink/Summer)은 전부 코드로 그리는 색상 프레임입니다.

## 6. 필터 수정 방법

필터도 `js/config.js`의 `FILTERS` 배열 하나로 관리됩니다.

```js
export const FILTERS = [
  { id: "warm", name: "WARM", css: "sepia(0.18) saturate(1.2) brightness(1.05) hue-rotate(-6deg)" },
];
```

- `css` 값은 Canvas 2D의 `ctx.filter`에 그대로 들어가는 문자열입니다. (`brightness()`, `contrast()`, `saturate()`, `sepia()`, `hue-rotate()`, `grayscale()` 등 CSS filter 문법을 그대로 사용)
- 값을 조정하면 미리보기와 최종 이미지에 동일하게 반영됩니다. 배열에 항목을 추가/삭제하면 편집 화면 버튼도 자동으로 늘어나거나 줄어듭니다.

## 7. 아이패드 홈 화면에 추가하기 (PWA)

1. iPad Safari로 배포된 주소에 접속합니다.
2. 하단 공유 버튼(⬆️) → **"홈 화면에 추가"**를 누릅니다.
3. 홈 화면 아이콘으로 실행하면 주소창 없이 전체 화면(standalone) 앱처럼 실행됩니다.
4. 행사 당일에는 이 홈 화면 아이콘으로 실행하는 것을 권장합니다. (Safari 탭으로 열면 실수로 스와이프해서 탭을 닫거나 다른 사이트로 이동할 위험이 있습니다.)

## 8. 카메라 권한 문제 해결

- **"카메라 권한이 거부되었습니다" 오류**: 아이패드 설정 앱 → Safari → 카메라 → "허용"으로 변경 후, 앱(또는 Safari 탭)을 완전히 종료했다가 다시 열어주세요. 홈 화면 앱(PWA)으로 추가했다면 설정 앱 → 홈 화면에 추가된 앱 이름 아래에서도 권한을 확인할 수 있습니다.
- **"카메라를 찾을 수 없습니다"**: 다른 앱(카메라, FaceTime 등)이 카메라를 점유 중이면 먼저 종료하세요.
- **HTTPS가 아니라서 카메라가 아예 안 뜨는 경우**: getUserMedia는 보안 컨텍스트(HTTPS 또는 localhost)에서만 동작합니다. GitHub Pages는 기본적으로 HTTPS이므로 배포된 주소로 접속하면 해결됩니다.
- 카메라 오류 화면에는 항상 **다시 시도** 버튼이 있어서, 권한을 바꾼 뒤 앱을 껐다 켜지 않고도 바로 재시도할 수 있습니다.
- 앱이 백그라운드로 갔다가 돌아왔을 때 카메라 스트림이 끊겨 있으면 자동으로 다시 연결을 시도합니다(그래도 실패하면 카메라 오류 화면으로 안내합니다).

---

## 파일 구조

```
index.html              화면 마크업 (SPA, 새로고침 없이 화면 전환)
manifest.json           PWA 매니페스트
sw.js                   정적 리소스 캐싱 (Cloudinary 요청은 절대 가로채지 않음)
css/style.css           전체 스타일 (반응형, iPad 가로 우선)
js/
  config.js             전역 설정: 촬영 수/시간, 출력 해상도, Cloudinary, 프레임, 필터, 문구
  utils.js               cover-crop 계산 등 공용 유틸
  camera.js              getUserMedia 수명주기 + 백그라운드 복귀 시 자동 복구
  capture.js              6장 자동 촬영 (카운트다운, 미러링 캡처, 플래시/셔터음, 다운스케일)
  selection.js            6장 중 4장 선택 + 선택 순서 관리/재정렬
  editor.js               프레임/필터 실시간 미리보기
  renderer.js             최종 합성 로직 (미리보기/최종 출력이 공유하는 단일 진실 소스)
  cloudinary.js           Unsigned Upload
  qr.js                   QR 코드 렌더링 (vendor 라이브러리 wrapper)
  app.js                  화면 전환/상태 관리, 에러 처리, 자동 초기화 타이머
  vendor/qrcode.js        QR 생성 라이브러리 (MIT, Kazuhiko Arase, 서드파티 코드 그대로 포함)
assets/
  frames/                 PNG 프레임을 추가할 폴더 (현재 비어 있음)
  icons/                  PWA 아이콘 (180/192/512/512-maskable)
  sounds/shutter.wav       셔터 효과음
```

## 실행 방법 요약

1. `python -m http.server 8080` 등으로 정적 서버 실행 → `http://localhost:8080` 접속
2. "촬영 시작" → 카메라 권한 허용 → 6장 자동 촬영(사진마다 6초) → 4장 선택 → 프레임/필터 선택 → "사진 완성하기" → 자동 업로드 → QR 코드 확인
3. 완성 화면에서 60초간 조작이 없으면 자동으로 처음 화면으로 돌아갑니다(마지막 10초는 안내 배너 표시).

## 구현 시 참고/생략 사항

- **PNG 프레임 이미지 파일 자체는 포함하지 않았습니다.** 구조(`overlaySrc` 설정 + `assets/frames/` 폴더)만 만들어 두었고, 기본 프레임 5종은 모두 코드(색상+텍스트)로 렌더링합니다. 실제 디자인된 PNG 프레임은 나중에 폴더에 넣고 설정만 추가하면 됩니다.
- **셔터 효과음은 합성 사운드**(스크립트로 생성한 간단한 클릭음)입니다. 실제 카메라 셔터를 녹음한 파일이 아닙니다. `assets/sounds/shutter.wav` 파일만 교체하면 다른 소리로 바꿀 수 있습니다.
- Cloudinary의 Upload Preset(`life4cut_unsigned`)이 Unsigned로 켜져 있고 Asset Folder가 지정되어 있다는 전제로 동작합니다 — 이 설정 자체는 Cloudinary 콘솔에서 미리 되어 있어야 하며, 이 저장소의 코드가 자동으로 만들어주지 않습니다.
- 화면 방향 강제 잠금(Screen Orientation Lock API)은 사용하지 않았습니다(스펙 요청대로, iPadOS에서 완전히 보장되지 않기 때문). 대신 세로로 돌아가도 레이아웃이 깨지지 않도록 CSS로만 대응했습니다.
- 요청하신 핵심 흐름(시작→6장 촬영→4장 선택→프레임/필터→QR) 외의 회원가입/로그인/서버/DB/관리자 페이지는 추가하지 않았습니다.

## 테스트

`css/style.css`, `js/*.js`는 실제 iPad Safari 환경을 그대로 재현할 수는 없어, Playwright(가짜 카메라 장치 + Cloudinary 네트워크 모킹)로 다음 시나리오를 자동 검증했습니다: 6장 자동 촬영 → 선택 순서/재정렬 → 프레임·필터 실시간 반영 → 업로드 실패 시 재시도(캔버스 재생성 없이 기존 Blob 재사용) → QR 생성(280px 이상) → 완성 화면 유휴 자동 초기화 → 이전 사진 완전 초기화. 다만 이것은 데스크톱 Chromium 기반 시뮬레이션이므로, **실제 iPad Safari 실기기 및 실제 Cloudinary 업로드/QR 스캔 테스트는 배포 후 반드시 직접 확인**해야 합니다.
