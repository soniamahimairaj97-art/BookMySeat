import { useEffect, useState } from "react";
import { getEmployees, getTeams } from "../api";
import { useToast } from "../ToastContext";
import { T } from "../theme";

const TEAM_COLORS = { PFG: "#16324F", Gear_Box: "#0E8A6A", e_Motor: "#B87400" };

export default function Employees() {
  const showToast = useToast();
  const [employees, setEmployees] = useState(null);
  const [teams, setTeams] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    Promise.all([getEmployees(), getTeams()])
      .then(([emps, tms]) => {
        setEmployees(emps);
        setTeams(tms);
      })
      .catch((err) => showToast(err.message, "error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!employees) {
    return <p className="text-sm" style={{ color: T.inkSoft }}>Loading…</p>;
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const shown = employees.filter((e) => (filter === "all" ? true : filter === "active" ? e.is_active : !e.is_active));

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <div className="flex items-center gap-2 p-4" style={{ borderBottom: `1px solid ${T.line}` }}>
        {["all", "active", "left"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
            style={{ background: filter === f ? T.navySoft : "transparent", color: filter === f ? T.ink : T.inkSoft }}
          >
            {f === "left" ? "Left (records kept)" : f}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: T.inkSoft }}>{shown.length} people</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {shown.map((e) => {
          const team = teamById[e.team_id];
          const color = team ? TEAM_COLORS[team.label] || T.inkSoft : T.inkSoft;
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: color, opacity: e.is_active ? 1 : 0.4 }}
              >
                {e.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: e.is_active ? T.ink : T.inkSoft }}>{e.name}</div>
                <div className="text-[11px] truncate" style={{ color: T.inkSoft }}>{e.email}</div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: T.navySoft, color: T.inkSoft }}>
                {team?.label ?? "—"}
              </span>
              {e.role === "manager" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: T.blueSoft, color: T.blue }}>
                  Manager
                </span>
              )}
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: e.is_active ? T.greenSoft : T.redSoft, color: e.is_active ? T.green : T.red }}
              >
                {e.is_active ? "Active" : "Left"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
