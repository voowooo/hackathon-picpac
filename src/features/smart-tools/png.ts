import { convertIndexedToRgb, decode } from "fast-png";
import type { Pixels } from "./pixels";

export function decodePhotoPng(pngData: Uint8Array): Pixels {
  const decoded = decode(pngData);
  const png = decoded.palette ? { ...decoded, data: convertIndexedToRgb(decoded), channels: decoded.palette[0].length, depth: 8 } : decoded;
  if (png.depth < 8 && png.channels === 1) {
    const data = new Uint8Array(png.width * png.height * 4);
    const stride = Math.ceil(png.width * png.depth / 8), mask = (1 << png.depth) - 1;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const bit = x * png.depth;
      const value = (png.data[y * stride + Math.floor(bit / 8)] >> (8 - png.depth - bit % 8)) & mask;
      const i = (y * png.width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(value / mask * 255);
      data[i + 3] = png.transparency?.[0] === value ? 0 : 255;
    }
    return { width: png.width, height: png.height, data };
  }
  if (png.depth !== 8 && png.depth !== 16) throw new Error('Не удалось прочитать цветовой формат фото');
  const data = new Uint8Array(png.width * png.height * 4);
  const byte = (n: number) => png.depth === 16 ? Math.round(n / 257) : n;
  for (let p = 0; p < png.width * png.height; p++) {
    const i = p * png.channels, out = p * 4;
    data[out] = byte(png.data[i]);
    data[out + 1] = byte(png.channels >= 3 ? png.data[i + 1] : png.data[i]);
    data[out + 2] = byte(png.channels >= 3 ? png.data[i + 2] : png.data[i]);
    data[out + 3] = png.channels === 4 ? byte(png.data[i + 3]) : png.channels === 2 ? byte(png.data[i + 1]) : 255;
    if (png.transparency && (png.channels === 1 || png.channels === 3)) {
      const key = png.transparency;
      if (png.data[i] === key[0] && (png.channels === 1 || png.data[i + 1] === key[1] && png.data[i + 2] === key[2])) data[out + 3] = 0;
    }
  }
  return { width: png.width, height: png.height, data };
}

