export type CropRect = { x: number; y: number; w: number; h: number };

// Same centered cover framing used by the layout's images, within an existing crop.
export function fitCropToAspect(bounds: CropRect, aspect: number): CropRect {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : bounds.w / Math.max(1, bounds.h);
  const w = Math.min(bounds.w, bounds.h * safe);
  const h = w / safe;
  return { x: bounds.x + (bounds.w - w) / 2, y: bounds.y + (bounds.h - h) / 2, w, h };
}

export function normalizedToDisplayCrop(normalized: { x: number; y: number; w: number; h: number }, displayW: number, displayH: number): CropRect {
  return {
    x: normalized.x * displayW,
    y: normalized.y * displayH,
    w: normalized.w * displayW,
    h: normalized.h * displayH,
  };
}

// Convert the preview rectangle using the dimensions of the exact decoded image
// that will be cropped, rather than Image.onLoad's potentially downsampled size.
export function cropToPixels(crop: CropRect, display: { w: number; h: number }, image: { w: number; h: number }) {
  const originX = Math.max(0, Math.min(image.w - 1, Math.round(crop.x / display.w * image.w)));
  const originY = Math.max(0, Math.min(image.h - 1, Math.round(crop.y / display.h * image.h)));
  const width = Math.max(1, Math.min(image.w - originX, Math.round(crop.w / display.w * image.w)));
  const height = Math.max(1, Math.min(image.h - originY, Math.round(crop.h / display.h * image.h)));
  return { originX, originY, width, height };
}
