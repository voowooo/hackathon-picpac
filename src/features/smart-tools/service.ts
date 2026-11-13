import { decodePhotoPng } from "./png";
import { fromByteArray, toByteArray } from "base64-js";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, FileMode, Paths, type FileHandle } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { encode } from "fast-png";
import { Image, Platform } from "react-native";
import type { Photo, PhotoQuality } from "../../types";
import { applyLocalEffect, suggestCrop, type LocalEffect, type Pixels } from "./pixels";
import { createPngWriter, photoBands } from "./streaming-png";
import { applyBackgroundMask } from "./mask";
import { assessQuality } from "./quality";

export const USE_AI_MOCKS = process.env.EXPO_PUBLIC_USE_AI_MOCKS === "true";
export const EDITOR_WORK_MAX_SIDE = 2048;
let recipeInputCache: { uri: string; width: number; height: number; side: number; pixels: Pixels } | undefined;
export function clearProcessingCache() { recipeInputCache = undefined; }
const MEGAPIXEL_LIMIT = 8_000_000;
const LIGHTWEIGHT_MAX_SIDE = 2000;

function orientedSize(width: number, height: number, rotate: number) {
  const rot = ((rotate % 360) + 360) % 360;
  if (rot === 90 || rot === 270) return { width: height, height: width };
  return { width, height };
}

export async function resolveImageSize(uri: string, width?: number, height?: number) {
  if (width && height && width > 0 && height > 0) return { width, height };
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
  });
}

/** One native pass: decode with optional downsample, rotate, resize — no full-res PNG round-trip. */
export async function renderToPngFile(
  uri: string,
  metaWidth: number,
  metaHeight: number,
  maxSide: number,
  rotate = 0,
) {
  const dims = await resolveImageSize(uri, metaWidth, metaHeight);
  const decodeLongest = Math.max(dims.width, dims.height);
  const loadOpts = decodeLongest > maxSide ? { maxWidth: maxSide, maxHeight: maxSide } : undefined;
  const ctx = ImageManipulator.manipulate(uri, loadOpts);
  if (rotate) ctx.rotate(rotate);
  const oriented = orientedSize(dims.width, dims.height, rotate);
  const longest = Math.max(oriented.width, oriented.height);
  if (longest > maxSide) {
    const scale = maxSide / longest;
    ctx.resize({
      width: Math.max(1, Math.round(oriented.width * scale)),
      height: Math.max(1, Math.round(oriented.height * scale)),
    });
  }
  try {
    const image = await ctx.renderAsync();
    try { return await image.saveAsync({ format: SaveFormat.PNG, compress: 1 }); }
    finally { image.release(); }
  } finally { ctx.release(); }
}

export async function prepareEditorWorkingImage(uri: string, _width?: number, _height?: number) {
  // Photo metadata describes the last print crop, not necessarily this source.
  const dims = await resolveImageSize(uri);
  return renderToPngFile(uri, dims.width, dims.height, EDITOR_WORK_MAX_SIDE);
}

async function loadFileBytes(uri: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await new File(uri).arrayBuffer());
  } catch {
    // Fall through.
  }
  try {
    const response = await fetch(uri);
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  } catch {
    // Fall through.
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return toByteArray(base64);
}

