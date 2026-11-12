import type { DB } from "./db.ts";
import { tx } from "./db.ts";
import { LAST_STATUS, PAYMENT_OPTIONS } from "./domain.ts";

// Стартовый каталог совпадает с моками приложения (src/config/catalog.ts),
// чтобы цены в приложении и на сервере сходились с первого запуска.
const CATALOG: { kind: string; id: string; data: Record<string, unknown> }[] = [
  { kind: "printFormat", id: "10x15", data: { label: "10×15 см", pricePer: 0.65, ratio: 2 / 3 } },
  { kind: "printFormat", id: "15x20", data: { label: "15×20 см", pricePer: 2.4, ratio: 3 / 4 } },
  { kind: "printFormat", id: "20x30", data: { label: "20×30 см", pricePer: 5.9, ratio: 2 / 3 } },
  { kind: "bookLine", id: "lite", data: { name: "Lite", desc: "Твёрдая обложка, гибкие страницы, до 160 стр.", formats: ["20×20", "21×30", "25×25"], basePrice: 49.9 } },
  { kind: "bookLine", id: "classic", data: { name: "Classic", desc: "Плотные страницы, раскрытие 180°, до 60 стр.", formats: ["20×20", "21×30"], basePrice: 69.9 } },
  { kind: "bookLine", id: "premium", data: { name: "Premium", desc: "Матовая бумага, плотные развороты, твёрдая обложка", formats: ["20×20", "21×30", "25×25", "30×20", "30×30"], basePrice: 99.9 } },
  { kind: "posterSize", id: "30x40", data: { label: "30×40 см", price: 24.9 } },
  { kind: "posterSize", id: "40x60", data: { label: "40×60 см", price: 39.9 } },
  { kind: "posterSize", id: "50x70", data: { label: "50×70 см", price: 54.9 } },
  { kind: "delivery", id: "courier", data: { label: "Курьер по Минску", eta: "1–2 дня", price: 5.0 } },
  { kind: "delivery", id: "belpost", data: { label: "Белпочта", eta: "3–5 дней", price: 3.5 } },
  { kind: "delivery", id: "ems", data: { label: "EMS", eta: "2–3 дня", price: 12.0 } },
];

const DEMO_COVERS = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600",
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600",
];

const NAMES = ["Анна Ковалёва", "Дмитрий Новик", "Ольга Шевчук", "Сергей Лукашевич", "Мария Жук", "Игорь Сидоренко", "Екатерина Бондарь", "Павел Климович"];
const STREETS = ["пр. Независимости, 45", "ул. Немига, 12", "ул. Сурганова, 7", "пр. Победителей, 100", "ул. Кальварийская, 21", "ул. Притыцкого, 83"];

type DemoProduct = { category: string; title: string; items: string; scenario: string; subtotal: number; config: Record<string, unknown> };

const DEMO_PRODUCTS: DemoProduct[] = [
  { category: "photobook", title: "Фотокнига Lite 25×25", items: "12 разворотов · кремовая обложка", scenario: "Поездка в Грузию", subtotal: 64.3, config: { category: "photobook", bookLineId: "lite", bookFormat: "25×25", spreads: 12 } },
  { category: "photobook", title: "Фотокнига Premium 30×30", items: "16 разворотов · графит обложка", scenario: "Первый год малыша", subtotal: 119.1, config: { category: "photobook", bookLineId: "premium", bookFormat: "30×30", spreads: 16 } },
  { category: "print", title: "Фотопечать 10×15", items: "19 отпечатков · матовая бумага", scenario: "Семейный архив", subtotal: 12.35, config: { category: "print", printFormatId: "10x15", copies: 1 } },
  { category: "print", title: "Фотопечать 15×20", items: "8 отпечатков · глянцевая бумага", scenario: "Новый заказ", subtotal: 19.2, config: { category: "print", printFormatId: "15x20", copies: 1 } },
  { category: "poster", title: "Постер 40×60 см", items: "Вертикальный", scenario: "Новый заказ", subtotal: 39.9, config: { category: "poster", posterSizeId: "40x60" } },
  { category: "poster", title: "Постер 50×70 см", items: "Горизонтальный", scenario: "Новый заказ", subtotal: 54.9, config: { category: "poster", posterSizeId: "50x70" } },
  { category: "postcard", title: "Открытка", items: "5 шт · Ботаника", scenario: "Подарок маме", subtotal: 19.5, config: { category: "postcard", copies: 5 } },
];

