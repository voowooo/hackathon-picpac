import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const resolveFromRoot = (p: string) => (path.isAbsolute(p) ? p : path.resolve(SERVER_ROOT, p));

const adminPassword = process.env.ADMIN_PASSWORD || "picpac-admin";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  adminPassword,
  // Без ADMIN_SECRET ключ подписи выводится из пароля: вход переживает перезапуск сервера,
  // а смена пароля разлогинивает всех.
  adminSecret: process.env.ADMIN_SECRET || createHash("sha256").update(`picpac-admin-token:${adminPassword}`).digest("hex"),
  dbFile: resolveFromRoot(process.env.DB_FILE ?? "./data/picpac.db"),
  uploadsDir: resolveFromRoot(process.env.UPLOADS_DIR ?? "./data/uploads"),
  adminDist: path.resolve(SERVER_ROOT, "../admin/dist"),
  maxPhotoBytes: 25 * 1024 * 1024,
};
