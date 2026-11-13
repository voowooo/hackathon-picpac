import { BOOK_LINES, BOOK_TEMPLATES, COVER_COLORS, DEFAULT_PRINT_FINISH, MAX_SPREADS, MIN_SPREADS, POSTCARD_TEMPLATES, POSTER_SIZES, PRICES, PRINT_FORMATS, SPREAD_LAYOUTS } from '../config/catalog';
import { Photo, PhotoSlot, PrintFinish, PrintFormat, ProductCategory, ProductConfig, SpreadLayout } from '../types/index';
import { clamp, normalizeHexColor } from '../utils/format';
import { photoById } from './photos';

export function spreadLayoutOf(cfg: ProductConfig, page: number): SpreadLayout {
  const id = cfg.spreadLayouts?.[page - 1];
  return SPREAD_LAYOUTS.find((l) => l.id === id) ?? SPREAD_LAYOUTS[0];
}

// Приводим список макетов к числу разворотов; неизвестные id заменяем дефолтом.
export function normalizeLayouts(list: string[] | undefined, spreads: number): string[] {
  const arr = list ?? [];
  return Array.from({ length: spreads }, (_, i) => (SPREAD_LAYOUTS.some((l) => l.id === arr[i]) ? arr[i] : SPREAD_LAYOUTS[0].id));
}

function finalizePrintFinish(finish: PrintFinish): PrintFinish {
  return {
    ...finish,
    marginColor: normalizeHexColor(finish.marginColor, DEFAULT_PRINT_FINISH.marginColor),
    frameColor: normalizeHexColor(finish.frameColor, DEFAULT_PRINT_FINISH.frameColor),
  };
}

export function getPrintFinish(cfg: ProductConfig, category: "print" | "poster"): PrintFinish {
  return finalizePrintFinish({
    ...DEFAULT_PRINT_FINISH,
    margin: category === "poster" ? 10 : DEFAULT_PRINT_FINISH.margin,
    ...(category === "print" ? cfg.printFinish : cfg.posterFinish),
  });
}

// Настройки конкретного отпечатка: слот может переопределить общий финиш и размер.
export function slotPrintFinish(cfg: ProductConfig, slot: PhotoSlot): PrintFinish {
  return { ...getPrintFinish(cfg, "print"), ...slot.printFinish };
}

export function slotPrintFormat(cfg: ProductConfig, slot: PhotoSlot): PrintFormat {
  return PRINT_FORMATS.find((f) => f.id === (slot.printFormatId ?? cfg.printFormatId)) ?? PRINT_FORMATS[0];
}

export function defaultSpreads(photoCount: number) {
  return clamp(Math.ceil((photoCount - 1) / 2), MIN_SPREADS, MAX_SPREADS);
}

export function slotCountFor(cat: ProductCategory, spreads: number, photoCount: number): number {
  switch (cat) {
    case "print": return Math.max(1, photoCount);
    case "poster": return 1;
    case "postcard": return 2;
    default: return 1;
  }
}

// Порядок и идентификаторы ячеек. Для книги: обложка + ячейки разворотов,
// id вида «photobook-slot-<разворот>-<ячейка>» — макет разворота меняет их число,
// а стабильные id сохраняют раскладку соседних страниц.
export function buildSlotIds(cfg: ProductConfig, photoCount = 0): string[] {
  if (cfg.category !== "photobook") {
    return Array.from({ length: slotCountFor(cfg.category, cfg.spreads, photoCount) }, (_, i) => `${cfg.category}-slot-${i}`);
  }
  const ids = [`${cfg.category}-slot-cover`];
  for (let s = 1; s <= cfg.spreads; s += 1) {
    const cells = spreadLayoutOf(cfg, s).cells.length;
    for (let k = 0; k < cells; k += 1) ids.push(`${cfg.category}-slot-${s}-${k}`);
  }
  return ids;
}

