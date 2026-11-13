import { ImageSourcePropType } from "react-native";
import { BookLine, BookTemplate, IconName, MockOrder, PosterSize, PrintFinish, PrintFormat, ProductCategory, ScenarioCard, SpreadLayout } from '../types/index';
import { money } from '../utils/format';

export const COVER_URLS: string[] = [
  "https://images.unsplash.com/photo-1527529482834-4699949fddd0?w=600",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600",
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=600",
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600",
  "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=600",
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600",
];

export const SCENARIOS: ScenarioCard[] = [
  { id: "georgia", title: "Поездка в Грузию", subtitle: "Фотокнига из отпуска", productHint: "photobook", cover: COVER_URLS[4] },
  { id: "baby", title: "Первый год малыша", subtitle: "Нежный альбом", productHint: "photobook", cover: COVER_URLS[1] },
  { id: "archive", title: "Семейный архив", subtitle: "Классическая печать", productHint: "print", cover: COVER_URLS[5] },
  { id: "gift", title: "Подарок маме", subtitle: "Открытка с фото", productHint: "gift", cover: COVER_URLS[2] },
];

export const BOOK_TEMPLATES: BookTemplate[] = [
  { id: "warm-minimal", name: "Тёплый минимализм", description: "Подпись поверх фото", titleStyle: "overlay" },
  { id: "travel-story", name: "История путешествия", description: "Подпись поверх фото", titleStyle: "overlay" },
  { id: "family-classic", name: "Семейная классика", description: "Подпись на цветной полосе", titleStyle: "band" },
  { id: "baby-soft", name: "Нежность", description: "Подпись на цветной полосе", titleStyle: "band" },
  { id: "premium-spread", name: "Премиум", description: "Подпись поверх фото", titleStyle: "overlay" },
];

export const BOOK_LINES: BookLine[] = [
  { id: "lite", name: "Lite", desc: "Твёрдая обложка, гибкие страницы, до 160 стр.", formats: ["21×30", "20×20", "25×25"], basePrice: 49.9 },
  { id: "classic", name: "Classic", desc: "Плотные страницы, раскрытие 180°, до 60 стр.", formats: ["21×30", "20×20"], basePrice: 69.9 },
  { id: "premium", name: "Premium", desc: "Матовая бумага, плотные развороты, твёрдая обложка", formats: ["21×30", "20×20", "25×25", "30×20", "30×30"], basePrice: 99.9 },
];

// Иконки-превью линеек (экран «Оформление фотокниги»): PNG в assets/books.
// Замените файл, сохранив имя, — Metro подхватит новую картинку без правок кода.
export const BOOK_LINE_IMAGES: Record<string, ImageSourcePropType> = {
  lite: require("../../assets/books/lite.png"),
  classic: require("../../assets/books/classic.png"),
  premium: require("../../assets/books/premium.png"),
};

export const SPREAD_LAYOUTS: SpreadLayout[] = [
  { id: "full", name: "По одному", cells: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }] },
  { id: "big-left", name: "Большое слева", cells: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 0.5 }, { x: 1, y: 0.5, w: 1, h: 0.5 }] },
  { id: "big-right", name: "Большое справа", cells: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 1, y: 0, w: 1, h: 1 }] },
  { id: "quad", name: "Сетка 2×2", cells: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 1, y: 0, w: 1, h: 0.5 }, { x: 1, y: 0.5, w: 1, h: 0.5 }] },
  { id: "mosaic", name: "Мозаика", cells: [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 1, h: 0.4 }, { x: 1, y: 0, w: 0.5, h: 1 }, { x: 1.5, y: 0, w: 0.5, h: 1 }] },
];

export const COVER_COLORS = [
  { id: "cream", color: "#F5E6D3", label: "Кремовый" },
  { id: "terracotta", color: "#C97B63", label: "Терракота" },
  { id: "sage", color: "#8FA68E", label: "Шалфей" },
  { id: "charcoal", color: "#3D3A36", label: "Графит" },
  { id: "ocean", color: "#5B7C8C", label: "Океан" },
];

export const POSTCARD_TEMPLATES = [
  { id: "classic", name: "Классика", accent: "#DD5757", tint: "#EDD5D5" },
  { id: "botanical", name: "Ботаника", accent: "#364C49", tint: "#C4DAD6" },
  { id: "minimal", name: "Минимум", accent: "#364C49", tint: "#F6EFE6" },
];

export const PRINT_FORMATS: PrintFormat[] = [
  { id: "10x15", label: "10×15 см", pricePer: 0.65, ratio: 2 / 3 },
  { id: "15x20", label: "15×20 см", pricePer: 2.4, ratio: 3 / 4 },
  { id: "20x30", label: "20×30 см", pricePer: 5.9, ratio: 2 / 3 },
];

export const POSTER_SIZES: PosterSize[] = [
  { id: "30x40", label: "30×40 см", price: 24.9 },
  { id: "40x60", label: "40×60 см", price: 39.9 },
  { id: "50x70", label: "50×70 см", price: 54.9 },
];

export const INITIAL_ORDERS: MockOrder[] = [
  { id: "ord-1042", title: "Фотокнига Lite 25×25", scenario: "Поездка в Грузию", status: "printing", statusIndex: 1, total: 69.3, previewUri: COVER_URLS[2], date: "28 окт 2026", items: "12 разворотов · шаблон «История путешествия»" },
  { id: "ord-1031", title: "Фотопечать 10×15", scenario: "Семейный архив", status: "delivered", statusIndex: 4, total: 12.35, previewUri: COVER_URLS[5], date: "12 сен 2026", items: "19 отпечатков · матовая бумага" },
  { id: "ord-1028", title: "Открытка", scenario: "Подарок маме", status: "ready", statusIndex: 2, total: 23.4, previewUri: COVER_URLS[14], date: "5 сен 2026", items: "5 открыток · стиль «Ботаника»" },
];

