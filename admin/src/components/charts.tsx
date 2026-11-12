import { useState } from "react";
import { day, int, money } from "../format";

// Выручка по дням: одна серия → колонки одного цвета, без легенды (её называет заголовок).
// Колонка ≤ 24px, скругление 4px только у вершины, подсказка при наведении на всю полосу дня.
export function RevenueChart({ data }: { data: { day: number; orders: number; revenue: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = innerW / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const peak = data.reduce((best, d, i) => (d.revenue > data[best].revenue ? i : best), 0);
  const h = hover != null ? data[hover] : null;
  // Подписи дат: не больше ~8 по оси, от последнего дня назад.
  const tickEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Выручка по дням за ${data.length} дн.`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
            <text x={pad.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{int(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const bh = Math.max(0, y(0) - y(d.revenue));
          const r = Math.min(4, bh / 2, barW / 2);
          const x0 = cx - barW / 2;
          const yTop = y(d.revenue);
          // Путь со скруглёнными верхними углами и прямым основанием.
          const path = bh > 0
            ? `M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${y(0)} Z`
            : "";
          return (
            <g key={d.day}>
              {hover === i ? <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} className="hover-band" /> : null}
              {path ? <path d={path} className="bar" /> : null}
              {(data.length - 1 - i) % tickEvery === 0 ? (
                <text x={cx} y={H - 8} className="tick" textAnchor="middle">{day(d.day)}</text>
              ) : null}
              {i === peak && d.revenue > 0 && hover == null ? (
                <text x={cx} y={yTop - 6} className="value-label" textAnchor="middle">{int(Math.round(d.revenue))}</text>
              ) : null}
              <rect
                x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent"
                onMouseEnter={() => setHover(i)} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${day(d.day)}: ${money(d.revenue)}, заказов ${d.orders}`}
              />
            </g>
          );
        })}
      </svg>
      {h && hover != null ? (
        <div className="tooltip" style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%` }}>
          <strong>{day(h.day)}</strong>
          <span>{money(h.revenue)}</span>
          <span className="muted">заказов: {h.orders}</span>
        </div>
      ) : null}
    </div>
  );
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

// Горизонтальные полосы с подписью и значением у конца — одна серия, один цвет.
export function BarList({ rows }: { rows: { label: string; value: number; display: string; hint?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label} title={r.hint}>
          <span className="barlist-label">{r.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="barlist-value">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}
