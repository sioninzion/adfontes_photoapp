# 2026 여름수련회 인생네컷

iPad Safari에서 터치만으로 끝까지 진행하는 인생네컷 포토부스 웹앱입니다.
백엔드 서버 없이 정적 파일만으로 동작하며, GitHub Pages에 그대로 올리면 됩니다.

흐름: **시작 → 6장 자동 촬영 → 4장 선택 → 프레임 선택 → 합성 → Cloudinary 업로드 → QR 표시**

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

### 운영자용 Google Drive 백업

- 참가자에게 사진을 전달하는 Cloudinary/QR 흐름과는 완전히 별개로, **결과 화면의 "사진 저장" 버튼**을 직접 눌렀을 때만 완성 이미지를 Google Drive(Apps Script 웹앱)에도 백업합니다. 자동으로 올라가지 않습니다.
- Apps Script 웹앱 주소는 `js/driveSave.js` 상단의 `APPS_SCRIPT_URL` 하나로 관리됩니다. 다른 Apps Script로 바꾸려면 이 값만 수정하면 됩니다.
- 같은 결과물을 두 번 이상 올리지 않도록, 저장에 성공하면 버튼이 "저장 완료 ✓"로 바뀌며 비활성화되고, 새로 촬영을 시작해야 다시 저장할 수 있습니다.

## 5. 프레임 추가/수정 방법

프레임은 `js/config.js`의 `FRAMES` 배열 하나로 관리됩니다. 실제 디자인된 PNG(2x2 그리드, 사진이 들어갈 4개의 투명 구멍 + 로고/문구가 이미 그려져 있는 형태)를 사용합니다.

```js
export const FRAMES = [
  {
    id: "white",                     // 내부 식별자 (중복 금지)
    name: "WHITE",                   // 버튼에 표시될 이름
    overlaySrc: "assets/frames/white_frame_transparent.png",
    overlayWidth: 971,               // PNG 원본 가로 픽셀
    overlayHeight: 1619,             // PNG 원본 세로 픽셀
    windows: [                       // 사진이 들어갈 4개 구멍 (PNG 원본 픽셀 좌표)
      { x: 74, y: 80, w: 397, h: 610 },   // 1번 사진 (왼쪽 위)
      { x: 499, y: 80, w: 397, h: 610 },  // 2번 사진 (오른쪽 위)
      { x: 74, y: 711, w: 397, h: 592 },  // 3번 사진 (왼쪽 아래)
      { x: 499, y: 711, w: 397, h: 592 }  // 4번 사진 (오른쪽 아래)
    ]
  },
];
```

- 배열에 객체를 하나 추가하면 편집 화면에 버튼이 자동으로 생기고, 최종 합성 Canvas에도 즉시 반영됩니다. 다른 파일을 손댈 필요가 없습니다.
- **새 프레임 PNG 추가 방법**: `assets/frames/`에 투명 배경 PNG를 넣고, 이미지 편집 프로그램(또는 그림판의 눈금자)으로 사진이 들어갈 4개 투명 구멍의 x/y/w/h(px, 왼쪽 위 기준)를 재서 위 형식대로 `windows`에 적으면 됩니다. 순서는 항상 "왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래"이며, 이 순서가 선택 화면에서 고른 1~4번 사진 순서와 그대로 대응합니다.
- 로고/날짜/문구는 PNG 안에 이미 그려져 있어야 합니다. 이 앱은 프레임 위에 별도로 텍스트를 그리지 않습니다.
- 현재 3종(White/Black/Blue)이 등록되어 있으며, 모두 자양교회 여름수련회(2026.08.13~15) 로고가 포함된 실제 디자인입니다.

## 6. 아이패드 홈 화면에 추가하기 (PWA)

1. iPad Safari로 배포된 주소에 접속합니다.
2. 하단 공유 버튼(⬆️) → **"홈 화면에 추가"**를 누릅니다.
3. 홈 화면 아이콘으로 실행하면 주소창 없이 전체 화면(standalone) 앱처럼 실행됩니다.
4. 행사 당일에는 이 홈 화면 아이콘으로 실행하는 것을 권장합니다. (Safari 탭으로 열면 실수로 스와이프해서 탭을 닫거나 다른 사이트로 이동할 위험이 있습니다.)

