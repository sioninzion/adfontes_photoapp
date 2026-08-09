// SHA-256 hashing and Base64 <-> bytes helpers. All computation stays on-device via Web Crypto.

export async function sha256(bufferOrView) {
  const buf = bufferOrView instanceof Uint8Array ? bufferOrView.buffer.slice(bufferOrView.byteOffset, bufferOrView.byteOffset + bufferOrView.byteLength) : bufferOrView;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

export function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Base64 encode/decode for arbitrary binary Uint8Array, chunked to avoid call-stack limits
// on String.fromCharCode(...bigArray) for large inputs.
export function bytesToBase64(bytes) {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomSessionId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes).toUpperCase();
}
