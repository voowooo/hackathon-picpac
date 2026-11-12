import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { crc32 } from "node:zlib";
import { buildApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { seed } from "../src/seed.ts";

const dir = mkdtempSync(path.join(tmpdir(), "picpac-pack-"));
const db = openDb(":memory:");
seed(db);
const app = await buildApp(db, { ...config, adminPassword: "secret", adminSecret: "s", uploadsDir: path.join(dir, "uploads"), adminDist: path.join(dir, "none") });
let token = "";
let base = "";

before(async () => {
  token = (await app.inject({ method: "POST", url: "/api/admin/login", payload: { password: "secret" } })).json().token;
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

// Разбор ZIP по центральному каталогу: имена, размеры и CRC каждого файла.
function readZip(buf: Buffer) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd > 0, "нет конца центрального каталога");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files: Record<string, Buffer> = {};
  for (let i = 0; i < count; i += 1) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const localNameLen = buf.readUInt16LE(offset + 26);
    const data = buf.subarray(offset + 30 + localNameLen, offset + 30 + localNameLen + size);
    assert.equal(crc32(data) >>> 0, crc, `CRC не сходится для ${name}`);
    files[name] = data;
    p += 46 + nameLen;
  }
  return files;
}

async function createOrderWithPhotos() {
  const order = (await app.inject({
    method: "POST", url: "/api/orders",
    payload: {
      clientId: "c1", recipient: { name: "Анна", phone: "+375291234567", address: "Минск" }, deliveryId: "courier", paymentId: "card", photoCount: 3,
      config: {
        category: "photobook", bookLineId: "lite", bookFormat: "25×25", spreads: 2, bookTitle: "Грузия", spreadLayouts: ["full", "quad"],
        slots: [{ id: "photobook-slot-cover", photoId: "a" }, { id: "photobook-slot-1-0", photoId: "b" }, { id: "photobook-slot-1-1", photoId: "c" }],
      },
    },
  })).json();
  // Загружаем в обратном порядке — в пакете фото всё равно должны идти по макету.
  for (const slotId of ["photobook-slot-1-1", "photobook-slot-cover"]) {
    const form = new FormData();
    form.append("slotId", slotId);
    form.append("photo", new Blob([Buffer.from(`jpeg-${slotId}`)], { type: "image/jpeg" }), `${slotId}.jpg`);
    const res = await fetch(`${base}/api/orders/${order.id}/photos`, { method: "POST", headers: { "X-Client-Id": "c1" }, body: form });
    assert.equal(res.status, 201);
  }
  return order.id as string;
}

