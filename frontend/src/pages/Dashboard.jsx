import { useEffect, useState } from "react";
import { getMyDashboard, getTeamDashboard } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { T, STATUS } from "../theme";
import { fmtLong, fmtShort, key, parseKey, today } from "../dateUtils";
import Stat from "../components/Stat";
import CapacityRing from "../components/CapacityRing";
import StatusChip from "../components/StatusChip";

const TEAM_COLORS = { PFG: "#16324F", Gear_Box: "#0E8A6A", e_Motor: "#B87400" };
const teamColor = (name) => TEAM_COLORS[name] || T.inkSoft;

const VIEW_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

function ViewAndDatePicker({ views, view, setView, selectedDate, setSelectedDate, rangeLabel }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className="px-3.5 py-2 rounded-xl text-xs font-medium"
          style={{
            background: v === view ? T.ink : T.panel,
            color: v === view ? "#fff" : T.inkSoft,
            border: `1px solid ${v === view ? T.ink : T.line}`,
          }}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
      <input
        type="date"
        value={key(selectedDate)}
        onChange={(e) => setSelectedDate(parseKey(e.target.value))}
        className="px-3 py-2 rounded-xl text-xs font-medium"
        style={{ border: `1px solid ${T.line}`, color: T.ink, background: T.panel }}
      />
      <span className="text-xs ml-1" style={{ color: T.inkSoft }}>{rangeLabel}</span>
    </div>
  );
}

