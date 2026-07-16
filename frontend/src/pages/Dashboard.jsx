import { useEffect, useState } from "react";
import { getDashboard, getHolidays } from "../api";
import { useToast } from "../ToastContext";
import { T, STATUS } from "../theme";
import { addDays, fmtLong, fmtShort, isWeekend, key, today } from "../dateUtils";
import Stat from "../components/Stat";
import CapacityRing from "../components/CapacityRing";

const TEAM_COLORS = { PFG: "#16324F", Gear_Box: "#0E8A6A", e_Motor: "#B87400" };
const teamColor = (name) => TEAM_COLORS[name] || T.inkSoft;

export default function Dashboard() {
  const showToast = useToast();
  const [dayOffset, setDayOffset] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const d = addDays(today(), dayOffset);
  const k = key(d);
  const closed = isWeekend(d) || holidays.some((h) => h.holiday_date === k);

  useEffect(() => {
    getHolidays()
      .then(setHolidays)
      .catch((err) => showToast(err.message, "error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    getDashboard(k)
      .then(setData)
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const days = Array.from({ length: 8 }, (_, i) => addDays(today(), i));
    Promise.all(
      days.map((dd) => {
        const kk = key(dd);
        const off = isWeekend(dd) || holidays.some((h) => h.holiday_date === kk);
        if (off) return Promise.resolve({ d: dd, closed: true, count: 0 });
        return getDashboard(kk).then((res) => ({ d: dd, closed: false, count: res.totals.wfo }));
      })
    )
      .then(setTrend)
      .catch((err) => showToast(err.message, "error"));
  }, [holidays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return <p className="text-sm" style={{ color: T.inkSoft }}>Loading dashboard…</p>;
  }
  if (!data) return null;

  const { teams: per, totals: total, capacity, show_full: full } = data;

  const seg = (t) => [
    { code: "WFO", v: t.wfo, color: STATUS.WFO.color },
    { code: "WFH", v: t.wfh, color: STATUS.WFH.color },
    { code: "L", v: t.leave, color: STATUS.L.color },
    { code: "A", v: t.absent, color: "#B0BCC8" },
  ];

  return (
    <div className="space-y-5">
      {/* Date scope */}
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2].map((o) => {
          const dd = addDays(today(), o);
          return (
            <button
              key={o}
              onClick={() => setDayOffset(o)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium"
              style={{
                background: o === dayOffset ? T.ink : T.panel,
                color: o === dayOffset ? "#fff" : T.inkSoft,
                border: `1px solid ${o === dayOffset ? T.ink : T.line}`,
              }}
            >
              {o === 0 ? "Today" : fmtShort(dd)}
            </button>
          );
        })}
        <span className="text-xs ml-1" style={{ color: T.inkSoft }}>
          {fmtLong(d)}
          {closed ? " · office closed" : ""}
        </span>
      </div>

      {/* Overall split */}
      <div className="flex flex-wrap gap-4">
        <Stat
          label="WFO (slots filled)"
          value={`${total.wfo}/${capacity}`}
          sub={full ? "Show Full — WFO booking blocked" : `${capacity - total.wfo} slots remaining`}
          accent={full ? T.red : STATUS.WFO.color}
        />
        <Stat label="WFH" value={total.wfh} sub="Working from home" accent={STATUS.WFH.color} />
        <Stat label="Leave (A)" value={total.leave} sub="Planned leave" accent={STATUS.L.color} />
        <Stat
          label="Absent / not marked"
          value={total.absent}
          sub={`of ${total.headcount} active employees`}
          accent="#8A98A6"
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="rounded-2xl p-6 flex-1 min-w-[300px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: T.ink }}>WFO slot utilization</h3>
          <CapacityRing occupied={total.wfo} capacity={capacity} />
        </div>

        <div className="rounded-2xl p-6 flex-[1.6] min-w-[340px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink }}>Team-wise split — WFO · WFH · Leave · Absent</h3>
          <p className="text-[11px] mb-4" style={{ color: T.inkSoft }}>
            Headcount: {per.map((t) => `${t.name} ${t.headcount}`).join(" · ")} ({total.headcount} active, {capacity} WFO slots).
          </p>
          <div className="space-y-4">
            {per.map((t) => (
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
                          style={{ width: `${(s.v / t.headcount) * 100}%`, background: s.color, transition: "width 500ms ease" }}
                        />
                      )
                  )}
                </div>
              </div>
            ))}
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
            Split table — {fmtShort(d)}
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

        <div className="rounded-2xl p-6 flex-1 min-w-[320px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink }}>WFO booking trend — next 8 days</h3>
          <p className="text-[11px] mb-4" style={{ color: T.inkSoft }}>Slots filled per day vs the {capacity} capacity.</p>
          <div className="flex items-end gap-2 h-32">
            {trend.map((t) => (
              <div key={key(t.d)} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold" style={{ color: t.closed ? "#B0BCC8" : T.ink }}>{t.closed ? "—" : t.count}</span>
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${t.closed ? 4 : Math.max((t.count / capacity) * 100, 4)}%`,
                    background: t.closed ? T.line : t.count >= capacity ? T.red : t.count / capacity > 0.7 ? T.amber : T.green,
                    transition: "height 400ms ease",
                  }}
                />
                <span className="text-[9px]" style={{ color: T.inkSoft }}>{t.d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
