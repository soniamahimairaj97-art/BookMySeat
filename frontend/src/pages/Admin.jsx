import { useEffect, useState } from "react";
import {
  addEmployee,
  addHoliday,
  decideApproval,
  deleteHoliday,
  exportExcel,
  getCapacity,
  getEmployees,
  getHolidays,
  getPendingApprovals,
  getTeams,
  previewCapacity,
  setCapacity,
} from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { T } from "../theme";
import { addDays, fmtLong, fmtShort, isWeekend, key, parseKey, today, TODAY_KEY } from "../dateUtils";
import Instructions from "../components/Instructions";

export default function Admin() {
  const { session } = useAuth();
  const showToast = useToast();

  const [pending, setPending] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [capacity, setCapacityState] = useState(null); // { seat_count, effective_from, history[] }
  const [loading, setLoading] = useState(true);

  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empTeam, setEmpTeam] = useState("");
  const [empPassword, setEmpPassword] = useState("");

  const [holDate, setHolDate] = useState("");
  const [holName, setHolName] = useState("");

  const [capSeatCount, setCapSeatCount] = useState("");
  const [capEffectiveFrom, setCapEffectiveFrom] = useState(TODAY_KEY);
  const [capConfirm, setCapConfirm] = useState(null); // { seat_count, effective_from, old_count, released }
  const [capBusy, setCapBusy] = useState(false);

  const upcoming = Array.from({ length: 14 }, (_, i) => addDays(today(), i)).filter((d) => !isWeekend(d));

  const loadAll = () => {
    setLoading(true);
    Promise.all([getPendingApprovals(), getEmployees(), getTeams(), getHolidays(), getCapacity()])
      .then(([ap, emps, tms, hols, cap]) => {
        setPending(ap);
        setEmployees(emps);
        setTeams(tms);
        setHolidays(hols);
        setCapacityState(cap);
        setCapSeatCount(String(cap.seat_count));
      })
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const decide = async (id, ok) => {
    try {
      await decideApproval(id, ok);
      showToast(
        ok
          ? "Approved — the employee's Edit option is now unlocked for that date (one-time edit)."
          : "Rejected — the date stays locked for the employee.",
        ok ? "ok" : "error"
      );
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const submitEmployee = async () => {
    const name = empName.trim();
    const email = empEmail.trim().toLowerCase();
    if (!name) return showToast("Enter the new employee's full name.", "error");
    if (!email) return showToast("Enter the new employee's work email.", "error");
    if (!empTeam) return showToast("Pick a team for the new employee.", "error");
    if (!empPassword || empPassword.length < 6) return showToast("Set a temporary password (min 6 characters).", "error");

    try {
      const created = await addEmployee({ name, email, team_id: parseInt(empTeam, 10), role: "employee", password: empPassword });
      setEmpName("");
      setEmpEmail("");
      setEmpTeam("");
      setEmpPassword("");
      const teamName = teamById[created.team_id]?.label ?? "";
      showToast(`${name} added to ${teamName} as Active — they can book WFO / WFH / Leave immediately.`, "ok");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const submitHoliday = async () => {
    if (!holDate) return showToast("Pick a date for the holiday.", "error");
    if (!holName.trim()) return showToast("Give the holiday a name (e.g. Diwali).", "error");
    try {
      await addHoliday(holDate, holName.trim());
      setHolDate("");
      setHolName("");
      showToast("Holiday added — that date is now shut down for booking.", "ok");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const removeHoliday = async (h) => {
    try {
      await deleteHoliday(h.holiday_date);
      showToast(`${h.name} removed — the date is open for booking again.`, "ok");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const runExport = async () => {
    try {
      const { blob, filename } = await exportExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Split report downloaded (Excel): per-day WFO / WFH / L / A with team totals.", "ok");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const applyCapacity = async (seatCount, effectiveFrom) => {
    setCapBusy(true);
    try {
      const result = await setCapacity(seatCount, effectiveFrom);
      setCapConfirm(null);
      showToast(
        result.released > 0
          ? `Capacity ${result.old_count} → ${result.new_count} from ${fmtShort(parseKey(result.effective_from))} — ${result.released} WFO booking(s) released to WFH.`
          : result.new_count > result.old_count
          ? `Capacity ${result.old_count} → ${result.new_count} from ${fmtShort(parseKey(result.effective_from))} — ${result.new_count - result.old_count} more slot(s) per day.`
          : `Capacity set to ${result.new_count} from ${fmtShort(parseKey(result.effective_from))}.`,
        "ok"
      );
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCapBusy(false);
    }
  };

  const submitCapacity = async () => {
    const seatCount = parseInt(capSeatCount, 10);
    const effectiveFrom = capEffectiveFrom || TODAY_KEY;
    if (!Number.isFinite(seatCount)) return showToast("Enter a seat count.", "error");
    if (seatCount < 10 || seatCount > 200) return showToast("Seat count must be between 10 and 200.", "error");

    if (capacity && seatCount < capacity.seat_count) {
      setCapBusy(true);
      try {
        const preview = await previewCapacity(seatCount, effectiveFrom);
        if (preview.released > 0) {
          setCapConfirm({ seat_count: seatCount, effective_from: effectiveFrom, old_count: preview.old_count, released: preview.released });
          return;
        }
        await applyCapacity(seatCount, effectiveFrom);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setCapBusy(false);
      }
      return;
    }

    applyCapacity(seatCount, effectiveFrom);
  };

  if (loading) return <p className="text-sm" style={{ color: T.inkSoft }}>Loading…</p>;

  const activeCount = employees.filter((e) => e.is_active).length;

  return (
    <div className="space-y-5">
      <Instructions role={session.role} capacity={capacity?.seat_count} />

      {/* Seat capacity */}
      <div className="rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Seat capacity</h3>
        <p className="text-xs mt-1 mb-4" style={{ color: T.inkSoft }}>
          WFO slots available per day. Current: <b>{capacity?.seat_count}</b> (effective {fmtLong(parseKey(capacity?.effective_from))}). Admin/Manager only.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="w-32">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>Seat count</span>
            <input
              type="number"
              min={10}
              max={200}
              value={capSeatCount}
              onChange={(e) => setCapSeatCount(e.target.value)}
              className="w-full mt-1 text-sm rounded-lg px-3 py-2"
              style={{ border: `1px solid ${T.line}`, color: T.ink }}
            />
          </label>
          <label className="w-44">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>Effective from</span>
            <input
              type="date"
              min={TODAY_KEY}
              value={capEffectiveFrom}
              onChange={(e) => setCapEffectiveFrom(e.target.value)}
              className="w-full mt-1 text-sm rounded-lg px-3 py-2"
              style={{ border: `1px solid ${T.line}`, color: T.ink }}
            />
          </label>
          <button
            onClick={submitCapacity}
            disabled={capBusy}
            className="text-xs font-semibold px-4 py-2.5 rounded-lg"
            style={{ background: T.ink, color: "#fff", opacity: capBusy ? 0.6 : 1 }}
          >
            Apply
          </button>
        </div>
        <p className="text-[10px] mt-3" style={{ color: T.inkSoft }}>
          Range: 10–200. Effective date can't be in the past. Reducing capacity releases the latest bookers
          (by booking time) to WFH — earliest bookers keep their slot.
        </p>

        {capacity?.history?.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.line}` }}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: T.inkSoft }}>History</div>
            <div className="space-y-1">
              {capacity.history.map((h) => (
                <div key={h.id} className="text-[11px] flex items-center gap-2" style={{ color: T.inkSoft }}>
                  <span style={{ color: T.ink }}>{h.seat_count}</span> seats from {fmtShort(parseKey(h.effective_from))}
                  {h.previous_count != null && <span>· was {h.previous_count}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {capConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,50,79,0.45)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: T.panel }}>
            <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Confirm capacity reduction</h3>
            <p className="text-xs mt-2" style={{ color: T.inkSoft }}>
              Reducing {capConfirm.old_count} → {capConfirm.seat_count} from {fmtShort(parseKey(capConfirm.effective_from))} will
              release <b>{capConfirm.released}</b> WFO booking(s) (latest bookers first) and convert them to WFH. Continue?
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setCapConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold"
                style={{ background: T.navySoft, color: T.inkSoft }}
              >
                Cancel
              </button>
              <button
                onClick={() => applyCapacity(capConfirm.seat_count, capConfirm.effective_from)}
                disabled={capBusy}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold"
                style={{ background: T.red, color: "#fff", opacity: capBusy ? 0.6 : 1 }}
              >
                Reduce & release {capConfirm.released}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit approvals queue */}
      <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Edit approvals — closed-day change requests</h3>
          <p className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
            Employees can't edit a previous (closed) date on their own. Approving unlocks a one-time edit for that employee & date.
          </p>
        </div>
        {pending.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: T.inkSoft }}>No pending requests.</p>
        ) : (
          pending.map((p) => {
            const emp = employeeById[p.employee_id];
            const team = emp ? teamById[emp.team_id] : null;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${T.line}` }}>
                <div className="flex-1 min-w-[220px]">
                  <div className="text-sm font-medium" style={{ color: T.ink }}>{emp?.name} · {team?.label ?? ""}</div>
                  <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: T.inkSoft }}>
                    Wants to edit {fmtLong(parseKey(p.booking_date))} · reason: {p.reason || "—"}
                  </div>
                </div>
                <button onClick={() => decide(p.id, true)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: T.green, color: "#fff" }}>
                  Approve — unlock edit
                </button>
                <button onClick={() => decide(p.id, false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: T.redSoft, color: T.red }}>
                  Reject
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add new employee */}
      <div className="rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Add new employee</h3>
        <p className="text-xs mt-1 mb-4" style={{ color: T.inkSoft }}>
          New joiners are created as <b>Active</b> and can book WFO / WFH / Leave (A) immediately. Managers only.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[160px]">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>Full name</span>
            <input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="e.g. Kavya Menon"
              className="w-full mt-1 text-sm rounded-lg px-3 py-2" style={{ border: `1px solid ${T.line}`, color: T.ink }} />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>Work email</span>
            <input value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} placeholder="name@company.com"
              className="w-full mt-1 text-sm rounded-lg px-3 py-2" style={{ border: `1px solid ${T.line}`, color: T.ink }} />
          </label>
          <label className="w-40">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>Team</span>
            <select value={empTeam} onChange={(e) => setEmpTeam(e.target.value)}
              className="w-full mt-1 text-sm rounded-lg px-3 py-2" style={{ border: `1px solid ${T.line}`, color: T.ink, background: T.panel }}>
              <option value="">Pick a team…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="w-40">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: T.inkSoft }}>Temp password</span>
            <input type="text" value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} placeholder="min 6 chars"
              className="w-full mt-1 text-sm rounded-lg px-3 py-2" style={{ border: `1px solid ${T.line}`, color: T.ink }} />
          </label>
          <button onClick={submitEmployee} className="text-xs font-semibold px-4 py-2.5 rounded-lg" style={{ background: T.ink, color: "#fff" }}>
            ＋ Add employee
          </button>
        </div>
        <p className="text-[10px] mt-3" style={{ color: T.inkSoft }}>
          Validations: name, valid & unique email, and team are required. Current headcount: {activeCount} active
          ({teams.map((t) => `${t.label} ${employees.filter((e) => e.team_id === t.id && e.is_active).length}`).join(" · ")}).
        </p>
      </div>

      {/* Holidays */}
      <div className="rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Company holidays</h3>
        <p className="text-xs mt-1 mb-4" style={{ color: T.inkSoft }}>Shut down a date — employees can't book it.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={holDate} onChange={(e) => setHolDate(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 flex-1 min-w-[140px]" style={{ border: `1px solid ${T.line}`, color: T.ink, background: T.panel }}>
            <option value="">Pick a date…</option>
            {upcoming.map((d) => <option key={key(d)} value={key(d)}>{fmtShort(d)}</option>)}
          </select>
          <input value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="Holiday name"
            className="text-xs rounded-lg px-3 py-2 flex-1 min-w-[140px]" style={{ border: `1px solid ${T.line}`, color: T.ink }} />
          <button onClick={submitHoliday} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: T.ink, color: "#fff" }}>
            Shut down date
          </button>
        </div>
        {holidays.length === 0 ? (
          <p className="text-xs" style={{ color: T.inkSoft }}>No holidays yet. Weekends are always closed automatically.</p>
        ) : (
          holidays.map((h) => (
            <div key={h.holiday_date} className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${T.line}` }}>
              <div>
                <div className="text-sm font-medium" style={{ color: T.ink }}>{h.name}</div>
                <div className="text-[11px]" style={{ color: T.inkSoft }}>{fmtLong(parseKey(h.holiday_date))}</div>
              </div>
              <button onClick={() => removeHoliday(h)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: T.redSoft, color: T.red }}>
                Reopen
              </button>
            </div>
          ))
        )}
      </div>

      {/* Export */}
      <div className="rounded-2xl p-6 flex flex-wrap items-center gap-4" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="flex-1 min-w-[240px]">
          <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Split report (Excel)</h3>
          <p className="text-xs mt-1" style={{ color: T.inkSoft }}>
            Current month — per employee per day: WFO / WFH / L / A, plus team-wise totals. Managers only.
          </p>
        </div>
        <button onClick={runExport} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: T.green, color: "#fff" }}>
          ⬇ Export Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}
