import Constants from "expo-constants";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
// Нативная multipart-загрузка: RN-шный fetch с FormData { uri, type } на телефоне
// часто падает (new architecture), uploadAsync идёт через нативный URLSession.
import * as FileSystem from "expo-file-system/legacy";
import { COVER_URLS } from "../config/catalog";
import type { MockOrder, Photo, ProductConfig } from "../types/index";
import { storage } from "./storage";

// ═══════════════ Клиент API PicPac ═══════════════
// Адрес сервера:
//   1) EXPO_PUBLIC_API_URL, если задан (например, http://192.168.1.5:4000);
//   2) иначе тот же хост, что у Metro (Expo Go / web), порт 4000.
// Если сервер недоступен, приложение остаётся на локальных моках.

const API_PORT = 4000;
const TIMEOUT_MS = 5000;

function resolveBaseUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (env === "off") return null;
  if (env) return env.replace(/\/+$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  // Через туннель (*.exp.direct) до локального сервера не достучаться — нужен EXPO_PUBLIC_API_URL.
  if (!host || host.endsWith(".exp.direct")) return null;
  return `http://${host}:${API_PORT}`;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API не настроен");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API_URL}/api${path}`, { ...init, signal: ctrl.signal });
    const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | undefined)?.error ?? `Ошибка сервера ${res.status}`);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "Сервер недоступен");
  } finally {
    clearTimeout(timer);
  }
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ——— Идентификатор устройства: по нему сервер отдаёт «мои заказы» ———
const CLIENT_ID_KEY = "picpac.clientId.v1";
let clientIdPromise: Promise<string> | null = null;

export function getClientId(): Promise<string> {
  clientIdPromise ??= (async () => {
    const saved = await storage?.getItem(CLIENT_ID_KEY).catch(() => null);
    if (saved) return saved;
    const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await storage?.setItem(CLIENT_ID_KEY, id).catch(() => { });
    return id;
  })();
  return clientIdPromise;
}

// ——— Каталог ———
export type RemoteCatalog = {
  printFormats: { id: string; label: string; pricePer: number; ratio: number }[];
  bookLines: { id: string; name: string; desc: string; formats: string[]; basePrice: number }[];
  posterSizes: { id: string; label: string; price: number }[];
  deliveryOptions: { id: string; label: string; eta: string; price: number }[];
  prices: { spreadPrice: number; postcardPrice: number };
};

export const fetchCatalog = () => request<RemoteCatalog>("/catalog");

// ——— Промокоды ———
export type PromoCheck = { valid: true; code: string; discountPercent: number } | { valid: false; code: string; error: string };

export const validatePromo = (code: string) => request<PromoCheck>("/promo/validate", json({ code }));

// ——— Заказы ———
export type RemoteOrder = MockOrder & { cancelled?: boolean };

// Относительные ссылки на фото с сервера превращаем в абсолютные.
const absolutize = (o: RemoteOrder): RemoteOrder => ({
  ...o,
  previewUri: !o.previewUri ? COVER_URLS[0] : o.previewUri.startsWith("/") && API_URL ? `${API_URL}${o.previewUri}` : o.previewUri,
});

export async function fetchOrders(): Promise<RemoteOrder[]> {
  const clientId = await getClientId();
  const list = await request<RemoteOrder[]>(`/orders?clientId=${encodeURIComponent(clientId)}`);
  return list.map(absolutize);
}

export type CreateOrderPayload = {
  config: ProductConfig;
  scenario: string;
  items: string;
  photoCount: number;
  recipient: { name: string; phone: string; address: string };
  deliveryId: string;
  paymentId: string;
  promoCode?: string;
  clientTotal: number;
  photoInfo?: Record<string, unknown>;
};

export async function createOrder(payload: CreateOrderPayload): Promise<RemoteOrder> {
  const clientId = await getClientId();
  // Внутри конфигурации — только ссылки на фото по id; сами файлы уходят отдельно.
  return absolutize(await request<RemoteOrder>("/orders", json({ ...payload, clientId }), 10000));
}

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

