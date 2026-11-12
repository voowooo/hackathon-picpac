import { ChevronLeft, ChevronRight, FileArchive, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api, CATEGORIES, downloadFile, ORDER_STATUSES, type Order } from "../api";
import { ErrorBox, PageHeader, StatusBadge, Toast, useLoad } from "../components/common";
import { bytes, dateTime, int, money } from "../format";
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
  // Выбор живёт между страницами списка, пока не сменились фильтры.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filterKey = `${status}|${category}|${search}`;
  useEffect(() => setSelected(new Set()), [filterKey]);
  const [bulkStatus, setBulkStatus] = useState("1");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const pageIds = data?.items.map((o) => o.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePage = () => setSelected((prev) => {
    const next = new Set(prev);
    for (const id of pageIds) if (allOnPage) next.delete(id); else next.add(id);
    return next;
  });

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      setToast(await fn());
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ids = [...selected];

  const applyBulk = (body: Record<string, unknown>, label: string) => run(async () => {
    const res = await api<{ updated: string[]; skipped: { id: string; reason: string }[] }>("/admin/orders/bulk", { method: "POST", body: { ids, ...body } });
    await reload();
    const skipped = res.skipped.length ? `, пропущено ${res.skipped.length} (${[...new Set(res.skipped.map((s) => s.reason))].join(", ")})` : "";
    return `${label}: ${res.updated.length}${skipped}`;
  });

  const downloadPacks = () => run(async () => {
    const { headers, size } = await downloadFile("/admin/orders/bulk-print-pack", { method: "POST", body: { ids } });
    const missing = Number(headers.get("X-Missing-Photos") ?? 0);
    return `Скачано: ${headers.get("X-Order-Count")} заказов, ${headers.get("X-Photo-Count")} фото, ${bytes(size)}${missing ? `. Не хватает фото: ${missing}` : ""}`;
  });

  const exportCsv = () => run(async () => {
    const q = new URLSearchParams({ status, category, search });
    await downloadFile(`/admin/orders/export.csv?${q}`);
    return `Выгружено заказов: ${data?.total ?? ""}`;
  });

  return (
    <>
      <PageHeader
        title="Заказы"
        subtitle={data ? `Найдено: ${int(data.total)}` : undefined}
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={busy || !data?.total} title="CSV для Excel с текущими фильтрами"><FileSpreadsheet size={16} /> Экспорт в Excel</button>
            <button className="btn" onClick={reload} disabled={loading}><RefreshCw size={16} /> Обновить</button>
          </>
        }
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
              <th className="check-col">
                <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Выбрать все на странице" disabled={!pageIds.length} />
              </th>
              <th>Заказ</th><th>Клиент</th><th>Продукт</th><th>Доставка</th><th>Статус</th><th className="num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((o) => (
              <tr
                key={o.id}
                className={`clickable${freshOrders.has(o.id) ? " fresh" : ""}${selected.has(o.id) ? " selected" : ""}`}
                onClick={() => { window.location.hash = `/orders/${o.id}`; }}
              >
                <td className="check-col" onClick={(e) => { e.stopPropagation(); toggle(o.id); }}>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} onClick={(e) => e.stopPropagation()} aria-label={`Выбрать ${o.id}`} />
                </td>
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
            {data && !data.items.length ? <tr><td colSpan={7} className="empty">Заказов не найдено</td></tr> : null}
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

      {selected.size ? (
        <div className="bulk-bar" role="region" aria-label="Действия с выбранными заказами">
          <strong>Выбрано: {selected.size}</strong>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="Новый статус">
            {ORDER_STATUSES.map((label, i) => <option key={label} value={i}>{label}</option>)}
          </select>
          <button className="btn primary" disabled={busy} onClick={() => applyBulk({ statusIndex: Number(bulkStatus) }, `Статус «${ORDER_STATUSES[Number(bulkStatus)]}»`)}>Применить</button>
          <button className="btn" disabled={busy} onClick={downloadPacks}><FileArchive size={16} /> Скачать к печати</button>
          <button className="btn danger" disabled={busy} onClick={() => { if (confirm(`Отменить заказов: ${selected.size}?`)) void applyBulk({ cancelled: true }, "Отменено"); }}>Отменить</button>
          <span className="spacer" />
          <button className="link-btn" onClick={() => setSelected(new Set())}>Снять выделение</button>
        </div>
      ) : null}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
