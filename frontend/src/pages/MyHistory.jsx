import { useEffect, useState } from "react";
import { getMyBookings } from "../api";
import { useToast } from "../ToastContext";
import { T, STATUS } from "../theme";
import { fmtLong, parseKey, TODAY_KEY } from "../dateUtils";
import Stat from "../components/Stat";
import StatusChip from "../components/StatusChip";

export default function MyHistory() {
  const showToast = useToast();
  const [bookings, setBookings] = useState(null);

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch((err) => showToast(err.message, "error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bookings) {
    return <p className="text-sm" style={{ color: T.inkSoft }}>Loading…</p>;
  }

  const wfoDays = bookings.filter((b) => b.status === "WFO").length;
  const wfhDays = bookings.filter((b) => b.status === "WFH").length;
  const leaveDays = bookings.filter((b) => b.status === "L").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <Stat label="WFO days" value={wfoDays} sub="Slots auto-assigned" accent={STATUS.WFO.color} />
        <Stat label="WFH days" value={wfhDays} accent={STATUS.WFH.color} />
        <Stat label="Leave (A) days" value={leaveDays} accent={STATUS.L.color} />
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="px-5 py-3.5 text-sm font-semibold" style={{ color: T.ink, borderBottom: `1px solid ${T.line}` }}>
          My timeline (newest first)
        </div>
        {bookings.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: T.inkSoft }}>Nothing marked yet — head to "My status".</p>
        ) : (
          bookings.map((b) => {
            const s = STATUS[b.status];
            const past = b.booking_date < TODAY_KEY;
            return (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: s.soft }}>{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: T.ink }}>{fmtLong(parseKey(b.booking_date))}</div>
                  <div className="text-[11px]" style={{ color: T.inkSoft }}>
                    {s.label}
                    {past ? " · day closed (edit needs manager approval)" : b.booking_date === TODAY_KEY ? " · editable until day close" : " · editable"}
                    {b.slot_number ? ` · slot ${b.slot_number}` : ""}
                  </div>
                </div>
                <StatusChip code={b.status} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
