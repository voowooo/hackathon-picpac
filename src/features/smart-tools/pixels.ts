export type Pixels = { width: number; height: number; data: Uint8Array };
export type LocalEffect = "enhance" | "gray" | "sepia" | "contrast" | "bright" | "blur" | "retro" | "cool" | "sharpen" | "background";
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export function measurePixels(image: Pixels) {
  const { width: w, height: h, data } = image;
  const gray = new Float32Array(w * h);
  let sum = 0, square = 0, count = 0, clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    gray[i] = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    if (data[offset + 3] < 32) continue;
    sum += gray[i]; square += gray[i] ** 2; count++;
    if (gray[i] < 8 || gray[i] > 247) clipped++;
  }
  const brightness = count ? sum / count : 0;
  let lapSum = 0, lapSquare = 0, lapCount = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if ([i, i - 1, i + 1, i - w, i + w].some(p => data[p * 4 + 3] < 32)) continue;
    const lap = gray[i] * 4 - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
    lapSum += lap; lapSquare += lap * lap; lapCount++;
  }
  return { brightness, contrast: Math.sqrt(Math.max(0, square / Math.max(1, count) - brightness ** 2)), sharpness: Math.max(0, lapSquare / Math.max(1, lapCount) - (lapSum / Math.max(1, lapCount)) ** 2), clipped: clipped / Math.max(1, count) };
}

export async function applyLocalEffect(image: Pixels, effect: LocalEffect): Promise<Pixels> {
  if (effect === "background") return removePlainBackground(image);
  const { width: w, height: h, data } = image;
  const out = new Uint8Array(data);
  const histogram = new Uint32Array(256);
  if (effect === "enhance") for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 32) histogram[Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)]++;
  const total = histogram.reduce((a, b) => a + b, 0);
  const percentile = (fraction: number) => { let n = 0; for (let i = 0; i < 256; i++) { n += histogram[i]; if (n > total * fraction) return i; } return 255; };
  const low = percentile(0.01), high = percentile(0.99);
  const gain = effect === "enhance" ? Math.min(1.45, 240 / Math.max(40, high - low)) : 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (effect === "gray") r = g = b = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (effect === "sepia") { const rr = r, gg = g, bb = b; r = .393 * rr + .769 * gg + .189 * bb; g = .349 * rr + .686 * gg + .168 * bb; b = .272 * rr + .534 * gg + .131 * bb; }
      if (effect === "contrast") { r = (r - 128) * 1.22 + 128; g = (g - 128) * 1.22 + 128; b = (b - 128) * 1.22 + 128; }
      if (effect === "bright") { r = r * 1.08 + 12; g = g * 1.08 + 12; b = b * 1.08 + 12; }
      if (effect === "retro") { r = r * .94 + 22; g = g * .9 + 16; b = b * .8 + 13; }
      if (effect === "cool") { r *= .95; g = g * 1.01 + 2; b = b * 1.06 + 7; }
      if (effect === "enhance") { r = (r - low) * gain + 7; g = (g - low) * gain + 7; b = (b - low) * gain + 7; }
      if ((effect === "sharpen" || effect === "enhance" || effect === "blur") && x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        const amount = effect === "enhance" ? .18 : .3;
        const channels = [r, g, b];
        for (let c = 0; c < 3; c++) {
          const average = (data[i - 4 + c] + data[i + 4 + c] + data[i - w * 4 + c] + data[i + w * 4 + c]) / 4;
          channels[c] = effect === "blur" ? (average * 4 + data[i + c]) / 5 : channels[c] + amount * (data[i + c] - average);
        }
        [r, g, b] = channels;
      }
      out[i] = clamp(r); out[i + 1] = clamp(g); out[i + 2] = clamp(b);
    }
    if (y % 64 === 0) await pause();
  }
  return { width: w, height: h, data: out };
}

