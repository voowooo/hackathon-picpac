import { Bell, BellOff, ClipboardList, LayoutDashboard, LogOut, Package, TicketPercent, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { auth, setUnauthorizedHandler } from "./api";
import { money } from "./format";
import { chime, soundPref, useLiveConnection, type LiveEvent } from "./live";
import { CatalogPage } from "./pages/Catalog";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";
import { OrderPage } from "./pages/OrderDetail";
import { OrdersPage } from "./pages/Orders";
import { PromosPage } from "./pages/Promos";

// Простой hash-роутер: #/orders, #/orders/ord-1001?…, #/catalog
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, "") || "/dashboard";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const navigate = (to: string) => { window.location.hash = to; };

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/dashboard", label: "Дашборд", icon: <LayoutDashboard size={18} /> },
  { to: "/orders", label: "Заказы", icon: <ClipboardList size={18} /> },
  { to: "/catalog", label: "Каталог и цены", icon: <Package size={18} /> },
  { to: "/promos", label: "Промокоды", icon: <TicketPercent size={18} /> },
];

type Notice = { key: number; orderId: string; title: string; text: string };

const STATUS_LABEL = { connecting: "Подключаемся…", online: "Онлайн: заказы приходят сразу", offline: "Нет связи, переподключаемся…" };

export function App() {
  const [authed, setAuthed] = useState(() => !!auth.token);
  const route = useHashRoute();
  const [path, query = ""] = route.split("?");
  const [unseen, setUnseen] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sound, setSound] = useState(soundPref.get);
  useEffect(() => setUnauthorizedHandler(() => setAuthed(false)), []);

  const onLive = useCallback((e: LiveEvent) => {
    if (e.type !== "order.created") return;
    const o = e.order;
    if (soundPref.get()) chime();
    if (!window.location.hash.startsWith("#/orders") || window.location.hash.startsWith("#/orders/")) setUnseen((n) => n + 1);
    const notice = { key: e.at + Math.random(), orderId: o.id, title: `Новый заказ ${o.id}`, text: `${o.title} · ${money(o.total)} · ${o.customer.name}` };
    setNotices((list) => [notice, ...list].slice(0, 4));
    setTimeout(() => setNotices((list) => list.filter((n) => n.key !== notice.key)), 12000);
  }, []);
  const live = useLiveConnection(authed, onLive);

  // На списке заказов новые заказы и так видны — сбрасываем счётчик.
  useEffect(() => { if (path === "/orders") setUnseen(0); }, [path]);
  useEffect(() => { document.title = unseen ? `(${unseen}) PicPac — админка` : "PicPac — админка"; }, [unseen]);

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;

  const params = new URLSearchParams(query);
  const orderMatch = /^\/orders\/([^/]+)$/.exec(path);

  let page: ReactNode;
  if (orderMatch) page = <OrderPage id={decodeURIComponent(orderMatch[1])} />;
  else if (path === "/orders") page = <OrdersPage params={params} />;
  else if (path === "/catalog") page = <CatalogPage />;
  else if (path === "/promos") page = <PromosPage />;
  else page = <DashboardPage />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="./logo.png" alt="" />
          <div>
            <strong>PicPac</strong>
            <span>админка</span>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={path.startsWith(n.to) ? "active" : ""}>
              {n.icon}
              {n.label}
              {n.to === "/orders" && unseen ? <span className="nav-badge" aria-label={`новых заказов: ${unseen}`}>{unseen}</span> : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className={`live-status ${live}`} title={STATUS_LABEL[live]}>
            <span className="live-dot" />
            {live === "online" ? "Онлайн" : live === "offline" ? "Нет связи" : "Подключение…"}
          </div>
          <button
            className="logout"
            onClick={() => { soundPref.set(!sound); setSound(!sound); if (!sound) chime(); }}
            title="Звук при новом заказе"
          >
            {sound ? <Bell size={16} /> : <BellOff size={16} />} Звук {sound ? "вкл." : "выкл."}
          </button>
          <button className="logout" onClick={() => { auth.clear(); setAuthed(false); }}>
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </aside>
      <main className="content">{page}</main>

      <div className="notices" aria-live="polite">
        {notices.map((n) => (
          <div key={n.key} className="notice">
            <a href={`#/orders/${n.orderId}`} onClick={() => setNotices((list) => list.filter((x) => x.key !== n.key))}>
              <strong>{n.title}</strong>
              <span>{n.text}</span>
            </a>
            <button className="icon-btn" aria-label="Закрыть" onClick={() => setNotices((list) => list.filter((x) => x.key !== n.key))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
