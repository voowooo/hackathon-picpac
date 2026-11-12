const moneyFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("ru-RU");
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Minsk" });
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Minsk" });
const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Minsk" });

export const money = (n: number) => `${moneyFmt.format(n)} BYN`;
export const int = (n: number) => intFmt.format(n);
export const dateTime = (ms: number) => dateTimeFmt.format(new Date(ms));
export const date = (ms: number) => dateFmt.format(new Date(ms));
export const day = (ms: number) => dayFmt.format(new Date(ms)).replace(".", "");
export const bytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);

// Человекочитаемое имя ячейки макета — так же, как в паспорте заказа на сервере.
export function slotLabel(slotId: string): string {
  let m: RegExpExecArray | null;
  if (slotId === "photobook-slot-cover") return "обложка";
  if ((m = /^photobook-slot-(\d+)-(\d+)$/.exec(slotId))) return `разворот ${m[1]}, ячейка ${Number(m[2]) + 1}`;
  if ((m = /^print-slot-(\d+)$/.exec(slotId))) return `отпечаток ${Number(m[1]) + 1}`;
  if (/^poster-slot-/.test(slotId)) return "постер";
  if ((m = /^postcard-slot-(\d+)$/.exec(slotId))) return `открытка, фото ${Number(m[1]) + 1}`;
  return slotId;
}
