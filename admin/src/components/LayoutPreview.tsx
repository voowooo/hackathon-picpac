import { AlertTriangle, ImageOff } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { slotLabel } from "../format";

// Превью макета «как у клиента»: геометрия повторяет src/config/catalog.ts приложения.
// Цель — чтобы менеджер увидел состав и порядок до печати, а не пиксель-в-пиксель копию.

type Finish = { margin?: number; marginColor?: string; frame?: number; frameColor?: string };
type Slot = { id: string; photoId?: string; printFormatId?: string; printFinish?: Finish };
export type PhotoInfo = { width?: number; height?: number; issues?: string[]; lowRes?: boolean };
type Cfg = Record<string, unknown> & {
  category?: string; slots?: Slot[]; spreadLayouts?: string[]; photoInfo?: Record<string, PhotoInfo>;
  printFinish?: Finish; posterFinish?: Finish;
};

const CELL = { x: 0, y: 0, w: 1, h: 1 };
const SPREAD_LAYOUTS: Record<string, { x: number; y: number; w: number; h: number }[]> = {
  full: [CELL, { ...CELL, x: 1 }],
  "big-left": [CELL, { x: 1, y: 0, w: 1, h: 0.5 }, { x: 1, y: 0.5, w: 1, h: 0.5 }],
  "big-right": [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 1, y: 0, w: 1, h: 1 }],
  quad: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 1, y: 0, w: 1, h: 0.5 }, { x: 1, y: 0.5, w: 1, h: 0.5 }],
  mosaic: [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 1, h: 0.4 }, { x: 1, y: 0, w: 0.5, h: 1 }, { x: 1.5, y: 0, w: 0.5, h: 1 }],
};
const COVER_COLORS: Record<string, string> = { cream: "#F5E6D3", terracotta: "#C97B63", sage: "#8FA68E", charcoal: "#3D3A36", ocean: "#5B7C8C" };
const POSTCARD_ACCENT: Record<string, { accent: string; tint: string }> = {
  classic: { accent: "#DD5757", tint: "#EDD5D5" }, botanical: { accent: "#364C49", tint: "#C4DAD6" }, minimal: { accent: "#364C49", tint: "#F6EFE6" },
};
const DEFAULT_FINISH: Required<Finish> = { margin: 2, marginColor: "#FFFFFF", frame: 0, frameColor: "#25382E" };

// «25×25», «30x40» → [25, 25]
const dims = (s: unknown): [number, number] | null => {
  const m = /(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/i.exec(String(s ?? ""));
  return m ? [parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))] : null;
};

export function qualityText(q: PhotoInfo | undefined) {
  if (!q) return "";
  return [...new Set([...(q.lowRes ? ["мало пикселей для формата"] : []), ...(q.issues ?? [])])].join(", ");
}

type Ctx = { urls: Map<string, string>; info: Record<string, PhotoInfo>; filled: Set<string> };

function Photo({ slotId, ctx, style, children }: { slotId: string; ctx: Ctx; style?: CSSProperties; children?: ReactNode }) {
  const url = ctx.urls.get(slotId);
  const warn = qualityText(ctx.info[slotId]);
  const expected = ctx.filled.has(slotId);
  const label = slotLabel(slotId);
  return (
    <div
      className={`lp-photo${url ? "" : expected ? " missing" : " empty"}`}
      style={{ ...style, backgroundImage: url ? `url("${url}")` : undefined }}
      title={`${label}${!url && expected ? " — фото не загружено" : ""}${warn ? ` — ${warn}` : ""}`}
    >
      {!url && expected ? <ImageOff size={16} /> : null}
      {warn ? <span className="lp-warn"><AlertTriangle size={12} /></span> : null}
      {children}
    </div>
  );
}

function finishStyle(f: Finish, scale: number): CSSProperties {
  const margin = Math.max(0, f.margin ?? 0) * scale;
  const frame = Math.max(0, f.frame ?? 0) * scale;
  return {
    padding: margin, background: f.marginColor ?? "#fff",
    boxShadow: frame ? `inset 0 0 0 ${frame}px ${f.frameColor ?? "#000"}` : undefined,
  };
}

