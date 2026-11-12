import type { DB } from "./db.ts";
import { loadCatalog, tx } from "./db.ts";
import type { OrderConfig } from "./domain.ts";
import { CATEGORIES, CATEGORY_LABELS, LAST_STATUS, ORDER_STATUS_IDS, ORDER_STATUSES, PAYMENT_OPTIONS, PriceError, computeSubtotal, productTitle, round2 } from "./domain.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ——— Промокоды ———
export type PromoRow = {
  code: string; description: string; discount_percent: number; active: number;
  max_uses: number | null; used_count: number; expires_at: number | null; created_at: number;
};

export function normalizeCode(code: unknown) {
  return String(code ?? "").trim().toUpperCase();
}

export function promoProblem(p: PromoRow | undefined, now = Date.now()): string | null {
  if (!p) return "Промокод не найден";
  if (!p.active) return "Промокод отключён";
  if (p.expires_at && p.expires_at < now) return "Срок действия промокода истёк";
  if (p.max_uses != null && p.used_count >= p.max_uses) return "Промокод больше не действует";
  return null;
}

export function findPromo(db: DB, code: string) {
  return db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code) as PromoRow | undefined;
}

export function promoToJson(p: PromoRow) {
  return {
    code: p.code, description: p.description, discountPercent: p.discount_percent, active: !!p.active,
    maxUses: p.max_uses, usedCount: p.used_count, expiresAt: p.expires_at, createdAt: p.created_at,
    problem: promoProblem(p),
  };
}

// ——— Заказы ———
export type OrderRow = {
  id: string; client_id: string; created_at: number; updated_at: number; status_index: number; cancelled: number;
  category: string; title: string; scenario: string; items: string; customer_name: string; customer_phone: string;
  customer_address: string; delivery_id: string; delivery_label: string; payment_id: string; promo_code: string | null;
  subtotal: number; discount: number; delivery_price: number; total: number; photo_count: number; preview_url: string | null;
  config: string; admin_note: string;
};

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Minsk" });

