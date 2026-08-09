// Splits a file's bytes into fixed-size chunks, and reassembles them back.
// Kept separate from packet.js so a future erasure-coded transport can reuse it.

export function chunkBytes(bytes, chunkSize) {
  const totalChunks = Math.max(1, Math.ceil(bytes.length / chunkSize));
  const chunks = new Array(totalChunks);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, bytes.length);
    chunks[i] = bytes.subarray(start, end);
  }
  return chunks;
}

// `slots` is an array of Uint8Array|null of length totalChunks, indexed by chunk index.
export function reassemble(slots, totalBytes) {
  const out = new Uint8Array(totalBytes);
  let offset = 0;
  for (const slot of slots) {
    out.set(slot, offset);
    offset += slot.length;
  }
  return out;
}
