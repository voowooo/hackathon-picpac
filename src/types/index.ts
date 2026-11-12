import type { Ionicons } from "@expo/vector-icons";
import type React from "react";
import type { View } from "react-native";

// Необязательное хранилище. Без пакета черновики живут до закрытия приложения.
export type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// ——— Типы ———
export type BookTemplate = { id: string; name: string; description: string; titleStyle: "overlay" | "band" };

export type MockOrder = {
  id: string; title: string; scenario: string; status: string; statusIndex: number;
  total: number; previewUri: string; date: string; items: string;
  /** Заказ отменён менеджером (приходит с сервера). */
  cancelled?: boolean;
};

export type ScenarioCard = { id: string; title: string; subtitle: string; productHint: "print" | "photobook" | "gift"; cover: string };

export type PrintFormat = { id: string; label: string; pricePer: number; ratio: number };

export type BookLine = { id: string; name: string; desc: string; formats: string[]; basePrice: number };

export type PosterSize = { id: string; label: string; price: number };

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

// ——— Варианты сетки разворота: ячейки в долях ширины (0…2) и высоты (0…1) ———
export type LayoutCell = { x: number; y: number; w: number; h: number };

export type SpreadLayout = { id: string; name: string; cells: LayoutCell[] };

// ——— AI-функции (заглушки): цена за каждое фото ———
export type AITool = { id: string; title: string; desc: string; icon: IconName; price: number };

export type Screen = "home" | "productPicker" | "photoPicker" | "bookSetup" | "builder" | "checkout" | "orders" | "profile";

export type ProductCategory = "print" | "photobook" | "poster" | "postcard";

export type PaperType = "matte" | "glossy";

export type PosterOrientation = "portrait" | "landscape";

export type Panel = "products" | "settings" | "photos" | "ai";

export type PhotoEdit = { rotation: number; crop?: { x: number; y: number; w: number; h: number } };
export type PhotoQuality = { brightness: number; contrast: number; sharpness: number; clipped: number; score: number; issues: string[]; maxPrintWidthCm: number; maxPrintHeightCm: number };
export type PhotoProcessingUpdate = { processingBaseUri?: string | null; width: number; height: number; quality?: PhotoQuality };

export type Photo = { id: string; uri: string; originalUri?: string; processingBaseUri?: string; quality?: PhotoQuality; edit?: PhotoEdit; width?: number; height?: number; timestamp?: number; geo?: { lat: number; lng: number } };

export type PhotoSlot = { id: string; photoId?: string; printFinish?: PrintFinish; printFormatId?: string };

export type ViewRef = React.ComponentRef<typeof View>;

export type DropRect = { id: string; x: number; y: number; w: number; h: number };

export type PrintFinish = { margin: number; marginColor: string; frame: number; frameColor: string };

export type ProductConfig = {
  category: ProductCategory; printFormatId: string; paper: PaperType; copies: number;
  bookLineId: string; bookFormat: string; spreads: number; coverColorId: string; bookTemplateId: string; bookTitle: string;
  // Оформление обложки: показ названия, цвет текста и стиль фото (на весь лист или в рамке).
  coverShowTitle?: boolean; coverTitleColor?: string;
  coverStyle?: "full" | "framed"; coverFrameWidth?: number; coverFrameColor?: string;
  posterOrientation: PosterOrientation; posterSizeId: string; postcardTemplateId: string; postcardCaption: string;
  slots: PhotoSlot[]; printFinish?: PrintFinish; posterFinish?: PrintFinish;
  aiTools?: string[];
  // Макет сетки каждого разворота (индекс = разворот − 1)
  spreadLayouts?: string[];
};

export type Draft = { id: string; name: string; savedAt: number; cfg: ProductConfig; photos: Photo[]; scenarioTitle?: string; bookPage: number };

export type MockupProps = {
  cfg: ProductConfig; photos: Photo[]; selectedSlotId?: string | null; swapSlotId?: string | null; onSlotPress?: (slotId: string) => void;
};

export type FlatPreviewProps = MockupProps & {
  bookPage: number; onBookPage: (n: number) => void;
  registerSlot?: (slotId: string, ref: ViewRef | null) => void;
  dropTargetId?: string | null;
  onTextPress?: (field: "postcardCaption" | "bookTitle") => void;
  onInteractionChange?: (active: boolean) => void;
};
