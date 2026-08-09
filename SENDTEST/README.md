# QR Beam

Wi-Fi, 인터넷, Bluetooth, 서버 연결 없이 **화면과 카메라만으로** 기기 간에 파일을 전송하는 완전 오프라인 웹앱(PWA)입니다.

> **화면의 빛 자체가 데이터 전송 채널입니다.**
> 파일은 서버에 업로드되지 않습니다. 두 기기가 같은 네트워크에 있을 필요도, 네트워크에 연결되어 있을 필요도 없습니다.

---

## 1. 작동 원리

```
FILE → Binary → Chunk → QR Frames → Screen → Camera → QR Decode
     → Chunk Recovery → Binary Reconstruction → Original File
```

1. **송신자**가 파일을 선택하면 파일 전체의 SHA-256 해시를 계산하고, 파일을 여러 개의
   작은 조각(chunk)으로 나눕니다.
2. 각 조각은 `START` / `DATA` / `END` 프레임으로 감싸져 QR 코드로 그려지고, 화면에서
   빠르게 연속으로 바뀝니다 (기본 10 QR/s). 스트림은 사용자가 중지할 때까지 반복됩니다.
3. **수신자**는 카메라로 화면을 비추고, 프레임을 순서에 상관없이 디코딩합니다. 이미 받은
   조각은 중복 저장하지 않고, 놓친 조각은 다음 반복(cycle)에서 채워집니다.
4. 모든 조각이 모이면 원본 순서대로 합치고, SHA-256 해시를 다시 계산해 송신자가 보낸
   해시와 비교합니다. 일치하면 파일을 저장할 수 있습니다.

네트워크(Wi-Fi/인터넷/Bluetooth/서버/WebRTC 등)는 어디에도 사용되지 않습니다. GitHub
Pages는 **앱 코드를 내려받는 용도**로만 쓰이고, 실제 파일 데이터는 절대 인터넷을 거치지
않습니다.

---

## 2. 프로토콜 구조

QR 하나에 담기는 패킷은 바이너리로 설계되어 있고, QR 텍스트 안전성을 위해 Base64로
인코딩됩니다 (네이티브 `BarcodeDetector`는 디코딩된 문자열만 반환하고 원시 바이트에
접근할 수 없기 때문에, 두 디코더 경로 모두에서 안전한 Base64를 선택했습니다).

```
[0..2]  magic "QRB"       3 bytes
[3]     protocol version  1 byte
[4]     packet type       1 byte   0=START, 1=DATA, 2=END
[5..8]  session id        4 bytes

START:  totalChunks(4) fileSize(4) chunkSize(2) mimeLen(1) mime(...) 
        nameLen(2) name(..., utf-8) sha256Hash(32)
DATA:   chunkIndex(4) totalChunks(4) payloadLen(2) payload(...) crc32(4)
END:    totalChunks(4) sha256Hash(32)
```

- 세션마다 4바이트 랜덤 세션 ID (예: `A82F391C`)가 발급됩니다.
- 각 DATA 프레임에는 CRC32 체크섬이 있어 QR 오류정정과 별개로 손상된 페이로드를
  걸러냅니다.
- 전송 스트림: `START, START, DATA(0), DATA(1), ..., DATA(N-1), END` 를 사용자가
  중지할 때까지 반복합니다.
- 수신자는 **첫 START 패킷의 세션 ID에 잠금(lock)** 되며, 다른 세션의 패킷은 무시합니다
  (여러 QR Beam 송신자가 근처에 있어도 안전).
- `chunkIndex` 기준으로 슬롯에 저장하므로 순서가 뒤섞여 도착해도 문제없습니다.

`src/protocol/`, `src/qr/` 모듈은 현재의 "인덱스 기반 chunk + 반복 전송" 방식에
강하게 결합되어 있지 않도록 분리되어 있어, 추후 Fountain/LT Code 같은 소거코드로
전송 계층만 교체할 수 있습니다 (§8 향후 계획 참고).

---

## 3. 설치 & 실행

별도의 빌드 과정이 없는 순수 HTML/CSS/JavaScript(ES Modules) 프로젝트입니다. QR
생성/디코딩 라이브러리(`qrcode-generator`, `jsQR`)는 `src/vendor/`에 이미 포함되어
있어 `npm install` 없이도 바로 실행됩니다.

### 개발 서버 실행

```bash
npm run dev
# 또는
npx http-server . -p 8080
```

브라우저에서 `http://localhost:8080` 접속. `localhost`는 보안 컨텍스트로 취급되어
HTTP로도 카메라 권한(`getUserMedia`)이 정상 동작합니다.

