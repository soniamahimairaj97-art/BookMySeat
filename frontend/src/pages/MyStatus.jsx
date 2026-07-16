import { useEffect, useState } from "react";
import { bookStatus, getDayStatus, getHolidays, requestEdit } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { T, STATUS, STATUS_ORDER, BOOKING_WINDOW } from "../theme";
import { addDays, fmtLong, fmtShort, isWeekend, key, today, TODAY_KEY } from "../dateUtils";
import Icon from "../components/Icon";
import Instructions from "../components/Instructions";
import StatusChip from "../components/StatusChip";

const PAST_DAYS = 5;

export default function MyStatus() {
  const { session } = useAuth();
  const showToast = useToast();

  const dates = Array.from({ length: PAST_DAYS + BOOKING_WINDOW + 1 }, (_, i) => addDays(today(), i - PAST_DAYS));
  const [dateIdx, setDateIdx] = useState(PAST_DAYS); // today
  const [choice, setChoice] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [status, setStatus] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const d = dates[dateIdx];
  const k = key(d);

  useEffect(() => {
    getHolidays()
      .then(setHolidays)
      .catch((err) => showToast(err.message, "error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStatus = () => {
    getDayStatus(k)
      .then(setStatus)
      .catch((err) => showToast(err.message, "error"));
  };

  useEffect(() => {
    setChoice(null);
    setStatus(null);
    refreshStatus();
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekend = isWeekend(d);
  const holiday = holidays.find((h) => h.holiday_date === k);
  const closedOffice = weekend || !!holiday;
  const isPast = k < TODAY_KEY;
  const wfoCount = status?.wfo_count ?? 0;
  const capacity = status?.capacity ?? 63;
  const full = status?.show_full ?? false;
  const myStatus = status?.my_status ?? null;
  const approvalStatus = status?.my_approval_status ?? null; // Pending | Approved | Rejected | Used | null
  const editUnlocked = !isPast || approvalStatus === "Approved";

  const pick = (code) => {
    if (closedOffice) return;
    if (!editUnlocked) return showToast("This day is closed. Request manager approval to edit.", "error");
    setChoice(choice === code ? null : code);
  };

  const save = async () => {
    if (weekend) return showToast("Weekends are not bookable — the office is closed Sat & Sun.", "error");
    if (holiday) return showToast(`This date is shut down by the manager: ${holiday.name}.`, "error");
    if (isPast && approvalStatus !== "Approved") return showToast("Day closed — previous dates can only be edited after manager approval.", "error");
    if (!choice) return showToast("Pick a category first — WFO, WFH or Leave (A).", "error");
    if (choice === myStatus) return showToast(`Already marked ${STATUS[choice].label} for ${fmtShort(d)} — your slot shows as filled.`, "error");
    if (choice === "WFO" && full && myStatus !== "WFO") {
      return showToast(`Show Full — all ${capacity} WFO slots are booked for ${fmtShort(d)}. Choose WFH or try another day.`, "error");
    }

    const isChange = !!myStatus;
    setBusy(true);
    try {
      const booking = await bookStatus(k, choice);
      setChoice(null);
      refreshStatus();
      if (choice === "WFO") {
        showToast(
          `${isChange ? `Changed ${STATUS[myStatus].code} → WFO` : "WFO booked"} for ${fmtShort(d)} — slot auto-assigned (${booking.slot_number}/${capacity}). No seat selection needed.${isPast ? " Approved edit used." : ""}`,
          "ok"
        );
      } else {
        showToast(
          `${isChange ? `Changed ${STATUS[myStatus].code} → ${STATUS[choice].code}` : `${STATUS[choice].label} marked`} for ${fmtShort(d)}.${myStatus === "WFO" ? " Your WFO slot was released." : ""}${isPast ? " Approved edit used." : ""}`,
          "ok"
        );
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const requestApproval = async () => {
    if (approvalStatus === "Pending") return showToast("Approval request already sent — waiting for your manager.", "error");
    if (approvalStatus === "Approved") return showToast("Already approved — the Edit option is unlocked for this date.", "ok");
    setBusy(true);
    try {
      await requestEdit(k, reason.trim() || "Requesting edit for this closed date.");
      setReason("");
      refreshStatus();
      showToast(`Edit request for ${fmtShort(d)} sent to your manager. You'll be able to edit once it's approved.`, "ok");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Instructions role={session.role} />

      {/* Date strip */}
      <div className="flex flex-wrap items-center gap-2">
        {dates.map((dd, i) => {
          const kk = key(dd);
          const we = isWeekend(dd);
          const hol = holidays.find((h) => h.holiday_date === kk);
          const off = we || hol;
          const past = kk < TODAY_KEY;
          const isToday = kk === TODAY_KEY;
          return (
            <button
              key={kk}
              onClick={() => setDateIdx(i)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{
                background: i === dateIdx ? (off ? T.redSoft : T.ink) : T.panel,
                color: i === dateIdx ? (off ? T.red : "#fff") : off ? "#B0BCC8" : past ? "#8A98A6" : T.inkSoft,
                border: `1px solid ${i === dateIdx ? (off ? T.red : T.ink) : T.line}`,
                textDecoration: off && i !== dateIdx ? "line-through" : "none",
              }}
            >
              {fmtShort(dd)}
              {isToday && <span className="block text-[9px] font-semibold" style={{ color: i === dateIdx ? T.amber : T.amberDark }}>TODAY · EDITABLE</span>}
              {past && !off && <span className="block text-[9px] font-semibold" style={{ color: i === dateIdx ? "#C6D3DF" : "#B0BCC8" }}>🔒 CLOSED DAY</span>}
              {off && <span className="block text-[9px] font-semibold" style={{ color: i === dateIdx ? T.red : "#C48A8A" }}>{hol ? "HOLIDAY" : "WEEKEND"}</span>}
            </button>
          );
        })}
        <span className="text-[10px] px-2 py-1 rounded-md" style={{ background: T.navySoft, color: T.inkSoft }}>Window: {BOOKING_WINDOW} days ahead</span>
      </div>

      {closedOffice ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <div className="text-4xl mb-3">{weekend ? "🌤️" : "🎉"}</div>
          <div className="text-lg font-semibold" style={{ color: T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>
            Office closed — {weekend ? "weekend" : holiday.name}
          </div>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: T.inkSoft }}>
            {fmtLong(d)} is not bookable. {weekend ? "Booking is available Monday to Friday only." : "This date was shut down by the manager as a company holiday."}
          </p>
        </div>
      ) : !status ? (
        <p className="text-sm" style={{ color: T.inkSoft }}>Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: full ? T.redSoft : T.greenSoft, color: full ? T.red : T.green }}>
              {full ? "SHOW FULL — WFO blocked" : `WFO slots: ${wfoCount}/${capacity} filled · ${capacity - wfoCount} open`}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: T.navySoft, color: T.inkSoft }}>
              WFH & Leave (A) are never capacity-blocked
            </span>
          </div>

          {isPast && (
            <div
              className="rounded-2xl p-5 flex flex-wrap items-center gap-4"
              style={{ background: approvalStatus === "Approved" ? "#F0FAF6" : "#FFF8EC", border: `1px solid ${approvalStatus === "Approved" ? T.green : T.amber}` }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <span style={{ color: approvalStatus === "Approved" ? T.green : T.amberDark }}><Icon d={["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"]} size={20} /></span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: approvalStatus === "Approved" ? T.green : T.amberDark }}>
                    {approvalStatus === "Approved"
                      ? "Manager approved — Edit unlocked for this date (one-time)"
                      : approvalStatus === "Pending"
                      ? "Approval pending with your manager"
                      : "Day closed — editing a previous date needs manager approval"}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
                    {approvalStatus === "Approved"
                      ? "Update your category below; the edit consumes the approval."
                      : approvalStatus === "Pending"
                      ? "Ask your manager to approve it in Admin → Edit approvals."
                      : "You can freely edit today and future dates. Past dates lock at day close."}
                  </div>
                  {approvalStatus !== "Approved" && approvalStatus !== "Pending" && (
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
              {approvalStatus !== "Approved" && (
                <button
                  onClick={requestApproval}
                  disabled={busy || approvalStatus === "Pending"}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: approvalStatus === "Pending" ? T.line : T.amber, color: approvalStatus === "Pending" ? T.inkSoft : "#3A2600" }}
                >
                  {approvalStatus === "Pending" ? "Request sent ✓" : "Request manager approval"}
                </button>
              )}
            </div>
          )}

          <div className="rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
            <div className="text-sm font-semibold mb-1" style={{ color: T.ink }}>Mark your day — {fmtLong(d)}</div>
            <p className="text-xs mb-5" style={{ color: T.inkSoft }}>
              One category per date. No seat to pick — WFO slots are auto-assigned from the {capacity} available.
            </p>
            <div className="flex flex-wrap gap-4">
              {STATUS_ORDER.map((code) => {
                const s = STATUS[code];
                const isCurrent = myStatus === code;
                const isChoice = choice === code;
                const wfoBlocked = code === "WFO" && full && !isCurrent;
                const disabled = !editUnlocked || wfoBlocked;
                return (
                  <button
                    key={code}
                    onClick={() => !disabled && pick(code)}
                    className="flex-1 min-w-[180px] rounded-2xl p-5 text-left transition-transform"
                    style={{
                      background: isChoice ? s.soft : T.panel,
                      border: `2px solid ${isChoice ? s.color : isCurrent ? s.color : T.line}`,
                      opacity: disabled ? 0.45 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                      transform: isChoice ? "translateY(-2px)" : "none",
                      boxShadow: isChoice ? "0 4px 14px rgba(22,50,79,0.12)" : "none",
                    }}
                  >
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="text-sm font-semibold" style={{ color: s.color }}>{s.label}</div>
                    <div className="text-[11px] mt-1" style={{ color: T.inkSoft }}>
                      {code === "WFO" ? (wfoBlocked ? "Show Full — no slots left" : `Auto slot · ${capacity - wfoCount} open`) : code === "WFH" ? "No slot needed" : "Marks you absent for the day"}
                    </div>
                    {isCurrent && (
                      <div className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block" style={{ background: s.color, color: "#fff" }}>
                        SLOT FILLED — YOUR CURRENT ENTRY
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl p-5 flex flex-wrap items-center gap-4" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-semibold" style={{ color: T.ink }}>{session.name}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: T.inkSoft }}>
                Current for {fmtShort(d)}: <StatusChip code={myStatus} />
                {myStatus && editUnlocked && <span>· pick another category to change it</span>}
                {myStatus && !editUnlocked && <span>· locked (day closed)</span>}
              </div>
            </div>
            <button
              onClick={save}
              disabled={busy || !editUnlocked || !choice}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-transform active:scale-95"
              style={{
                background: !editUnlocked || !choice ? T.line : T.amber,
                color: !editUnlocked || !choice ? T.inkSoft : "#3A2600",
                cursor: !editUnlocked || !choice ? "not-allowed" : "pointer",
                boxShadow: !editUnlocked || !choice ? "none" : "0 3px 10px rgba(245,165,36,0.4)",
              }}
            >
              {!editUnlocked
                ? "🔒 Locked — needs approval"
                : myStatus && choice
                ? `Change ${STATUS[myStatus].code} → ${STATUS[choice].code}`
                : choice
                ? `Confirm ${STATUS[choice].code} for ${fmtShort(d)}`
                : myStatus
                ? "Slot filled ✓"
                : "Pick a category"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
