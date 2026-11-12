import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { EventEmitter } from "node:events";
import { checkPassword, issueToken, requireAdmin, verifyToken } from "./auth.ts";
import { config as defaultConfig } from "./config.ts";
import type { DB } from "./db.ts";
import { CATALOG_KINDS, SETTINGS_SCHEMA, listCatalog, loadCatalog, sanitizeCatalogData, tx } from "./db.ts";
import { ORDER_STATUSES, PAYMENT_OPTIONS } from "./domain.ts";
import {
  HttpError, createOrder, findPromo, getOrder, listOrders, normalizeCode, orderEvents, orderPhotos, promoProblem, promoToJson,
  stats, toAdminOrder, toClientOrder, updateOrder,
} from "./orders.ts";
import type { OrderRow, PromoRow } from "./orders.ts";
import { buildPrintPack } from "./printpack.ts";
import { resetDb } from "./seed.ts";
import { zipStream } from "./zip.ts";

type AppConfig = typeof defaultConfig;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic", "image/heif": ".heif",
};
const MAX_PHOTOS_PER_ORDER = 300;

export async function buildApp(db: DB, cfg: AppConfig = defaultConfig, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 5 * 1024 * 1024 });
  mkdirSync(cfg.uploadsDir, { recursive: true });

  // Шина событий для живых обновлений админки (SSE).
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const emit = (type: string, payload: Record<string, unknown> = {}) => events.emit("event", { type, at: Date.now(), ...payload });

  // Приложение (Expo web, Expo Go) и админка ходят с разных origin — открываем CORS.
  await app.register(cors, { origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "Authorization", "X-Client-Id"] });
  await app.register(multipart, { limits: { fileSize: cfg.maxPhotoBytes, files: 1, fields: 5 } });

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    const status = err.statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "Внутренняя ошибка сервера" : err.message });
  });

  app.get("/api/health", async () => ({ ok: true, time: Date.now() }));

  // ═════════════ Публичное API (мобильное приложение) ═════════════
  app.get("/api/catalog", async () => ({
    ...loadCatalog(db),
    paymentOptions: Object.entries(PAYMENT_OPTIONS).map(([id, label]) => ({ id, label })),
    orderStatuses: ORDER_STATUSES,
  }));

  app.post("/api/promo/validate", async (req) => {
    const code = normalizeCode((req.body as { code?: unknown } | undefined)?.code);
    const promo = code ? findPromo(db, code) : undefined;
    const problem = promoProblem(promo);
    return problem ? { valid: false, code, error: problem } : { valid: true, code, discountPercent: promo!.discount_percent };
  });

  app.post("/api/orders", async (req, reply) => {
    const order = createOrder(db, (req.body ?? {}) as Parameters<typeof createOrder>[1]);
    emit("order.created", { order: toAdminOrder(order) });
    return reply.code(201).send(toClientOrder(order));
  });

  app.get("/api/orders", async (req) => {
    const clientId = String((req.query as { clientId?: string }).clientId ?? "").trim();
    if (!clientId) throw new HttpError(400, "Не передан clientId");
    const rows = db.prepare("SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC LIMIT 100").all(clientId) as OrderRow[];
    return rows.map(toClientOrder);
  });

  const ownOrder = (id: string, clientId: unknown) => {
    const order = getOrder(db, id);
    if (!order || order.client_id !== String(clientId ?? "")) throw new HttpError(404, "Заказ не найден");
    return order;
  };

  app.get("/api/orders/:id", async (req) => {
    const { id } = req.params as { id: string };
    return toClientOrder(ownOrder(id, req.headers["x-client-id"] ?? (req.query as { clientId?: string }).clientId));
  });

  // Загрузка фото заказа: по одному файлу на запрос, multipart-поле «photo».
  app.post("/api/orders/:id/photos", async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = ownOrder(id, req.headers["x-client-id"]);
    const count = (db.prepare("SELECT COUNT(*) AS n FROM order_photos WHERE order_id = ?").get(id) as { n: number }).n;
    if (count >= MAX_PHOTOS_PER_ORDER) throw new HttpError(400, "Слишком много фото в заказе");

    const file = await req.file();
    if (!file) throw new HttpError(400, "Файл не передан");
    const ext = MIME_EXT[file.mimetype];
    if (!ext) {
      file.file.resume();
      throw new HttpError(415, "Поддерживаются только JPEG, PNG, WebP и HEIC");
    }
    const filename = `${randomUUID()}${ext}`;
    const target = path.join(cfg.uploadsDir, filename);
    await pipeline(file.file, createWriteStream(target));
    if (file.file.truncated) {
      unlinkSync(target);
      throw new HttpError(413, "Файл слишком большой");
    }
    const slotField = file.fields.slotId as { value?: unknown } | undefined;
    const slotId = typeof slotField?.value === "string" ? slotField.value.slice(0, 100) : null;
    const size = file.file.bytesRead;
    const now = Date.now();
    const result = db.prepare("INSERT INTO order_photos (order_id, slot_id, filename, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, slotId, filename, file.filename?.slice(0, 200) ?? null, file.mimetype, size, now);
    if (!order.preview_url) db.prepare("UPDATE orders SET preview_url = ? WHERE id = ?").run(`/api/photos/${filename}`, id);
    emit("order.photo", { orderId: id, uploaded: count + 1, expected: order.photo_count });
    return reply.code(201).send({ id: Number(result.lastInsertRowid), url: `/api/photos/${filename}` });
  });

  // Имена файлов — случайные UUID, поэтому ссылка сама по себе служит ключом доступа.
  await app.register(fastifyStatic, { root: cfg.uploadsDir, prefix: "/api/photos/", decorateReply: false, index: false, maxAge: "7d", immutable: true });

  // ═════════════ Админка ═════════════
  app.post("/api/admin/login", async (req, reply) => {
    const { password } = (req.body ?? {}) as { password?: unknown };
    if (!checkPassword(password, cfg.adminPassword)) return reply.code(401).send({ error: "Неверный пароль" });
    return issueToken(cfg.adminSecret);
  });

  // Поток событий для админки. EventSource не умеет слать заголовки, поэтому токен — в ?token=.
  app.get("/api/admin/events", (req, reply) => {
    const token = (req.query as { token?: string }).token;
    if (!verifyToken(token, cfg.adminSecret)) return reply.code(401).send({ error: "Требуется вход в админку" });
    reply.hijack();
    const origin = req.headers.origin;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    });
    const send = (e: unknown) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    send({ type: "hello", at: Date.now() });
    events.on("event", send);
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 25000);
    const close = () => {
      clearInterval(ping);
      events.off("event", send);
      streams.delete(close);
      if (!reply.raw.writableEnded) reply.raw.end();
    };
    streams.add(close);
    req.raw.on("close", close);
  });
  // При остановке сервера закрываем открытые потоки, иначе close() будет ждать их вечно.
  const streams = new Set<() => void>();
  app.addHook("preClose", async () => {
    for (const close of [...streams]) close();
  });

  await app.register(async (admin) => {
    admin.addHook("onRequest", requireAdmin(cfg.adminSecret));

    admin.get("/api/admin/me", async () => ({ ok: true }));
    admin.get("/api/admin/stats", async () => stats(db));

    // ——— Заказы ———
    admin.get("/api/admin/orders", async (req) => {
      const q = req.query as Record<string, string | undefined>;
      return listOrders(db, { status: q.status, category: q.category, search: q.search, limit: Number(q.limit) || 50, offset: Number(q.offset) || 0 });
    });
    admin.get("/api/admin/orders/:id", async (req) => {
      const { id } = req.params as { id: string };
      const order = getOrder(db, id);
      if (!order) throw new HttpError(404, "Заказ не найден");
      return toAdminOrder(order, orderPhotos(db, id), orderEvents(db, id));
    });
    admin.patch("/api/admin/orders/:id", async (req) => {
      const { id } = req.params as { id: string };
      updateOrder(db, id, (req.body ?? {}) as Parameters<typeof updateOrder>[2]);
      const order = getOrder(db, id)!;
      emit("order.updated", { orderId: id, statusIndex: order.status_index, cancelled: !!order.cancelled });
      return toAdminOrder(order, orderPhotos(db, id), orderEvents(db, id));
    });

    // Пакет к печати: ZIP с фото в порядке макета, паспортом заказа и составом.
    admin.get("/api/admin/orders/:id/print-pack", async (req, reply) => {
      const { id } = req.params as { id: string };
      const order = getOrder(db, id);
      if (!order) throw new HttpError(404, "Заказ не найден");
      const photos = orderPhotos(db, id).filter((p) => existsSync(path.join(cfg.uploadsDir, p.filename)));
      const pack = buildPrintPack(db, order, photos, cfg.uploadsDir);
      const ascii = `${order.id}_print.zip`;
      reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(pack.filename)}`)
        .header("X-Photo-Count", String(pack.photoCount))
        .header("X-Missing-Photos", String(pack.missing.length))
        .header("Access-Control-Expose-Headers", "Content-Disposition, X-Photo-Count, X-Missing-Photos");
      return reply.send(zipStream(pack.entries));
    });

    // ——— Каталог ———
    admin.get("/api/admin/catalog", async () => {
      const prices = loadCatalog(db).prices;
      return { kinds: CATALOG_KINDS, settingsSchema: SETTINGS_SCHEMA, items: listCatalog(db), prices };
    });

    admin.post("/api/admin/catalog/:kind", async (req, reply) => {
      const { kind } = req.params as { kind: string };
      const body = (req.body ?? {}) as { id?: unknown; active?: unknown; data?: Record<string, unknown> };
      const id = String(body.id ?? "").trim();
      if (!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id)) throw new HttpError(400, "ID: латиница, цифры, «-» и «_», до 40 символов");
      let data: Record<string, unknown>;
      try { data = sanitizeCatalogData(kind, body.data ?? {}); } catch (e) { throw new HttpError(400, (e as Error).message); }
      const exists = db.prepare("SELECT 1 FROM catalog_items WHERE kind = ? AND id = ?").get(kind, id);
      if (exists) throw new HttpError(409, `Позиция с ID «${id}» уже есть`);
      const sort = (db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM catalog_items WHERE kind = ?").get(kind) as { s: number }).s;
      db.prepare("INSERT INTO catalog_items (kind, id, sort, active, data) VALUES (?, ?, ?, ?, ?)").run(kind, id, sort, body.active === false ? 0 : 1, JSON.stringify(data));
      return reply.code(201).send(listCatalog(db, kind).find((r) => r.id === id));
    });

    admin.put("/api/admin/catalog/:kind/:id", async (req) => {
      const { kind, id } = req.params as { kind: string; id: string };
      const body = (req.body ?? {}) as { active?: unknown; data?: Record<string, unknown> };
      const row = listCatalog(db, kind).find((r) => r.id === id);
      if (!row) throw new HttpError(404, "Позиция не найдена");
      let data = row.data;
      if (body.data) {
        try { data = sanitizeCatalogData(kind, body.data); } catch (e) { throw new HttpError(400, (e as Error).message); }
      }
      const active = body.active === undefined ? row.active : !!body.active;
      if (!active && row.active) {
        const left = (db.prepare("SELECT COUNT(*) AS n FROM catalog_items WHERE kind = ? AND active = 1").get(kind) as { n: number }).n;
        if (left <= 1) throw new HttpError(400, "Нельзя скрыть последнюю активную позицию раздела — приложению нужна хотя бы одна");
      }
      db.prepare("UPDATE catalog_items SET data = ?, active = ? WHERE kind = ? AND id = ?").run(JSON.stringify(data), active ? 1 : 0, kind, id);
      return listCatalog(db, kind).find((r) => r.id === id);
    });

    admin.delete("/api/admin/catalog/:kind/:id", async (req, reply) => {
      const { kind, id } = req.params as { kind: string; id: string };
      const row = listCatalog(db, kind).find((r) => r.id === id);
      if (!row) throw new HttpError(404, "Позиция не найдена");
      if (row.active) {
        const left = (db.prepare("SELECT COUNT(*) AS n FROM catalog_items WHERE kind = ? AND active = 1").get(kind) as { n: number }).n;
        if (left <= 1) throw new HttpError(400, "Нельзя удалить последнюю активную позицию раздела");
      }
      db.prepare("DELETE FROM catalog_items WHERE kind = ? AND id = ?").run(kind, id);
      return reply.code(204).send();
    });

    admin.put("/api/admin/prices", async (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      tx(db, () => {
        for (const f of SETTINGS_SCHEMA.fields) {
          if (body[f.key] === undefined) continue;
          const n = Number(body[f.key]);
          if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `Поле «${f.label}» должно быть неотрицательным числом`);
          db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(f.key, String(n));
        }
      });
      return loadCatalog(db).prices;
    });

    // ——— Промокоды ———
    const promoFromBody = (body: Record<string, unknown>, partial: boolean) => {
      const out: Partial<Record<keyof PromoRow, string | number | null>> = {};
      if (!partial || body.discountPercent !== undefined) {
        const d = Number(body.discountPercent);
        if (!Number.isFinite(d) || d <= 0 || d > 90) throw new HttpError(400, "Скидка — от 1 до 90%");
        out.discount_percent = d;
      }
      if (body.description !== undefined) out.description = String(body.description).trim().slice(0, 200);
      if (body.active !== undefined) out.active = body.active ? 1 : 0;
      if (body.maxUses !== undefined) {
        const m = body.maxUses === null || body.maxUses === "" ? null : Number(body.maxUses);
        if (m !== null && (!Number.isInteger(m) || m < 1)) throw new HttpError(400, "Лимит использований — целое число от 1 или пусто");
        out.max_uses = m;
      }
      if (body.expiresAt !== undefined) {
        const t = body.expiresAt === null || body.expiresAt === "" ? null : Number(body.expiresAt);
        if (t !== null && !Number.isFinite(t)) throw new HttpError(400, "Некорректная дата окончания");
        out.expires_at = t;
      }
      return out;
    };

    admin.get("/api/admin/promos", async () =>
      (db.prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all() as PromoRow[]).map(promoToJson));

    admin.post("/api/admin/promos", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const code = normalizeCode(body.code);
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new HttpError(400, "Код: 3–30 символов, латиница, цифры, «-» и «_»");
      if (findPromo(db, code)) throw new HttpError(409, `Промокод ${code} уже существует`);
      const f = promoFromBody(body, false);
      db.prepare("INSERT INTO promo_codes (code, description, discount_percent, active, max_uses, used_count, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
        .run(code, f.description ?? "", f.discount_percent!, f.active ?? 1, f.max_uses ?? null, f.expires_at ?? null, Date.now());
      return reply.code(201).send(promoToJson(findPromo(db, code)!));
    });

    admin.patch("/api/admin/promos/:code", async (req) => {
      const code = normalizeCode((req.params as { code: string }).code);
      if (!findPromo(db, code)) throw new HttpError(404, "Промокод не найден");
      const f = promoFromBody((req.body ?? {}) as Record<string, unknown>, true);
      const keys = Object.keys(f) as (keyof typeof f)[];
      if (keys.length) {
        db.prepare(`UPDATE promo_codes SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE code = ?`).run(...keys.map((k) => f[k] ?? null), code);
      }
      return promoToJson(findPromo(db, code)!);
    });

    admin.delete("/api/admin/promos/:code", async (req, reply) => {
      const code = normalizeCode((req.params as { code: string }).code);
      const r = db.prepare("DELETE FROM promo_codes WHERE code = ?").run(code);
      if (!r.changes) throw new HttpError(404, "Промокод не найден");
      return reply.code(204).send();
    });

    // Сброс к демо-данным (удобно перед показом жюри).
    admin.post("/api/admin/reset-demo", async () => {
      resetDb(db);
      emit("reset");
      return { ok: true };
    });
  });

  // ═════════════ Сборка админки (если есть admin/dist) ═════════════
  if (existsSync(cfg.adminDist)) {
    await app.register(fastifyStatic, { root: cfg.adminDist, prefix: "/admin/", decorateReply: false });
    app.get("/admin", (_req, reply) => reply.redirect("/admin/"));
    app.get("/", (_req, reply) => reply.redirect("/admin/"));
  }

  return app;
}
