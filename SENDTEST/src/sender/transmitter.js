import { LIMITS } from '../protocol/protocol.js';
import { sha256, bytesToHex, randomSessionId } from '../protocol/hash.js';
import { chunkBytes } from '../protocol/chunker.js';
import { buildStartPacket, buildDataPacket, buildEndPacket, encodePacketToText } from '../protocol/packet.js';
import { renderQRToCanvas } from '../qr/encoder.js';

const IMAGE_COMPRESS_MAX_DIMENSION = 1920;
const IMAGE_COMPRESS_QUALITY = 0.82;

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, IMAGE_COMPRESS_MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_COMPRESS_QUALITY));
  const buf = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buf), mimeType: 'image/jpeg' };
}

function withJpegExtension(filename) {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base}.jpg`;
}

// Drives the "chunk -> QR -> screen" side of the pipeline. Builds the full ordered list
// of packets once (START, START, DATA[0..N-1], END) and then loops over it forever at a
// fixed FPS until stop() is called — receivers that miss frames simply pick them up on
// the next cycle.
export class Transmitter {
  constructor({ canvas, mode, onFrame, onComplete }) {
    this.canvas = canvas;
    this.mode = mode;
    this.onFrame = onFrame || (() => {});
    this.onComplete = onComplete || (() => {});
    this.packets = [];
    this.meta = null;
    this.running = false;
    this.paused = false;
    this.frameIndex = 0;
    this.cycle = 1;
    this.bytesEmitted = 0;
    this.startTime = 0;
    this._nextTickAt = 0;
    this._timerId = null;
  }

  async prepare(file, { compress = false } = {}) {
    let bytes = new Uint8Array(await file.arrayBuffer());
    let filename = file.name || 'file';
    let mimeType = file.type || 'application/octet-stream';
    let compressedInfo = null;

    if (bytes.length > LIMITS.MAX_FILE_SIZE) {
      throw new Error(`파일이 너무 큽니다. 최대 ${(LIMITS.MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB까지 지원합니다.`);
    }

    if (compress && mimeType.startsWith('image/') && mimeType !== 'image/gif') {
      const originalSize = bytes.length;
      const result = await compressImage(file);
      if (result.bytes.length < originalSize) {
        bytes = result.bytes;
        mimeType = result.mimeType;
        filename = withJpegExtension(filename);
        compressedInfo = { originalSize, newSize: bytes.length };
      }
    }

    const hashBytes = await sha256(bytes);
    const sessionId = randomSessionId();
    const chunks = chunkBytes(bytes, this.mode.payloadSize);
    const totalChunks = chunks.length;

    const startText = encodePacketToText(buildStartPacket({
      sessionId, filename, fileSize: bytes.length, mimeType,
      chunkSize: this.mode.payloadSize, totalChunks, hashBytes,
    }));
    const endText = encodePacketToText(buildEndPacket({ sessionId, totalChunks, hashBytes }));

    const packets = [startText, startText];
    for (let i = 0; i < totalChunks; i++) {
      packets.push(encodePacketToText(buildDataPacket({ sessionId, chunkIndex: i, totalChunks, payload: chunks[i] })));
    }
    packets.push(endText);

    this.packets = packets;
    this.dataFrameCount = totalChunks;
    this.meta = {
      filename, fileSize: bytes.length, mimeType, totalChunks, sessionId,
      hashHex: bytesToHex(hashBytes), compressedInfo, chunkSize: this.mode.payloadSize,
    };
    return this.meta;
  }

  start() {
    if (!this.packets.length) throw new Error('전송할 파일이 준비되지 않았습니다.');
    this.running = true;
    this.paused = false;
    this.frameIndex = 0;
    this.cycle = 1;
    this.bytesEmitted = 0;
    this.startTime = performance.now();
    this._nextTickAt = performance.now();
    this._tick();
  }

  pause() {
    this.paused = true;
    if (this._timerId) { clearTimeout(this._timerId); this._timerId = null; }
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this._nextTickAt = performance.now();
    this._tick();
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this._timerId) { clearTimeout(this._timerId); this._timerId = null; }
  }

  _tick() {
    if (!this.running || this.paused) return;

    const text = this.packets[this.frameIndex];
    renderQRToCanvas(this.canvas, text, this.mode.ecLevel);

    const isDataFrame = this.frameIndex >= 2 && this.frameIndex < 2 + this.dataFrameCount;
    const dataFrameIndex = isDataFrame ? this.frameIndex - 2 : -1;
    if (isDataFrame) this.bytesEmitted += this.mode.payloadSize;

    const elapsedSec = (performance.now() - this.startTime) / 1000;
    this.onFrame({
      frameIndex: this.frameIndex,
      totalFrames: this.packets.length,
      dataFrameIndex,
      totalChunks: this.dataFrameCount,
      cycle: this.cycle,
      fps: this.mode.fps,
      bytesEmitted: this.bytesEmitted,
      elapsedSec,
      meta: this.meta,
    });

    this.frameIndex++;
    if (this.frameIndex >= this.packets.length) {
      this.frameIndex = 0;
      this.cycle++;
      this.onComplete({ cycle: this.cycle });
    }

    const interval = 1000 / this.mode.fps;
    this._nextTickAt += interval;
    const delay = Math.max(0, this._nextTickAt - performance.now());
    this._timerId = setTimeout(() => this._tick(), delay);
  }
}
