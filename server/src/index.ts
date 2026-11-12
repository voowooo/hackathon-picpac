import { networkInterfaces } from "node:os";
import { buildApp } from "./app.ts";
import { config } from "./config.ts";
import { openDb } from "./db.ts";
import { seedIfEmpty } from "./seed.ts";

const db = openDb();
if (seedIfEmpty(db)) console.log("База пустая — заполнили демо-каталогом, промокодами и заказами");
if (!process.env.ADMIN_PASSWORD) console.warn(`ADMIN_PASSWORD не задан — пароль админки по умолчанию: ${config.adminPassword}`);

const app = await buildApp(db, config, { logger: process.env.LOG === "1" });
await app.listen({ port: config.port, host: config.host });

// Все внешние IPv4: у ноутбука их бывает несколько (Wi‑Fi, VPN, WSL). Телефону нужен адрес той сети, где он сам.
const lan = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
  (list ?? []).filter((i) => i.family === "IPv4" && !i.internal).map((i) => `${i.address} (${name})`));
console.log(`PicPac API:   http://localhost:${config.port}/api`);
for (const addr of lan) console.log(`В сети:       http://${addr.replace(" (", `:${config.port}/api  (`)}`);
if (lan.length) console.log("Проверка с телефона: откройте http://<адрес>:" + config.port + "/api/health в браузере телефона");
console.log(`Админка:      http://localhost:${config.port}/admin  (после npm run build в admin/; в разработке — http://localhost:5173)`);

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