// «13 нояб 2026» — как в моках приложения.
export function formatDate(ms: number) {
  const parts = Object.fromEntries(dateFmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return `${parts.day} ${String(parts.month).replace(".", "")} ${parts.year}`;
}

// Форма заказа, которую понимает мобильное приложение (тип MockOrder).
export function toClientOrder(o: OrderRow) {
  return {
    id: o.id,
    title: o.title,
    scenario: o.scenario,
    status: o.cancelled ? "cancelled" : ORDER_STATUS_IDS[o.status_index],
    statusIndex: o.status_index,
    cancelled: !!o.cancelled,
    total: o.total,
    previewUri: o.preview_url ?? "",
    date: formatDate(o.created_at),
    items: o.items,
  };
}

export type PhotoRow = { id: number; order_id: string; slot_id: string | null; filename: string; original_name: string | null; mime: string | null; size: number; created_at: number };
export type EventRow = { id: number; order_id: string; created_at: number; kind: string; status_index: number | null; note: string; actor: string };

export function toAdminOrder(o: OrderRow, photos?: PhotoRow[], events?: EventRow[]) {
  return {
    id: o.id,
    clientId: o.client_id,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    statusIndex: o.status_index,
    status: ORDER_STATUSES[o.status_index],
    cancelled: !!o.cancelled,
    category: o.category,
    categoryLabel: CATEGORY_LABELS[o.category as keyof typeof CATEGORY_LABELS] ?? o.category,
    title: o.title,
    scenario: o.scenario,
    items: o.items,
    customer: { name: o.customer_name, phone: o.customer_phone, address: o.customer_address },
    delivery: { id: o.delivery_id, label: o.delivery_label, price: o.delivery_price },
    payment: { id: o.payment_id, label: PAYMENT_OPTIONS[o.payment_id] ?? o.payment_id },
    promoCode: o.promo_code,
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    photoCount: o.photo_count,
    previewUrl: o.preview_url,
    adminNote: o.admin_note,
    ...(photos ? { photos: photos.map((p) => ({ id: p.id, slotId: p.slot_id, url: `/api/photos/${p.filename}`, originalName: p.original_name, size: p.size, createdAt: p.created_at })) } : {}),
    ...(events ? { events: events.map((e) => ({ id: e.id, createdAt: e.created_at, kind: e.kind, statusIndex: e.status_index, status: e.status_index != null ? ORDER_STATUSES[e.status_index] : null, note: e.note, actor: e.actor })) } : {}),
    ...(photos || events ? { config: JSON.parse(o.config) } : {}),
  };
}

export type CreateOrderInput = {
  clientId?: unknown;
  config?: unknown;
  scenario?: unknown;
  items?: unknown;
  photoCount?: unknown;
  recipient?: { name?: unknown; phone?: unknown; address?: unknown };
  deliveryId?: unknown;
  paymentId?: unknown;
  promoCode?: unknown;
  clientTotal?: unknown;
  photoInfo?: unknown;
};

// Сведения о качестве фото из приложения (ключ — id ячейки макета).
export type PhotoInfo = { width?: number; height?: number; score?: number; issues: string[]; maxPrintWidthCm?: number; maxPrintHeightCm?: number; lowRes?: boolean };

function sanitizePhotoInfo(raw: unknown): Record<string, PhotoInfo> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, PhotoInfo> = {};
  const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.round(Number(v) * 10) / 10 : undefined);
  for (const [slotId, v] of Object.entries(raw as Record<string, unknown>).slice(0, 500)) {
    if (!/^[\w-]{1,60}$/.test(slotId) || !v || typeof v !== "object") continue;
    const info = v as Record<string, unknown>;
    out[slotId] = {
      width: num(info.width), height: num(info.height), score: num(info.score),
      maxPrintWidthCm: num(info.maxPrintWidthCm), maxPrintHeightCm: num(info.maxPrintHeightCm),
      lowRes: info.lowRes === true,
      issues: (Array.isArray(info.issues) ? info.issues : []).slice(0, 6).map((x) => String(x).slice(0, 120)).filter(Boolean),
    };
  }
  return out;
}

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);

export function nextOrderId(db: DB) {
  const row = db.prepare("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS n FROM orders WHERE id LIKE 'ord-%'").get() as { n: number | null };
  return `ord-${Math.max(1000, row.n ?? 1000) + 1}`;
}

export function createOrder(db: DB, input: CreateOrderInput, now = Date.now()) {
  const clientId = str(input.clientId, 100);
  if (!clientId) throw new HttpError(400, "Не передан clientId");
  const cfg = input.config as OrderConfig | undefined;
  if (!cfg || typeof cfg !== "object" || !CATEGORIES.includes(cfg.category)) throw new HttpError(400, "Некорректная конфигурация продукта");

  const name = str(input.recipient?.name, 200);
  const phone = str(input.recipient?.phone, 50);
  const address = str(input.recipient?.address, 500);
  if (!name || phone.replace(/\D/g, "").length < 7 || !address) throw new HttpError(400, "Заполните имя, телефон и адрес");

  const catalog = loadCatalog(db);
  const delivery = catalog.deliveryOptions.find((d) => d.id === input.deliveryId);
  if (!delivery) throw new HttpError(400, "Способ доставки недоступен");
  const paymentId = str(input.paymentId, 30);
  if (!PAYMENT_OPTIONS[paymentId]) throw new HttpError(400, "Способ оплаты недоступен");

  let subtotal: number;
  try {
    subtotal = computeSubtotal(cfg, catalog);
  } catch (e) {
    if (e instanceof PriceError) throw new HttpError(400, e.message);
    throw e;
  }

  return tx(db, () => {
    const code = normalizeCode(input.promoCode);
    let discount = 0;
    let promoCode: string | null = null;
    if (code) {
      const promo = findPromo(db, code);
      const problem = promoProblem(promo, now);
      if (problem) throw new HttpError(400, problem);
      discount = round2(subtotal * (promo!.discount_percent / 100));
      promoCode = code;
      db.prepare("UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?").run(code);
    }
    const total = round2(subtotal - discount + delivery.price);
    const id = nextOrderId(db);
    const photoCount = Math.max(0, Math.min(10000, Math.floor(Number(input.photoCount) || 0)));
    db.prepare(`INSERT INTO orders (id, client_id, created_at, updated_at, status_index, cancelled, category, title, scenario, items,
      customer_name, customer_phone, customer_address, delivery_id, delivery_label, payment_id, promo_code, subtotal, discount,
      delivery_price, total, photo_count, preview_url, config) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`).run(
      id, clientId, now, now, cfg.category, productTitle(cfg, catalog), str(input.scenario, 200) || "Новый заказ", str(input.items, 500),
      name, phone, address, delivery.id, delivery.label, paymentId, promoCode, subtotal, discount, delivery.price, total, photoCount,
      JSON.stringify({ ...cfg, photoInfo: sanitizePhotoInfo(input.photoInfo) }),
    );
    db.prepare("INSERT INTO order_events (order_id, created_at, kind, status_index, note, actor) VALUES (?, ?, 'created', 0, ?, 'client')").run(
      id, now, "Заказ оформлен в приложении",
    );
    return getOrder(db, id)!;
  });
}

