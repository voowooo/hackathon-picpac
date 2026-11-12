/* global __dirname */
// No device or test framework needed: exercise the pixel and layout algorithms.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};
for (const extension of ['.png', '.jpg', '.jpeg']) require.extensions[extension] = module => { module.exports = 1; };
const root = path.join(__dirname, '..');
const { applyLocalEffect, suggestCrop } = require(path.join(root, 'src/features/smart-tools/pixels.ts'));
const { assessQuality } = require(path.join(root, 'src/features/smart-tools/quality.ts'));
const { historyPush, historyMove } = require(path.join(root, 'src/features/photo-editor/history.ts'));
const { makeSmartLayout } = require(path.join(root, 'src/features/smart-tools/layout.ts'));
const { makeConfig, aiSurcharge, buildSlotIds } = require(path.join(root, 'src/domain/products.ts'));
function image(w, h, pixel) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(pixel(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
}
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
(async () => {
  let past = [], future = [], current = 'original';
  for (const result of ['enhance', 'enhance+gray', 'gray']) { past = historyPush(past, current); current = result; future = []; }
  let step = historyMove(past, future, current);
  check(step.value === 'enhance+gray', 'Undo must restore the exact prior recipe');
  past = step.from; future = step.to; current = step.value;
  step = historyMove(future, past, current);
  check(step.value === 'gray', 'Redo must restore a removed-effect result');
  check(historyMove([], [], current) === null, 'History boundaries are safe');
  check(historyPush(Array.from({length:20}, (_, i) => i), 20).length === 12, 'History memory is bounded');
  const dark = assessQuality(image(64, 64, () => [12, 12, 12, 255]), 400, 400);
  const lifted = await applyLocalEffect(image(64, 64, () => [25, 35, 45, 255]), 'enhance');
  check(assessQuality(lifted, 3000, 2000).brightness > 50, 'Auto enhancement must visibly lift underexposure');
  check(dark.issues.some(s => s.includes('тёмное')), 'Dark photo must be flagged');
  check(dark.issues.some(s => s.includes('пикселей')), 'Low resolution must be flagged');
  const bright = assessQuality(image(64, 64, () => [250, 250, 250, 255]), 3000, 2000);
  check(bright.issues.some(s => s.includes('светлое')), 'Overexposure must be flagged');
  const sharpImage = image(64, 64, (x, y) => (x + y) % 2 ? [70, 150, 200, 255] : [190, 70, 90, 255]);
  const sharp = assessQuality(sharpImage, 3000, 2000);
  check(!sharp.issues.length, 'Detailed, adequately exposed large photo should pass');
  check(sharp.maxPrintWidthCm === 31 && sharp.maxPrintHeightCm === 21, 'Print recommendation uses original dimensions');
  const source = image(12, 12, (x, y) => [x % 2 ? 180 : 30 + x * 3, y * y + 30, (x * y % 8) * 20, (x + y) % 3 ? 255 : 0]);
  const untouched = new Uint8Array(source.data);
  for (const effect of ['enhance', 'gray', 'sepia', 'contrast', 'bright', 'blur', 'retro', 'cool', 'sharpen']) {
    const result = await applyLocalEffect(source, effect);
    check(result.width === source.width && result.height === source.height, `${effect} must retain dimensions`);
    check(result.data.every((v, i) => i % 4 !== 3 || v === source.data[i]), `${effect} must retain alpha`);
    check(result.data.some((v, i) => v !== source.data[i]), `${effect} must perform real processing`);
    if (effect === 'gray') check(result.data.every((v, i, a) => i % 4 !== 0 || v === a[i + 1] && v === a[i + 2]), 'Grayscale channels match');
  }
  assert.deepEqual(source.data, untouched); checks++;
  const object = image(40, 40, (x, y) => x >= 10 && x < 30 && y >= 10 && y < 30 ? [220, 20, 30, 255] : [255, 255, 255, 255]);
  const cutout = await applyLocalEffect(object, 'background');
  check(cutout.data[3] === 0, 'Background must become transparent');
  check(cutout.data[(20 * 40 + 20) * 4 + 3] === 255, 'Object center must stay opaque');
  const enclosed = image(40, 40, (x, y) => x >= 8 && x < 32 && y >= 8 && y < 32 && !(x >= 16 && x < 24 && y >= 16 && y < 24) ? [220, 20, 30, 255] : [255, 255, 255, 255]);
  const hole = await applyLocalEffect(enclosed, 'background');
  check(hole.data[(20 * 40 + 20) * 4 + 3] === 255, 'Only edge-connected background is removed');
  await assert.rejects(() => applyLocalEffect(image(20, 20, () => [255, 255, 255, 255]), 'background')); checks++;
  const saliency = image(128, 64, (x, y) => x > 88 ? ((x + y) % 4 < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]) : [128, 128, 128, 255]);
  const smart = suggestCrop(saliency, 1);
  check(smart.x > .3, 'Crop should favor detailed subject on the right');
  for (const aspect of [1, 2 / 3, 1.5, .2, 5]) {
    const c = suggestCrop(saliency, aspect);
    check(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1.000001 && c.y + c.h <= 1.000001, 'Crop stays within image');
    check(Math.abs(c.w * 128 / (c.h * 64) - aspect) < .00001, 'Crop matches print aspect');
  }
  for (const count of [0, 1, 3, 9, 20, 80]) {
    const photos = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, uri: `test-${i}`, width: i % 2 ? 3000 : 1500, height: 2000, quality: { ...sharp, score: i % 3 ? 100 : 40 } }));
    for (const category of ['photobook', 'print', 'poster', 'postcard']) {
      const cfg = makeConfig(category, photos), previous = JSON.stringify(cfg);
      const result = makeSmartLayout(cfg, photos);
      const ids = result.slots.flatMap(s => s.photoId ? [s.photoId] : []);
      check(ids.length === new Set(ids).size, 'No duplicated photos');
      check(ids.every(id => photos.some(p => p.id === id)), 'Only chosen photos are used');
      assert.deepEqual(result.slots.map(s => s.id), buildSlotIds(result, photos.length)); checks++;
      check(JSON.stringify(cfg) === previous, 'Manual config remains immutable');
      check(aiSurcharge({ ...result, aiTools: ['enhance', 'bgRemove'] }) === 0, 'Legacy options must not charge');
    }
  }
  const { encode, decode } = await import('fast-png');
  const png = decode(encode({ ...cutout, channels: 4, depth: 8 }));
  assert.deepEqual(new Uint8Array(png.data), cutout.data); checks++;
  console.log(`Smart tools: ${checks} checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