export const ORDER_STATUSES: string[] = ["Принят", "В печати", "Готов", "В пути", "Доставлен"];

export const STATUS_ICONS: IconName[] = ["receipt-outline", "print-outline", "cube-outline", "car-outline", "home-outline"];

export const STATUS_TEXT: string[] = [
  "Заказ принят, проверяем макет",
  "Печатаем ваш заказ",
  "Заказ упакован и готов к отправке",
  "Курьер уже везёт ваш заказ",
  "Заказ доставлен. Приятного просмотра!",
];

export const STATUS_ETA: string[] = ["Ожидаем: 3–4 дня", "Ожидаем: 2–3 дня", "Отправим сегодня или завтра", "Ожидаем: сегодня", "Доставлен"];

export const DELIVERY_OPTIONS = [
  { id: "courier", label: "Курьер по Минску", eta: "1–2 дня", price: 5.0 },
  { id: "belpost", label: "Белпочта", eta: "3–5 дней", price: 3.5 },
  { id: "ems", label: "EMS", eta: "2–3 дня", price: 12.0 },
];

export const PAYMENT_OPTIONS = [
  { id: "card", label: "Банковская карта" },
  { id: "erip", label: "ЕРИП" },
  { id: "cash", label: "При получении" },
];

export const PROMO_CODE = "PICPAC10";

export const PROMO_DISCOUNT = 0.1;

export const MIN_SPREADS = 2;

export const MAX_SPREADS = 20;

// Цены, которые не привязаны к позиции каталога. Объект (а не константы),
// чтобы applyRemoteCatalog мог обновить их значениями с сервера.
export const PRICES = { postcard: 3.9, spread: 1.2 };

export const DEFAULT_PRINT_FINISH: PrintFinish = { margin: 2, marginColor: "#FFFFFF", frame: 0, frameColor: "#25382E" };

export const PRINT_COLORS = [
  { name: "Белый", value: "#FFFFFF" }, { name: "Кремовый", value: "#F5E6D3" }, { name: "Серый", value: "#9DA7A0" },
  { name: "Чёрный", value: "#25382E" }, { name: "Зелёный", value: "#6C9278" }, { name: "Синий", value: "#557FAD" },
  { name: "Красный", value: "#BD5D54" }, { name: "Розовый", value: "#E8B5C4" }, { name: "Жёлтый", value: "#E5C36A" },
  { name: "Лиловый", value: "#A99AC4" },
];

export const PRODUCT_TABS: { id: ProductCategory; label: string; short: string; icon: IconName; blurb: string; from: string }[] = [
  { id: "print", label: "Фотопечать", short: "Печать", icon: "print-outline", blurb: "Классические отпечатки", from: `от ${money(PRINT_FORMATS[0].pricePer)}` },
  { id: "photobook", label: "Фотокнига", short: "Книга", icon: "book-outline", blurb: "История в разворотах", from: `от ${money(BOOK_LINES[0].basePrice)}` },
  { id: "poster", label: "Постер", short: "Постер", icon: "image-outline", blurb: "Одно фото на стену", from: `от ${money(POSTER_SIZES[0].price)}` },
  { id: "postcard", label: "Открытка", short: "Открытка", icon: "mail-outline", blurb: "Фото и тёплые слова", from: `от ${money(PRICES.postcard)}` },
];

export const HINT_TO_CATEGORY: Record<string, ProductCategory> = { print: "print", photobook: "photobook", gift: "postcard" };

// ═══════════ Каталог с сервера ═══════════
// Массивы выше импортируются по всему приложению, поэтому серверные данные
// подставляем в них «на месте» — без правок каждого экрана. Если сервер
// недоступен, остаются значения по умолчанию из этого файла.
type RemoteCatalogData = {
  printFormats: PrintFormat[]; bookLines: BookLine[]; posterSizes: PosterSize[];
  deliveryOptions: { id: string; label: string; eta: string; price: number }[];
  prices: { spreadPrice: number; postcardPrice: number };
};

const replaceAll = <T,>(target: T[], next: T[] | undefined) => {
  if (!Array.isArray(next) || !next.length) return;
  target.splice(0, target.length, ...next);
};

export function applyRemoteCatalog(c: RemoteCatalogData) {
  replaceAll(PRINT_FORMATS, c.printFormats);
  replaceAll(BOOK_LINES, c.bookLines);
  replaceAll(POSTER_SIZES, c.posterSizes);
  replaceAll(DELIVERY_OPTIONS, c.deliveryOptions);
  if (Number.isFinite(c.prices?.postcardPrice)) PRICES.postcard = c.prices.postcardPrice;
  if (Number.isFinite(c.prices?.spreadPrice)) PRICES.spread = c.prices.spreadPrice;
  const minPrint = Math.min(...PRINT_FORMATS.map((f) => f.pricePer));
  const minBook = Math.min(...BOOK_LINES.map((b) => b.basePrice));
  const minPoster = Math.min(...POSTER_SIZES.map((p) => p.price));
  const from: Record<ProductCategory, number> = { print: minPrint, photobook: minBook, poster: minPoster, postcard: PRICES.postcard };
  for (const tab of PRODUCT_TABS) tab.from = `от ${money(from[tab.id])}`;
}
