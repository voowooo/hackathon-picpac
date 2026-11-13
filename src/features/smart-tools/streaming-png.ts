import { Zlib } from 'fflate';

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[i + 4] = type.charCodeAt(i);
  bytes.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < bytes.length - 4; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}

/** PNG scanlines are compressed incrementally: a full-resolution RGBA buffer is never required. */
export function createPngWriter(width: number, height: number, write: (bytes: Uint8Array) => void) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('Invalid PNG size');
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
  write(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])); write(chunk('IHDR', header));
  const compressor = new Zlib({ level: 3 }, (bytes, final) => {
    if (bytes.length) write(chunk('IDAT', bytes));
    if (final) write(chunk('IEND', new Uint8Array()));
  });
  let rows = 0;
  return {
    push(data: Uint8Array) {
      const count = data.length / (width * 4);
      if (!Number.isInteger(count) || count <= 0 || rows + count > height) throw new Error('Invalid PNG rows');
      const scanlines = new Uint8Array(data.length + count);
      for (let y = 0; y < count; y++) scanlines.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
      rows += count; compressor.push(scanlines, rows === height);
    },
  };
}

/** Halo includes all sequential blur/unsharp neighborhoods, so adjacent bands match. */
export function* photoBands(width: number, height: number, halo = 32) {
  const rows = Math.max(1, Math.min(256, Math.floor(1_000_000 / width)));
  for (let y = 0; y < height; y += rows) {
    const count = Math.min(rows, height - y), top = Math.max(0, y - halo);
    yield { y, count, top, height: Math.min(height, y + count + halo) - top };
  }
}
