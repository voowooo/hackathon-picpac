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

const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
console.log(`PicPac API:   http://localhost:${config.port}/api`);
if (lan) console.log(`В локальной сети: http://${lan}:${config.port}/api`);
console.log(`Админка:      http://localhost:${config.port}/admin  (после npm run build в admin/; в разработке — http://localhost:5173)`);

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
