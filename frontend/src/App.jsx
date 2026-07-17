import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { T, icons } from "./theme";
import { getCapacityFor } from "./api";
import { TODAY_KEY } from "./dateUtils";
import Icon from "./components/Icon";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MyStatus from "./pages/MyStatus";
import MyHistory from "./pages/MyHistory";
import Employees from "./pages/Employees";
import Admin from "./pages/Admin";

const isCapacityManager = (role) => role === "manager" || role === "admin";

export default function App() {
  const { session, logout } = useAuth();
  const showToast = useToast();
  const [page, setPage] = useState("dashboard");
  const [capacity, setCapacity] = useState(null);

  useEffect(() => {
    if (!session) return;
    getCapacityFor(TODAY_KEY)
      .then((c) => setCapacity(c.seat_count))
      .catch(() => {});
  }, [session]);

  if (!session) return <Login />;

  const role = session.role;
  const isManager = isCapacityManager(role);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: icons.dash },
    { id: "status", label: "My status", icon: icons.seat },
    { id: "history", label: "My history", icon: icons.history },
    { id: "employees", label: "Employees", icon: icons.people },
    ...(isManager ? [{ id: "admin", label: "Admin", icon: icons.admin }] : []),
  ];

  const capacityLabel = capacity ?? "…";
  const titles = {
    dashboard: isManager
      ? ["Dashboard — team split", "Team-wise WFO · WFH · Leave (A) · Absent counts, by day/week/month"]
      : ["My dashboard", "Your own WFO · WFH · Leave (A) · Absent counts, by week/month"],
    status: ["My status", `WFO / WFH / Leave (A) · ${capacityLabel} WFO slots · auto-assigned · Mon–Fri, 7-day window`],
    history: ["My history", "Your daily categories and edit rules"],
    employees: ["Employees", "People on record"],
    admin: ["Admin panel", "Add employees, edit approvals, holidays, seat capacity and split report — Admin/Manager only"],
  };

  const activePage = page === "admin" && !isManager ? "dashboard" : page;

  const handleLogout = () => {
    logout();
    showToast("Signed out.", "ok");
  };

  return (
    <div className="min-h-screen flex" style={{ background: T.canvas, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <aside className="w-16 md:w-56 shrink-0 flex flex-col py-5 px-2 md:px-4" style={{ background: T.ink }}>
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: T.amber, color: "#3A2600", fontFamily: "'Space Grotesk', sans-serif" }}>B</div>
          <div className="hidden md:block">
            <div className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Book<span style={{ color: T.amber }}>My</span>Seat</div>
            <div className="text-[10px]" style={{ color: "#8FA6BC" }}>{capacityLabel} WFO slots</div>
          </div>
        </div>
        {nav.map((n) => (
          <button key={n.id} onClick={() => setPage(n.id)}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl mb-1 text-sm transition-colors"
            style={{ background: activePage === n.id ? "rgba(255,255,255,0.12)" : "transparent", color: activePage === n.id ? "#fff" : "#8FA6BC" }}>
            <Icon d={n.icon} />
            <span className="hidden md:inline font-medium">{n.label}</span>
          </button>
        ))}
        <button onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition-colors"
          style={{ color: "#8FA6BC" }}>
          <Icon d={icons.logout} />
          <span className="hidden md:inline font-medium">Sign out</span>
        </button>
      </aside>

      <main className="flex-1 min-w-0 p-5 md:p-8 overflow-y-auto">
        <header className="mb-6 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold" style={{ color: T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>{titles[activePage][0]}</h1>
            <p className="text-sm mt-1" style={{ color: T.inkSoft }}>{titles[activePage][1]}</p>
          </div>
          <div className="px-3 py-2 rounded-xl text-xs" style={{ border: `1px solid ${T.line}`, color: T.inkSoft, background: T.panel }}>
            {session.name} · <span className="capitalize font-semibold" style={{ color: T.ink }}>{role}</span>
          </div>
        </header>

        {activePage === "dashboard" && <Dashboard />}
        {activePage === "status" && <MyStatus />}
        {activePage === "history" && <MyHistory />}
        {activePage === "employees" && <Employees />}
        {activePage === "admin" && isManager && <Admin />}
      </main>
    </div>
  );
}
