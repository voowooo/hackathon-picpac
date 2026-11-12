import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { buildApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { seed } from "../src/seed.ts";

const dir = mkdtempSync(path.join(tmpdir(), "picpac-test-"));
const db = openDb(":memory:");
seed(db);
const app = await buildApp(db, { ...config, adminPassword: "secret", adminSecret: "test-secret", uploadsDir: path.join(dir, "uploads"), adminDist: path.join(dir, "none") });

let token = "";
const auth = () => ({ authorization: `Bearer ${token}` });

const orderBody = (over: Record<string, unknown> = {}) => ({
  clientId: "client-1",
  config: { category: "print", printFormatId: "10x15", copies: 2, slots: [{ id: "s0", photoId: "a" }, { id: "s1", photoId: "b", printFormatId: "15x20" }, { id: "s2" }] },
  recipient: { name: "Тест", phone: "+375291234567", address: "Минск" },
  deliveryId: "courier",
  paymentId: "card",
  photoCount: 2,
  ...over,
});

before(async () => {
  const res = await app.inject({ method: "POST", url: "/api/admin/login", payload: { password: "secret" } });
  assert.equal(res.statusCode, 200);
  token = res.json().token;
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("публичное API", () => {
  test("каталог отдаёт активные позиции и цены", async () => {
    const res = await app.inject("/api/catalog");
    const body = res.json();
    assert.equal(body.printFormats.length, 3);
    assert.equal(body.prices.spreadPrice, 1.2);
    assert.equal(body.deliveryOptions[0].id, "courier");
  });

  test("проверка промокода", async () => {
    const ok = await app.inject({ method: "POST", url: "/api/promo/validate", payload: { code: "picpac10" } });
    assert.deepEqual(ok.json(), { valid: true, code: "PICPAC10", discountPercent: 10 });
    const off = await app.inject({ method: "POST", url: "/api/promo/validate", payload: { code: "SUMMER15" } });
    assert.equal(off.json().valid, false);
  });

  test("сервер сам считает сумму заказа и применяет промокод", async () => {
    const res = await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ promoCode: "PICPAC10", clientTotal: 1 }) });
    assert.equal(res.statusCode, 201);
    const order = res.json();
    // (0.65 + 2.40) × 2 = 6.10; −10% = 0.61; + доставка 5
    assert.equal(order.total, 10.49);
    assert.equal(order.statusIndex, 0);
    assert.match(order.id, /^ord-\d+$/);

    const list = await app.inject("/api/orders?clientId=client-1");
    assert.equal(list.json()[0].id, order.id);
    const foreign = await app.inject({ url: `/api/orders/${order.id}`, headers: { "x-client-id": "someone-else" } });
    assert.equal(foreign.statusCode, 404);
  });

  test("отклоняет заказ без контактов и с неизвестной доставкой", async () => {
    const noName = await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ recipient: { name: "", phone: "1", address: "" } }) });
    assert.equal(noName.statusCode, 400);
    const badDelivery = await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ deliveryId: "teleport" }) });
    assert.equal(badDelivery.statusCode, 400);
  });

  test("загрузка фото к заказу", async () => {
    const created = (await app.inject({ method: "POST", url: "/api/orders", payload: orderBody() })).json();
    const boundary = "----picpac";
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="slotId"\r\n\r\ns0\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "x-client-id": "client-1" };
    const up = await app.inject({ method: "POST", url: `/api/orders/${created.id}/photos`, payload, headers });
    assert.equal(up.statusCode, 201, up.body);
    const file = await app.inject(up.json().url);
    assert.equal(file.statusCode, 200);

    const detail = (await app.inject({ url: `/api/admin/orders/${created.id}`, headers: auth() })).json();
    assert.equal(detail.photos.length, 1);
    assert.equal(detail.photos[0].slotId, "s0");
    assert.equal(detail.previewUrl, up.json().url);
  });
});

