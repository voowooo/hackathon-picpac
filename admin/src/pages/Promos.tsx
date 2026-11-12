import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type Promo } from "../api";
import { ErrorBox, PageHeader, Toast, useLoad } from "../components/common";
import { date, int } from "../format";

// Дата окончания хранится как конец выбранного дня по Минску (UTC+3).
const endOfDay = (yyyyMmDd: string) => (yyyyMmDd ? Date.parse(`${yyyyMmDd}T23:59:59+03:00`) : null);

export function PromosPage() {
  const { data, error, loading, reload } = useLoad(() => api<Promo[]>("/admin/promos"), []);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", discountPercent: "10", description: "", maxUses: "", expires: "" });

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      setToast(message);
      await reload();
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => api("/admin/promos", {
      method: "POST",
      body: { code: form.code, discountPercent: Number(form.discountPercent), description: form.description, maxUses: form.maxUses || null, expiresAt: endOfDay(form.expires) },
    }), `Промокод ${form.code.toUpperCase()} создан`);
    if (ok) setForm({ code: "", discountPercent: "10", description: "", maxUses: "", expires: "" });
  };

  return (
    <>
      <PageHeader title="Промокоды" subtitle="Скидка считается от стоимости продукта, без доставки" />

      <form className="card promo-form" onSubmit={create}>
        <label className="field"><span>Код</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SPRING25" required /></label>
        <label className="field"><span>Скидка, %</span><input inputMode="numeric" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} required /></label>
        <label className="field grow"><span>Описание</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Для кого и зачем" /></label>
        <label className="field"><span>Лимит использований</span><input inputMode="numeric" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="без лимита" /></label>
        <label className="field"><span>Действует до</span><input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></label>
        <button className="btn primary"><Plus size={16} /> Создать</button>
      </form>

      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {loading && !data ? <p className="muted">Загружаем…</p> : null}

      {data ? (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr><th>Код</th><th>Описание</th><th className="num">Скидка</th><th className="num">Использован</th><th>Действует до</th><th>Состояние</th><th /></tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.code} className={p.problem ? "inactive" : ""}>
                  <td><code>{p.code}</code></td>
                  <td>{p.description || <span className="muted">—</span>}</td>
                  <td className="num">{p.discountPercent}%</td>
                  <td className="num">{int(p.usedCount)}{p.maxUses != null ? ` / ${int(p.maxUses)}` : ""}</td>
                  <td>{p.expiresAt ? date(p.expiresAt) : <span className="muted">бессрочно</span>}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={p.active} onChange={() => run(() => api(`/admin/promos/${p.code}`, { method: "PATCH", body: { active: !p.active } }), p.active ? "Промокод отключён" : "Промокод включён")} />
                      <span>{p.problem && p.active ? p.problem : p.active ? "Работает" : "Отключён"}</span>
                    </label>
                  </td>
                  <td className="row-actions">
                    <button className="icon-btn danger" aria-label="Удалить" onClick={() => {
                      if (confirm(`Удалить промокод ${p.code}? Заказы с ним останутся.`)) void run(() => api(`/admin/promos/${p.code}`, { method: "DELETE" }), "Удалено");
                    }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {!data.length ? <tr><td colSpan={7} className="empty">Промокодов пока нет</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
