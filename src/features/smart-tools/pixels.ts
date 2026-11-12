export type Pixels = { width: number; height: number; data: Uint8Array };
export type LocalEffect = "enhance" | "gray" | "sepia" | "contrast" | "bright" | "blur" | "retro" | "cool" | "sharpen" | "background";
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// Separable, alpha-weighted box blur: O(pixels), independent of radius.
// Transparent pixels must not bleed their hidden RGB into visible edges.
async function blurRgb(image: Pixels, radius: number) {
  const { width: w, height: h, data } = image;
  const horizontal = new Float32Array(w * h * 4);
  const output = new Uint8Array(data);
  for (let y = 0; y < h; y++) {
    const sums = [0, 0, 0, 0];
    const add = (x: number, sign: number) => {
      if (x < 0 || x >= w) return;
      const i = (y * w + x) * 4, a = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) sums[c] += data[i + c] * a * sign;
      sums[3] += a * sign;
    };
    for (let x = 0; x <= radius; x++) add(x, 1);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) horizontal[i + c] = sums[c];
      add(x - radius, -1); add(x + radius + 1, 1);
    }
    if (y % 64 === 0) await pause();
  }
  for (let x = 0; x < w; x++) {
    const sums = [0, 0, 0, 0];
    const add = (y: number, sign: number) => {
      if (y < 0 || y >= h) return;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) sums[c] += horizontal[i + c] * sign;
    };
    for (let y = 0; y <= radius; y++) add(y, 1);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      if (sums[3] > .001) for (let c = 0; c < 3; c++) output[i + c] = clamp(sums[c] / sums[3]);
      add(y - radius, -1); add(y + radius + 1, 1);
    }
    if (x % 64 === 0) await pause();
  }
  return output;
}

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
  const blurred = ['sharpen', 'enhance', 'blur'].includes(effect)
    ? await blurRgb(image, effect === 'blur' ? Math.max(2, Math.min(8, Math.round(Math.max(w, h) / 350))) : Math.max(1, Math.min(3, Math.round(Math.max(w, h) / 900)))) : null;
  const histogram = new Uint32Array(256);
  if (effect === "enhance") for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 32) histogram[Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)]++;
  const total = histogram.reduce((a, b) => a + b, 0);
  const percentile = (fraction: number) => { let n = 0; for (let i = 0; i < 256; i++) { n += histogram[i]; if (n > total * fraction) return i; } return 255; };
  const low = percentile(0.01), high = percentile(0.99);
  const gain = effect === "enhance" && high - low > 24 ? Math.min(1.6, 245 / (high - low)) : 1;
  let exposureMean = 0;
  if (total) exposureMean = histogram.reduce((sum, n, i) => sum + n * i, 0) / total;
  const gamma = effect === 'enhance' ? Math.max(.55, Math.min(1.4, Math.log(.52) / Math.log(Math.max(.03, Math.min(.97, exposureMean / 255))))) : 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (effect === "gray") r = g = b = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (effect === "sepia") { const rr = r, gg = g, bb = b; r = .393 * rr + .769 * gg + .189 * bb; g = .349 * rr + .686 * gg + .168 * bb; b = .272 * rr + .534 * gg + .131 * bb; }
      if (effect === "contrast") { r = (r - 128) * 1.38 + 128; g = (g - 128) * 1.38 + 128; b = (b - 128) * 1.38 + 128; }
      if (effect === "bright") { r = 255 * (r / 255) ** .72; g = 255 * (g / 255) ** .72; b = 255 * (b / 255) ** .72; }
      if (effect === "retro") { const l = .299 * r + .587 * g + .114 * b; r = r * .8 + l * .15 + 26; g = g * .78 + l * .15 + 12; b = b * .65 + l * .15 + 8; }
      if (effect === "cool") { r = r * .88; g = g * 1.02 + 4; b = b * 1.12 + 13; }
      if (effect === "enhance") {
        const tone = (v: number) => 255 * (Math.max(0, Math.min(255, (v - low) * gain + (gain === 1 ? low : 5))) / 255) ** gamma;
        r = tone(r); g = tone(g); b = tone(b);
        const l = .2126 * r + .7152 * g + .0722 * b;
        r = l + (r - l) * 1.08; g = l + (g - l) * 1.08; b = l + (b - l) * 1.08;
      }
      if (blurred) {
        if (effect === 'blur') { r = blurred[i]; g = blurred[i + 1]; b = blurred[i + 2]; }
        else {
          const amount = effect === 'enhance' ? .4 : 1.15;
          const detail = (c: number) => { const delta = data[i + c] - blurred[i + c]; return Math.abs(delta) > 3 ? Math.max(-35, Math.min(35, delta * amount)) : 0; };
          r += detail(0); g += detail(1); b += detail(2);
        }
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
  for (const zoom of [1, .9, .8]) for (let sy = 0; sy <= 8; sy++) for (let sx = 0; sx <= 8; sx++) {
    const cropW = cw * zoom, cropH = ch * zoom;
    const x0 = (w - cropW) * sx / 8, y0 = (h - cropH) * sy / 8;
    let score = 0, samples = 0;
    for (let y = Math.max(1, Math.ceil(y0)); y < Math.min(h - 1, y0 + cropH); y += 2) for (let x = Math.max(1, Math.ceil(x0)); x < Math.min(w - 1, x0 + cropW); x += 2) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 32) continue;
      const energy = Math.abs(data[i] - data[i + 4]) + Math.abs(data[i + 1] - data[i + w * 4 + 1]);
      const centerWeight = 1 - .5 * (Math.abs((x - x0) / cropW - .5) + Math.abs((y - y0) / cropH - .5));
      score += energy * centerWeight; samples++;
    }
    score = score / Math.max(1, samples) * zoom ** .8;
    score = (score + .001) * (1 - .035 * (Math.abs(sx - 4) + Math.abs(sy - 4)));
    if (score > bestScore) { bestScore = score; best = { x: x0, y: y0, w: cropW, h: cropH }; }
  }
  return { x: best.x / w, y: best.y / h, w: best.w / w, h: best.h / h };
}
