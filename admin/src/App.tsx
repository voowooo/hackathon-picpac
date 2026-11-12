import { ClipboardList, LayoutDashboard, LogOut, Package, TicketPercent } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { auth, setUnauthorizedHandler } from "./api";
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

export function App() {
  const [authed, setAuthed] = useState(() => !!auth.token);
  const route = useHashRoute();
  useEffect(() => setUnauthorizedHandler(() => setAuthed(false)), []);

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;

  const [path, query = ""] = route.split("?");
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
            </a>
          ))}
        </nav>
        <button className="logout" onClick={() => { auth.clear(); setAuthed(false); }}>
          <LogOut size={16} /> Выйти
        </button>
      </aside>
      <main className="content">{page}</main>
    </div>
  );
}