describe("админка", () => {
  test("без токена — 401, с неверным паролем — 401", async () => {
    assert.equal((await app.inject("/api/admin/stats")).statusCode, 401);
    assert.equal((await app.inject({ url: "/api/admin/stats", headers: { authorization: "Bearer abc.def" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/login", payload: { password: "nope" } })).statusCode, 401);
  });

  test("смена статуса пишет историю и видна клиенту", async () => {
    const created = (await app.inject({ method: "POST", url: "/api/orders", payload: orderBody() })).json();
    const res = await app.inject({ method: "PATCH", url: `/api/admin/orders/${created.id}`, headers: auth(), payload: { statusIndex: 2, comment: "Упаковали" } });
    assert.equal(res.statusCode, 200);
    const order = res.json();
    assert.equal(order.statusIndex, 2);
    assert.equal(order.events.at(-1).note, "Упаковали");
    const client = (await app.inject(`/api/orders/${created.id}?clientId=client-1`)).json();
    assert.equal(client.status, "ready");
    const bad = await app.inject({ method: "PATCH", url: `/api/admin/orders/${created.id}`, headers: auth(), payload: { statusIndex: 9 } });
    assert.equal(bad.statusCode, 400);
  });

  test("изменение цены в каталоге влияет на новые заказы", async () => {
    const put = await app.inject({ method: "PUT", url: "/api/admin/catalog/posterSize/30x40", headers: auth(), payload: { data: { label: "30×40 см", price: 30 } } });
    assert.equal(put.statusCode, 200);
    const order = (await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ config: { category: "poster", posterSizeId: "30x40" } }) })).json();
    assert.equal(order.total, 35);

    const hide = await app.inject({ method: "PUT", url: "/api/admin/catalog/posterSize/30x40", headers: auth(), payload: { active: false } });
    assert.equal(hide.json().active, false);
    const catalog = (await app.inject("/api/catalog")).json();
    assert.ok(!catalog.posterSizes.some((p: { id: string }) => p.id === "30x40"));
    const hidden = await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ config: { category: "poster", posterSizeId: "30x40" } }) });
    assert.equal(hidden.statusCode, 400);
  });

  test("создание позиции каталога валидирует поля", async () => {
    const bad = await app.inject({ method: "POST", url: "/api/admin/catalog/delivery", headers: auth(), payload: { id: "pickup", data: { label: "Самовывоз", eta: "сегодня", price: -1 } } });
    assert.equal(bad.statusCode, 400);
    const ok = await app.inject({ method: "POST", url: "/api/admin/catalog/delivery", headers: auth(), payload: { id: "pickup", data: { label: "Самовывоз", eta: "сегодня", price: 0 } } });
    assert.equal(ok.statusCode, 201);
    const dup = await app.inject({ method: "POST", url: "/api/admin/catalog/delivery", headers: auth(), payload: { id: "pickup", data: { label: "x", eta: "y", price: 0 } } });
    assert.equal(dup.statusCode, 409);
  });

  test("промокоды: создание, лимит использований, отключение", async () => {
    const created = await app.inject({ method: "POST", url: "/api/admin/promos", headers: auth(), payload: { code: "once", discountPercent: 50, maxUses: 1 } });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().code, "ONCE");
    const first = await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ promoCode: "ONCE" }) });
    assert.equal(first.statusCode, 201);
    const second = await app.inject({ method: "POST", url: "/api/orders", payload: orderBody({ promoCode: "ONCE" }) });
    assert.equal(second.statusCode, 400);

    await app.inject({ method: "PATCH", url: "/api/admin/promos/PICPAC10", headers: auth(), payload: { active: false } });
    const v = (await app.inject({ method: "POST", url: "/api/promo/validate", payload: { code: "PICPAC10" } })).json();
    assert.equal(v.valid, false);
  });

  test("дашборд и список заказов", async () => {
    const s = (await app.inject({ url: "/api/admin/stats", headers: auth() })).json();
    assert.ok(s.totals.orders > 30);
    assert.equal(s.daily.length, 14);
    assert.equal(s.byStatus.length, 5);
    const list = (await app.inject({ url: "/api/admin/orders?search=client&status=0&limit=5", headers: auth() })).json();
    assert.ok(Array.isArray(list.items));
    const found = (await app.inject({ url: "/api/admin/orders?search=ord-1001", headers: auth() })).json();
    assert.equal(found.items[0].id, "ord-1001");
  });
});