// Форматы, которые браузер админки точно покажет. Остальное (HEIC/HEIF с iPhone и т.п.)
// перекодируем в JPEG на телефоне: сервер примет и HEIC, но в Chrome он не отобразится.
const BROWSER_SAFE = new Set(["jpg", "jpeg", "png", "webp"]);
// Длинная сторона после перекодирования: хватает на постер 50×70 при ~200 dpi.
const MAX_UPLOAD_SIDE = 6000;

type UploadFile = { uri: string; name: string; type: string };

async function prepareNativeUpload(photo: Photo): Promise<UploadFile> {
  const ext = (/\.(\w+)(?:\?|$)/.exec(photo.uri)?.[1] ?? "").toLowerCase();
  if (BROWSER_SAFE.has(ext)) return { uri: photo.uri, name: `${photo.id}.${ext}`, type: MIME_BY_EXT[ext] };
  try {
    const ctx = ImageManipulator.manipulate(photo.uri);
    const longest = Math.max(photo.width ?? 0, photo.height ?? 0);
    if (longest > MAX_UPLOAD_SIDE && photo.width && photo.height) {
      const k = MAX_UPLOAD_SIDE / longest;
      ctx.resize({ width: Math.round(photo.width * k), height: Math.round(photo.height * k) });
    }
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    image.release();
    ctx.release();
    return { uri: saved.uri, name: `${photo.id}.jpg`, type: "image/jpeg" };
  } catch {
    // Не смогли перекодировать — отправляем как есть, это лучше, чем ничего.
    return { uri: photo.uri, name: `${photo.id}.${ext || "jpg"}`, type: MIME_BY_EXT[ext] ?? "image/jpeg" };
  }
}

async function uploadOne(orderId: string, clientId: string, slotId: string, photo: Photo) {
  const path = `/orders/${encodeURIComponent(orderId)}/photos`;
  if (Platform.OS === "web") {
    const form = new FormData();
    form.append("slotId", slotId);
    const blob = await (await fetch(photo.uri)).blob();
    const type = blob.type || "image/jpeg";
    form.append("photo", new Blob([blob], { type }), `${photo.id}.${type.split("/")[1] ?? "jpg"}`);
    await request(path, { method: "POST", headers: { "X-Client-Id": clientId }, body: form }, 90000);
  } else {
    // React Native: нативная загрузка файла по uri через URLSession — fetch + FormData
    // на устройстве молча обрывается и фото в админку не доходят.
    if (!API_URL) throw new ApiError(0, "API не настроен");
    const file = await prepareNativeUpload(photo);
    const res = await FileSystem.uploadAsync(`${API_URL}/api${path}`, file.uri, {
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "photo",
      mimeType: file.type,
      parameters: { slotId },
      httpMethod: "POST",
      // FOREGROUND: загрузка завершится, пока открыт экран заказов.
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: { "X-Client-Id": clientId },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new ApiError(res.status, res.body?.slice(0, 200) || `Сервер ответил ${res.status}`);
    }
  }
}

// Загружаем фото из ячеек макета по одному, с повторами; ошибки не прерывают остальные загрузки.
export async function uploadOrderPhotos(orderId: string, cfg: ProductConfig, photos: Photo[]) {
  const clientId = await getClientId();
  const jobs = cfg.slots.filter((s) => s.photoId).map((s) => ({ slotId: s.id, photo: photos.find((p) => p.id === s.photoId) })).filter((j) => j.photo);
  let ok = 0;
  let lastError: string | null = null;
  for (const { slotId, photo } of jobs) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await uploadOne(orderId, clientId, slotId, photo!);
        ok += 1;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        // Пишем в лог Metro, чтобы по телефону понять, почему фото не доехало.
        console.warn(`[uploadOrderPhotos] попытка ${attempt} для ${photo!.id}:`, lastError);
        // Ошибку проверки (формат, размер) повторять бессмысленно.
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) break;
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
  }
  return { ok, total: jobs.length, error: ok < jobs.length ? lastError : null };
}
