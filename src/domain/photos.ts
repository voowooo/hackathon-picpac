import { Photo } from '../types/index';

export let photoIdSeq = 0;

export function makePhotoId() {
  photoIdSeq += 1;
  return `ph-${Date.now().toString(36)}-${photoIdSeq}`;
}

// Дата съёмки из EXIF: iOS кладёт теги в контейнер «{Exif}», Android — в плоские ключи.
// DateTimeOriginal имеет вид «YYYY:MM:DD HH:MM:SS».
export function exifTimestamp(exif: Record<string, unknown> | null | undefined): number | undefined {
  const container = exif as { "{Exif}"?: Record<string, unknown> } | null | undefined;
  const raw =
    container?.["{Exif}"]?.DateTimeOriginal ??
    exif?.DateTimeOriginal ??
    exif?.dateTimeOriginal ??
    container?.["{Exif}"]?.DateTime ??
    exif?.DateTime;
  if (typeof raw !== "string") return undefined;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return undefined;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  return Number.isFinite(t) ? t : undefined;
}

// Координаты из EXIF GPS. iOS кладёт их в контейнер «{GPS}» (числа + ссылки N/S, E/W),
// Android — в плоские теги (нередко в формате рациональных «60/1, 20/1, 0/1»).
export function toDecimalCoord(value: unknown, ref: unknown): number | undefined {
  let deg: number | undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    deg = value;
  } else if (typeof value === "string") {
    const parts = value.split(",").map((s) => s.trim());
    if (parts.length >= 2) {
      const dms = parts.map((p) => {
        const [n, d] = p.split("/").map(Number);
        return d ? n / d : Number(p);
      });
      if (dms.length >= 3 && dms.slice(0, 3).every(Number.isFinite)) {
        deg = dms[0] + dms[1] / 60 + dms[2] / 3600;
      }
    }
    if (deg === undefined) {
      const n = parseFloat(value);
      if (Number.isFinite(n)) deg = n;
    }
  }
  if (deg === undefined) return undefined;
  const r = typeof ref === "string" ? ref.trim().toUpperCase() : "";
  return r === "S" || r === "W" ? -Math.abs(deg) : deg;
}

export function exifLocation(exif: Record<string, unknown> | null | undefined): { lat: number; lng: number } | undefined {
  if (!exif) return undefined;
  const gps = exif["{GPS}"] as Record<string, unknown> | undefined;
  const flat = exif as Record<string, unknown>;
  const lat = toDecimalCoord(gps?.Latitude ?? flat.GPSLatitude, gps?.LatitudeRef ?? flat.GPSLatitudeRef);
  const lng = toDecimalCoord(gps?.Longitude ?? flat.GPSLongitude, gps?.LongitudeRef ?? flat.GPSLongitudeRef);
  if (lat === undefined || lng === undefined) return undefined;
  // 0/0 — почти всегда «данных нет», а не съёмка в океане у нулевого меридиана.
  if (lat === 0 && lng === 0) return undefined;
  return { lat, lng };
}

// Расстояние между точками (гаверсинус), в метрах.
export function geoDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(s));
}

export function photoById(photos: Photo[], id?: string) {
  return photos.find((p) => p.id === id);
}
