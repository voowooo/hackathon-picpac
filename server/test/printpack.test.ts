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
