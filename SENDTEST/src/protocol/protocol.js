// QR Beam protocol constants. Kept isolated from chunk/packet layout so the transport
// (currently: repeat-until-complete indexed chunks) can later be swapped for an
// erasure/fountain code without touching sender/receiver call sites.

export const PROTOCOL_VERSION = 1;

export const MAGIC = new Uint8Array([0x51, 0x52, 0x42]); // "QRB"

export const PACKET_TYPE = Object.freeze({
  START: 0,
  DATA: 1,
  END: 2,
});

export const PACKET_TYPE_NAME = Object.freeze({
  0: 'START',
  1: 'DATA',
  2: 'END',
});

// Hard limits — file size is capped so the whole file can safely live in memory as a
// single ArrayBuffer (no chunked-disk streaming in v1). Easy to raise later.
export const LIMITS = Object.freeze({
  RECOMMENDED_MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_FILE_SIZE: 30 * 1024 * 1024, // 30 MB
  MAX_FILENAME_BYTES: 65535,
  MAX_MIME_BYTES: 255,
});

// Transfer modes trade payload-per-QR / FPS / error-correction level against scan
// reliability. "표준" is the default — first priority is a transfer that actually
// completes, not raw throughput.
//
// Payload sizes are deliberately smaller than a naive "500-900 bytes" reading of the
// spec would suggest: with our Base64-encoded binary packets, a higher error-correction
// level (H) actually *reserves more codewords* than it saves, so pairing a larger
// payload with a higher EC level (as "안정" naively would) produces a DENSER QR code
// than "고속" — the opposite of what "안정" should mean. These sizes were chosen by
// measuring actual rendered QR module counts (via the vendored qrcode-generator) so
// that 안정 < 표준 < 고속 in module density, i.e. in how hard each is to scan.
export const TRANSFER_MODES = Object.freeze({
  stable: { key: 'stable', label: '안정', payloadSize: 120, fps: 6, ecLevel: 'H' }, // ~73 modules (v14)
  standard: { key: 'standard', label: '표준', payloadSize: 280, fps: 10, ecLevel: 'M' }, // ~77 modules (v15)
  fast: { key: 'fast', label: '고속', payloadSize: 500, fps: 15, ecLevel: 'L' }, // ~89 modules (v18)
});

export const DEFAULT_MODE = 'standard';

export const SCAN_FPS = 15; // how often the receiver samples the camera for a QR

// Sender state machine
export const SENDER_STATE = Object.freeze({
  IDLE: 'IDLE',
  FILE_SELECTED: 'FILE_SELECTED',
  PREPARING: 'PREPARING',
  TRANSMITTING: 'TRANSMITTING',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
  STOPPED: 'STOPPED',
});

// Receiver state machine
export const RECEIVER_STATE = Object.freeze({
  IDLE: 'IDLE',
  CAMERA_STARTING: 'CAMERA_STARTING',
  SCANNING: 'SCANNING',
  SESSION_FOUND: 'SESSION_FOUND',
  RECEIVING: 'RECEIVING',
  VERIFYING: 'VERIFYING',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
});