같은 Wi-Fi 안에서 다른 기기로 테스트하려면 로컬 IP로 접속하되(`http://<PC-IP>:8080`),
이 경우 대부분의 모바일 브라우저는 **HTTPS가 아니면 카메라를 막습니다** — 실제 QR
송수신 테스트는 배포된 HTTPS 주소(GitHub Pages 등) 또는 `mkcert` 등으로 로컬 HTTPS
인증서를 만들어 진행하는 것을 권장합니다.

### 빌드

빌드 단계가 없습니다. `SENDTEST/` 폴더 전체가 정적 배포 산출물입니다.

### GitHub Pages 배포

1. 이 폴더(`SENDTEST/`)의 내용을 리포지토리 루트(또는 `docs/` 등)에 푸시합니다.
2. GitHub 저장소 Settings → Pages → Branch에서 배포할 브랜치/폴더를 지정합니다.
3. `https://<사용자명>.github.io/<저장소명>/` 로 접속합니다.

모든 리소스 경로가 상대 경로(`./src/...`)로 작성되어 있어 저장소 하위 경로에
배포되어도 그대로 동작합니다.

> **중요**: GitHub Pages는 앱 코드 다운로드에만 사용됩니다. 실제 파일 전송 데이터는
> GitHub이나 인터넷을 절대 거치지 않습니다.

---

## 4. PWA 설치

앱을 한 번 로드하면 Service Worker가 앱 셸(HTML/CSS/JS/아이콘)을 캐시하여, 이후에는
인터넷 연결 없이도 앱을 실행할 수 있습니다 (단, 파일 전송 자체는 원래부터 항상
오프라인입니다).

- **iPhone (Safari)**: 사이트 접속 → 공유 버튼(⬆️) → "홈 화면에 추가"
- **Android (Chrome)**: 사이트 접속 → 우측 상단 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"
- **데스크톱 (Chrome/Edge)**: 주소창 오른쪽의 설치 아이콘 클릭

### 카메라 권한 설정

- **iPhone Safari**: 설정 → Safari → 카메라 → "확인" 또는 "허용"으로 설정. 이미
  거부했다면 설정 → Safari → 웹사이트 설정에서 해당 사이트의 카메라 권한을 재설정하세요.
- **Android Chrome**: 주소창의 자물쇠(또는 정보) 아이콘 → 권한 → 카메라 → "허용".
  전역적으로 막혀 있다면 설정 → 앱 → Chrome → 권한 → 카메라를 확인하세요.

---

## 5. 사용 방법

**보내는 사람**

앱 실행 → `파일 보내기` → 파일 선택 → (사진인 경우) 원본/빠른 전송 선택 → 전송 모드
선택 → `전송 시작` → 화면에 뜨는 QR을 상대방에게 보여줍니다.

**받는 사람**

앱 실행 → `파일 받기` → `카메라 시작` → 화면 안의 사각형 프레임에 상대방의 QR
화면을 맞춥니다 → 자동으로 수신/조립/검증 후 `파일 저장`.

### 권장 설정

| 항목 | 권장값 |
|---|---|
| 송수신 거리 | 15~30cm (QR이 뷰파인더 사각형을 가득 채우는 정도) |
| 화면 밝기 | 최대 밝기 권장 (인식률 향상) |
| FPS | 표준 모드 10 QR/s (안정 6 QR/s / 고속 15 QR/s) |
| 전송 모드 | 처음에는 "표준", 인식이 잘 안 되면 "안정"으로 낮추기 |

### 전송 모드

| 모드 | payload/QR | FPS | 오류정정 | QR 크기(모듈) |
|---|---|---|---|---|
| 안정 | 120 B | 6 | H (최고) | ~73×73 |
| 표준 | 280 B | 10 | M | ~77×77 |
| 고속 | 500 B | 15 | L (최저) | ~89×89 |

> Base64로 인코딩된 바이너리 패킷 특성상 오류정정 수준(H)이 높을수록 같은 데이터량 대비
> 더 많은 모듈을 필요로 합니다. 그래서 "안정" 모드는 payload를 충분히 작게 잡아, 오류정정
> 수준이 낮은 "고속" 모드보다도 QR이 더 조밀해지지 않도록(=더 읽기 쉽도록) 실측 기반으로
> 값을 정했습니다.

---

## 6. 디버그 모드

URL에 `?debug=1`을 붙이면(`index.html?debug=1`) 화면 하단에 실시간 로그 패널이
나타나 세션 ID, 패킷 타입, 중복/CRC 오류 횟수, 세션 잠금/해시 불일치 등의 내부 상태를
확인할 수 있습니다. 일반 사용자에게는 노출되지 않습니다.

---

## 7. 현재 구현된 기능