const DELIVERY = [
  { id: "courier", label: "Курьер по Минску", price: 5 },
  { id: "belpost", label: "Белпочта", price: 3.5 },
  { id: "ems", label: "EMS", price: 12 },
];

// Детерминированный генератор, чтобы демо-данные были одинаковыми при каждом сбросе.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function seedIfEmpty(db: DB) {
  const hasCatalog = (db.prepare("SELECT COUNT(*) AS n FROM catalog_items").get() as { n: number }).n > 0;
  if (hasCatalog) return false;
  seed(db);
  return true;
}

export function seed(db: DB, now = Date.now()) {
  tx(db, () => {
    const insItem = db.prepare("INSERT INTO catalog_items (kind, id, sort, active, data) VALUES (?, ?, ?, 1, ?)");
    CATALOG.forEach((c, i) => insItem.run(c.kind, c.id, i, JSON.stringify(c.data)));
    const insSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    insSetting.run("spreadPrice", "1.2");
    insSetting.run("postcardPrice", "3.9");

    const insPromo = db.prepare("INSERT INTO promo_codes (code, description, discount_percent, active, max_uses, used_count, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    insPromo.run("PICPAC10", "Скидка для всех", 10, 1, null, 4, null, now - 40 * 86400e3);
    insPromo.run("HACK20", "Промо хакатона", 20, 1, 100, 2, now + 30 * 86400e3, now - 5 * 86400e3);
    insPromo.run("SUMMER15", "Летняя акция (закончилась)", 15, 0, null, 0, now - 60 * 86400e3, now - 120 * 86400e3);

    const rand = rng(42);
    const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const insOrder = db.prepare(`INSERT INTO orders (id, client_id, created_at, updated_at, status_index, cancelled, category, title, scenario, items,
      customer_name, customer_phone, customer_address, delivery_id, delivery_label, payment_id, promo_code, subtotal, discount, delivery_price, total,
      photo_count, preview_url, config) VALUES (?, 'demo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insEvent = db.prepare("INSERT INTO order_events (order_id, created_at, kind, status_index, note, actor) VALUES (?, ?, ?, ?, ?, ?)");

    const COUNT = 36;
    for (let i = 0; i < COUNT; i += 1) {
      const id = `ord-${1001 + i}`;
      const daysAgo = Math.floor(((COUNT - i) / COUNT) * 28 + rand() * 2);
      const created = now - daysAgo * 86400e3 - Math.floor(rand() * 10 * 3600e3);
      const product = pick(DEMO_PRODUCTS);
      const delivery = pick(DELIVERY);
      const promo = rand() < 0.2 ? (rand() < 0.6 ? "PICPAC10" : "HACK20") : null;
      const discount = promo ? Math.round(product.subtotal * (promo === "HACK20" ? 0.2 : 0.1) * 100) / 100 : 0;
      const total = Math.round((product.subtotal - discount + delivery.price) * 100) / 100;
      // Чем старше заказ, тем дальше он продвинулся по статусам.
      const status = Math.min(LAST_STATUS, Math.floor(daysAgo / 2.2));
      const cancelled = rand() < 0.05 ? 1 : 0;
      const name = pick(NAMES);
      insOrder.run(
        id, created, created + status * 86400e3, status, cancelled, product.category, product.title, product.scenario, product.items,
        name, `+375 29 ${Math.floor(100 + rand() * 899)}-${Math.floor(10 + rand() * 89)}-${Math.floor(10 + rand() * 89)}`, `Минск, ${pick(STREETS)}`,
        delivery.id, delivery.label, pick(Object.keys(PAYMENT_OPTIONS)), promo, product.subtotal, discount, delivery.price, total,
        Math.floor(1 + rand() * 30), pick(DEMO_COVERS), JSON.stringify(product.config),
      );
      insEvent.run(id, created, "created", 0, "Заказ оформлен в приложении", "client");
      for (let s = 1; s <= status; s += 1) insEvent.run(id, created + s * 86400e3, "status", s, "", "admin");
      if (cancelled) insEvent.run(id, created + (status + 0.5) * 86400e3, "cancelled", status, "Клиент отменил заказ", "admin");
    }
  });
}

export function resetDb(db: DB) {
  tx(db, () => {
    for (const t of ["order_events", "order_photos", "orders", "promo_codes", "settings", "catalog_items"]) db.exec(`DELETE FROM ${t}`);
  });
  seed(db);
}
