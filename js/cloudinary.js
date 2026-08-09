// ---------------------------------------------------------------------------
// Cloudinary Unsigned Upload. 서버/APIKey/Secret 없이 브라우저에서 바로 업로드.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";

export class UploadError extends Error {
  constructor(message) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * 최종 JPEG Blob을 Cloudinary에 업로드하고 secure_url을 반환한다.
 * @param {Blob} blob
 * @param {(ratio:number)=>void} [onProgress] - 0~1
 */
export function uploadToCloudinary(blob, onProgress) {
  return new Promise((resolve, reject) => {
    if (!navigator.onLine) {
      reject(new UploadError("인터넷에 연결되어 있지 않습니다."));
      return;
    }

    const formData = new FormData();
    formData.append("file", blob, "life4cut.jpg");
    formData.append("upload_preset", CONFIG.cloudinary.uploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", CONFIG.cloudinary.uploadUrl, true);
    xhr.responseType = "json";
    xhr.timeout = 30000;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = xhr.response;
        if (data && data.secure_url) {
          resolve(data.secure_url);
        } else {
          reject(new UploadError("업로드 응답에서 이미지 주소를 찾을 수 없습니다."));
        }
      } else {
        reject(new UploadError(`업로드에 실패했습니다. (오류 코드 ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new UploadError("네트워크 오류로 업로드에 실패했습니다."));
    xhr.ontimeout = () => reject(new UploadError("업로드 시간이 초과되었습니다."));

    xhr.send(formData);
  });
}
