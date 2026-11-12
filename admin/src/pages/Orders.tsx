import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api, CATEGORIES, ORDER_STATUSES, type Order } from "../api";
import { ErrorBox, PageHeader, StatusBadge, useLoad } from "../components/common";
import { dateTime, int, money } from "../format";
import { freshOrders, useLiveReload } from "../live";

const PAGE = 25;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "active", label: "В работе" },
  ...ORDER_STATUSES.map((label, i) => ({ value: String(i), label })),
  { value: "cancelled", label: "Отменённые" },
];

export function OrdersPage({ params }: { params: URLSearchParams }) {
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const search = params.get("q") ?? "";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    window.location.hash = `/orders?${next.toString()}`;
  };

  const qs = new URLSearchParams({ status, category, search, limit: String(PAGE), offset: String(page * PAGE) });
  const { data, error, loading, reload } = useLoad(() => api<{ total: number; items: Order[] }>(`/admin/orders?${qs}`), [qs.toString()]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  useLiveReload(() => true, reload);

  return (
    <>
      <PageHeader
        title="Заказы"
        subtitle={data ? `Найдено: ${int(data.total)}` : undefined}
        actions={<button className="btn" onClick={reload} disabled={loading}><RefreshCw size={16} /> Обновить</button>}
      />

      <div className="filters">
        <div className="segmented" role="tablist">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} className={status === f.value ? "on" : ""} onClick={() => setParam({ status: f.value })}>{f.label}</button>
          ))}
        </div>
        <select value={category} onChange={(e) => setParam({ category: e.target.value })} aria-label="Продукт">
          <option value="">Все продукты</option>
          {Object.entries(CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <form className="search" onSubmit={(e) => { e.preventDefault(); setParam({ q: draft.trim() }); }}>
          <Search size={16} />
          <input placeholder="№ заказа, имя, телефон" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </form>
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : null}

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Заказ</th><th>Клиент</th><th>Продукт</th><th>Доставка</th><th>Статус</th><th className="num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((o) => (
              <tr key={o.id} className={`clickable${freshOrders.has(o.id) ? " fresh" : ""}`} onClick={() => { window.location.hash = `/orders/${o.id}`; }}>
                <td>
                  <div className="order-cell">
                    {o.previewUrl ? <img src={o.previewUrl} alt="" className="thumb" loading="lazy" /> : <span className="thumb" />}
                    <div><strong>{o.id}</strong>{freshOrders.has(o.id) ? <span className="new-tag">новый</span> : null}<div className="muted small">{dateTime(o.createdAt)}</div></div>
                  </div>
                </td>
                <td>{o.customer.name}<div className="muted small">{o.customer.phone}</div></td>
                <td>{o.title}<div className="muted small">{o.items}</div></td>
                <td>{o.delivery.label}<div className="muted small">{o.payment.label}</div></td>
                <td><StatusBadge statusIndex={o.statusIndex} label={o.status} cancelled={o.cancelled} /></td>
                <td className="num"><strong>{money(o.total)}</strong>{o.promoCode ? <div className="muted small">{o.promoCode}</div> : null}</td>
              </tr>
            ))}
            {data && !data.items.length ? <tr><td colSpan={6} className="empty">Заказов не найдено</td></tr> : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="pager">
          <button className="btn" disabled={page === 0} onClick={() => setParam({ page: String(page - 1) })}><ChevronLeft size={16} /> Назад</button>
          <span className="muted">Страница {page + 1} из {pages}</span>
          <button className="btn" disabled={page + 1 >= pages} onClick={() => setParam({ page: String(page + 1) })}>Вперёд <ChevronRight size={16} /></button>
        </div>
      ) : null}
    </>
  );
}