// Ячейки конкретного разворота в порядке макета.
export function spreadSlotsFor(cfg: ProductConfig, page: number): PhotoSlot[] {
  const cells = spreadLayoutOf(cfg, page).cells.length;
  return Array.from({ length: cells }, (_, k) => {
    const id = `${cfg.category}-slot-${page}-${k}`;
    return cfg.slots.find((s) => s.id === id) ?? { id };
  });
}

export function syncSlots(cfg: ProductConfig, photos: Photo[], autofill = true): PhotoSlot[] {
  const ids = new Set(photos.map((p) => p.id));
  // Храним прежние слоты целиком: переопределения печати (printFinish, printFormatId) переживают пересборку.
  const prevById = new Map(cfg.slots.map((s) => [s.id, s] as const));
  const used = new Set<string>();
  const slots: PhotoSlot[] = buildSlotIds(cfg, photos.length).map((id) => {
    const prev = prevById.get(id);
    let photoId = prev?.photoId;
    if (photoId && (!ids.has(photoId) || used.has(photoId))) photoId = undefined;
    if (photoId) used.add(photoId);
    return { ...prev, id, photoId };
  });
  if (autofill) {
    const free = photos.filter((p) => !used.has(p.id));
    let k = 0;
    for (const s of slots) {
      if (!s.photoId && k < free.length) {
        s.photoId = free[k].id;
        k += 1;
      }
    }
  }
  return slots;
}

export function makeConfig(category: ProductCategory, photos: Photo[], prev?: ProductConfig): ProductConfig {
  const base: ProductConfig = prev ?? {
    category, printFormatId: "10x15", paper: "matte", copies: 1, bookLineId: "lite", bookFormat: BOOK_LINES[0].formats[0],
    spreads: defaultSpreads(photos.length), coverColorId: "cream", bookTemplateId: BOOK_TEMPLATES[0].id,
    bookTitle: "Наши лучшие моменты", posterOrientation: "portrait", posterSizeId: POSTER_SIZES[1].id,
    postcardTemplateId: POSTCARD_TEMPLATES[0].id, postcardCaption: "С любовью и теплом", slots: [], aiTools: [], spreadLayouts: [],
    coverShowTitle: true, coverTitleColor: "#FFFFFF", coverStyle: "full", coverFrameWidth: 14, coverFrameColor: "#F5E6D3",
  };
  const cfg: ProductConfig = { ...base, category, copies: prev && prev.category === category ? prev.copies : 1, slots: [] };
  cfg.spreads = cfg.category === "photobook" ? Math.max(MIN_SPREADS, cfg.spreads) : cfg.spreads;
  cfg.spreadLayouts = normalizeLayouts(cfg.spreadLayouts, cfg.spreads);
  return { ...cfg, slots: syncSlots(cfg, photos) };
}

// Разворот, к которому относится ячейка (по id вида «photobook-slot-3-0»).
export function pageOfSlotId(id?: string | null) {
  const m = /^photobook-slot-(\d+)-/.exec(id ?? "");
  return m ? Number(m[1]) : 0;
}

export function filledCount(cfg: ProductConfig) {
  return cfg.slots.filter((s) => s.photoId).length;
}

export function productTitle(cfg: ProductConfig): string {
  switch (cfg.category) {
    case "print": return `Фотопечать ${PRINT_FORMATS.find((x) => x.id === cfg.printFormatId)?.label ?? ""}`;
    case "photobook": return `Фотокнига ${BOOK_LINES.find((x) => x.id === cfg.bookLineId)?.name ?? ""} ${cfg.bookFormat}`;
    case "poster": return `Постер ${POSTER_SIZES.find((x) => x.id === cfg.posterSizeId)?.label ?? ""}`;
    case "postcard": return "Открытка";
    default: return "Продукт PicPac";
  }
}

