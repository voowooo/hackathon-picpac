import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api, type CatalogItem, type CatalogResponse, type KindSchema } from "../api";
import { ErrorBox, PageHeader, Toast, useLoad } from "../components/common";
import { money } from "../format";

type FormValues = Record<string, string>;

const toForm = (schema: KindSchema, data: Record<string, unknown>): FormValues =>
  Object.fromEntries(schema.fields.map((f) => [f.key, Array.isArray(data[f.key]) ? (data[f.key] as string[]).join(", ") : String(data[f.key] ?? "")]));

const fromForm = (schema: KindSchema, v: FormValues) =>
  Object.fromEntries(schema.fields.map((f) => [f.key, f.type === "number" ? Number(v[f.key].replace(",", ".")) : v[f.key]]));

const show = (type: string, v: unknown) =>
  type === "number" && typeof v === "number" ? (v < 1 && v > 0 && !Number.isInteger(v * 100) ? v.toFixed(4) : String(v)) : Array.isArray(v) ? v.join(", ") : String(v ?? "");

export function CatalogPage() {
  const { data, error, loading, reload } = useLoad(() => api<CatalogResponse>("/admin/catalog"), []);
  const [kind, setKind] = useState("printFormat");
  const [toast, setToast] = useState<string | null>(null);

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

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return loading ? <p className="muted">Загружаем…</p> : null;

  const schema = data.kinds[kind];
  const items = data.items.filter((i) => i.kind === kind);

  return (
    <>
      <PageHeader title="Каталог и цены" subtitle="Изменения сразу видны в приложении при следующем открытии; на уже оформленные заказы не влияют" />

      <div className="segmented tabs">
        {Object.entries(data.kinds).map(([k, s]) => (
          <button key={k} className={k === kind ? "on" : ""} onClick={() => setKind(k)}>{s.title}</button>
        ))}
        <button className={kind === "_prices" ? "on" : ""} onClick={() => setKind("_prices")}>Прочие цены</button>
      </div>

      {kind === "_prices" ? (
        <PricesForm schema={data.settingsSchema} prices={data.prices} onSave={(body) => run(() => api("/admin/prices", { method: "PUT", body }), "Цены сохранены")} />
      ) : (
        <KindTable key={kind} kind={kind} schema={schema} items={items} run={run} />
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}

function KindTable({ kind, schema, items, run }: { kind: string; schema: KindSchema; items: CatalogItem[]; run: (fn: () => Promise<unknown>, msg: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState("");

  const startEdit = (item: CatalogItem) => { setAdding(false); setEditing(item.id); setValues(toForm(schema, item.data)); };
  const startAdd = () => { setEditing(null); setAdding(true); setNewId(""); setValues(toForm(schema, {})); };

  const inputs = (
    <>
      {schema.fields.map((f) => (
        <td key={f.key}>
          <input
            className={f.type === "number" ? "num-input" : ""}
            inputMode={f.type === "number" ? "decimal" : undefined}
            value={values[f.key] ?? ""}
            placeholder={f.hint}
            title={f.hint}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </td>
      ))}
    </>
  );

  return (
    <div className="card table-card">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            {schema.fields.map((f) => <th key={f.key} title={f.hint}>{f.label}</th>)}
            <th>В приложении</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editing === item.id ? (
              <tr key={item.id} className="editing">
                <td><code>{item.id}</code></td>
                {inputs}
                <td>{item.active ? "показывается" : "скрыто"}</td>
                <td className="row-actions">
                  <button className="btn primary sm" onClick={async () => {
                    if (await run(() => api(`/admin/catalog/${kind}/${item.id}`, { method: "PUT", body: { data: fromForm(schema, values) } }), "Сохранено")) setEditing(null);
                  }}>Сохранить</button>
                  <button className="icon-btn" aria-label="Отмена" onClick={() => setEditing(null)}><X size={16} /></button>
                </td>
              </tr>
            ) : (
              <tr key={item.id} className={item.active ? "" : "inactive"}>
                <td><code>{item.id}</code></td>
                {schema.fields.map((f) => (
                  <td key={f.key} className={f.type === "number" ? "num" : ""}>
                    {f.type === "number" && /price/i.test(f.key) ? money(Number(item.data[f.key])) : show(f.type, item.data[f.key])}
                  </td>
                ))}
                <td>
                  <button className="link-btn" onClick={() => run(() => api(`/admin/catalog/${kind}/${item.id}`, { method: "PUT", body: { active: !item.active } }), item.active ? "Скрыто из приложения" : "Снова показывается")}>
                    {item.active ? <><Eye size={15} /> показывается</> : <><EyeOff size={15} /> скрыто</>}
                  </button>
                </td>
                <td className="row-actions">
                  <button className="icon-btn" aria-label="Изменить" onClick={() => startEdit(item)}><Pencil size={16} /></button>
                  <button className="icon-btn danger" aria-label="Удалить" onClick={() => {
                    if (confirm(`Удалить «${item.id}»? Оформленные заказы не изменятся.`)) void run(() => api(`/admin/catalog/${kind}/${item.id}`, { method: "DELETE" }), "Удалено");
                  }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ),
          )}
          {adding ? (
            <tr className="editing">
              <td><input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="id, напр. 13x18" /></td>
              {inputs}
              <td>показывается</td>
              <td className="row-actions">
                <button className="btn primary sm" onClick={async () => {
                  if (await run(() => api(`/admin/catalog/${kind}`, { method: "POST", body: { id: newId.trim(), data: fromForm(schema, values) } }), "Добавлено")) setAdding(false);
                }}>Добавить</button>
                <button className="icon-btn" aria-label="Отмена" onClick={() => setAdding(false)}><X size={16} /></button>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {!adding ? <button className="btn add-row" onClick={startAdd}><Plus size={16} /> Добавить позицию</button> : null}
    </div>
  );
}

function PricesForm({ schema, prices, onSave }: { schema: KindSchema; prices: Record<string, number>; onSave: (body: Record<string, number>) => Promise<boolean> }) {
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(schema.fields.map((f) => [f.key, String(prices[f.key] ?? "")])));
  return (
    <form className="card form-card" onSubmit={(e) => { e.preventDefault(); void onSave(Object.fromEntries(schema.fields.map((f) => [f.key, Number(values[f.key].replace(",", "."))]))); }}>
      {schema.fields.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label}</span>
          <input inputMode="decimal" value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
        </label>
      ))}
      <button className="btn primary">Сохранить</button>
    </form>
  );
}