test("пакет к печати: фото по порядку макета, паспорт и состав", async () => {
  const id = await createOrderWithPhotos();
  const res = await fetch(`${base}/api/admin/orders/${id}/print-pack`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  assert.equal(res.headers.get("x-missing-photos"), "1");
  const files = readZip(Buffer.from(await res.arrayBuffer()));
  const names = Object.keys(files);
  assert.deepEqual(names.filter((n) => n.startsWith("photos/")), ["photos/01_Обложка.jpg", "photos/02_Разворот_1_ячейка_2.jpg"]);
  assert.equal(files["photos/01_Обложка.jpg"].toString(), "jpeg-photobook-slot-cover");
  const passport = files["Паспорт заказа.txt"].toString("utf8");
  assert.match(passport, new RegExp(`ПАСПОРТ ЗАКАЗА ${id}`));
  assert.match(passport, /Линейка: Lite/);
  assert.match(passport, /2\. Сетка 2×2/);
  assert.match(passport, /не загружены фото для ячеек: Разворот 1, ячейка 1/);
  assert.match(files["Состав.csv"].toString("utf8"), /photos\/02_Разворот_1_ячейка_2\.jpg;Разворот 1, ячейка 2/);
  assert.equal(JSON.parse(files["order.json"].toString()).config.bookTitle, "Грузия");
});

test("пакет к печати требует вход", async () => {
  const res = await fetch(`${base}/api/admin/orders/ord-1001/print-pack`);
  assert.equal(res.status, 401);
});

test("поток событий: новый заказ и смена статуса приходят в админку", async () => {
  assert.equal((await fetch(`${base}/api/admin/events?token=bad`)).status, 401);

  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/admin/events?token=${encodeURIComponent(token)}`, { signal: ctrl.signal });
  assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const reader = res.body!.getReader();
  const received: { type: string; [k: string]: unknown }[] = [];
  let buffer = "";
  const waitFor = async (type: string) => {
    for (;;) {
      const found = received.find((e) => e.type === type);
      if (found) return found;
      const { value, done } = await reader.read();
      if (done) throw new Error(`поток закрылся до события ${type}`);
      buffer += new TextDecoder().decode(value);
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop()!;
      for (const c of chunks) if (c.startsWith("data: ")) received.push(JSON.parse(c.slice(6)));
    }
  };
  await waitFor("hello");

  const id = await createOrderWithPhotos();
  const created = await waitFor("order.created");
  assert.equal((created.order as { id: string }).id, id);
  await waitFor("order.photo");

  await app.inject({ method: "PATCH", url: `/api/admin/orders/${id}`, headers: { authorization: `Bearer ${token}` }, payload: { statusIndex: 1 } });
  const updated = await waitFor("order.updated");
  assert.equal(updated.statusIndex, 1);
  ctrl.abort();
});

const auth = () => ({ authorization: `Bearer ${token}` });

test("качество фото из приложения попадает в паспорт и состав", async () => {
  const order = (await app.inject({
    method: "POST", url: "/api/orders",
    payload: {
      clientId: "c2", recipient: { name: "Олег", phone: "+375291112233", address: "Минск" }, deliveryId: "courier", paymentId: "card", photoCount: 1,
      config: { category: "poster", posterSizeId: "50x70", slots: [{ id: "poster-slot-0", photoId: "a" }] },
      photoInfo: { "poster-slot-0": { width: 800, height: 600, lowRes: true, issues: ["темновато"], score: 41 }, "bad slot!": { issues: ["x"] } },
    },
  })).json();
  const form = new FormData();
  form.append("slotId", "poster-slot-0");
  form.append("photo", new Blob([Buffer.from("img")], { type: "image/jpeg" }), "p.jpg");
  await fetch(`${base}/api/orders/${order.id}/photos`, { method: "POST", headers: { "X-Client-Id": "c2" }, body: form });

  const detail = (await app.inject({ url: `/api/admin/orders/${order.id}`, headers: auth() })).json();
  assert.deepEqual(Object.keys(detail.config.photoInfo), ["poster-slot-0"]);
  const res = await fetch(`${base}/api/admin/orders/${order.id}/print-pack`, { headers: auth() });
  const files = readZip(Buffer.from(await res.arrayBuffer()));
  assert.match(files["Паспорт заказа.txt"].toString(), /Постер: мало пикселей для формата, темновато/);
  assert.match(files["Состав.csv"].toString(), /800×600;мало пикселей для формата, темновато/);
});

test("массовая смена статуса пропускает отменённые и шлёт события", async () => {
  const res = await app.inject({ method: "POST", url: "/api/admin/orders/bulk", headers: auth(), payload: { ids: ["ord-1001", "ord-1002", "nope"], statusIndex: 4, comment: "партия" } });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.skipped.some((s: { id: string }) => s.id === "nope"));
  for (const id of body.updated) {
    const o = (await app.inject({ url: `/api/admin/orders/${id}`, headers: auth() })).json();
    assert.equal(o.statusIndex, 4);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/admin/orders/bulk", headers: auth(), payload: { ids: [] } })).statusCode, 400);
});

test("общий пакет к печати на несколько заказов", async () => {
  const ids = ["ord-1001", "ord-1002"];
  const res = await fetch(`${base}/api/admin/orders/bulk-print-pack`, { method: "POST", headers: { ...auth(), "content-type": "application/json" }, body: JSON.stringify({ ids }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-order-count"), "2");
  const names = Object.keys(readZip(Buffer.from(await res.arrayBuffer())));
  assert.ok(names.includes("Сводка.csv"));
  assert.ok(names.includes("ord-1001/Паспорт заказа.txt"));
  assert.ok(names.includes("ord-1002/Состав.csv"));
});

test("выгрузка заказов в CSV учитывает фильтры", async () => {
  const res = await fetch(`${base}/api/admin/orders/export.csv?category=poster`, { headers: auth() });
  assert.equal(res.status, 200);
  // res.text() съедает BOM, поэтому проверяем сырые байты.
  const raw = Buffer.from(await res.arrayBuffer());
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], "нужен BOM для Excel");
  const lines = raw.subarray(3).toString("utf8").trim().split("\r\n");
  assert.ok(lines[0].startsWith("Заказ;Дата;Статус"));
  assert.ok(lines.length > 1);
  assert.ok(lines.slice(1).every((l) => l.includes("Постер")));
});

test("дашборд за выбранный период", async () => {
  const s7 = (await app.inject({ url: "/api/admin/stats?days=7", headers: auth() })).json();
  const s90 = (await app.inject({ url: "/api/admin/stats?days=90", headers: auth() })).json();
  assert.equal(s7.daily.length, 7);
  assert.equal(s90.daily.length, 90);
  assert.equal(s7.period.days, 7);
  assert.ok(s90.period.orders >= s7.period.orders);
  assert.equal((await app.inject({ url: "/api/admin/stats?days=13", headers: auth() })).json().period.days, 14);
});
