// ---------------------------------------------------------------------------
// 시작 화면 양 끝(각 15%) 세로 띠 장식.
// 각 옆면은 5개의 가는 띠(ribbon)로 나뉘고, 띠 하나하나는 모든 구절을 한
// 줄로 이어붙인 긴 문장이 계속 흘러가는 형태다(개별 구절이 툭툭 끊겨
// 움직이는 것이 아니라 하나의 연속된 띠).
//
// - 왼쪽 5개 띠: 아래->위로 흐름, 글자는 -90deg(바닥이 오른쪽/중앙을 향함)
// - 오른쪽 5개 띠: 위->아래로 흐름, 글자는 +90deg(바닥이 왼쪽/중앙을 향함)
// - 띠마다 한글/영문(NIV)을 번갈아 사용하고, 폰트도 두 가지를 번갈아 쓴다.
// - 10개 띠가 전부 조금씩 다른 속도로 움직이도록 duration을 미세하게 다르게 준다.
//
// translateY(px) 애니메이션을 rotate()보다 먼저 적용하면(transform 리스트에서
// 앞쪽에 두면) 화면상 이동 방향은 항상 순수한 수직 이동이 된다는 점을
// 실제로 측정해서 확인한 뒤 이 방식을 사용했다.
// ---------------------------------------------------------------------------

import { BIBLE_VERSES } from "./config.js";

const RIBBONS_PER_SIDE = 5;
const FONT_CLASSES = ["verse-font-a", "verse-font-b"];
const SEPARATOR = "     ·     ";
const BASE_DURATION_MS = 95000;
const DURATION_STEP_MS = 9000; // 띠마다 속도를 살짝씩 다르게

function buildJoinedText(useEnglish) {
  return BIBLE_VERSES.map((v) => {
    if (useEnglish) return `${v.textEn} — ${v.refEn}`;
    return `${v.text} - ${v.ref}`;
  }).join(SEPARATOR);
}

function buildRibbon(railEl, index, { rotateClass, rotateDeg, direction }) {
  const ribbon = document.createElement("div");
  ribbon.className = "verse-ribbon";

  const textEl = document.createElement("div");
  const useEnglish = index % 2 === 1;
  const fontClass = FONT_CLASSES[index % FONT_CLASSES.length];
  textEl.className = `verse-ribbon-text ${rotateClass} ${fontClass}`;

  const joined = buildJoinedText(useEnglish);
  // 이어붙인 문장을 두 번 반복해야 스크롤이 끊김 없이 순환한다.
  textEl.textContent = joined + SEPARATOR + joined;

  ribbon.appendChild(textEl);
  railEl.appendChild(ribbon);

  // 한 바퀴(원본 문장 하나 길이)만큼만 이동하면 정확히 이어 붙은 지점에서
  // 다시 처음과 동일한 모습이 되어 자연스럽게 순환한다.
  // transform 순서는 반드시 "중앙 정렬(translate -50%,-50%) -> 스크롤
  // (translateY) -> 회전(rotate)" 이어야 화면상 이동 방향이 항상 순수한
  // 수직 이동이 된다 - 실제 브라우저에서 각 순서별로 렌더링 결과를 측정해
  // 확인했다.
  requestAnimationFrame(() => {
    const halfWidth = textEl.scrollWidth / 2;
    const duration = BASE_DURATION_MS + index * DURATION_STEP_MS;
    const start = direction === "up" ? 0 : -halfWidth;
    const end = direction === "up" ? -halfWidth : 0;

    if (typeof textEl.animate === "function") {
      textEl.animate(
        [
          { transform: `translate(-50%, -50%) translateY(${start}px) rotate(${rotateDeg}deg)` },
          { transform: `translate(-50%, -50%) translateY(${end}px) rotate(${rotateDeg}deg)` }
        ],
        { duration, iterations: Infinity, easing: "linear" }
      );
    }
  });
}

/** 시작 화면의 좌/우 성경 말씀 띠(각 5개, 총 10개)를 생성한다. 한 번만 호출하면 된다. */
export function initVerseRails() {
  const leftRail = document.getElementById("verse-rail-left");
  const rightRail = document.getElementById("verse-rail-right");
  if (!leftRail || !rightRail) return;

  for (let i = 0; i < RIBBONS_PER_SIDE; i++) {
    buildRibbon(leftRail, i, { rotateClass: "verse-text--rotate-ccw", rotateDeg: -90, direction: "up" });
    buildRibbon(rightRail, i, { rotateClass: "verse-text--rotate-cw", rotateDeg: 90, direction: "down" });
  }
}
