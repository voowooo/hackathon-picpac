import path from "node:path";
import type { DB } from "./db.ts";
import { loadCatalog } from "./db.ts";
import { CATEGORY_LABELS, ORDER_STATUSES, PAYMENT_OPTIONS } from "./domain.ts";
import type { OrderRow, PhotoRow } from "./orders.ts";
import type { ZipEntry } from "./zip.ts";

// «Пакет к печати»: фото в порядке макета + паспорт заказа для типографии.

type Finish = { margin?: number; marginColor?: string; frame?: number; frameColor?: string };
type Slot = { id: string; photoId?: string; printFormatId?: string; printFinish?: Finish };
type Quality = { width?: number; height?: number; issues?: string[]; lowRes?: boolean; maxPrintWidthCm?: number; maxPrintHeightCm?: number };
type Cfg = Record<string, unknown> & { category?: string; slots?: Slot[]; spreadLayouts?: string[]; photoInfo?: Record<string, Quality> };

// Короткое описание проблем снимка для паспорта и CSV.
export function qualityNote(q: Quality | undefined) {
  if (!q) return "";
  const notes = [...(q.lowRes ? ["мало пикселей для формата"] : []), ...(q.issues ?? [])];
  return [...new Set(notes)].join(", ");
}

// CSV для Excel: BOM (чтобы открылся в UTF-8) и разделитель «;» для русской локали.
export function toCsv(rows: string[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

// Названия из каталога приложения (src/config/catalog.ts), которых нет в базе.
const SPREAD_LAYOUT_NAMES: Record<string, string> = {
  full: "По одному", "big-left": "Большое слева", "big-right": "Большое справа", quad: "Сетка 2×2", mosaic: "Мозаика",
};
const COVER_COLOR_NAMES: Record<string, string> = { cream: "кремовый", terracotta: "терракота", sage: "шалфей", charcoal: "графит", ocean: "океан" };
const POSTCARD_TEMPLATE_NAMES: Record<string, string> = { classic: "Классика", botanical: "Ботаника", minimal: "Минимум" };
const DEFAULT_FINISH: Required<Finish> = { margin: 2, marginColor: "#FFFFFF", frame: 0, frameColor: "#25382E" };

export function slotLabel(slotId: string): string {
  let m: RegExpExecArray | null;
  if (slotId === "photobook-slot-cover") return "Обложка";
  if ((m = /^photobook-slot-(\d+)-(\d+)$/.exec(slotId))) return `Разворот ${m[1]}, ячейка ${Number(m[2]) + 1}`;
  if ((m = /^print-slot-(\d+)$/.exec(slotId))) return `Отпечаток ${Number(m[1]) + 1}`;
  if (/^poster-slot-/.test(slotId)) return "Постер";
  if ((m = /^postcard-slot-(\d+)$/.exec(slotId))) return `Открытка, фото ${Number(m[1]) + 1}`;
  return slotId;
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
const pad = (n: number, width: number) => String(n).padStart(width, "0");

const finishText = (f: Finish) => {
  const parts = [`поля ${f.margin ?? 0} (${f.marginColor ?? "—"})`];
  parts.push(f.frame ? `рамка ${f.frame} (${f.frameColor ?? "—"})` : "без рамки");
  return parts.join(", ");
};

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildPrintPack(db: DB, order: OrderRow, photos: PhotoRow[], uploadsDir: string) {
  const cfg = JSON.parse(order.config) as Cfg;
  const catalog = loadCatalog(db);
  const slots = Array.isArray(cfg.slots) ? cfg.slots : [];
  const slotOrder = new Map(slots.map((s, i) => [s.id, i] as const));
  const filledSlots = slots.filter((s) => s.photoId);

  // Фото по порядку ячеек макета; без ячейки — в конце.
  const sorted = [...photos].sort((a, b) => (slotOrder.get(a.slot_id ?? "") ?? 1e9) - (slotOrder.get(b.slot_id ?? "") ?? 1e9) || a.id - b.id);
  const width = Math.max(2, String(sorted.length).length);
  const copies = Math.max(1, Number(cfg.copies ?? 1) || 1);
  const baseFinish: Finish = { ...DEFAULT_FINISH, ...(cfg.category === "poster" ? { margin: 10 } : {}), ...((cfg.category === "poster" ? cfg.posterFinish : cfg.printFinish) as Finish | undefined) };

  const files: ZipEntry[] = [];
  const rows: string[][] = [["Файл", "Ячейка макета", "Формат", "Копий", "Оформление", "Размер, px", "Замечания по качеству", "Исходное имя"]];
  sorted.forEach((p, i) => {
    const slot = slots.find((s) => s.id === p.slot_id);
    const label = p.slot_id ? slotLabel(p.slot_id) : "Без ячейки";
    const ext = path.extname(p.filename) || ".jpg";
    const name = `photos/${pad(i + 1, width)}_${safe(label)}${ext}`;
    files.push({ name, path: path.join(uploadsDir, p.filename) });
    let format = "";
    let finish = "";
    let qty: number | string = "";
    if (cfg.category === "print") {
      const fmtId = slot?.printFormatId ?? (cfg.printFormatId as string | undefined);
      format = catalog.printFormats.find((f) => f.id === fmtId)?.label ?? fmtId ?? "";
      finish = finishText({ ...baseFinish, ...slot?.printFinish });
      qty = copies;
    } else if (cfg.category === "poster") {
      format = catalog.posterSizes.find((s) => s.id === cfg.posterSizeId)?.label ?? String(cfg.posterSizeId ?? "");
      finish = finishText(baseFinish);
      qty = 1;
    }
    const q = p.slot_id ? cfg.photoInfo?.[p.slot_id] : undefined;
    rows.push([name, label, format, String(qty), finish, q?.width && q?.height ? `${q.width}×${q.height}` : "", qualityNote(q), p.original_name ?? ""]);
  });

  const uploadedSlots = new Set(photos.map((p) => p.slot_id));
  const missing = filledSlots.filter((s) => !uploadedSlots.has(s.id)).map((s) => slotLabel(s.id));

  // ——— Паспорт ———
  const L: string[] = [];
  const line = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") L.push(`${k}: ${v}`); };
  const created = new Date(order.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Minsk" });
  L.push(`ПАСПОРТ ЗАКАЗА ${order.id}`, "=".repeat(40));
  line("Создан", created);
  line("Статус", order.cancelled ? "ОТМЕНЁН" : ORDER_STATUSES[order.status_index]);
  line("Продукт", `${CATEGORY_LABELS[order.category as keyof typeof CATEGORY_LABELS] ?? order.category} — ${order.title}`);
  line("Состав", order.items);
  L.push("");
  L.push("ПАРАМЕТРЫ ПЕЧАТИ", "-".repeat(40));
  switch (cfg.category) {
    case "print":
      line("Бумага", cfg.paper === "glossy" ? "глянцевая" : "матовая");
      line("Копий каждого снимка", copies);
      line("Оформление по умолчанию", finishText(baseFinish));
      line("Отпечатков всего", filledSlots.length * copies);
      break;
    case "photobook": {
      const lineName = catalog.bookLines.find((b) => b.id === cfg.bookLineId)?.name ?? cfg.bookLineId;
      line("Линейка", lineName);
      line("Формат", cfg.bookFormat);
      line("Разворотов", cfg.spreads);
      line("Цвет обложки", COVER_COLOR_NAMES[String(cfg.coverColorId)] ?? cfg.coverColorId);
      line("Стиль обложки", cfg.coverStyle === "framed" ? `фото в рамке ${cfg.coverFrameWidth ?? ""} (${cfg.coverFrameColor ?? ""})` : "фото на всю обложку");
      line("Название на обложке", cfg.coverShowTitle === false ? "не печатать" : `«${cfg.bookTitle ?? ""}», цвет ${cfg.coverTitleColor ?? ""}`);
      line("Шаблон", cfg.bookTemplateId);
      if (Array.isArray(cfg.spreadLayouts) && cfg.spreadLayouts.length) {
        L.push("Сетки разворотов:");
        cfg.spreadLayouts.forEach((id, i) => L.push(`  ${i + 1}. ${SPREAD_LAYOUT_NAMES[id] ?? id}`));
      }
      break;
    }
    case "poster":
      line("Размер", catalog.posterSizes.find((s) => s.id === cfg.posterSizeId)?.label ?? cfg.posterSizeId);
      line("Ориентация", cfg.posterOrientation === "landscape" ? "горизонтальная" : "вертикальная");
      line("Оформление", finishText(baseFinish));
      break;
    case "postcard":
      line("Шаблон", POSTCARD_TEMPLATE_NAMES[String(cfg.postcardTemplateId)] ?? cfg.postcardTemplateId);
      line("Подпись", cfg.postcardCaption ? `«${cfg.postcardCaption}»` : "");
      line("Тираж", `${copies} шт`);
      break;
  }
  L.push("");
  L.push("ФАЙЛЫ", "-".repeat(40));
  line("Фото в пакете", `${sorted.length} из ${filledSlots.length || order.photo_count}`);
  L.push("Порядок файлов в папке photos/ совпадает с порядком в макете; подробности — в «Состав.csv».");
  if (missing.length) L.push(`ВНИМАНИЕ: не загружены фото для ячеек: ${missing.join("; ")}`);
  const weak = filledSlots.map((s) => [slotLabel(s.id), qualityNote(cfg.photoInfo?.[s.id])] as const).filter(([, note]) => note);
  if (weak.length) {
    L.push("ПРОВЕРЬТЕ КАЧЕСТВО (клиента предупредили в приложении):");
    for (const [label, note] of weak) L.push(`  • ${label}: ${note}`);
  }
  if (order.admin_note) { L.push(""); line("Заметка менеджера", order.admin_note); }
  L.push("");
  L.push("ДОСТАВКА", "-".repeat(40));
  line("Получатель", order.customer_name);
  line("Телефон", order.customer_phone);
  line("Адрес", order.customer_address);
  line("Способ", order.delivery_label);
  line("Оплата", PAYMENT_OPTIONS[order.payment_id] ?? order.payment_id);
  line("Сумма", `${order.total.toFixed(2)} BYN`);

  const passport = L.join("\r\n") + "\r\n";
  // BOM нужен, чтобы Excel открыл CSV в UTF-8; разделитель «;» — для русской локали.
  const csv = toCsv(rows);

  const entries: ZipEntry[] = [
    { name: "Паспорт заказа.txt", data: "﻿" + passport },
    { name: "Состав.csv", data: csv },
    { name: "order.json", data: JSON.stringify({ id: order.id, category: order.category, title: order.title, config: cfg }, null, 2) },
    ...files,
  ];
  return { entries, filename: `${order.id}_к_печати.zip`, missing, photoCount: sorted.length };
}
