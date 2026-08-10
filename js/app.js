// ---------------------------------------------------------------------------
// 전체 화면 전환과 상태를 관리하는 메인 컨트롤러.
// 시작 -> 촬영(6장) -> 선택(4장) -> 편집(프레임) -> 업로드 -> 결과(QR)
// ---------------------------------------------------------------------------

import { CONFIG, FRAMES } from "./config.js";
import { CameraManager } from "./camera.js";
import { CaptureScreen } from "./capture.js";
import { SelectionScreen } from "./selection.js";
import { EditorScreen } from "./editor.js";
import { renderComposite } from "./renderer.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { renderQrCode } from "./qr.js";
import { canvasToBlob } from "./utils.js";
import { convertFinalImageToPngDataUrl, uploadFinalImageToDrive } from "./driveSave.js";

// ---------------------------------------------------------------------------
// DOM 참조
// ---------------------------------------------------------------------------
const screens = {
  start: document.getElementById("screen-start"),
  cameraError: document.getElementById("screen-camera-error"),
  capture: document.getElementById("screen-capture"),
  select: document.getElementById("screen-select"),
  edit: document.getElementById("screen-edit"),
  upload: document.getElementById("screen-upload"),
  result: document.getElementById("screen-result")
};

const startButton = document.getElementById("start-button");
const startStatus = document.getElementById("start-status");

const cameraErrorMessage = document.getElementById("camera-error-message");
const cameraErrorRetryButton = document.getElementById("camera-error-retry-button");

const captureStage = document.getElementById("capture-stage");
const captureFrame = document.getElementById("capture-frame");
const captureVideo = document.getElementById("capture-video");
const captureProgress = document.getElementById("capture-progress");
const captureCountdown = document.getElementById("capture-countdown");
const captureFlash = document.getElementById("capture-flash");
const captureThumbEls = Array.from(document.querySelectorAll("#capture-thumbnails .capture-thumb"));
const shutterAudio = document.getElementById("shutter-audio");

const selectCellEls = Array.from(document.querySelectorAll("#select-grid .select-cell"));
const selectNextButton = document.getElementById("select-next-button");

const editPreviewCanvas = document.getElementById("edit-preview-canvas");
const editFrameList = document.getElementById("edit-frame-list");
const editFinishButton = document.getElementById("edit-finish-button");

const uploadLoadingPanel = document.getElementById("upload-loading");
const uploadFailedPanel = document.getElementById("upload-failed");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadErrorMessage = document.getElementById("upload-error-message");
const uploadRetryButton = document.getElementById("upload-retry-button");
const uploadFailedImage = document.getElementById("upload-failed-image");

const resultFinalImage = document.getElementById("result-final-image");
const resultQrContainer = document.getElementById("result-qr-container");
const resultQrRetryButton = document.getElementById("result-qr-retry-button");
const resultRestartButton = document.getElementById("result-restart-button");
const resultExtendButton = document.getElementById("result-extend-button");
const resultIdleBar = document.getElementById("result-idle-bar");
const resultIdleSeconds = document.getElementById("result-idle-seconds");

const globalErrorToast = document.getElementById("global-error-toast");

// ---------------------------------------------------------------------------
// 상태
// ---------------------------------------------------------------------------
const state = {
  photos: [], // 6장 원본 촬영본
  selectedOrder: [], // 선택 순서대로 정렬된 4장
  finalBlob: null,
  finalObjectUrl: null,
  secureUrl: null,
  uploadFailureMode: null, // 'render' | 'upload'
  driveSaved: false // 운영자용 Drive 백업 중복 저장 방지 플래그
};

let isStarting = false;
let isFinishing = false;
let isUploading = false;
let isDriveSaving = false;
let idleIntervalId = null;
let idleRemaining = 0;

const cameraManager = new CameraManager(captureVideo);
cameraManager.onError = (err) => {
  captureScreen.cancel();
  showCameraErrorScreen(err);
};

const captureScreen = new CaptureScreen({
  stageEl: captureStage,
  frameEl: captureFrame,
  videoEl: captureVideo,
  countdownEl: captureCountdown,
  progressEl: captureProgress,
  thumbnailEls: captureThumbEls,
  flashEl: captureFlash,
  shutterAudioEl: shutterAudio
});