## 7. 카메라 권한 문제 해결

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
  config.js             전역 설정: 촬영 수/시간, 출력 해상도, Cloudinary, 프레임, 문구
  utils.js               cover-crop 계산 등 공용 유틸
  camera.js              getUserMedia 수명주기 + 백그라운드 복귀 시 자동 복구
  capture.js              6장 자동 촬영 (카운트다운, 미러링 캡처, 플래시/셔터음, 다운스케일)
  selection.js            6장 중 4장 선택 + 선택 순서 관리/재정렬
  editor.js               프레임 실시간 미리보기
  renderer.js             최종 합성 로직 (미리보기/최종 출력이 공유하는 단일 진실 소스)
  cloudinary.js           Unsigned Upload
  qr.js                   QR 코드 렌더링 (vendor 라이브러리 wrapper)
  driveSave.js            운영자용 Google Drive 백업 저장 (결과 화면 "사진 저장" 버튼 전용)
  app.js                  화면 전환/상태 관리, 에러 처리, 자동 초기화 타이머
  vendor/qrcode.js        QR 생성 라이브러리 (MIT, Kazuhiko Arase, 서드파티 코드 그대로 포함)
view.html                 QR 스캔 시 휴대폰에서 열리는 사진 보기/저장 페이지
assets/
  frames/                 실제 사용 중인 PNG 프레임 3종(White/Black/Blue)
  icons/                  PWA 아이콘 (180/192/512/512-maskable)
  sounds/shutter.wav       셔터 효과음
  fonts/                  버튼/제목용 Ok단단체, 본문용 온글잎 의연체 (둘 다 상업용 무료)
```

### 폰트

- **버튼, 제목류**: `Ok단단체`(OkDanDan-Bold.ttf, OKTICON/OkFont 배포, 상업용 무료)
- **나머지 본문**: `온글잎 의연체`(OngeulipUiyeon-Regular.ttf, VoyagerX/온글잎 배포, 상업용 무료. 폰트 파일 재배포는 금지되어 있으니 다른 프로젝트에 그대로 복사해서 쓰지 말고 각 배포처에서 직접 받으세요.)
- `css/style.css` 상단의 `@font-face`와 `--font-heading`/`--font-body` 변수에서 관리합니다. 최종 합성 이미지 하단 문구도 동일한 폰트를 사용합니다.

## 실행 방법 요약

1. `python -m http.server 8080` 등으로 정적 서버 실행 → `http://localhost:8080` 접속
2. "촬영 시작" → 카메라 권한 허용 → 6장 자동 촬영(사진마다 6초) → 4장 선택 → 프레임 선택 → "사진 완성하기" → 자동 업로드 → QR 코드 확인
3. 완성 화면에서 60초간 조작이 없으면 자동으로 처음 화면으로 돌아갑니다(마지막 10초는 안내 배너 표시).

## 구현 시 참고/생략 사항

- 최종 합성 레이아웃은 세로 4단 스트립이 아니라, 자양교회 여름수련회 프레임 디자인에 맞춘 **2x2 그리드(왼쪽 위→오른쪽 위→왼쪽 아래→오른쪽 아래 = 선택한 1~4번 사진 순서)**입니다.
- **셔터 효과음은 합성 사운드**(스크립트로 생성한 간단한 클릭음)입니다. 실제 카메라 셔터를 녹음한 파일이 아닙니다. `assets/sounds/shutter.wav` 파일만 교체하면 다른 소리로 바꿀 수 있습니다.
- Cloudinary의 Upload Preset(`life4cut_unsigned`)이 Unsigned로 켜져 있고 Asset Folder가 지정되어 있다는 전제로 동작합니다 — 이 설정 자체는 Cloudinary 콘솔에서 미리 되어 있어야 하며, 이 저장소의 코드가 자동으로 만들어주지 않습니다.
- 화면 방향 강제 잠금(Screen Orientation Lock API)은 사용하지 않았습니다(스펙 요청대로, iPadOS에서 완전히 보장되지 않기 때문). 대신 세로로 돌아가도 레이아웃이 깨지지 않도록 CSS로만 대응했습니다.
- 필터 기능은 제거했습니다(요청에 따라). 편집 화면에서는 프레임만 선택합니다.
- 요청하신 핵심 흐름(시작→6장 촬영→4장 선택→프레임→QR) 외의 회원가입/로그인/서버/DB/관리자 페이지는 추가하지 않았습니다.

## 테스트

`css/style.css`, `js/*.js`는 실제 iPad Safari 환경을 그대로 재현할 수는 없어, Playwright(가짜 카메라 장치 + Cloudinary 네트워크 모킹)로 다음 시나리오를 자동 검증했습니다: 6장 자동 촬영 → 선택 순서/재정렬 → 프레임 실시간 반영 → 업로드 실패 시 재시도(캔버스 재생성 없이 기존 Blob 재사용) → QR 생성(280px 이상) → 완성 화면 유휴 자동 초기화 → 이전 사진 완전 초기화. 다만 이것은 데스크톱 Chromium 기반 시뮬레이션이므로, **실제 iPad Safari 실기기 및 실제 Cloudinary 업로드/QR 스캔 테스트는 배포 후 반드시 직접 확인**해야 합니다.
