// ---------------------------------------------------------------------------
// 6장 중 4장 선택 화면.
// 터치한 "순서"가 최종 인생네컷의 위->아래 배치 순서가 된다.
// 이미 선택한 사진을 다시 누르면 선택이 취소되고, 뒤 번호들이 자동으로 당겨진다.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";

export class SelectionScreen {
  /**
   * @param {HTMLElement[]} cellEls - 길이 6, 각 셀은 .thumb-img, .thumb-badge 자식을 가진다
   * @param {HTMLButtonElement} nextButtonEl
   * @param {(count:number)=>void} [onSelectionChange]
   */
  constructor(cellEls, nextButtonEl, onSelectionChange) {
    this.cellEls = cellEls;
    this.nextButtonEl = nextButtonEl;
    this.onSelectionChange = onSelectionChange || (() => {});
    this.order = []; // photo index(0~5)의 배열, 선택한 순서
    this.photos = [];

    this._onCellClick = this._onCellClick.bind(this);
    this.cellEls.forEach((el, index) => {
      el.addEventListener("click", () => this._onCellClick(index));
    });
  }

  /** 촬영된 6장으로 화면을 초기화한다. */
  init(photos) {
    this.photos = photos;
    this.order = [];
    this.cellEls.forEach((el, index) => {
      const img = el.querySelector(".thumb-img");
      if (img && photos[index]) img.style.backgroundImage = `url(${photos[index].url})`;
      el.classList.remove("selected");
      const badge = el.querySelector(".thumb-badge");
      if (badge) badge.textContent = "";
    });
    this._updateNextButton();
  }

  _onCellClick(index) {
    const existingPos = this.order.indexOf(index);
    if (existingPos !== -1) {
      this.order.splice(existingPos, 1);
    } else {
      if (this.order.length >= CONFIG.selectedPhotoCount) {
        this._shake(this.cellEls[index]);
        return;
      }
      this.order.push(index);
    }
    this._render();
  }

  _shake(el) {
    el.classList.remove("shake");
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth;
    el.classList.add("shake");
  }

  _render() {
    this.cellEls.forEach((el, index) => {
      const pos = this.order.indexOf(index);
      const badge = el.querySelector(".thumb-badge");
      if (pos === -1) {
        el.classList.remove("selected");
        if (badge) badge.textContent = "";
      } else {
        el.classList.add("selected");
        if (badge) badge.textContent = String(pos + 1);
      }
    });
    this._updateNextButton();
  }

  _updateNextButton() {
    const done = this.order.length === CONFIG.selectedPhotoCount;
    this.nextButtonEl.disabled = !done;
    this.onSelectionChange(this.order.length);
  }

  /** 선택 순서대로 정렬된 사진 배열(위->아래)을 반환한다. */
  getOrderedSelection() {
    return this.order.map((photoIndex) => this.photos[photoIndex]);
  }

  reset() {
    this.order = [];
    this.photos = [];
  }
}