export function getOrder(db: DB, id: string) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
}

export function orderPhotos(db: DB, id: string) {
  return db.prepare("SELECT * FROM order_photos WHERE order_id = ? ORDER BY id").all(id) as PhotoRow[];
}

export function orderEvents(db: DB, id: string) {
  return db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at, id").all(id) as EventRow[];
}

export function updateOrder(db: DB, id: string, patch: { statusIndex?: unknown; cancelled?: unknown; adminNote?: unknown; comment?: unknown }, now = Date.now()) {
  return tx(db, () => {
    const order = getOrder(db, id);
    if (!order) throw new HttpError(404, "Заказ не найден");
    const comment = str(patch.comment, 1000);
    const addEvent = db.prepare("INSERT INTO order_events (order_id, created_at, kind, status_index, note, actor) VALUES (?, ?, ?, ?, ?, 'admin')");
    let touched = false;

    if (patch.statusIndex !== undefined) {
      const s = Number(patch.statusIndex);
      if (!Number.isInteger(s) || s < 0 || s > LAST_STATUS) throw new HttpError(400, "Некорректный статус");
      if (s !== order.status_index) {
        db.prepare("UPDATE orders SET status_index = ? WHERE id = ?").run(s, id);
        addEvent.run(id, now, "status", s, comment);
        touched = true;
      }
    }
    if (patch.cancelled !== undefined) {
      const c = patch.cancelled ? 1 : 0;
      if (c !== order.cancelled) {
        db.prepare("UPDATE orders SET cancelled = ? WHERE id = ?").run(c, id);
        addEvent.run(id, now, c ? "cancelled" : "restored", order.status_index, comment);
        touched = true;
      }
    }
    if (patch.adminNote !== undefined) {
      db.prepare("UPDATE orders SET admin_note = ? WHERE id = ?").run(str(patch.adminNote, 2000), id);
      touched = true;
    }
    if (!touched && comment) {
      addEvent.run(id, now, "comment", null, comment);
      touched = true;
    }
    if (touched) db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run(now, id);
    return getOrder(db, id)!;
  });
}

export function listOrders(db: DB, q: { status?: string; category?: string; search?: string; limit?: number; offset?: number }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q.status === "cancelled") where.push("cancelled = 1");
  else if (q.status === "active") where.push(`cancelled = 0 AND status_index < ${LAST_STATUS}`);
  else if (q.status !== undefined && q.status !== "" && /^\d+$/.test(q.status)) {
    where.push("cancelled = 0 AND status_index = ?");
    params.push(Number(q.status));
  }
  if (q.category && (CATEGORIES as readonly string[]).includes(q.category)) {
    where.push("category = ?");
    params.push(q.category);
  }
  if (q.search?.trim()) {
    const like = `%${q.search.trim().toLowerCase()}%`;
    where.push("(LOWER(id) LIKE ? OR LOWER(customer_name) LIKE ? OR customer_phone LIKE ? OR LOWER(title) LIKE ?)");
    params.push(like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(200, q.limit ?? 50));
  const offset = Math.max(0, q.offset ?? 0);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM orders ${clause}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM orders ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as OrderRow[];
  return { total, items: rows.map((r) => toAdminOrder(r)) };
}