export function LayoutPreview({ config, photos }: { config: Cfg; photos: { slotId: string | null; url: string }[] }) {
  const slots = Array.isArray(config.slots) ? config.slots : [];
  const ctx: Ctx = {
    urls: new Map(photos.filter((p) => p.slotId).map((p) => [p.slotId!, p.url] as const)),
    info: config.photoInfo ?? {},
    filled: new Set(slots.filter((s) => s.photoId).map((s) => s.id)),
  };

  switch (config.category) {
    case "photobook": {
      const [pw, ph] = dims(config.bookFormat) ?? [25, 25];
      const pageRatio = pw / ph;
      const coverBg = COVER_COLORS[String(config.coverColorId)] ?? "#F5E6D3";
      const framed = config.coverStyle === "framed";
      const spreads = Math.max(0, Number(config.spreads) || 0);
      const layouts = Array.isArray(config.spreadLayouts) ? config.spreadLayouts : [];
      return (
        <div className="lp-book">
          <figure className="lp-item">
            <div className="lp-cover" style={{ aspectRatio: `${pw} / ${ph}`, background: coverBg, padding: framed ? `${Number(config.coverFrameWidth ?? 14) / 3}%` : 0 }}>
              <Photo slotId="photobook-slot-cover" ctx={ctx} style={{ position: "absolute", inset: framed ? `${Number(config.coverFrameWidth ?? 14) / 3}%` : 0 }}>
                {config.coverShowTitle !== false && config.bookTitle ? (
                  <span className="lp-cover-title" style={{ color: String(config.coverTitleColor ?? "#fff") }}>{String(config.bookTitle)}</span>
                ) : null}
              </Photo>
            </div>
            <figcaption>Обложка</figcaption>
          </figure>
          {Array.from({ length: spreads }, (_, i) => {
            const page = i + 1;
            const cells = SPREAD_LAYOUTS[layouts[i]] ?? SPREAD_LAYOUTS.full;
            return (
              <figure key={page} className="lp-item">
                <div className="lp-spread" style={{ aspectRatio: `${2 * pageRatio} / 1` }}>
                  {cells.map((c, k) => (
                    <Photo
                      key={k}
                      slotId={`photobook-slot-${page}-${k}`}
                      ctx={ctx}
                      style={{ position: "absolute", left: `${(c.x / 2) * 100}%`, top: `${c.y * 100}%`, width: `${(c.w / 2) * 100}%`, height: `${c.h * 100}%` }}
                    />
                  ))}
                  <span className="lp-fold" />
                </div>
                <figcaption>Разворот {page}</figcaption>
              </figure>
            );
          })}
        </div>
      );
    }
    case "print": {
      const base: Finish = { ...DEFAULT_FINISH, ...config.printFinish };
      const copies = Math.max(1, Number(config.copies) || 1);
      return (
        <div className="lp-prints">
          {slots.filter((s) => s.photoId).map((s) => {
            const fmt = s.printFormatId ?? String(config.printFormatId ?? "10x15");
            const [w, h] = dims(fmt) ?? [10, 15];
            const q = ctx.info[s.id];
            // Ориентация отпечатка — по фото, если знаем его размеры.
            const landscape = q?.width && q?.height ? q.width > q.height : false;
            return (
              <figure key={s.id} className="lp-item">
                <div className="lp-print" style={{ aspectRatio: landscape ? `${h} / ${w}` : `${w} / ${h}`, ...finishStyle({ ...base, ...s.printFinish }, 1.2) }}>
                  <Photo slotId={s.id} ctx={ctx} style={{ width: "100%", height: "100%" }} />
                </div>
                <figcaption>{fmt.replace("x", "×")}{copies > 1 ? ` · ×${copies}` : ""}</figcaption>
              </figure>
            );
          })}
        </div>
      );
    }
    case "poster": {
      const [w, h] = dims(config.posterSizeId) ?? [30, 40];
      const landscape = config.posterOrientation === "landscape";
      const f: Finish = { ...DEFAULT_FINISH, margin: 10, ...config.posterFinish };
      return (
        <div className="lp-single">
          <div className="lp-poster" style={{ aspectRatio: landscape ? `${h} / ${w}` : `${w} / ${h}`, ...finishStyle(f, 0.6) }}>
            <Photo slotId="poster-slot-0" ctx={ctx} style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      );
    }
    case "postcard": {
      const t = POSTCARD_ACCENT[String(config.postcardTemplateId)] ?? POSTCARD_ACCENT.classic;
      return (
        <div className="lp-postcard" style={{ background: t.tint }}>
          <Photo slotId="postcard-slot-0" ctx={ctx} style={{ gridArea: "a" }} />
          <Photo slotId="postcard-slot-1" ctx={ctx} style={{ gridArea: "b" }} />
          <p style={{ color: t.accent }}>{String(config.postcardCaption ?? "")}</p>
        </div>
      );
    }
    default:
      return <p className="muted">Для этого типа продукта превью нет.</p>;
  }
}
