import Constants from "expo-constants";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
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

// Загружаем фото из ячеек макета по одному файлу; ошибки не прерывают остальные загрузки.
export async function uploadOrderPhotos(orderId: string, cfg: ProductConfig, photos: Photo[]) {
  const clientId = await getClientId();
  const jobs = cfg.slots.filter((s) => s.photoId).map((s) => ({ slotId: s.id, photo: photos.find((p) => p.id === s.photoId) })).filter((j) => j.photo);
  let ok = 0;
  for (const { slotId, photo } of jobs) {
    let uri = photo!.uri;
    let ext = (/\.(\w+)(?:\?|$)/.exec(uri)?.[1] ?? "jpg").toLowerCase();
    try {
      // iPhone-фото могут прийти как HEIC: сервер сохранит файл, но превью
      // в админке (браузер) его не отрисует — перекодируем в JPEG до загрузки.
      if (Platform.OS !== "web" && (ext === "heic" || ext === "heif")) {
        const jpeg = await manipulateAsync(uri, [], { compress: 0.85, format: SaveFormat.JPEG });
        uri = jpeg.uri;
        ext = "jpg";
      }
      const mime = MIME_BY_EXT[ext] ?? "image/jpeg";
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        const type = blob.type || mime;
        const form = new FormData();
        form.append("slotId", slotId);
        form.append("photo", new Blob([blob], { type }), `${photo!.id}.${type.split("/")[1] ?? "jpg"}`);
        await request(`/orders/${encodeURIComponent(orderId)}/photos`, { method: "POST", headers: { "X-Client-Id": clientId }, body: form }, 60000);
      } else {
        // React Native: нативная загрузка файла по uri — иначе fetch + FormData
        // на устройстве молча обрывается и фото в админку не доходят.
        const url = `${API_URL}/api/orders/${encodeURIComponent(orderId)}/photos`;
        if (!API_URL) throw new ApiError(0, "API не настроен");
        const res = await FileSystem.uploadAsync(url, uri, {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "photo",
          mimeType: mime,
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
      ok += 1;
    } catch (e) {
      // Ошибка одной фотографии не отменяет остальные; пишем её в лог Metro,
      // чтобы по телефону понять, почему фото не доехало до сервера.
      console.warn(`[uploadOrderPhotos] не удалось загрузить ${photo!.id} (${uri.slice(0, 60)}):`, e instanceof ApiError ? `${e.status} ${e.message}` : e);
    }
  }
  return { ok, total: jobs.length };
}