async function removePlainBackground(image: Pixels): Promise<Pixels> {
  const { width: w, height: h, data } = image;
  const samples = new Map<number, { count: number; r: number; g: number; b: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 32) return;
    const key = (data[i] >> 5) * 64 + (data[i + 1] >> 5) * 8 + (data[i + 2] >> 5);
    const s = samples.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    s.count++; s.r += data[i]; s.g += data[i + 1]; s.b += data[i + 2]; samples.set(key, s);
  };
  for (let x = 0; x < w; x += 3) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 3) { sample(0, y); sample(w - 1, y); }
  const dominant = [...samples.values()].sort((a, b) => b.count - a.count)[0];
  const total = [...samples.values()].reduce((n, s) => n + s.count, 0);
  if (!dominant || dominant.count < total * .32) throw new Error("Для этой функции нужен однотонный фон");
  const bg = [dominant.r, dominant.g, dominant.b].map(n => n / dominant.count);
  const mask = new Uint8Array(w * h), queue = new Uint32Array(w * h);
  let start = 0, end = 0;
  const visit = (p: number) => {
    if (mask[p]) return;
    const i = p * 4;
    const distance = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    if (data[i + 3] > 0 && distance > 48) return;
    mask[p] = 1; queue[end++] = p;
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
  while (start < end) {
    const p = queue[start++], x = p % w, y = Math.floor(p / w);
    if (x > 0) visit(p - 1); if (x < w - 1) visit(p + 1); if (y > 0) visit(p - w); if (y < h - 1) visit(p + w);
    if (start % 50000 === 0) await pause();
  }
  if (end < w * h * .01 || end > w * h * .95) throw new Error("Не удалось отделить объект от фона");
  const out = new Uint8Array(data);
  for (let p = 0; p < mask.length; p++) {
    if (mask[p]) out[p * 4 + 3] = 0;
    else {
      const x = p % w, y = Math.floor(p / w);
      const neighbors = (x > 0 ? mask[p - 1] : 0) + (x < w - 1 ? mask[p + 1] : 0) + (y > 0 ? mask[p - w] : 0) + (y < h - 1 ? mask[p + w] : 0);
      if (neighbors) out[p * 4 + 3] = Math.min(out[p * 4 + 3], 255 - neighbors * 36);
    }
  }
  return { width: w, height: h, data: out };
}

export function suggestCrop(image: Pixels, aspect: number) {
  const { width: w, height: h, data } = image;
  if (w < 2 || h < 2) return { x: 0, y: 0, w: 1, h: 1 };
  const imageAspect = w / h;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : imageAspect;
  let cw = Math.min(w, h * safeAspect);
  let ch = cw / safeAspect;
  if (ch > h) {
    ch = h;
    cw = ch * safeAspect;
  }
  if (cw > w) {
    cw = w;
    ch = cw / safeAspect;
  }
  cw = Math.max(1, cw);
  ch = Math.max(1, ch);
  let best = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch }, bestScore = -Infinity;
  for (let sy = 0; sy <= 8; sy++) for (let sx = 0; sx <= 8; sx++) {
    const x0 = (w - cw) * sx / 8, y0 = (h - ch) * sy / 8;
    let score = 0;
    for (let y = Math.max(1, Math.ceil(y0)); y < Math.min(h - 1, y0 + ch); y += 2) for (let x = Math.max(1, Math.ceil(x0)); x < Math.min(w - 1, x0 + cw); x += 2) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 32) continue;
      const energy = Math.abs(data[i] - data[i + 4]) + Math.abs(data[i + 1] - data[i + w * 4 + 1]);
      const centerWeight = 1 - .5 * (Math.abs((x - x0) / cw - .5) + Math.abs((y - y0) / ch - .5));
      score += energy * centerWeight;
    }
    score *= 1 - .035 * (Math.abs(sx - 4) + Math.abs(sy - 4));
    if (score > bestScore) { bestScore = score; best = { x: x0, y: y0, w: cw, h: ch }; }
  }
  return { x: best.x / w, y: best.y / h, w: best.w / w, h: best.h / h };
}
