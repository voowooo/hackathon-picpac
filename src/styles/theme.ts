

// ═══════════════════════════ Тема ═══════════════════════════
// Палитра: красный акцент, тёмно-зелёный текст, кремовый фон,
// пастельные заливки и приглушённые цветные акценты.
export const colors = {
  bg: "#F6EFE6", card: "#FFFFFF", text: "#364C49", textSecondary: "#7A8A84", accent: "#DD5757",
  /** Активная вкладка нижнего меню — насыщеннее базового красного. */
  accentBright: "#F03B3B",
  accentSoft: "#EDD5D5", accentYellow: "#E8996C", border: "#CCC7BF", danger: "#DD5757", safe: "#5A9E6F", stage: "#EFE6D9",
  ai: "#8C71D8", aiSoft: "#E0DCE8",
  // Пастельные заливки и цветные акценты (теги, шапки карточек, иконки)
  pastelPink: "#EDD5D5", pastelMint: "#C4DAD6", pastelBlue: "#CFDDE7", pastelLilac: "#E0DCE8", pastelSand: "#EDE1D5",
  accentOrange: "#E8996C", accentBlue: "#568CDE", accentPurple: "#8C71D8",
};

// Цикл пастельных заливок — для «цветных шапок» карточек и тегов.
export const PASTELS = [colors.pastelPink, colors.pastelMint, colors.pastelBlue, colors.pastelLilac, colors.pastelSand];

// Акцент под каждую пастель (цвет иконки/текста на заливке).
export const PASTEL_INK = ["#DD5757", "#364C49", "#568CDE", "#8C71D8", "#E8996C"];

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 12, md: 20, lg: 24 };

// Цвета текста названия на обложке.
export const COVER_TITLE_COLORS = ["#FFFFFF", "#2D2A26", "#2D6553", "#C97B63", "#FFD166"];

// Цвета рамки: палитра обложек + белый и графит.
export const COVER_FRAME_COLORS = ["#F5E6D3", "#FFFFFF", "#C97B63", "#8FA68E", "#5B7C8C", "#3D3A36"];

// Имена известных цветов для подсказок; всё прочее показываем как HEX — свой цвет.
export const COVER_COLOR_NAMES: Record<string, string> = {
  "#FFFFFF": "Белый", "#2D2A26": "Графит", "#2D6553": "Зелёный", "#C97B63": "Терракота", "#FFD166": "Золотистый",
  "#F5E6D3": "Кремовый", "#8FA68E": "Шалфей", "#5B7C8C": "Океан", "#3D3A36": "Графит",
};

export const COVER_FRAME_WIDTHS = [
  { width: 8, label: "Тонкая" },
  { width: 16, label: "Средняя" },
  { width: 28, label: "Широкая" },
];

// ═══════════════════════════ Стили ═══════════════════════════
export const shadow = { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 };
