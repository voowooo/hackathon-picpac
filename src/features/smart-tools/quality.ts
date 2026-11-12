import type { PhotoQuality } from "../../types";
import { measurePixels, type Pixels } from "./pixels";

export function assessQuality(image: Pixels, width: number, height: number): PhotoQuality {
  const metrics = measurePixels(image);
  const issues: string[] = [];
  if (Math.min(width, height) < 800 || width * height < 1_000_000) issues.push("Мало пикселей для крупной печати");
  if (metrics.brightness < 48) issues.push("Фото слишком тёмное");
  if (metrics.brightness > 224) issues.push("Фото слишком светлое");
  if (metrics.contrast < 12) issues.push("Низкий контраст или мало деталей");
  else if (metrics.sharpness < 22) issues.push("Возможна низкая резкость");
  return { ...metrics, score: Math.max(5, 100 - issues.length * 22), issues, maxPrintWidthCm: Math.floor(width / 240 * 2.54), maxPrintHeightCm: Math.floor(height / 240 * 2.54) };
}