- File → ArrayBuffer → SHA-256 해시 계산 (Web Crypto)
- 파일 청크 분할 및 바이너리 패킷(START/DATA/END) 인코딩, Base64 QR 텍스트 변환
- `qrcode-generator` 기반 QR 렌더링 (Canvas 직접 렌더링, 고정 FPS 루프, 표준/안정/고속 모드)
- 카메라 스트림 + 중앙 ROI 크롭 스캔 루프, `BarcodeDetector` 우선 사용 + `jsQR` 폴백
- 세션 잠금, chunk 중복 제거, 순서 무관 저장, CRC32 검증, 반복 전송을 통한 누락 복구
- SHA-256 전체 파일 무결성 검증, 실패 시 계속 수신 대기
- 사진 압축("빠른 사진 전송") 옵션, 이미지/동영상 미리보기, 원본 파일명 유지 다운로드
- Wake Lock(화면 꺼짐 방지), Fullscreen API, Safe Area 대응, 다크모드
- PWA(manifest + Service Worker)로 앱 셸 오프라인 캐싱
- `?debug=1` 디버그 패널

## 8. 현재 한계점

- 파일 크기 제한: 권장 10MB 이하, 최대 30MB (`src/protocol/protocol.js`의 `LIMITS`
  상수로 손쉽게 조정 가능). 전체 파일을 메모리에 올려 처리하는 v1 구조상의 제약입니다.
- HEIC는 `<input type="file">`이 그대로 바이너리로 전송하지만, 수신 측 브라우저가
  HEIC 미리보기를 지원하지 않으면(대부분의 비-Safari 브라우저) 완료 화면에서 파일
  아이콘만 표시됩니다. 파일 자체는 정상적으로 복원됩니다.
- 순차 chunk + 반복 전송 방식이라, 아주 많은 조각(느린 회선/큰 파일 + 낮은 FPS) 조합에서는
  완주까지 여러 cycle이 필요할 수 있습니다.
- END 패킷은 보조 신호일 뿐이며, 완료 판정은 항상 "모든 chunk 수신 + 해시 일치" 기준입니다.
- 해시 불일치 시 특정 chunk를 재요청하는 능동적 매커니즘은 없고, 송신 스트림의 다음
  cycle을 계속 수신하는 수동적 복구만 지원합니다.
- **처리량이 매우 낮습니다.** 화면-카메라 광학 채널의 근본적인 한계로, 이론상 최대
  속도는 고속 모드에서도 초당 수 KB 수준입니다 (예: 500B × 15fps ≈ 7.5KB/s). 인생네컷
  같은 사진 한 장(수 MB)을 원본 그대로 보내면 수 분이 걸릴 수 있으므로, 사진은 기본으로
  제공되는 "빠른 사진 전송" 압축 옵션을 사용하는 것을 강력히 권장합니다.

## 9. 향후 Fountain Code 적용 계획

프로토콜과 chunk 계층(`src/protocol/chunker.js`, `src/protocol/packet.js`)은 "chunk
index 기반 반복 전송"에 강하게 결합되지 않도록 분리되어 있습니다. 다음 단계로:

1. DATA 패킷에 (원본 chunk가 아닌) LT/Fountain 인코딩 심볼과 인코딩 계수를 담는
   패킷 타입을 추가.
2. 수신측 `receiver.js`의 슬롯 배열을 belief-propagation 기반 디코더로 교체.
3. 순수 반복 전송 모드와 Fountain 모드를 세션 START 패킷의 플래그로 구분해, 구버전
   수신기와의 호환성을 유지.

v1은 "실제로 성공하는 전송"을 최우선으로 삼아 이 작업은 의도적으로 범위에서
제외했습니다.

---

## 10. 개인정보 및 보안

- 전송 파일은 어떤 서버에도 업로드되지 않습니다.
- Analytics, 외부 API 호출이 전혀 없습니다.
- 모든 인코딩/디코딩/해싱은 기기 내부(Web Crypto, Canvas, getUserMedia)에서만
  이루어집니다.

---

## 11. 프로젝트 구조

```
SENDTEST/
├── index.html
├── manifest.json
├── service-worker.js
├── package.json
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── main.js
│   ├── sender/
│   │   ├── sender.js
│   │   └── transmitter.js
│   ├── receiver/
│   │   ├── receiver.js
│   │   └── scanner.js
│   ├── protocol/
│   │   ├── protocol.js
│   │   ├── packet.js
│   │   ├── chunker.js
│   │   ├── crc32.js
│   │   └── hash.js
│   ├── qr/
│   │   ├── encoder.js
│   │   └── decoder.js
│   ├── ui/
│   │   ├── senderUI.js
│   │   ├── receiverUI.js
│   │   ├── hud.js
│   │   └── format.js
│   ├── vendor/
│   │   ├── qrcode.js   (kazuhikoarase/qrcode-generator, MIT)
│   │   └── jsQR.js     (cozmo/jsQR, Apache-2.0)
│   └── styles/
│       └── style.css
└── README.md
```