// ——— Дашборд ———
export function stats(db: DB, now = Date.now(), days = 14) {
  const one = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).get(...p) as T;
  const all = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).all(...p) as T[];

  const totals = one<{ orders: number; revenue: number | null; avg: number | null }>(
    "SELECT COUNT(*) AS orders, SUM(total) AS revenue, AVG(total) AS avg FROM orders WHERE cancelled = 0",
  );
  // Итоги за выбранный период и за такой же период до него — для сравнения.
  const span = days * 86400e3;
  const periodSql = "SELECT COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE cancelled = 0 AND created_at >= ? AND created_at < ?";
  const cur = one<{ orders: number; revenue: number | null }>(periodSql, now - span, now + 1);
  const prev = one<{ orders: number; revenue: number | null }>(periodSql, now - 2 * span, now - span);
  const since = now - span;
  const active = one<{ n: number }>(`SELECT COUNT(*) AS n FROM orders WHERE cancelled = 0 AND status_index < ${LAST_STATUS}`).n;
  const cancelled = one<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE cancelled = 1").n;

  const byStatus = ORDER_STATUSES.map((label, i) => ({
    statusIndex: i, label,
    count: one<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE cancelled = 0 AND status_index = ?", i).n,
  }));

  const byCategory = CATEGORIES.map((c) => {
    const r = one<{ n: number; revenue: number | null }>("SELECT COUNT(*) AS n, SUM(total) AS revenue FROM orders WHERE cancelled = 0 AND category = ? AND created_at >= ?", c, since);
    return { category: c, label: CATEGORY_LABELS[c], count: r.n, revenue: round2(r.revenue ?? 0) };
  });

  // Выручка по дням в часовом поясе Минска (UTC+3, без перехода на летнее время).
  const TZ = 3 * 3600e3;
  const dayStart = (ms: number) => Math.floor((ms + TZ) / 86400e3) * 86400e3 - TZ;
  const firstDay = dayStart(now) - (days - 1) * 86400e3;
  const rows = all<{ created_at: number; total: number }>("SELECT created_at, total FROM orders WHERE cancelled = 0 AND created_at >= ?", firstDay);
  const daily = Array.from({ length: days }, (_, i) => ({ day: firstDay + i * 86400e3, orders: 0, revenue: 0 }));
  for (const r of rows) {
    const idx = Math.floor((dayStart(r.created_at) - firstDay) / 86400e3);
    if (daily[idx]) {
      daily[idx].orders += 1;
      daily[idx].revenue = round2(daily[idx].revenue + r.total);
    }
  }

  const promos = all<{ code: string; n: number; discount: number; revenue: number }>(
    "SELECT promo_code AS code, COUNT(*) AS n, SUM(discount) AS discount, SUM(total) AS revenue FROM orders WHERE promo_code IS NOT NULL AND cancelled = 0 AND created_at >= ? GROUP BY promo_code ORDER BY n DESC LIMIT 5",
    since,
  ).map((p) => ({ code: p.code, orders: p.n, discount: round2(p.discount), revenue: round2(p.revenue) }));

  const recent = all<OrderRow>("SELECT * FROM orders ORDER BY created_at DESC LIMIT 6").map((r) => toAdminOrder(r));

  return {
    totals: { orders: totals.orders, revenue: round2(totals.revenue ?? 0), avgCheck: round2(totals.avg ?? 0), active, cancelled },
    period: {
      days, orders: cur.orders, revenue: round2(cur.revenue ?? 0), avgCheck: cur.orders ? round2((cur.revenue ?? 0) / cur.orders) : 0,
      prevOrders: prev.orders, prevRevenue: round2(prev.revenue ?? 0),
    },
    byStatus, byCategory, daily, promos, recent,
  };
}
