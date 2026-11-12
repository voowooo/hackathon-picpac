import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import type { BookLine, Catalog, DeliveryOption, PosterSize, Prices, PrintFormat } from "./domain.ts";

export type DB = DatabaseSync;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS catalog_items (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  discount_percent REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status_index INTEGER NOT NULL DEFAULT 0,
  cancelled INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  scenario TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  delivery_label TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  promo_code TEXT,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  delivery_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  photo_count INTEGER NOT NULL DEFAULT 0,
  preview_url TEXT,
  config TEXT NOT NULL,
  admin_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS orders_client ON orders(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
CREATE TABLE IF NOT EXISTS order_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  slot_id TEXT,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_photos_order ON order_photos(order_id);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  status_index INTEGER,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id, created_at);
`;

export function openDb(file = config.dbFile): DB {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ——— Каталог ———
// Каждый вид позиций хранится одной таблицей: служебные поля + JSON с данными.
// Схема полей отдаётся админке, чтобы формы строились без дублирования.
export type FieldType = "text" | "number" | "list";
export type KindSchema = { title: string; fields: { key: string; label: string; type: FieldType; hint?: string }[] };

export const CATALOG_KINDS: Record<string, KindSchema> = {
  printFormat: {
    title: "Форматы печати",
    fields: [
      { key: "label", label: "Название", type: "text" },
      { key: "pricePer", label: "Цена за отпечаток, BYN", type: "number" },
      { key: "ratio", label: "Пропорция (ширина/высота)", type: "number", hint: "10×15 → 0.6667" },
    ],
  },
  bookLine: {
    title: "Линейки фотокниг",
    fields: [
      { key: "name", label: "Название", type: "text" },
      { key: "desc", label: "Описание", type: "text" },
      { key: "formats", label: "Форматы", type: "list", hint: "через запятую: 20×20, 21×30" },
      { key: "basePrice", label: "Базовая цена, BYN", type: "number" },
    ],
  },
  posterSize: {
    title: "Размеры постеров",
    fields: [
      { key: "label", label: "Название", type: "text", hint: "формат «30×40 см» — из него считается пропорция" },
      { key: "price", label: "Цена, BYN", type: "number" },
    ],
  },
  delivery: {
    title: "Доставка",
    fields: [
      { key: "label", label: "Название", type: "text" },
      { key: "eta", label: "Срок", type: "text" },
      { key: "price", label: "Цена, BYN", type: "number" },
    ],
  },
};

export const SETTINGS_SCHEMA: KindSchema = {
  title: "Цены",
  fields: [
    { key: "spreadPrice", label: "Цена разворота фотокниги, BYN", type: "number" },
    { key: "postcardPrice", label: "Цена открытки, BYN", type: "number" },
  ],
};

export type CatalogRow = { kind: string; id: string; sort: number; active: boolean; data: Record<string, unknown> };

type RawCatalogRow = { kind: string; id: string; sort: number; active: number; data: string };

export function listCatalog(db: DB, kind?: string, onlyActive = false): CatalogRow[] {
  const where: string[] = [];
  const params: string[] = [];
  if (kind) { where.push("kind = ?"); params.push(kind); }
  if (onlyActive) where.push("active = 1");
  const sql = `SELECT kind, id, sort, active, data FROM catalog_items ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY kind, sort, id`;
  return (db.prepare(sql).all(...params) as RawCatalogRow[]).map((r) => ({ ...r, active: !!r.active, data: JSON.parse(r.data) }));
}

export function getPrices(db: DB): Prices {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  return { spreadPrice: map.spreadPrice ?? 1.2, postcardPrice: map.postcardPrice ?? 3.9 };
}

export function loadCatalog(db: DB): Catalog {
  const rows = listCatalog(db, undefined, true);
  const of = <T>(kind: string) => rows.filter((r) => r.kind === kind).map((r) => ({ id: r.id, ...r.data }) as T);
  return {
    printFormats: of<PrintFormat>("printFormat"),
    bookLines: of<BookLine>("bookLine"),
    posterSizes: of<PosterSize>("posterSize"),
    deliveryOptions: of<DeliveryOption>("delivery"),
    prices: getPrices(db),
  };
}

// Приводит данные позиции к схеме вида; бросает ошибку с понятным текстом.
export function sanitizeCatalogData(kind: string, input: Record<string, unknown>): Record<string, unknown> {
  const schema = CATALOG_KINDS[kind];
  if (!schema) throw new Error(`Неизвестный раздел каталога: ${kind}`);
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    const v = input[f.key];
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Поле «${f.label}» должно быть неотрицательным числом`);
      out[f.key] = n;
    } else if (f.type === "list") {
      const list = Array.isArray(v) ? v : String(v ?? "").split(",");
      out[f.key] = list.map((x) => String(x).trim()).filter(Boolean);
      if (!(out[f.key] as string[]).length) throw new Error(`Поле «${f.label}» не может быть пустым`);
    } else {
      const s = String(v ?? "").trim();
      if (!s) throw new Error(`Поле «${f.label}» не может быть пустым`);
      out[f.key] = s;
    }
  }
  return out;
}
