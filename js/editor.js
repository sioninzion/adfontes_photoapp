// ---------------------------------------------------------------------------
// 프레임 편집 화면.
// 프레임을 누르면 별도 "적용" 버튼 없이 즉시 미리보기 Canvas에 반영한다.
// 원본 사진은 다시 인코딩하지 않고, renderer.js의 동일한 합성 함수로
// 작은 미리보기 Canvas에만 다시 그린다.
// ---------------------------------------------------------------------------

import { CONFIG, FRAMES } from "./config.js";
import { renderComposite } from "./renderer.js";
import { loadImageFromUrl } from "./utils.js";

export class EditorScreen {
  /**
   * @param {object} refs
   * @param {HTMLCanvasElement} refs.previewCanvas
   * @param {HTMLElement[]} refs.frameButtons - dataset.frameId 보유
   */
  constructor(refs) {
    this.previewCanvas = refs.previewCanvas;
    this.ctx = this.previewCanvas.getContext("2d");
    this.frameButtons = refs.frameButtons;

    this.images = [];
    this.frameId = FRAMES[0].id;

    this.frameButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.setFrame(btn.dataset.frameId));
    });
  }

  /** @param {Array<{url:string}>} orderedPhotos - 선택 순서대로 정렬된 4장 */
  async init(orderedPhotos) {
    this.frameId = FRAMES[0].id;
    this.previewCanvas.width = CONFIG.previewWidth;
    this.previewCanvas.height = CONFIG.previewHeight;

    this.images = await Promise.all(orderedPhotos.map((p) => loadImageFromUrl(p.url)));
    this._updateActiveButtons();
    await this._render();
  }

  setFrame(id) {
    if (this.frameId === id) return;
    this.frameId = id;
    this._updateActiveButtons();
    this._render();
  }

  getFrame() {
    return FRAMES.find((f) => f.id === this.frameId) || FRAMES[0];
  }

  _updateActiveButtons() {
    this.frameButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.frameId === this.frameId);
    });
  }

  async _render() {
    await renderComposite(this.ctx, {
      width: this.previewCanvas.width,
      height: this.previewCanvas.height,
      images: this.images,
      frame: this.getFrame()
    });
  }

  reset() {
    this.images = [];
  }
}
