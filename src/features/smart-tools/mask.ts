import type { Pixels } from './pixels';

/** Lift the global, edge-connected cutout onto a full-resolution band without replacing photo detail. */
export function applyBackgroundMask(image: Pixels, mask: Pixels, fullWidth: number, fullHeight: number, top = 0): Pixels {
  const data = new Uint8Array(image.data);
  for (let y = 0; y < image.height; y++) {
    const my = Math.max(0, Math.min(mask.height - 1, (y + top + .5) * mask.height / fullHeight - .5));
    const y0 = Math.floor(my), y1 = Math.min(mask.height - 1, y0 + 1), fy = my - y0;
    for (let x = 0; x < image.width; x++) {
      const mx = Math.max(0, Math.min(mask.width - 1, (x + .5) * mask.width / fullWidth - .5));
      const x0 = Math.floor(mx), x1 = Math.min(mask.width - 1, x0 + 1), fx = mx - x0;
      const a = mask.data[(y0 * mask.width + x0) * 4 + 3] * (1 - fx) + mask.data[(y0 * mask.width + x1) * 4 + 3] * fx;
      const b = mask.data[(y1 * mask.width + x0) * 4 + 3] * (1 - fx) + mask.data[(y1 * mask.width + x1) * 4 + 3] * fx;
      const i = (y * image.width + x) * 4 + 3;
      data[i] = Math.min(data[i], Math.round(a * (1 - fy) + b * fy));
    }
  }
  return { ...image, data };
}
