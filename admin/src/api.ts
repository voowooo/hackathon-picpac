// Тонкий клиент к API PicPac. Токен админа храним в localStorage.
const TOKEN_KEY = "picpac.admin.token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const auth = {
  get token() {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    try {
      const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: number };
      return expiresAt > Date.now() ? token : null;
    } catch {
      return null;
    }
  },
  save(token: string, expiresAt: number) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const token = auth.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method: init.method ?? "GET", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  if (res.status === 401 && path !== "/admin/login") {
    auth.clear();
    onUnauthorized();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Ошибка ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ——— Типы ответов ———
export type Order = {
  id: string; clientId: string; createdAt: number; updatedAt: number; statusIndex: number; status: string; cancelled: boolean;
  category: string; categoryLabel: string; title: string; scenario: string; items: string;
  customer: { name: string; phone: string; address: string };
  delivery: { id: string; label: string; price: number };
  payment: { id: string; label: string };
  promoCode: string | null; subtotal: number; discount: number; total: number; photoCount: number; previewUrl: string | null; adminNote: string;
};

export type OrderDetail = Order & {
  photos: { id: number; slotId: string | null; url: string; originalName: string | null; size: number; createdAt: number }[];
  events: { id: number; createdAt: number; kind: string; statusIndex: number | null; status: string | null; note: string; actor: string }[];
  config: Record<string, unknown>;
};

export type Stats = {
  totals: { orders: number; revenue: number; avgCheck: number; active: number; cancelled: number };
  period: { days: number; orders: number; revenue: number; avgCheck: number; prevOrders: number; prevRevenue: number };
  byStatus: { statusIndex: number; label: string; count: number }[];
  byCategory: { category: string; label: string; count: number; revenue: number }[];
  daily: { day: number; orders: number; revenue: number }[];
  promos: { code: string; orders: number; discount: number; revenue: number }[];
  recent: Order[];
};

export type FieldType = "text" | "number" | "list";
export type KindSchema = { title: string; fields: { key: string; label: string; type: FieldType; hint?: string }[] };
export type CatalogItem = { kind: string; id: string; sort: number; active: boolean; data: Record<string, unknown> };
export type CatalogResponse = { kinds: Record<string, KindSchema>; settingsSchema: KindSchema; items: CatalogItem[]; prices: Record<string, number> };

export type Promo = {
  code: string; description: string; discountPercent: number; active: boolean; maxUses: number | null; usedCount: number;
  expiresAt: number | null; createdAt: number; problem: string | null;
};

export const ORDER_STATUSES = ["Принят", "В печати", "Готов", "В пути", "Доставлен"];
export const CATEGORIES: Record<string, string> = { print: "Фотопечать", photobook: "Фотокнига", poster: "Постер", postcard: "Открытка" };

// Скачивание файла с авторизацией: fetch → blob → временная ссылка.
export async function downloadFile(path: string, init: { method?: string; body?: unknown } = {}) {
  const token = auth.token;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, { method: init.method ?? "GET", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  if (res.status === 401) {
    auth.clear();
    onUnauthorized();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Ошибка ${res.status}`);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="([^"]+)"/i.exec(disposition)?.[1];
  const filename = utf ? decodeURIComponent(utf) : plain ?? "download";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { filename, size: blob.size, headers: res.headers };
}
