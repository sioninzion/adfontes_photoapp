// ---------------------------------------------------------------------------
// 운영자용 Google Drive 백업 저장 기능.
// 참가자에게 사진을 전달하는 QR/Cloudinary 흐름과는 완전히 분리되어 있다.
// 사용자가 결과 화면의 "사진 저장" 버튼을 눌렀을 때만 호출되며, 자동으로
// 실행되지 않는다.
//
// Google Apps Script 웹앱은 CORS preflight(OPTIONS) 요청을 처리하지 못하는
// 경우가 많으므로, fetch에 Content-Type 등 커스텀 헤더를 절대 추가하지
// 않는다. body에 문자열을 그대로 넘기면 브라우저가 자동으로 CORS-safelisted
// Content-Type(text/plain)을 붙여서 preflight 없이 바로 전송된다.
// ---------------------------------------------------------------------------

import { loadImageFromUrl } from "./utils.js";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbybuR3almhAX7_VjJqk1oyZSJ1PGHPM0CiEd9V0yPBYQzmq_dhYDojO50AUHloF4qZk/exec";

/**
 * 이미 만들어진 최종 인생네컷 이미지(Object URL)를 새로 합성하지 않고
 * 그대로 다시 그려서 PNG Data URL로 변환한다. iPad Safari에서도
 * canvas.toDataURL("image/png")는 안정적으로 동작한다.
 * @param {string} imageUrl - state.finalObjectUrl 등 이미 렌더링된 최종 이미지 URL
 * @returns {Promise<string>} PNG data URL
 */
export async function convertFinalImageToPngDataUrl(imageUrl) {
  const img = await loadImageFromUrl(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas를 생성할 수 없습니다.");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * 완성된 PNG Data URL을 Google Apps Script 웹앱으로 전송해 Drive에 저장한다.
 * @param {string} imageDataUrl
 * @returns {Promise<{success:true, fileName?:string, fileId?:string, viewUrl?:string, downloadUrl?:string}>}
 */
export async function uploadFinalImageToDrive(imageDataUrl) {
  console.log("[Drive] 저장 시작");

  let response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ image: imageDataUrl })
    });
  } catch (networkErr) {
    console.log("[Drive] 저장 실패");
    throw new Error("네트워크 오류로 Drive에 저장하지 못했습니다.");
  }

  if (!response.ok) {
    console.log("[Drive] 저장 실패");
    throw new Error(`Drive 저장 요청이 실패했습니다. (status ${response.status})`);
  }

  let result;
  try {
    result = await response.json();
  } catch (parseErr) {
    console.log("[Drive] 저장 실패");
    throw new Error("Drive 응답을 이해할 수 없습니다.");
  }

  if (!result || result.success !== true) {
    console.log("[Drive] 저장 실패");
    throw new Error((result && result.error) || "Drive 저장에 실패했습니다.");
  }

  console.log("[Drive] 저장 성공");
  return result;
}
