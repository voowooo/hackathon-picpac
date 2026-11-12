import { COVER_COLOR_NAMES } from '../styles/theme';

// ═══════════════════════════ Помощники ═══════════════════════════
export const money = (n: number) => `${n.toFixed(2).replace(".", ",")} BYN`;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Русские склонения: plural(2, "заказ", "заказа", "заказов") → «заказа». */
export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 11 || m100 > 14)) return few;
  return many;
}

/** «фото 2», «фото 2 и 5», «фото 2, 3 и 5» — порядковые номера в списке снимков. */
export function formatListedPhotoNumbers(nums: number[]): string {
  const unique = [...new Set(nums)].filter((n) => n > 0).sort((a, b) => a - b);
  if (unique.length === 0) return "фото";
  if (unique.length === 1) return `фото ${unique[0]}`;
  if (unique.length === 2) return `фото ${unique[0]} и ${unique[1]}`;
  return `фото ${unique.slice(0, -1).join(", ")} и ${unique[unique.length - 1]}`;
}

export const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function formatDraftDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseRatio(fmt: string): number {
  const [w, h] = fmt.split("×").map(Number);
  return w && h ? w / h : 1;
}

export function parseHexColor(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const full = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (full) return `#${full[1].toUpperCase()}`;
  const short = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (!short) return null;
  const [r, g, b] = short[1];
  return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
}

export function normalizeHexColor(value?: string | null, fallback = "#FFFFFF") {
  return parseHexColor(value) ?? fallback;
}

export function hexColorsEqual(a?: string | null, b?: string | null) {
  const left = parseHexColor(a);
  const right = parseHexColor(b);
  return !!left && !!right && left === right;
}

export function isDark(hex: string) {
  const n = parseInt(normalizeHexColor(hex, "#FFFFFF").slice(1), 16);
  if (!Number.isFinite(n)) return false;
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 150;
}

export function colorName(value?: string): string {
  const hex = parseHexColor(value);
  if (!hex) return "—";
  return COVER_COLOR_NAMES[hex] ?? hex;
}