export function productDetails(cfg: ProductConfig): string {
  const filled = filledCount(cfg);
  switch (cfg.category) {
    case "print": return `${filled * cfg.copies} отпечатков · ${cfg.paper === "matte" ? "матовая" : "глянцевая"} бумага`;
    case "photobook": return `${cfg.spreads} разворотов · ${COVER_COLORS.find((c) => c.id === cfg.coverColorId)?.label.toLowerCase()} обложка`;
    case "poster": return cfg.posterOrientation === "portrait" ? "Вертикальный" : "Горизонтальный";
    case "postcard": return `${cfg.copies} шт · ${POSTCARD_TEMPLATES.find((t) => t.id === cfg.postcardTemplateId)?.name}`;
    default: return "";
  }
}

export function baseEstimate(cfg: ProductConfig): number {
  const filled = filledCount(cfg);
  switch (cfg.category) {
    case "print": return cfg.slots.reduce((sum, s) => (s.photoId ? sum + slotPrintFormat(cfg, s).pricePer : sum), 0) * cfg.copies;
    case "photobook": return (BOOK_LINES.find((x) => x.id === cfg.bookLineId)?.basePrice ?? 49.9) + cfg.spreads * PRICES.spread;
    case "poster": return POSTER_SIZES.find((x) => x.id === cfg.posterSizeId)?.price ?? 24.9;
    case "postcard": return PRICES.postcard * cfg.copies;
    default: return 0;
  }
}

// Local processing is free, including drafts with legacy paid option IDs.
export function aiPerPhoto(_cfg: ProductConfig) {
  return 0;
}

export function aiSurcharge(cfg: ProductConfig) {
  return aiPerPhoto(cfg) * filledCount(cfg);
}

export function estimatePrice(cfg: ProductConfig) {
  return baseEstimate(cfg) + aiSurcharge(cfg);
}

// Сколько снимков в макете имеют низкое разрешение для выбранного формата (≈120 dpi).
export function lowResCount(cfg: ProductConfig, photos: Photo[]): number {
  let longCm = 0;
  if (cfg.category === "print") {
    longCm = Math.max(...(PRINT_FORMATS.find((f) => f.id === cfg.printFormatId)?.id ?? "10x15").split("x").map(Number));
  } else if (cfg.category === "poster") {
    longCm = Math.max(...(POSTER_SIZES.find((s) => s.id === cfg.posterSizeId)?.label ?? "30×40").split("×").map((x) => parseFloat(x)));
  }
  if (!longCm) return 0;
  const need = (longCm / 2.54) * 120;
  return cfg.slots.filter((s) => {
    const p = photoById(photos, s.photoId);
    return !!p?.width && !!p?.height && Math.max(p.width, p.height) < need;
  }).length;
}

// Размеры и замечания проверки качества по каждому слоту — уходят в заказ,
// менеджер видит их в админке в превью макета и в «Состав.csv» пакета печати.
export function slotPhotoInfo(cfg: ProductConfig, photos: Photo[]) {
  const out: Record<string, { width?: number; height?: number; score?: number; issues: string[]; maxPrintWidthCm?: number; maxPrintHeightCm?: number; lowRes: boolean }> = {};
  for (const s of cfg.slots) {
    const p = photoById(photos, s.photoId);
    if (!p) continue;
    out[s.id] = {
      width: p.width, height: p.height, score: p.quality?.score, issues: p.quality?.issues ?? [],
      maxPrintWidthCm: p.quality?.maxPrintWidthCm, maxPrintHeightCm: p.quality?.maxPrintHeightCm, lowRes: lowResSlot(cfg, p),
    };
  }
  return out;
}

function lowResSlot(cfg: ProductConfig, p: Photo): boolean {
  let longCm = 0;
  if (cfg.category === "print") {
    longCm = Math.max(...(PRINT_FORMATS.find((f) => f.id === cfg.printFormatId)?.id ?? "10x15").split("x").map(Number));
  } else if (cfg.category === "poster") {
    longCm = Math.max(...(POSTER_SIZES.find((s) => s.id === cfg.posterSizeId)?.label ?? "30×40").split("×").map((x) => parseFloat(x)));
  }
  if (!longCm) return false;
  return !!p.width && !!p.height && Math.max(p.width, p.height) < (longCm / 2.54) * 120;
}
