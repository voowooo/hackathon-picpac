import { Ban, CheckCircle2, Clock, Package, Printer, Truck } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

// Загрузка данных с повтором и флагом загрузки.
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

const STATUS_ICONS = [Clock, Printer, Package, Truck, CheckCircle2];

// Статус всегда подписан и с иконкой — цвет только дублирует смысл.
export function StatusBadge({ statusIndex, label, cancelled }: { statusIndex: number; label: string; cancelled?: boolean }) {
  if (cancelled) return <span className="badge s-cancelled"><Ban size={13} /> Отменён</span>;
  const Icon = STATUS_ICONS[statusIndex] ?? Clock;
  return <span className={`badge s-${statusIndex}`}><Icon size={13} /> {label}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card error-box">
      <p>{error}</p>
      {onRetry ? <button className="btn" onClick={onRetry}>Повторить</button> : null}
    </div>
  );
}

export function Toast({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}
