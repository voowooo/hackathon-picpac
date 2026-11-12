import { RefreshCw } from "lucide-react";
import { api, type Stats } from "../api";
import { BarList, RevenueChart } from "../components/charts";
import { ErrorBox, PageHeader, StatusBadge, useLoad } from "../components/common";
import { dateTime, int, money } from "../format";
import { useLiveReload } from "../live";

export function DashboardPage() {
  const { data, error, loading, reload } = useLoad(() => api<Stats>("/admin/stats"), []);
  useLiveReload((e) => e.type !== "order.photo", reload);

  return (
    <>
      <PageHeader
        title="Дашборд"
        subtitle="Отменённые заказы в выручку не входят"
        actions={<button className="btn" onClick={reload} disabled={loading}><RefreshCw size={16} /> Обновить</button>}
      />
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <section className="tiles">
            <Tile label="Выручка за 30 дней" value={money(data.last30.revenue)} note={`${int(data.last30.orders)} заказов`} />
            <Tile label="Средний чек" value={money(data.totals.avgCheck)} note={`всего ${int(data.totals.orders)} заказов`} />
            <Tile label="В работе" value={int(data.totals.active)} note="ещё не доставлены" href="#/orders?status=active" />
            <Tile label="Отменено" value={int(data.totals.cancelled)} note="за всё время" href="#/orders?status=cancelled" />
          </section>

          <section className="card">
            <h2>Выручка по дням, BYN</h2>
            <p className="muted small">Последние 14 дней</p>
            <RevenueChart data={data.daily} />
          </section>

          <div className="grid-2">
            <section className="card">
              <h2>Заказы по статусам</h2>
              <BarList rows={data.byStatus.map((s) => ({ label: s.label, value: s.count, display: int(s.count) }))} />
            </section>
            <section className="card">
              <h2>Выручка по продуктам</h2>
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
              <h2>Промокоды</h2>
              {data.promos.length ? (
                <table className="table compact">
                  <thead><tr><th>Код</th><th className="num">Заказов</th><th className="num">Скидок выдано</th></tr></thead>
                  <tbody>
                    {data.promos.map((p) => (
                      <tr key={p.code}><td><code>{p.code}</code></td><td className="num">{int(p.orders)}</td><td className="num">{money(p.discount)}</td></tr>
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

function Tile({ label, value, note, href }: { label: string; value: string; note: string; href?: string }) {
  const body = (
    <>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="muted small">{note}</span>
    </>
  );
  return href ? <a className="card tile link" href={href}>{body}</a> : <div className="card tile">{body}</div>;
}