async function writePngBytes(bytes: Uint8Array) {
  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'image/png' }));
  }
  const name = `picpac-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  try {
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    await file.write(bytes);
    return file.uri;
  } catch {
    if (FileSystem.cacheDirectory) {
      const uri = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.writeAsStringAsync(uri, fromByteArray(bytes), { encoding: FileSystem.EncodingType.Base64 });
      return uri;
    }
  }
  throw new Error("save-failed");
}

async function savePixelsToFile(pixels: Pixels) {
  const bytes = encode({ width: pixels.width, height: pixels.height, data: pixels.data, channels: 4, depth: 8 });
  const uri = await writePngBytes(bytes);
  return { uri, width: pixels.width, height: pixels.height };
}

export async function readPixels(
  uri: string,
  width: number,
  height: number,
  maxSide = 128,
  rotate = 0,
): Promise<Pixels> {
  const limit = maxSide === Infinity ? Math.max(width, height) : Number.isFinite(maxSide) && maxSide > 0 ? maxSide : EDITOR_WORK_MAX_SIDE;
  const raster = await renderToPngFile(uri, width, height, limit, rotate);
  try { return decodePhotoPng(await loadFileBytes(raster.uri)); }
  finally { disposeRaster(raster.uri); }
}

export async function analyzePhoto(photo: Pick<Photo, "uri" | "width" | "height">): Promise<PhotoQuality | undefined> {
  try {
    const dims = await resolveImageSize(photo.uri, photo.width, photo.height);
    const sample = await readPixels(photo.uri, dims.width, dims.height, 160);
    return assessQuality(sample, dims.width, dims.height);
  } catch {
    return undefined;
  }
}

export type ProcessedPhoto = {
  uri: string;
  width: number;
  height: number;
  mocked?: boolean;
  downscaled?: boolean;
};

function effectMaxSide(width: number, height: number, lightweight: boolean) {
  const longest = Math.max(width, height);
  if (lightweight) return LIGHTWEIGHT_MAX_SIDE;
  return Math.min(EDITOR_WORK_MAX_SIDE, longest);
}

export async function processLocalPhoto(
  uri: string,
  width: number,
  height: number,
  effect: LocalEffect,
  lightweight = false,
  rotate = 0,
): Promise<ProcessedPhoto> {
  if (USE_AI_MOCKS) {
    await new Promise(resolve => setTimeout(resolve, 550));
    return { uri, width, height, mocked: true };
  }
  const oriented = orientedSize(width, height, rotate);
  const maxSide = effectMaxSide(oriented.width, oriented.height, lightweight);
  const pixels = await readPixels(uri, width, height, maxSide, rotate);
  const result = await applyLocalEffect(pixels, effect);
  const saved = await savePixelsToFile(result);
  const dims = await resolveImageSize(uri, width, height);
  return {
    ...saved,
    mocked: false,
    downscaled: saved.width < dims.width || saved.height < dims.height || dims.width * dims.height > MEGAPIXEL_LIMIT,
  };
}

/** Decode and encode once for an entire recipe. Removing any effect replays
 * the remaining recipe from the baseline, without cumulative JPEG/PNG loss. */
function disposeRaster(uri: string) {
  try {
    if (Platform.OS === 'web') { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri); }
    else new File(uri).delete();
  } catch { /* Cleanup must not replace the processing result/error. */ }
}

export async function processPhotoRecipe(uri: string, width: number, height: number, effects: LocalEffect[], maxSide = EDITOR_WORK_MAX_SIDE, onProgress?: (fraction: number) => void) {
  if (USE_AI_MOCKS) throw new Error('Включён демо-режим. Отключите EXPO_PUBLIC_USE_AI_MOCKS для обработки.');
  const ordered = effects.includes('background') ? ['background' as const, ...effects.filter(e => e !== 'background')] : effects;
  // One common exposure reference avoids band-dependent brightness and preview/export shifts.
  let reference = await readPixels(uri, width, height, 512);
  const references: Pixels[] = [];
  for (const effect of ordered) {
    references.push(reference);
    reference = await applyLocalEffect(reference, effect);
  }
  if (maxSide === Infinity && width * height > MEGAPIXEL_LIMIT) {
    clearProcessingCache();
    return exportRecipeBands(uri, width, height, ordered, references, onProgress);
  }
  const side = Math.min(Math.max(width, height), maxSide);
  let pixels: Pixels;
  if (recipeInputCache?.uri === uri && recipeInputCache.width === width && recipeInputCache.height === height && recipeInputCache.side === side) pixels = recipeInputCache.pixels;
  else {
    pixels = await readPixels(uri, width, height, maxSide);
    recipeInputCache = { uri, width, height, side, pixels };
  }
  for (let i = 0; i < ordered.length; i++) {
    pixels = await applyLocalEffect(pixels, ordered[i], { reference: references[i] });
    onProgress?.((i + 1) / ordered.length);
  }
  return savePixelsToFile(pixels);
}

async function exportRecipeBands(uri: string, width: number, height: number, effects: LocalEffect[], references: Pixels[], onProgress?: (fraction: number) => void) {
  const mask = effects.includes('background') ? await applyLocalEffect(await readPixels(uri, width, height, EDITOR_WORK_MAX_SIDE), 'background') : undefined;
  const context = ImageManipulator.manipulate(uri);
  let handle: FileHandle | undefined, file: File | undefined;
  const chunks: ArrayBuffer[] = [];
  try {
    const source = await context.renderAsync();
    try {
      if (source.width !== width || source.height !== height) throw new Error('Image dimensions changed');
      if (Platform.OS !== 'web') {
        file = new File(Paths.cache, `picpac-full-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
        file.create(); handle = file.open(FileMode.WriteOnly);
      }
      const writer = createPngWriter(width, height, bytes => {
        if (handle) handle.writeBytesSync(bytes);
        else chunks.push(new Uint8Array(bytes).buffer);
      });
      for (const band of photoBands(width, height)) {
        const cropContext = ImageManipulator.manipulate(source);
        let rasterUri: string | undefined;
        try {
          cropContext.crop({ originX: 0, originY: band.top, width, height: band.height });
          const cropped = await cropContext.renderAsync();
          let pixels: Pixels;
          try {
            const raster = await cropped.saveAsync({ format: SaveFormat.PNG }); rasterUri = raster.uri;
            pixels = decodePhotoPng(await loadFileBytes(raster.uri));
          } finally { cropped.release(); }
          for (let i = 0; i < effects.length; i++) {
            pixels = effects[i] === 'background' && mask
              ? applyBackgroundMask(pixels, mask, width, height, band.top)
              : await applyLocalEffect(pixels, effects[i], { reference: references[i], longestSide: Math.max(width, height) });
          }
          writer.push(pixels.data.subarray((band.y - band.top) * width * 4, (band.y - band.top + band.count) * width * 4));
          onProgress?.((band.y + band.count) / height);
          await new Promise(resolve => setTimeout(resolve, 0));
        } finally { cropContext.release(); if (rasterUri) disposeRaster(rasterUri); }
      }
      handle?.close(); handle = undefined;
      return { uri: file?.uri ?? URL.createObjectURL(new Blob(chunks, { type: 'image/png' })), width, height };
    } finally { source.release(); }
  } catch (error) {
    handle?.close(); handle = undefined;
    if (file) disposeRaster(file.uri);
    throw error;
  } finally { handle?.close(); context.release(); }
}

export async function findSmartCrop(uri: string, width: number, height: number, aspect: number, rotate = 0) {
  try {
    const sample = await readPixels(uri, width, height, 384, rotate);
    return suggestCrop(sample, aspect);
  } catch {
    const oriented = orientedSize(width, height, rotate);
    return centerNormalizedCrop(aspect, oriented.width / oriented.height);
  }
}

export function centerNormalizedCrop(aspect: number, imageAspect: number) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : imageAspect || 1;
  const imgA = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : safeAspect;
  if (imgA >= safeAspect) {
    const h = 1;
    const w = safeAspect / imgA;
    return { x: (1 - w) / 2, y: 0, w, h };
  }
  const w = 1;
  const h = imgA / safeAspect;
  return { x: 0, y: (1 - h) / 2, w, h };
}
