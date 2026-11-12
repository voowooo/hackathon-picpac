import { AlertTriangle, ArrowLeft, Ban, Check, Download, FileArchive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api, downloadFile, ORDER_STATUSES, type OrderDetail } from "../api";
import { ErrorBox, PageHeader, StatusBadge, Toast, useLoad } from "../components/common";
import { LayoutPreview, qualityText, type PhotoInfo } from "../components/LayoutPreview";
import { bytes, dateTime, money, slotLabel } from "../format";
import { useLiveReload } from "../live";

const EVENT_LABEL: Record<string, string> = { created: "Заказ создан", status: "Статус", cancelled: "Заказ отменён", restored: "Заказ восстановлен", comment: "Комментарий" };

export function OrderPage({ id }: { id: string }) {
  const { data: order, setData, error, loading, reload } = useLoad(() => api<OrderDetail>(`/admin/orders/${encodeURIComponent(id)}`), [id]);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [packing, setPacking] = useState(false);
  // Фото догружаются в фоне, а статус могли сменить в другой вкладке — обновляемся сами.
  useLiveReload((e) => (e.type === "order.photo" || e.type === "order.updated") && e.orderId === id, reload);

  const downloadPack = async () => {
    setPacking(true);
    try {
      const { headers, size } = await downloadFile(`/admin/orders/${encodeURIComponent(id)}/print-pack`);
      const missing = Number(headers.get("X-Missing-Photos") ?? 0);
      const count = Number(headers.get("X-Photo-Count") ?? 0);
      setToast(missing ? `Скачано ${count} фото (${bytes(size)}). Не хватает ${missing} — см. паспорт` : `Пакет скачан: ${count} фото, ${bytes(size)}`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setPacking(false);
    }
  };

  const patch = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      const next = await api<OrderDetail>(`/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: { ...body, comment: comment.trim() || undefined } });
      setData(next);
      setComment("");
      setToast(message);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!order) return loading ? <p className="muted">Загружаем…</p> : null;

  const noteValue = note ?? order.adminNote;
  const cfg = order.config;
  const photoInfo = (cfg.photoInfo ?? {}) as Record<string, PhotoInfo>;
  const weak = Object.entries(photoInfo).filter(([, q]) => qualityText(q));

  return (
    <>
      <a href="#/orders" className="back"><ArrowLeft size={16} /> Все заказы</a>
      <PageHeader
        title={`Заказ ${order.id}`}
        subtitle={<>{dateTime(order.createdAt)} · {order.title} · <StatusBadge statusIndex={order.statusIndex} label={order.status} cancelled={order.cancelled} /></>}
        actions={
          <button className="btn primary" onClick={downloadPack} disabled={packing} title="ZIP: фото в порядке макета, паспорт заказа и состав в CSV">
            <FileArchive size={16} /> {packing ? "Собираем…" : "Скачать к печати"}
          </button>
        }
      />

      <div className="grid-detail">
        <div className="stack">
          <section className="card">
            <h2>Статус</h2>
            <ol className="stepper">
              {ORDER_STATUSES.map((label, i) => {
                const state = i < order.statusIndex ? "done" : i === order.statusIndex ? "current" : "todo";
                return (
                  <li key={label} className={`${state}${order.cancelled ? " muted-step" : ""}`}>
                    <button disabled={busy || order.cancelled || i === order.statusIndex} onClick={() => patch({ statusIndex: i }, `Статус: ${label}`)}>
                      <span className="dot">{state === "done" ? <Check size={14} /> : i + 1}</span>
                      <span>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <label className="field">
              <span>Комментарий к изменению (видно только в админке)</span>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: передали в СДЭК, трек 123" />
            </label>
            <div className="row">
              {order.statusIndex < ORDER_STATUSES.length - 1 && !order.cancelled ? (
                <button className="btn primary" disabled={busy} onClick={() => patch({ statusIndex: order.statusIndex + 1 }, `Статус: ${ORDER_STATUSES[order.statusIndex + 1]}`)}>
                  Перевести в «{ORDER_STATUSES[order.statusIndex + 1]}»
                </button>
              ) : null}
              {order.cancelled ? (
                <button className="btn" disabled={busy} onClick={() => patch({ cancelled: false }, "Заказ восстановлен")}><RotateCcw size={16} /> Восстановить</button>
              ) : (
                <button className="btn danger" disabled={busy} onClick={() => { if (confirm(`Отменить заказ ${order.id}?`)) void patch({ cancelled: true }, "Заказ отменён"); }}>
                  <Ban size={16} /> Отменить заказ
                </button>
              )}
              {comment.trim() ? <button className="btn" disabled={busy} onClick={() => patch({}, "Комментарий добавлен")}>Только комментарий</button> : null}
            </div>
          </section>

          {order.clientId !== "demo" ? (
            <section className="card">
              <h2>Макет</h2>
              <p className="muted small">Так заказ собрал клиент. <AlertTriangle size={12} className="inline-icon" /> — замечание по качеству, перечёркнутая ячейка — фото ещё не загружено.</p>
              <LayoutPreview config={cfg} photos={order.photos} />
            </section>
          ) : null}

          <section className="card">
            <h2>Фото к печати <span className="muted">({order.photos.length} из {order.photoCount})</span></h2>
            {order.clientId !== "demo" && order.photos.length < order.photoCount && Date.now() - order.createdAt > 2 * 60_000 ? (
              <div className="quality-banner">
                <AlertTriangle size={16} />
                <span>Дошли не все фото. Причина видна в терминале сервера (строки с ⚠️). Обычно это обрыв связи — попросите клиента оформить заказ ещё раз.</span>
              </div>
            ) : null}
            {weak.length ? (
              <div className="quality-banner">
                <AlertTriangle size={16} />
                <span>Замечания по качеству: {weak.length} из {order.photos.length || weak.length}. Клиента предупредили в приложении; перед печатью проверьте снимки.</span>
              </div>
            ) : null}
            {order.photos.length ? (
              <div className="photo-grid">
                {order.photos.map((p, i) => {
                  const q = p.slotId ? photoInfo[p.slotId] : undefined;
                  const note = qualityText(q);
                  return (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer" download={p.originalName ?? undefined} className={`photo${note ? " warn" : ""}`}>
                      <PhotoImg src={p.url} alt={`Фото ${i + 1}`} name={p.originalName} />
                      {note ? <span className="photo-warn" title={note}><AlertTriangle size={12} /> {note}</span> : null}
                      <span className="photo-meta">
                        <span title={p.slotId ? slotLabel(p.slotId) : undefined}>{i + 1}{p.slotId ? ` · ${slotLabel(p.slotId)}` : ""}</span>
                        <span title={q?.width && q?.height ? `${q.width}×${q.height} px` : undefined}><Download size={12} /> {bytes(p.size)}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="muted">
                {order.clientId === "demo" ? "Демо-заказ — фото не загружались." : "Фото ещё не загружены: приложение отправляет их в фоне после оформления."}
              </p>
            )}
          </section>

          <section className="card">
            <h2>История</h2>
            <ul className="timeline">
              {order.events.map((e) => (
                <li key={e.id}>
                  <span className="muted small">{dateTime(e.createdAt)}</span>
                  <span>
                    <strong>{EVENT_LABEL[e.kind] ?? e.kind}</strong>
                    {e.kind === "status" && e.status ? ` → ${e.status}` : ""}
                    {e.note ? <span className="muted"> — {e.note}</span> : null}
                  </span>
                  <span className="muted small">{e.actor === "client" ? "клиент" : "админ"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h2>Клиент</h2>
            <dl className="kv">
              <dt>Имя</dt><dd>{order.customer.name}</dd>
              <dt>Телефон</dt><dd><a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`}>{order.customer.phone}</a></dd>
              <dt>Адрес</dt><dd>{order.customer.address}</dd>
              <dt>Доставка</dt><dd>{order.delivery.label}</dd>
              <dt>Оплата</dt><dd>{order.payment.label}</dd>
            </dl>
          </section>

          <section className="card">
            <h2>Сумма</h2>
            <dl className="kv">
              <dt>Продукт</dt><dd className="num">{money(order.subtotal)}</dd>
              {order.discount ? <><dt>Промокод {order.promoCode}</dt><dd className="num">−{money(order.discount)}</dd></> : null}
              <dt>Доставка</dt><dd className="num">{money(order.delivery.price)}</dd>
              <dt><strong>Итого</strong></dt><dd className="num"><strong>{money(order.total)}</strong></dd>
            </dl>
          </section>

          <section className="card">
            <h2>Продукт</h2>
            <dl className="kv">
              <dt>Тип</dt><dd>{order.categoryLabel}</dd>
              <dt>Состав</dt><dd>{order.items || "—"}</dd>
              <dt>Сценарий</dt><dd>{order.scenario}</dd>
              {productRows(cfg).map(([k, v]) => <FragmentRow key={k} k={k} v={v} />)}
            </dl>
            <details>
              <summary className="muted small">Полная конфигурация (JSON)</summary>
              <pre className="json">{JSON.stringify(cfg, null, 2)}</pre>
            </details>
          </section>

          <section className="card">
            <h2>Заметка менеджера</h2>
            <textarea rows={3} value={noteValue} onChange={(e) => setNote(e.target.value)} placeholder="Видна только в админке" />
            <button className="btn" disabled={busy || noteValue === order.adminNote} onClick={async () => { await patch({ adminNote: noteValue }, "Заметка сохранена"); setNote(null); }}>
              Сохранить заметку
            </button>
          </section>
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return <><dt>{k}</dt><dd>{v}</dd></>;
}

function productRows(cfg: Record<string, unknown>): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") rows.push([label, String(v)]); };
  switch (cfg.category) {
    case "print": add("Формат", cfg.printFormatId); add("Бумага", cfg.paper === "glossy" ? "глянцевая" : cfg.paper ? "матовая" : undefined); add("Копий", cfg.copies); break;
    case "photobook": add("Линейка", cfg.bookLineId); add("Формат", cfg.bookFormat); add("Разворотов", cfg.spreads); add("Обложка", cfg.coverColorId); add("Название", cfg.bookTitle); break;
    case "poster": add("Размер", cfg.posterSizeId); add("Ориентация", cfg.posterOrientation === "landscape" ? "горизонтальная" : cfg.posterOrientation ? "вертикальная" : undefined); break;
    case "postcard": add("Шаблон", cfg.postcardTemplateId); add("Подпись", cfg.postcardCaption); add("Копий", cfg.copies); break;
  }
  return rows;
}

// Фото, которое браузер не умеет показать (например, HEIC со старой версии приложения), —
// заглушка вместо «битой» картинки; файл всё равно можно скачать.
function PhotoImg({ src, alt, name }: { src: string; alt: string; name: string | null }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const ext = (/\.(\w+)$/.exec(name ?? src)?.[1] ?? "").toUpperCase();
    return <span className="photo-fallback">Браузер не показывает {ext || "этот формат"}<br />Нажмите, чтобы скачать</span>;
  }
  return (
    <img
      src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}
      // Ошибка могла случиться до того, как React подписался на событие.
      ref={(img) => { if (img?.complete && img.naturalWidth === 0 && img.currentSrc) setFailed(true); }}
    />
  );
}
