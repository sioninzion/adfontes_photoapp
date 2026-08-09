// ---------------------------------------------------------------------------
// 6장 자동 촬영 시퀀스. 카운트다운 UI, 플래시, 셔터음, 프레임 캡처(미러 +
// cover crop + downscale)를 담당한다.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { computeCoverSourceRect, canvasToBlob, wait, nextId } from "./utils.js";

export class CaptureScreen {
  /**
   * @param {object} refs
   * @param {HTMLElement} refs.stageEl - 비디오를 담는 컨테이너(.capture-stage)
   * @param {HTMLVideoElement} refs.videoEl
   * @param {HTMLElement} refs.countdownEl
   * @param {HTMLElement} refs.progressEl
   * @param {HTMLElement[]} refs.thumbnailEls - 길이 6
   * @param {HTMLElement} refs.flashEl
   * @param {HTMLAudioElement} [refs.shutterAudioEl]
   */
  constructor(refs) {
    this.stageEl = refs.stageEl;
    this.videoEl = refs.videoEl;
    this.countdownEl = refs.countdownEl;
    this.progressEl = refs.progressEl;
    this.thumbnailEls = refs.thumbnailEls;
    this.flashEl = refs.flashEl;
    this.shutterAudioEl = refs.shutterAudioEl || null;

    this.photos = [];
    this.cancelled = false;
    this._timer = null;

    // 오프스크린 캡처용 캔버스는 재사용한다
    this._canvas = document.createElement("canvas");
    this._ctx = this._canvas.getContext("2d");

    // 아이패드를 세로/가로 어느 쪽으로 들어도 미리보기와 촬영 결과가 항상
    // 동일한 CONFIG.captureAspectRatio 비율을 갖도록, CSS의 aspect-ratio에
    // 기대지 않고 실제 픽셀 크기를 JS로 직접 계산해서 강제한다.
    this._onViewportChange = () => requestAnimationFrame(() => this._fitVideoBox());
    window.addEventListener("resize", this._onViewportChange);
    window.addEventListener("orientationchange", this._onViewportChange);

    // resize/orientationchange 이벤트만으로는 iOS Safari에서 레이아웃 변경
    // 시점을 놓치는 경우가 있어, 실제 컨테이너 크기 변화를 직접 관찰한다.
    if (typeof ResizeObserver !== "undefined" && this.stageEl) {
      this._resizeObserver = new ResizeObserver(() => this._fitVideoBox());
      this._resizeObserver.observe(this.stageEl);
    }

    // 카메라 스트림 메타데이터가 늦게 반영되는 기기에서도 최종적으로
    // 한 번 더 정확한 크기를 맞춘다.
    this.videoEl.addEventListener("loadedmetadata", () => this._fitVideoBox());
  }

  /** .capture-stage 안에서 captureAspectRatio를 유지하는 최대 크기를 계산해 적용한다. */
  _fitVideoBox() {
    if (!this.stageEl) return;
    const cw = this.stageEl.clientWidth;
    const ch = this.stageEl.clientHeight;
    if (!cw || !ch) return;

    const ratio = CONFIG.captureAspectRatio;
    let w = cw;
    let h = w / ratio;
    if (h > ch) {
      h = ch;
      w = h * ratio;
    }

    this.videoEl.style.width = `${Math.round(w)}px`;
    this.videoEl.style.height = `${Math.round(h)}px`;
  }

  /** 새 세션을 위해 상태와 썸네일을 초기화한다. 기존 Object URL은 정리한다. */
  reset() {
    this.cancel();
    this._revokeAll();
    this.photos = [];
    this.thumbnailEls.forEach((el) => {
      el.style.backgroundImage = "";
      el.classList.remove("filled");
      el.textContent = "";
    });
    this.countdownEl.textContent = "";
    this.progressEl.textContent = "";
  }

  cancel() {
    this.cancelled = true;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _revokeAll() {
    this.photos.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  }

  /** 6장을 순서대로 촬영한다. 도중 취소되면 null을 반환한다. */
  async run() {
    this.cancelled = false;
    this.photos = [];
    this._fitVideoBox();

    for (let i = 0; i < CONFIG.photoCount; i++) {
      if (this.cancelled) return null;
      this._renderProgress(i + 1);

      await this._runCountdown();
      if (this.cancelled) return null;

      const photo = await this._captureFrame(i);
      this.photos.push(photo);
      this._renderThumbnail(i, photo);
      this._triggerFlashAndShutter();

      await wait(CONFIG.captureFreezeMs);
      if (this.cancelled) return null;
    }

    this.countdownEl.textContent = "";
    this.progressEl.textContent = "";
    return this.photos;
  }

  _renderProgress(current) {
    this.progressEl.textContent = `PHOTO ${current} / ${CONFIG.photoCount}`;
  }

  _runCountdown() {
    return new Promise((resolve) => {
      let remaining = CONFIG.countdownSeconds;
      this._renderCountdownNumber(remaining);

      this._timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(this._timer);
          this._timer = null;
          resolve();
          return;
        }
        this._renderCountdownNumber(remaining);
      }, 1000);
    });
  }

  _renderCountdownNumber(n) {
    this.countdownEl.textContent = String(n);
    // 재시작 트릭으로 매번 scale/fade 애니메이션을 다시 실행시킨다
    this.countdownEl.classList.remove("countdown-pop");
    // eslint-disable-next-line no-unused-expressions
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add("countdown-pop");
  }

  async _captureFrame(index) {
    const video = this.videoEl;
    const nativeW = video.videoWidth || 1280;
    const nativeH = video.videoHeight || 720;

    const aspect = CONFIG.captureAspectRatio;
    const longEdge = CONFIG.captureLongEdge;
    const outW = aspect >= 1 ? longEdge : Math.round(longEdge * aspect);
    const outH = aspect >= 1 ? Math.round(longEdge / aspect) : longEdge;

    this._canvas.width = outW;
    this._canvas.height = outH;
    const ctx = this._ctx;

    ctx.save();
    // 전면 카메라 미러링: 미리보기(CSS 반전)와 동일한 방향으로 저장한다
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);

    const { sx, sy, sw, sh } = computeCoverSourceRect(nativeW, nativeH, outW, outH);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
    ctx.restore();

    const blob = await canvasToBlob(this._canvas, "image/jpeg", CONFIG.captureJpegQuality);
    const url = URL.createObjectURL(blob);

    return { id: nextId(), index, blob, url, width: outW, height: outH };
  }

  _renderThumbnail(index, photo) {
    const el = this.thumbnailEls[index];
    if (!el) return;
    el.style.backgroundImage = `url(${photo.url})`;
    el.classList.add("filled");
  }

  _triggerFlashAndShutter() {
    this.flashEl.classList.remove("flash-active");
    // eslint-disable-next-line no-unused-expressions
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add("flash-active");

    if (this.shutterAudioEl) {
      try {
        this.shutterAudioEl.currentTime = 0;
        const playPromise = this.shutterAudioEl.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            /* Safari 자동재생 정책으로 실패해도 촬영에는 영향 없음 */
          });
        }
      } catch {
        /* 무시 */
      }
    }
  }
}
