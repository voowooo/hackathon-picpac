// Общие типы и расчёт цены. Логика повторяет src/domain/products.ts приложения,
// но цены берутся из базы — клиенту не доверяем сумму заказа.

export const ORDER_STATUSES = ["Принят", "В печати", "Готов", "В пути", "Доставлен"] as const;
export const ORDER_STATUS_IDS = ["accepted", "printing", "ready", "shipping", "delivered"] as const;
export const LAST_STATUS = ORDER_STATUSES.length - 1;

export const CATEGORIES = ["print", "photobook", "poster", "postcard"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  print: "Фотопечать",
  photobook: "Фотокнига",
  poster: "Постер",
  postcard: "Открытка",
};

export type PrintFormat = { id: string; label: string; pricePer: number; ratio: number };
export type BookLine = { id: string; name: string; desc: string; formats: string[]; basePrice: number };
export type PosterSize = { id: string; label: string; price: number };
export type DeliveryOption = { id: string; label: string; eta: string; price: number };
export type Prices = { spreadPrice: number; postcardPrice: number };

export type Catalog = {
  printFormats: PrintFormat[];
  bookLines: BookLine[];
  posterSizes: PosterSize[];
  deliveryOptions: DeliveryOption[];
  prices: Prices;
};

export const PAYMENT_OPTIONS: Record<string, string> = { card: "Банковская карта", erip: "ЕРИП", cash: "При получении" };

// Минимальная форма ProductConfig из приложения — только поля, влияющие на цену.
export type OrderConfig = {
  category: Category;
  printFormatId?: string;
  copies?: number;
  bookLineId?: string;
  bookFormat?: string;
  spreads?: number;
  posterSizeId?: string;
  slots?: { id: string; photoId?: string; printFormatId?: string }[];
  [key: string]: unknown;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export class PriceError extends Error {}

export function computeSubtotal(cfg: OrderConfig, catalog: Catalog): number {
  const copies = Math.max(1, Math.min(999, Math.floor(Number(cfg.copies ?? 1)) || 1));
  const slots = Array.isArray(cfg.slots) ? cfg.slots : [];
  switch (cfg.category) {
    case "print": {
      let sum = 0;
      for (const s of slots) {
        if (!s?.photoId) continue;
        const fmt = catalog.printFormats.find((f) => f.id === (s.printFormatId ?? cfg.printFormatId));
        if (!fmt) throw new PriceError(`Формат печати недоступен: ${s.printFormatId ?? cfg.printFormatId}`);
        sum += fmt.pricePer;
      }
      if (!sum) throw new PriceError("В заказе нет фото");
      return round2(sum * copies);
    }
    case "photobook": {
      const line = catalog.bookLines.find((l) => l.id === cfg.bookLineId);
      if (!line) throw new PriceError(`Линейка фотокниг недоступна: ${cfg.bookLineId}`);
      const spreads = Math.max(1, Math.min(100, Math.floor(Number(cfg.spreads ?? 0)) || 0));
      return round2(line.basePrice + spreads * catalog.prices.spreadPrice);
    }
    case "poster": {
      const size = catalog.posterSizes.find((p) => p.id === cfg.posterSizeId);
      if (!size) throw new PriceError(`Размер постера недоступен: ${cfg.posterSizeId}`);
      return round2(size.price);
    }
    case "postcard":
      return round2(catalog.prices.postcardPrice * copies);
    default:
      throw new PriceError("Неизвестный тип продукта");
  }
}

export function productTitle(cfg: OrderConfig, catalog: Catalog): string {
  switch (cfg.category) {
    case "print": return `Фотопечать ${catalog.printFormats.find((x) => x.id === cfg.printFormatId)?.label ?? ""}`.trim();
    case "photobook": return `Фотокнига ${catalog.bookLines.find((x) => x.id === cfg.bookLineId)?.name ?? ""} ${cfg.bookFormat ?? ""}`.trim();
    case "poster": return `Постер ${catalog.posterSizes.find((x) => x.id === cfg.posterSizeId)?.label ?? ""}`.trim();
    case "postcard": return "Открытка";
    default: return "Продукт PicPac";
  }
}

export { round2 };