const selectionScreen = new SelectionScreen(selectCellEls, selectNextButton, (count) => {
  if (count === 0) selectNextButton.textContent = `${CONFIG.selectedPhotoCount}장을 선택해주세요`;
  else if (count === CONFIG.selectedPhotoCount) selectNextButton.textContent = "다음";
  else selectNextButton.textContent = `${count} / ${CONFIG.selectedPhotoCount} 선택됨`;
});

const frameButtons = buildEditorButtons();
const editorScreen = new EditorScreen({
  previewCanvas: editPreviewCanvas,
  frameButtons
});

// ---------------------------------------------------------------------------
// 화면 전환
// ---------------------------------------------------------------------------
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("screen--active", key === name);
  });
  if (name !== "result") stopIdleWatch();
}

function showToast(message) {
  globalErrorToast.textContent = message;
  globalErrorToast.classList.add("toast--visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    globalErrorToast.classList.remove("toast--visible");
  }, 4000);
}

// ---------------------------------------------------------------------------
// 프레임 버튼 동적 생성 (config.js만 수정하면 자동 반영)
// ---------------------------------------------------------------------------
function buildEditorButtons() {
  return FRAMES.map((frame) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn frame-btn";
    btn.dataset.frameId = frame.id;
    btn.innerHTML = `
      <span class="frame-swatch" style="background-image:url(${frame.overlaySrc})"></span>
      <span class="option-label">${frame.name}</span>
    `;
    editFrameList.appendChild(btn);
    return btn;
  });
}

// ---------------------------------------------------------------------------
// 1. 시작 화면 -> 카메라 시작 -> 촬영 화면
// ---------------------------------------------------------------------------
async function handleStartCapture() {
  if (isStarting) return;
  isStarting = true;
  startButton.disabled = true;
  startStatus.textContent = "카메라를 준비하고 있어요...";

  try {
    await cameraManager.start();
    startStatus.textContent = "";
    startButton.disabled = false;
    showScreen("capture");
    runCaptureSequence();
  } catch (err) {
    startButton.disabled = false;
    startStatus.textContent = "";
    showCameraErrorScreen(err);
  } finally {
    isStarting = false;
  }
}

function showCameraErrorScreen(err) {
  cameraErrorMessage.textContent =
    (err && err.message) || "카메라를 시작할 수 없습니다. iPad 설정에서 카메라 권한을 확인해주세요.";
  showScreen("cameraError");
}

async function runCaptureSequence() {
  captureScreen.reset();
  const photos = await captureScreen.run();
  if (!photos) return; // 취소됨 (카메라 오류 등)

  state.photos = photos;
  cameraManager.stop(); // 편집이 끝날 때까지 카메라는 필요 없음

  selectionScreen.init(photos);
  showScreen("select");
}

