import { useEffect, useMemo, useState } from "react";
import { bulkBookStatus, getMyApprovals, getMyDashboard, requestEdit } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { T, STATUS, STATUS_ORDER, BOOKING_WINDOW, icons } from "../theme";
import { addDays, addMonths, fmtLong, fmtMonth, fmtShort, key, parseKey, startOfMonth, today, TODAY_KEY } from "../dateUtils";
import Icon from "../components/Icon";
import Instructions from "../components/Instructions";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MyStatus() {
  const { session } = useAuth();
  const showToast = useToast();

  const [monthAnchor, setMonthAnchor] = useState(startOfMonth(today()));
  const [activeTab, setActiveTab] = useState("WFO");
  const [selected, setSelected] = useState(() => new Set());
  const [dashboard, setDashboard] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [approvalDate, setApprovalDate] = useState(null);
  const [reason, setReason] = useState("");

  const monthKey = key(monthAnchor);
  const windowEndKey = key(addDays(today(), BOOKING_WINDOW));

  const refreshDashboard = () =>
    getMyDashboard("monthly", monthKey)
      .then(setDashboard)
      .catch((err) => showToast(err.message, "error"));

  const refreshApprovals = () =>
    getMyApprovals()
      .then(setApprovals)
      .catch((err) => showToast(err.message, "error"));

  useEffect(() => {
    setLoading(true);
    refreshDashboard().finally(() => setLoading(false));
  }, [monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshApprovals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const latestApprovalByDate = useMemo(() => {
    const map = {};
    for (const a of approvals) {
      if (!(a.booking_date in map)) map[a.booking_date] = a; // /approvals/mine is newest-first
    }
    return map;
  }, [approvals]);

  const cells = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.days.map((day) => {
      const k = day.date;
      const approval = latestApprovalByDate[k];
      const locked = day.is_past && approval?.status !== "Approved";
      const outOfWindow = !day.is_past && k > windowEndKey;
      const selectable = day.is_working_day && !locked && !outOfWindow;
      return { ...day, k, approval, locked, outOfWindow, selectable };
    });
  }, [dashboard, latestApprovalByDate, windowEndKey]);

  const leadingBlanks = cells.length ? (parseKey(cells[0].k).getDay() + 6) % 7 : 0;
  const trailingBlanks = cells.length ? (7 - ((leadingBlanks + cells.length) % 7)) % 7 : 0;

  const todayCell = cells.find((c) => c.k === TODAY_KEY);
  const capacity = todayCell?.capacity ?? 63;

  const switchTab = (code) => {
    setActiveTab(code);
    setSelected(new Set());
  };

  const toggleDate = (cell) => {
    if (cell.selectable) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(cell.k)) next.delete(cell.k);
        else next.add(cell.k);
        return next;
      });
      return;
    }
    if (cell.locked) {
      setApprovalDate(cell.k);
      setReason("");
    } else if (cell.is_holiday) {
      showToast(`${fmtLong(parseKey(cell.k))} is a holiday${cell.holiday_name ? `: ${cell.holiday_name}` : ""}.`, "error");
    } else if (cell.is_weekend) {
      showToast("Weekends are not bookable — the office is closed Sat & Sun.", "error");
    } else if (cell.outOfWindow) {
      showToast(`Booking window is ${BOOKING_WINDOW} days ahead.`, "error");
    }
  };

  const apply = async () => {
    if (selected.size === 0) return showToast("Select at least one date.", "error");
    setBusy(true);
    try {
      const res = await bulkBookStatus([...selected].sort(), activeTab);
      setSelected(new Set());
      await refreshDashboard();
      const skippedText = res.skipped.length
        ? ` · skipped ${res.skipped.length} (${res.skipped.map((s) => `${fmtShort(parseKey(s.date))}: ${s.reason}`).join(", ")})`
        : "";
      showToast(
        `${STATUS[activeTab].label} applied to ${res.booked.length} date${res.booked.length === 1 ? "" : "s"}${skippedText}`,
        res.booked.length ? "ok" : "error"
      );
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitApprovalRequest = async () => {
    setBusy(true);
    try {
      await requestEdit(approvalDate, reason.trim() || "Requesting edit for this closed date.");
      showToast(`Edit request for ${fmtShort(parseKey(approvalDate))} sent to your manager.`, "ok");
      setApprovalDate(null);
      setReason("");
      await refreshApprovals();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const approvalCell = approvalDate ? cells.find((c) => c.k === approvalDate) : null;
  const approvalStatus = approvalCell?.approval?.status ?? null;

  return (
    <div className="space-y-5">
      <Instructions role={session.role} capacity={capacity} />

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((code) => {
          const s = STATUS[code];
          const isActive = activeTab === code;
          return (
            <button
              key={code}
              onClick={() => switchTab(code)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{
                background: isActive ? s.color : T.panel,
                color: isActive ? "#fff" : s.color,
                border: `2px solid ${s.color}`,
              }}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
        <span className="text-[11px] px-3 py-1.5 rounded-md self-center" style={{ background: T.navySoft, color: T.inkSoft }}>
          Tap dates below to select, then apply {STATUS[activeTab].label} to all of them at once.
        </span>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMonthAnchor((m) => addMonths(m, -1))}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.ink }}
        >
          ‹ Prev
        </button>
        <span className="text-sm font-semibold min-w-[140px] text-center" style={{ color: T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>
          {fmtMonth(monthAnchor)}
        </span>
        <button
          onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.ink }}
        >
          Next ›
        </button>
        <button
          onClick={() => setMonthAnchor(startOfMonth(today()))}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: T.navySoft, color: T.inkSoft }}
        >
          Today
        </button>
        <span className="text-[10px] px-2 py-1 rounded-md ml-auto" style={{ background: T.navySoft, color: T.inkSoft }}>
          Window: {BOOKING_WINDOW} days ahead
        </span>
      </div>

      {loading && !dashboard ? (
        <p className="text-sm" style={{ color: T.inkSoft }}>Loading calendar…</p>
      ) : (
        <div className="rounded-2xl p-5" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="text-center text-[11px] font-semibold" style={{ color: T.inkSoft }}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`lead-${i}`} />
            ))}
            {cells.map((cell) => {
              const isSelected = selected.has(cell.k);
              const isToday = cell.k === TODAY_KEY;
              const closed = cell.is_weekend || cell.is_holiday;
              const dim = closed || cell.outOfWindow;
              const activeColor = STATUS[activeTab].color;
              const activeSoft = STATUS[activeTab].soft;

              return (
                <button
                  key={cell.k}
                  onClick={() => toggleDate(cell)}
                  className="rounded-xl p-2 text-left min-h-[72px] relative transition-transform"
                  style={{
                    background: isSelected ? activeSoft : T.panel,
                    border: `2px solid ${isSelected ? activeColor : isToday ? T.amber : T.line}`,
                    opacity: dim ? 0.4 : 1,
                    cursor: cell.selectable ? "pointer" : cell.locked ? "pointer" : "not-allowed",
                  }}
                  title={
                    cell.is_holiday
                      ? cell.holiday_name
                      : cell.is_weekend
                      ? "Weekend — office closed"
                      : cell.outOfWindow
                      ? "Outside the booking window"
                      : cell.locked
                      ? "Day closed — tap to request manager approval"
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold" style={{ color: isToday ? T.amberDark : T.ink }}>
                      {parseKey(cell.k).getDate()}
                    </span>
                    {cell.locked && <Icon d={icons.lock} size={12} />}
                  </div>
                  {cell.status && (
                    <div
                      className="mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block"
                      style={{ background: STATUS[cell.status].soft, color: STATUS[cell.status].color }}
                    >
                      {STATUS[cell.status].code}
                    </div>
                  )}
                  {cell.is_working_day && cell.show_full && (
                    <div className="mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block" style={{ background: T.redSoft, color: T.red }}>
                      FULL
                    </div>
                  )}
                  {cell.is_holiday && <div className="mt-1 text-[9px]" style={{ color: T.inkSoft }}>Holiday</div>}
                </button>
              );
            })}
            {Array.from({ length: trailingBlanks }, (_, i) => (
              <div key={`trail-${i}`} />
            ))}
          </div>
        </div>
      )}

      {/* Bulk apply */}
      <div className="rounded-2xl p-5 flex flex-wrap items-center gap-4" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="flex-1 min-w-[240px] text-xs" style={{ color: T.inkSoft }}>
          {selected.size > 0
            ? `${selected.size} date${selected.size === 1 ? "" : "s"} selected for ${STATUS[activeTab].label}.`
            : "No dates selected yet — tap dates on the calendar above."}
        </div>
        <button
          onClick={apply}
          disabled={busy || selected.size === 0}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-transform active:scale-95"
          style={{
            background: selected.size === 0 ? T.line : T.amber,
            color: selected.size === 0 ? T.inkSoft : "#3A2600",
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            boxShadow: selected.size === 0 ? "none" : "0 3px 10px rgba(245,165,36,0.4)",
          }}
        >
          Apply {STATUS[activeTab].label} to {selected.size} selected date{selected.size === 1 ? "" : "s"}
        </button>
      </div>

      {/* Edit-approval request panel, for a locked past date the employee tapped */}
      {approvalDate && (
        <div
          className="rounded-2xl p-5 flex flex-wrap items-center gap-4"
          style={{ background: approvalStatus === "Pending" ? "#FFF8EC" : "#FFF8EC", border: `1px solid ${T.amber}` }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <span style={{ color: T.amberDark }}>
              <Icon d={icons.lock} size={20} />
            </span>
            <div>
              <div className="text-sm font-semibold" style={{ color: T.amberDark }}>
                {fmtLong(parseKey(approvalDate))} is closed
                {approvalStatus === "Pending" ? " — approval pending with your manager" : ""}
                {approvalStatus === "Rejected" ? " — your last request was rejected" : ""}
              </div>
              <div className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
                {approvalStatus === "Pending"
                  ? "Ask your manager to approve it in Admin → Edit approvals."
                  : "Request manager approval to unlock a one-time edit for this date."}
              </div>
              {approvalStatus !== "Pending" && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for the edit (optional)"
                  className="mt-2 text-xs rounded-lg px-3 py-1.5 w-full max-w-xs"
                  style={{ border: `1px solid ${T.line}`, color: T.ink }}
                />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {approvalStatus !== "Pending" && (
              <button
                onClick={submitApprovalRequest}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: T.amber, color: "#3A2600" }}
              >
                Request manager approval
              </button>
            )}
            <button
              onClick={() => setApprovalDate(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: T.navySoft, color: T.inkSoft }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
