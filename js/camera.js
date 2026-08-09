// ---------------------------------------------------------------------------
// 카메라 스트림 수명주기를 관리한다.
// - 전면 카메라 요청 + 해상도 fallback
// - <video>는 CSS로 좌우 반전(미러) 처리 (style.css의 .camera-video)
// - 앱이 background -> foreground로 돌아왔을 때 죽은 트랙을 자동 복구
// ---------------------------------------------------------------------------

const CONSTRAINT_ATTEMPTS = [
  {
    video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  },
  {
    video: { facingMode: "user" },
    audio: false
  },
  {
    video: true,
    audio: false
  }
];

export class CameraManager {
  constructor(videoElement) {
    this.videoEl = videoElement;
    this.stream = null;
    this.onError = null;
    this._visibilityBound = this._handleVisibilityChange.bind(this);
    this._pageShowBound = this._handlePageShow.bind(this);
    document.addEventListener("visibilitychange", this._visibilityBound);
    window.addEventListener("pageshow", this._pageShowBound);
    window.addEventListener("focus", this._pageShowBound);
  }

  get isActive() {
    return !!(this.stream && this.stream.getVideoTracks().some((t) => t.readyState === "live"));
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /** 카메라 스트림을 시작한다. 해상도를 순차적으로 낮춰가며 시도한다. */
  async start() {
    if (!CameraManager.isSupported()) {
      const err = new Error("이 브라우저는 카메라를 지원하지 않습니다.");
      err.code = "unsupported";
      throw err;
    }

    this.stop();

    let lastError = null;
    for (const constraints of CONSTRAINT_ATTEMPTS) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.stream = stream;
        this.videoEl.srcObject = stream;
        await this.videoEl.play().catch(() => {});
        this._attachTrackEndedWatcher();
        return stream;
      } catch (err) {
        lastError = err;
      }
    }

    const wrapped = new Error(this._describeError(lastError));
    wrapped.code = lastError && lastError.name ? lastError.name : "unknown";
    wrapped.original = lastError;
    throw wrapped;
  }

  _describeError(err) {
    if (!err) return "카메라를 시작할 수 없습니다.";
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "카메라 권한이 거부되었습니다.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "카메라를 찾을 수 없습니다.";
      case "NotReadableError":
      case "TrackStartError":
        return "카메라가 다른 앱에서 사용 중입니다.";
      default:
        return "카메라를 시작할 수 없습니다.";
    }
  }

  _attachTrackEndedWatcher() {
    if (!this.stream) return;
    this.stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (this.onError) this.onError(new Error("카메라 연결이 끊어졌습니다."));
      });
    });
  }

  _handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      this._recoverIfNeeded();
    }
  }

  _handlePageShow() {
    this._recoverIfNeeded();
  }

  async _recoverIfNeeded() {
    if (!this.stream) return; // 아직 카메라를 사용 중이 아니면 손대지 않는다
    const needsRecovery = this.stream.getVideoTracks().every((t) => t.readyState === "ended");
    if (needsRecovery) {
      try {
        await this.start();
      } catch (err) {
        if (this.onError) this.onError(err);
      }
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this._visibilityBound);
    window.removeEventListener("pageshow", this._pageShowBound);
    window.removeEventListener("focus", this._pageShowBound);
  }
}