// ---------------------------------------------------------------------------
// 2. 선택 화면 -> 편집 화면
// ---------------------------------------------------------------------------
async function handleSelectNext() {
  if (selectNextButton.disabled) return;
  state.selectedOrder = selectionScreen.getOrderedSelection();

  // 선택되지 않은 2장은 더 이상 필요 없으므로 즉시 메모리에서 해제한다
  const selectedIds = new Set(state.selectedOrder.map((p) => p.id));
  state.photos.forEach((p) => {
    if (!selectedIds.has(p.id) && p.url) URL.revokeObjectURL(p.url);
  });

  showScreen("edit");
  editFinishButton.disabled = true;
  try {
    await editorScreen.init(state.selectedOrder);
  } catch (err) {
    showToast("사진을 불러오는 중 문제가 발생했습니다.");
  } finally {
    editFinishButton.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// 3. 편집 화면 -> 최종 이미지 생성 -> 업로드 화면
// ---------------------------------------------------------------------------
async function handleFinish() {
  if (isFinishing) return;
  isFinishing = true;
  editFinishButton.disabled = true;

  showScreen("upload");
  showUploadLoading();

  try {
    const blob = await generateFinalImage();
    state.finalBlob = blob;
    if (state.finalObjectUrl) URL.revokeObjectURL(state.finalObjectUrl);
    state.finalObjectUrl = URL.createObjectURL(blob);
  } catch (err) {
    state.uploadFailureMode = "render";
    showUploadFailed("사진을 만드는 중 문제가 발생했습니다. 다시 시도해주세요.");
    isFinishing = false;
    editFinishButton.disabled = false;
    return;
  }

  isFinishing = false;
  editFinishButton.disabled = false;
  attemptUpload();
}

async function generateFinalImage() {
  const canvas = document.createElement("canvas");
  canvas.width = CONFIG.finalWidth;
  canvas.height = CONFIG.finalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas를 생성할 수 없습니다.");

  await renderComposite(ctx, {
    width: CONFIG.finalWidth,
    height: CONFIG.finalHeight,
    images: editorScreen.images,
    frame: editorScreen.getFrame()
  });

  return canvasToBlob(canvas, "image/jpeg", CONFIG.jpegQuality);
}

// ---------------------------------------------------------------------------
// 4. 업로드
// ---------------------------------------------------------------------------
function showUploadLoading() {
  uploadLoadingPanel.classList.remove("hidden");
  uploadFailedPanel.classList.add("hidden");
  setUploadProgress(0);
}

function showUploadFailed(message) {
  uploadLoadingPanel.classList.add("hidden");
  uploadFailedPanel.classList.remove("hidden");
  uploadErrorMessage.textContent = message;
  if (state.finalObjectUrl) uploadFailedImage.src = state.finalObjectUrl;
}

function setUploadProgress(ratio) {
  uploadProgressBar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
}

async function attemptUpload() {
  if (isUploading) return;
  isUploading = true;
  uploadRetryButton.disabled = true;
  showUploadLoading();

  try {
    const secureUrl = await uploadToCloudinary(state.finalBlob, setUploadProgress);
    state.secureUrl = secureUrl;
    showResult();
  } catch (err) {
    state.uploadFailureMode = "upload";
    showUploadFailed(err && err.message ? err.message : "업로드에 실패했습니다. 다시 시도해주세요.");
  } finally {
    isUploading = false;
    uploadRetryButton.disabled = false;
  }
}

function handleRetryUpload() {
  if (uploadRetryButton.disabled) return;
  if (state.uploadFailureMode === "render" || !state.finalBlob) {
    handleFinish();
  } else {
    attemptUpload();
  }
}

// ---------------------------------------------------------------------------
// 5. 결과 화면 (QR + 완성 사진) + 자동 초기화
// ---------------------------------------------------------------------------
function showResult() {
  resultFinalImage.src = state.finalObjectUrl;
  renderResultQr();
  showScreen("result");
  startIdleWatch();
  handleDriveSave();
}

/**
 * QR로 곧바로 Cloudinary 원본 이미지를 열지 않고, 앱과 같은 톤으로 꾸며진
 * view.html(사진 + 저장 버튼)을 거치도록 한다. GitHub Pages의 하위 경로
 * 배포에서도 항상 올바르게 동작하도록 현재 페이지 기준 상대 경로로 만든다.
 */
function buildQrTargetUrl(secureUrl) {
  const target = new URL("view.html", window.location.href);
  target.searchParams.set("src", secureUrl);
  return target.href;
}

function renderResultQr() {
  try {
    renderQrCode(resultQrContainer, buildQrTargetUrl(state.secureUrl), 320);
  } catch (err) {
    resultQrContainer.innerHTML = '<p class="qr-error">QR 코드를 생성하지 못했습니다.</p>';
  }
}

// ---------------------------------------------------------------------------
// 운영자용 Google Drive 백업 저장 (참가자용 QR 다운로드와는 완전히 별개 기능).
// 결과 화면에 진입하면 자동으로 한 번 실행된다(버튼 없음, 화면에 별도 안내 없음).
// ---------------------------------------------------------------------------
async function handleDriveSave() {
  if (isDriveSaving) return; // 중복 실행 방지
  if (state.driveSaved) return; // 이미 이 결과물은 저장 완료됨 - 중복 업로드 방지
  if (!state.finalObjectUrl) return;

  isDriveSaving = true;

  try {
    const pngDataUrl = await convertFinalImageToPngDataUrl(state.finalObjectUrl);
    await uploadFinalImageToDrive(pngDataUrl);
    state.driveSaved = true;
  } catch (err) {
    showToast("사진의 Drive 저장에 실패했습니다.");
  } finally {
    isDriveSaving = false;
  }
}

function startIdleWatch() {
  stopIdleWatch();
  idleRemaining = CONFIG.resultIdleTimeoutSeconds;
  resultIdleSeconds.textContent = String(idleRemaining);
  resultIdleBar.classList.remove("idle-bar--warning");
  idleIntervalId = setInterval(() => {
    idleRemaining -= 1;
    resultIdleSeconds.textContent = String(Math.max(idleRemaining, 0));
    resultIdleBar.classList.toggle("idle-bar--warning", idleRemaining <= CONFIG.resultIdleWarningSeconds);
    if (idleRemaining <= 0) {
      stopIdleWatch();
      resetSession();
    }
  }, 1000);
}

function stopIdleWatch() {
  if (idleIntervalId) {
    clearInterval(idleIntervalId);
    idleIntervalId = null;
  }
}

function handleExtendIdle() {
  if (!idleIntervalId) return; // 결과 화면이 아니면 무시
  startIdleWatch();
  showToast(`시간이 ${CONFIG.resultIdleTimeoutSeconds}초 연장되었습니다.`);
}

// ---------------------------------------------------------------------------
// 세션 초기화 (처음으로)
// ---------------------------------------------------------------------------
function resetSession() {
  stopIdleWatch();
  cameraManager.stop();

  captureScreen.reset();
  selectionScreen.reset();
  editorScreen.reset();

  if (state.finalObjectUrl) URL.revokeObjectURL(state.finalObjectUrl);
  state.photos = [];
  state.selectedOrder = [];
  state.finalBlob = null;
  state.finalObjectUrl = null;
  state.secureUrl = null;
  state.uploadFailureMode = null;
  state.driveSaved = false; // 새 촬영이 시작되면 다음 결과물은 다시 저장할 수 있어야 한다

  resultQrContainer.innerHTML = "";
  showScreen("start");
}

// ---------------------------------------------------------------------------
// 이벤트 바인딩
// ---------------------------------------------------------------------------
startButton.addEventListener("click", handleStartCapture);
cameraErrorRetryButton.addEventListener("click", handleStartCapture);
selectNextButton.addEventListener("click", handleSelectNext);
editFinishButton.addEventListener("click", handleFinish);
uploadRetryButton.addEventListener("click", handleRetryUpload);
resultQrRetryButton.addEventListener("click", renderResultQr);
resultRestartButton.addEventListener("click", resetSession);
resultExtendButton.addEventListener("click", handleExtendIdle);

// 결과 화면에서 아무 터치가 있으면 자동 초기화 타이머를 리셋한다
screens.result.addEventListener("pointerdown", () => {
  if (idleIntervalId) startIdleWatch();
});

// 네트워크가 끊겼다가 돌아왔을 때 안내
window.addEventListener("offline", () => {
  showToast("인터넷 연결이 끊어졌습니다.");
});

// ---------------------------------------------------------------------------
// 초기 화면
// ---------------------------------------------------------------------------
// 썸네일 그리드(CSS aspect-ratio)가 실제 촬영 비율과 항상 같도록 동기화한다.
// (촬영 중인 비디오 박스 자체는 CaptureScreen이 JS로 직접 크기를 계산해 강제한다)
document.documentElement.style.setProperty("--capture-aspect", String(CONFIG.captureAspectRatio));

// 버튼/제목용 커스텀 폰트를 미리 로드한다. Canvas 텍스트(최종 합성 하단 문구)는
// 폰트 로딩이 끝나기 전에 그리면 조용히 기본 폰트로 대체되므로, 편집 화면에
// 도달하기 전에 최대한 일찍 로딩을 시작해둔다.
if (typeof FontFace !== "undefined") {
  Promise.all([
    new FontFace("OkDanDan", 'url("assets/fonts/OkDanDan-Bold.ttf")', { weight: "700" }).load(),
    new FontFace("OngeulipUiyeon", 'url("assets/fonts/OngeulipUiyeon-Regular.ttf")', { weight: "400" }).load()
  ])
    .then((fonts) => fonts.forEach((font) => document.fonts.add(font)))
    .catch(() => {
      /* 로딩 실패해도 CSS @font-face의 시스템 폰트 fallback으로 정상 동작한다 */
    });
}

showScreen("start");