function ManagerDashboard({ data, view, setView, selectedDate, setSelectedDate }) {
  const { teams: per, totals: total, capacity, show_full: full, avg_wfo_utilization, days, working_days, start, end } = data;
  const isDaily = view === "daily";

  const seg = (t) => [
    { code: "WFO", v: t.wfo, color: STATUS.WFO.color },
    { code: "WFH", v: t.wfh, color: STATUS.WFH.color },
    { code: "L", v: t.leave, color: STATUS.L.color },
    { code: "A", v: t.absent, color: "#B0BCC8" },
  ];

  const rangeLabel = isDaily ? fmtLong(parseKey(start)) : `${fmtShort(parseKey(start))} – ${fmtShort(parseKey(end))} · ${working_days} working days`;

  return (
    <div className="space-y-5">
      <ViewAndDatePicker
        views={["daily", "weekly", "monthly"]}
        view={view}
        setView={setView}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        rangeLabel={rangeLabel}
      />

      <div className="flex flex-wrap gap-4">
        <Stat
          label={isDaily ? "WFO (slots filled)" : "WFO (person-days)"}
          value={isDaily ? `${total.wfo}/${capacity}` : total.wfo}
          sub={isDaily ? (full ? "Show Full — WFO booking blocked" : `${capacity - total.wfo} slots remaining`) : `across ${working_days} working days`}
          accent={isDaily && full ? T.red : STATUS.WFO.color}
        />
        <Stat label="WFH" value={total.wfh} sub={isDaily ? "Working from home" : "person-days"} accent={STATUS.WFH.color} />
        <Stat label="Leave (A)" value={total.leave} sub={isDaily ? "Planned leave" : "person-days"} accent={STATUS.L.color} />
        <Stat
          label="Absent / not marked"
          value={total.absent}
          sub={`of ${total.headcount} active employees${isDaily ? "" : " × working days"}`}
          accent="#8A98A6"
        />
        {!isDaily && (
          <Stat
            label="Avg WFO utilization"
            value={`${Math.round((avg_wfo_utilization ?? 0) * 100)}%`}
            sub="vs capacity, averaged per working day"
            accent={STATUS.WFO.color}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-5">
        {isDaily && (
          <div className="rounded-2xl p-6 flex-1 min-w-[300px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: T.ink }}>WFO slot utilization</h3>
            <CapacityRing occupied={total.wfo} capacity={capacity} />
          </div>
        )}

        <div className="rounded-2xl p-6 flex-[1.6] min-w-[340px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink }}>
            Team-wise split — WFO · WFH · Leave · Absent{isDaily ? "" : " (period totals)"}
          </h3>
          <p className="text-[11px] mb-4" style={{ color: T.inkSoft }}>
            Headcount: {per.map((t) => `${t.name} ${t.headcount}`).join(" · ")} ({total.headcount} active{isDaily ? `, ${capacity} WFO slots` : ""}).
          </p>
          <div className="space-y-4">
            {per.map((t) => {
              const denom = isDaily ? t.headcount : t.wfo + t.wfh + t.leave + t.absent || 1;
              return (
                <div key={t.name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium flex items-center gap-1.5" style={{ color: T.ink }}>
                      <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: teamColor(t.name) }} />
                      {t.name}
                    </span>
                    <span style={{ color: T.inkSoft }}>
                      WFO {t.wfo} · WFH {t.wfh} · Leave {t.leave} · Absent {t.absent} · {t.headcount} members
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex" style={{ background: T.navySoft }}>
                    {seg(t).map(
                      (s) =>
                        s.v > 0 && (
                          <div
                            key={s.code}
                            title={`${s.code}: ${s.v}`}
                            style={{ width: `${(s.v / denom) * 100}%`, background: s.color, transition: "width 500ms ease" }}
                          />
                        )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-[11px]" style={{ color: T.inkSoft }}>
            <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: STATUS.WFO.color }} /> WFO</span>
            <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: STATUS.WFH.color }} /> WFH</span>
            <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: STATUS.L.color }} /> Leave (A)</span>
            <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: "#B0BCC8" }} /> Absent / not marked</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="rounded-2xl overflow-hidden flex-1 min-w-[320px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <div className="px-5 py-3.5 text-sm font-semibold" style={{ color: T.ink, borderBottom: `1px solid ${T.line}` }}>
            Split table — {isDaily ? fmtShort(parseKey(start)) : VIEW_LABELS[view]}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: T.inkSoft }}>
                {["Team", "Members", "WFO", "WFH", "Leave (A)", "Absent"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ borderBottom: `1px solid ${T.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {per.map((t) => (
                <tr key={t.name} style={{ color: T.ink }}>
                  <td className="px-4 py-2.5 font-medium" style={{ borderBottom: `1px solid ${T.line}` }}>{t.name}</td>
                  <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}>{t.headcount}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ borderBottom: `1px solid ${T.line}`, color: STATUS.WFO.color }}>{t.wfo}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ borderBottom: `1px solid ${T.line}`, color: STATUS.WFH.color }}>{t.wfh}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ borderBottom: `1px solid ${T.line}`, color: STATUS.L.color }}>{t.leave}</td>
                  <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${T.line}`, color: "#8A98A6" }}>{t.absent}</td>
                </tr>
              ))}
              <tr style={{ color: T.ink, background: "#F7FAFC" }}>
                <td className="px-4 py-2.5 font-bold">Total</td>
                <td className="px-4 py-2.5 font-bold">{total.headcount}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: STATUS.WFO.color }}>{total.wfo}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: STATUS.WFH.color }}>{total.wfh}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: STATUS.L.color }}>{total.leave}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: "#8A98A6" }}>{total.absent}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {!isDaily && (
          <div className="rounded-2xl p-6 flex-1 min-w-[320px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink }}>WFO booking trend — {VIEW_LABELS[view].toLowerCase()} view</h3>
            <p className="text-[11px] mb-4" style={{ color: T.inkSoft }}>Slots filled per working day vs capacity that day.</p>
            <div className="flex items-end gap-2 h-32 overflow-x-auto">
              {days.map((d) => {
                const dd = parseKey(d.date);
                const cap = d.capacity || 1;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-[24px]">
                    <span className="text-[10px] font-semibold" style={{ color: d.is_working_day ? T.ink : "#B0BCC8" }}>
                      {d.is_working_day ? d.wfo_count : "—"}
                    </span>
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${d.is_working_day ? Math.max((d.wfo_count / cap) * 100, 4) : 4}%`,
                        background: !d.is_working_day ? T.line : d.show_full ? T.red : d.wfo_count / cap > 0.7 ? T.amber : T.green,
                        transition: "height 400ms ease",
                      }}
                    />
                    <span className="text-[9px]" style={{ color: T.inkSoft }}>{dd.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeDashboard({ data, view, setView, selectedDate, setSelectedDate }) {
  const { totals, days, start, end } = data;
  const selectedDay = days.find((d) => d.date === key(selectedDate));
  const rangeLabel = `${fmtShort(parseKey(start))} – ${fmtShort(parseKey(end))} · ${totals.working_days} working days`;

  return (
    <div className="space-y-5">
      <ViewAndDatePicker
        views={["weekly", "monthly"]}
        view={view}
        setView={setView}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        rangeLabel={rangeLabel}
      />

      <div className="flex flex-wrap gap-4">
        <Stat label="WFO" value={totals.wfo} sub={`of ${totals.working_days} working days`} accent={STATUS.WFO.color} />
        <Stat label="WFH" value={totals.wfh} sub="Working from home" accent={STATUS.WFH.color} />
        <Stat label="Leave (A)" value={totals.leave} sub="Planned leave" accent={STATUS.L.color} />
        <Stat label="Absent / not marked" value={totals.absent} sub="days without an entry" accent="#8A98A6" />
      </div>

      {selectedDay?.is_working_day && (
        <div className="rounded-2xl px-5 py-3.5 text-xs flex items-center gap-2" style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.inkSoft }}>
          <span className="text-sm font-semibold" style={{ color: selectedDay.show_full ? T.red : T.ink }}>
            WFO slots on {fmtShort(parseKey(selectedDay.date))}: {selectedDay.wfo_count}/{selectedDay.capacity} filled
          </span>
          {selectedDay.show_full && <span className="font-semibold" style={{ color: T.red }}>· Show Full</span>}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="px-5 py-3.5 text-sm font-semibold" style={{ color: T.ink, borderBottom: `1px solid ${T.line}` }}>
          My entries — {VIEW_LABELS[view]}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: T.inkSoft }}>
              {["Date", "Day", "My status"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ borderBottom: `1px solid ${T.line}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} style={{ color: T.ink }}>
                <td className="px-4 py-2.5 font-medium" style={{ borderBottom: `1px solid ${T.line}` }}>{fmtShort(parseKey(d.date))}</td>
                <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${T.line}`, color: T.inkSoft }}>
                  {d.is_weekend ? "Weekend" : d.is_holiday ? `Holiday — ${d.holiday_name}` : "Working day"}
                </td>
                <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}>
                  {d.is_working_day ? <StatusChip code={d.status} /> : <span style={{ color: "#B0BCC8" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { session } = useAuth();
  const showToast = useToast();
  const isManager = session.role === "manager" || session.role === "admin";

  const [selectedDate, setSelectedDate] = useState(today());
  const [view, setView] = useState(isManager ? "daily" : "weekly");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const dateKey = key(selectedDate);

  useEffect(() => {
    setLoading(true);
    const fetcher = isManager ? getTeamDashboard : getMyDashboard;
    fetcher(view, dateKey)
      .then(setData)
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [view, dateKey, isManager]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return <p className="text-sm" style={{ color: T.inkSoft }}>Loading dashboard…</p>;
  }
  if (!data) return null;

  return isManager ? (
    <ManagerDashboard data={data} view={view} setView={setView} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
  ) : (
    <EmployeeDashboard data={data} view={view} setView={setView} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
  );
}
