import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { api, type Stats } from "../api";
import { BarList, RevenueChart } from "../components/charts";
import { ErrorBox, PageHeader, StatusBadge, useLoad } from "../components/common";
import { dateTime, int, money } from "../format";
import { useLiveReload } from "../live";

export function DashboardPage() {
  const [days, setDays] = useState(() => Number(localStorage.getItem("picpac.admin.days")) || 14);
  const pickDays = (d: number) => { localStorage.setItem("picpac.admin.days", String(d)); setDays(d); };
  const { data, error, loading, reload } = useLoad(() => api<Stats>(`/admin/stats?days=${days}`), [days]);
  useLiveReload((e) => e.type !== "order.photo", reload);

  return (
    <>
      <PageHeader
        title="Дашборд"
        subtitle="Отменённые заказы в выручку не входят"
        actions={
          <>
            <div className="segmented" role="tablist" aria-label="Период">
              {PERIODS.map((d) => <button key={d} className={d === days ? "on" : ""} onClick={() => pickDays(d)}>{d} дн.</button>)}
            </div>
            <button className="btn" onClick={reload} disabled={loading}><RefreshCw size={16} /> Обновить</button>
          </>
        }
      />
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <section className="tiles">
            <Tile label={`Выручка за ${data.period.days} дн.`} value={money(data.period.revenue)} note={<Delta cur={data.period.revenue} prev={data.period.prevRevenue} />} />
            <Tile label="Заказов за период" value={int(data.period.orders)} note={<Delta cur={data.period.orders} prev={data.period.prevOrders} />} />
            <Tile label="Средний чек" value={money(data.period.avgCheck)} note={`за всё время ${money(data.totals.avgCheck)}`} />
            <Tile label="В работе" value={int(data.totals.active)} note="ещё не доставлены" href="#/orders?status=active" />
          </section>

          <section className="card">
            <h2>Выручка по дням, BYN</h2>
            <p className="muted small">Последние {data.period.days} дн. · отменено за всё время: {int(data.totals.cancelled)}</p>
            <RevenueChart data={data.daily} />
          </section>

          <div className="grid-2">
            <section className="card">
              <h2>Заказы по статусам</h2>
              <BarList rows={data.byStatus.map((s) => ({ label: s.label, value: s.count, display: int(s.count) }))} />
            </section>
            <section className="card">
              <h2>Выручка по продуктам <span className="muted small">за {data.period.days} дн.</span></h2>
              <BarList rows={data.byCategory.map((c) => ({ label: c.label, value: c.revenue, display: money(c.revenue), hint: `${c.count} заказов` }))} />
            </section>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Последние заказы</h2>
              <table className="table compact">
                <tbody>
                  {data.recent.map((o) => (
                    <tr key={o.id} className="clickable" onClick={() => { window.location.hash = `/orders/${o.id}`; }}>
                      <td><strong>{o.id}</strong><div className="muted small">{dateTime(o.createdAt)}</div></td>
                      <td>{o.title}<div className="muted small">{o.customer.name}</div></td>
                      <td><StatusBadge statusIndex={o.statusIndex} label={o.status} cancelled={o.cancelled} /></td>
                      <td className="num">{money(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card">
              <h2>Промокоды <span className="muted small">за {data.period.days} дн.</span></h2>
              {data.promos.length ? (
                <table className="table compact">
                  <thead><tr><th>Код</th><th className="num">Заказов</th><th className="num">Выручка</th><th className="num">Скидок выдано</th></tr></thead>
                  <tbody>
                    {data.promos.map((p) => (
                      <tr key={p.code}><td><code>{p.code}</code></td><td className="num">{int(p.orders)}</td><td className="num">{money(p.revenue)}</td><td className="num">{money(p.discount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">Промокодами ещё не пользовались</p>}
            </section>
          </div>
        </>
      ) : loading ? <p className="muted">Загружаем…</p> : null}
    </>
  );
}

const PERIODS = [7, 14, 30, 90];

// Изменение к предыдущему такому же периоду: стрелка и знак дублируют цвет.
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="muted small">{cur ? "в прошлом периоде — 0" : "нет данных"}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="muted small">как в прошлом периоде</span>;
  return <span className={`delta ${pct > 0 ? "up" : "down"}`}>{pct > 0 ? "▲ +" : "▼ −"}{Math.abs(pct)}% к прошлому периоду</span>;
}

function Tile({ label, value, note, href }: { label: string; value: string; note: ReactNode; href?: string }) {
  const body = (
    <>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="muted small">{note}</span>
    </>
  );
  return href ? <a className="card tile link" href={href}>{body}</a> : <div className="card tile">{body}</div>;
}
