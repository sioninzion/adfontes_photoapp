// ---------------------------------------------------------------------------
// 시작 화면 양 끝(각 15%) 세로 띠에 성경 말씀이 계속 흘러가는 장식 효과.
// 왼쪽은 아래->위, 오른쪽은 위->아래로 스크롤한다.
// 각 구절은 90도로 눕혀서 표시하되, 글자의 아래쪽(바닥)이 화면 중앙을
// 향하도록 방향을 반대로 준다(왼쪽은 -90deg, 오른쪽은 +90deg).
// 순수 장식 요소이므로 스크린리더에는 노출하지 않는다(aria-hidden).
// ---------------------------------------------------------------------------

import { BIBLE_VERSES } from "./config.js";

const FONT_CLASSES = ["verse-font-a", "verse-font-b"];

function buildTrack(railEl, rotationClass) {
  const track = document.createElement("div");
  track.className = "verse-track";

  // 리스트를 두 번 이어 붙여야 반복 지점에서 끊김 없이 순환한다.
  const doubled = [...BIBLE_VERSES, ...BIBLE_VERSES];

  doubled.forEach((verse, i) => {
    const slot = document.createElement("div");
    slot.className = "verse-slot";

    const textEl = document.createElement("div");
    textEl.className = `verse-text ${rotationClass} ${FONT_CLASSES[i % FONT_CLASSES.length]}`;
    textEl.innerHTML = `${verse.text}<br /><span class="verse-ref">- ${verse.ref}</span>`;

    slot.appendChild(textEl);
    track.appendChild(slot);
  });

  railEl.appendChild(track);
  return track;
}

/** 시작 화면의 좌/우 성경 말씀 띠를 생성한다. 한 번만 호출하면 된다. */
export function initVerseRails() {
  const leftRail = document.getElementById("verse-rail-left");
  const rightRail = document.getElementById("verse-rail-right");
  if (!leftRail || !rightRail) return;

  // 왼쪽: 글자 바닥이 중앙(오른쪽)을 향하도록 -90deg, 아래->위로 스크롤
  buildTrack(leftRail, "verse-text--rotate-ccw");
  // 오른쪽: 글자 바닥이 중앙(왼쪽)을 향하도록 +90deg, 위->아래로 스크롤
  buildTrack(rightRail, "verse-text--rotate-cw");
}
