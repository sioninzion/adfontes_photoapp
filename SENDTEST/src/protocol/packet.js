// Binary packet layout for QR Beam frames.
//
// All multi-byte integers are big-endian. Layout:
//
//   [0..2]  magic "QRB"            3 bytes
//   [3]     protocol version       1 byte
//   [4]     packet type            1 byte  (0=START, 1=DATA, 2=END)
//   [5..8]  session id             4 bytes
//   ... type-specific fields ...
//
// START: totalChunks(4) fileSize(4) chunkSize(2) mimeLen(1) mime(mimeLen)
//        nameLen(2) name(nameLen, utf-8) hash(32)
// DATA:  chunkIndex(4) totalChunks(4) payloadLen(2) payload(payloadLen) crc32(4)
// END:   totalChunks(4) hash(32)
//
// The finished packet is Base64-encoded before being placed in a QR code — this keeps
// the payload text-safe for both the native BarcodeDetector API (which only exposes a
// decoded string, not raw bytes) and the jsQR fallback, at the cost of ~33% overhead.

import { MAGIC, PROTOCOL_VERSION, PACKET_TYPE } from './protocol.js';
import { crc32 } from './crc32.js';
import { bytesToBase64, base64ToBytes } from './hash.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class ByteWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }
  push(bytes) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }
  u8(v) { this.push(Uint8Array.of(v & 0xff)); }
  u16(v) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, v, false);
    this.push(b);
  }
  u32(v) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v >>> 0, false);
    this.push(b);
  }
  bytes(arr) { this.push(arr); }
  toUint8Array() {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}

class ByteReader {
  constructor(buf) {
    this.buf = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.offset = 0;
  }
  u8() { const v = this.view.getUint8(this.offset); this.offset += 1; return v; }
  u16() { const v = this.view.getUint16(this.offset, false); this.offset += 2; return v; }
  u32() { const v = this.view.getUint32(this.offset, false); this.offset += 4; return v; }
  bytes(n) { const v = this.buf.subarray(this.offset, this.offset + n); this.offset += n; return v; }
  remaining() { return this.buf.length - this.offset; }
}

function sessionIdToBytes(sessionIdHex) {
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    bytes[i] = parseInt(sessionIdHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function sessionIdFromBytes(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex.toUpperCase();
}

function writeHeader(w, type, sessionIdHex) {
  w.bytes(MAGIC);
  w.u8(PROTOCOL_VERSION);
  w.u8(type);
  w.bytes(sessionIdToBytes(sessionIdHex));
}

export function buildStartPacket({ sessionId, filename, fileSize, mimeType, chunkSize, totalChunks, hashBytes }) {
  const w = new ByteWriter();
  writeHeader(w, PACKET_TYPE.START, sessionId);
  w.u32(totalChunks);
  w.u32(fileSize);
  w.u16(chunkSize);
  const mimeBytes = textEncoder.encode(mimeType || 'application/octet-stream');
  w.u8(mimeBytes.length);
  w.bytes(mimeBytes);
  const nameBytes = textEncoder.encode(filename || 'file');
  w.u16(nameBytes.length);
  w.bytes(nameBytes);
  w.bytes(hashBytes);
  return w.toUint8Array();
}

export function buildDataPacket({ sessionId, chunkIndex, totalChunks, payload }) {
  const w = new ByteWriter();
  writeHeader(w, PACKET_TYPE.DATA, sessionId);
  w.u32(chunkIndex);
  w.u32(totalChunks);
  w.u16(payload.length);
  w.bytes(payload);
  w.u32(crc32(payload));
  return w.toUint8Array();
}

export function buildEndPacket({ sessionId, totalChunks, hashBytes }) {
  const w = new ByteWriter();
  writeHeader(w, PACKET_TYPE.END, sessionId);
  w.u32(totalChunks);
  w.bytes(hashBytes);
  return w.toUint8Array();
}

export function encodePacketToText(packetBytes) {
  return bytesToBase64(packetBytes);
}

// Returns a parsed packet object, or null if the text isn't a valid QR Beam packet
// (wrong magic/version, truncated, or a QR from an unrelated app in frame).
export function parsePacketFromText(text) {
  let bytes;
  try {
    bytes = base64ToBytes(text);
  } catch {
    return null;
  }
  return parsePacketBytes(bytes);
}

export function parsePacketBytes(bytes) {
  if (!bytes || bytes.length < 9) return null;
  if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1] || bytes[2] !== MAGIC[2]) return null;
  const version = bytes[3];
  if (version !== PROTOCOL_VERSION) return null;
  const type = bytes[4];

  try {
    const r = new ByteReader(bytes);
    r.bytes(3); // magic
    r.u8(); // version
    r.u8(); // type
    const sessionId = sessionIdFromBytes(r.bytes(4));

    if (type === PACKET_TYPE.START) {
      const totalChunks = r.u32();
      const fileSize = r.u32();
      const chunkSize = r.u16();
      const mimeLen = r.u8();
      const mimeType = textDecoder.decode(r.bytes(mimeLen));
      const nameLen = r.u16();
      const filename = textDecoder.decode(r.bytes(nameLen));
      const hashBytes = r.bytes(32);
      if (hashBytes.length !== 32) return null;
      return { type: PACKET_TYPE.START, version, sessionId, totalChunks, fileSize, chunkSize, mimeType, filename, hashBytes: new Uint8Array(hashBytes) };
    }

    if (type === PACKET_TYPE.DATA) {
      const chunkIndex = r.u32();
      const totalChunks = r.u32();
      const payloadLen = r.u16();
      const payload = r.bytes(payloadLen);
      if (payload.length !== payloadLen) return null;
      const checksum = r.u32();
      const actualCrc = crc32(payload);
      const crcValid = actualCrc === checksum;
      return { type: PACKET_TYPE.DATA, version, sessionId, chunkIndex, totalChunks, payload: new Uint8Array(payload), crcValid };
    }

    if (type === PACKET_TYPE.END) {
      const totalChunks = r.u32();
      const hashBytes = r.bytes(32);
      if (hashBytes.length !== 32) return null;
      return { type: PACKET_TYPE.END, version, sessionId, totalChunks, hashBytes: new Uint8Array(hashBytes) };
    }
  } catch {
    return null;
  }
  return null;
}
