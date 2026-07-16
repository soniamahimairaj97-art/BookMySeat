import React, { useState } from "react";
import * as XLSX from "xlsx";

/* ————— Design tokens ————— */
const T = {
  ink: "#16324F", inkSoft: "#3D5A76", canvas: "#EDF1F5", panel: "#FFFFFF",
  line: "#D9E1E9", amber: "#F5A524", amberDark: "#B87400", green: "#0E8A6A",
  greenSoft: "#E2F5EE", red: "#D64545", redSoft: "#FDECEC", navySoft: "#E7EDF4",
  gold: "#C9A227", blue: "#3D5A76", blueSoft: "#E7EDF4",
};

/* ————— Requirement constants (v4) ————— */
const TEAMS = [
  { id: 1, name: "PFG", color: "#16324F", size: 27 },
  { id: 2, name: "Gear_Box", color: "#0E8A6A", size: 20 },
  { id: 3, name: "e_Motor", color: "#B87400", size: 23 },
];
const CAPACITY = 63;        // fixed total WFO slot capacity
const BOOKING_WINDOW = 7;   // days in advance
const PAST_DAYS = 5;        // closed days shown for edit-with-approval demo

/* Daily categories — no seat selection anywhere */
const STATUS = {
  WFO: { code: "WFO", label: "Work From Office", color: "#0E8A6A", soft: "#E2F5EE", icon: "🏢" },
  WFH: { code: "WFH", label: "Work From Home", color: "#3D5A76", soft: "#E7EDF4", icon: "🏠" },
  L:   { code: "L",   label: "Leave (A)",        color: "#D64545", soft: "#FDECEC", icon: "🌴" },
};
const STATUS_ORDER = ["WFO", "WFH", "L"];

const FIRST = ["Aarav","Ishita","Rohan","Priya","Kabir","Ananya","Vikram","Sneha","Arjun","Meera","Dev","Nisha","Rahul","Pooja","Karan","Divya","Amit","Ritu","Sanjay","Tanvi"];
const LAST = ["Sharma","Patel","Iyer","Verma","Nair","Gupta","Reddy","Kulkarni","Mehta","Singh","Joshi","Rao","Das","Bose","Kapoor"];

/* ————— Date helpers (demo anchored to Wed 8 Jul 2026) ————— */
const TODAY = new Date(2026, 6, 8);
const key = (d) => d.toISOString().slice(0, 10);
const TODAY_KEY = key(TODAY);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const fmtShort = (d) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtLong = (d) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* Employee headcount per requirement: PFG 27, Gear_Box 20, e_Motor 23 = 70 */
function buildEmployees() {
  const list = []; let id = 1;
  TEAMS.forEach((team) => {
    for (let i = 0; i < team.size; i++) {
      const name = `${FIRST[(id * 7 + team.id) % FIRST.length]} ${LAST[(id * 3 + team.id) % LAST.length]}`;
      list.push({ id, name, email: name.toLowerCase().replace(/\s+/g, ".") + "@company.com", teamId: team.id, active: id % 23 !== 0 });
      id++;
    }
  });
  return list;
}

/* Seed daily category bookings for past + upcoming working days.
   bookings = { "yyyy-mm-dd": { [employeeId]: "WFO" | "WFH" | "L" } } */
function seedBookings(employees) {
  const active = employees.filter((e) => e.active);
  const out = {};
  for (let offset = -PAST_DAYS - 4; offset <= BOOKING_WINDOW; offset++) {
    const d = addDays(TODAY, offset);
    if (isWeekend(d)) continue;
    const k = key(d);
    const map = {};
    let wfo = 0;
    active.forEach((e, i) => {
      const roll = (e.id * 7 + offset * 5 + i) % 10;
      if (roll < 6) { if (wfo < (offset === 0 ? 58 : 45)) { map[e.id] = "WFO"; wfo++; } else map[e.id] = "WFH"; }
      else if (roll < 8) map[e.id] = "WFH";
      else if (roll < 9) map[e.id] = "L";
      /* roll 9 → not marked (absent, unplanned) */
    });
    out[k] = map;
  }
  return out;
}

/* ————— Small pieces ————— */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const icons = {
  dash: ["M3 3h8v8H3z", "M13 3h8v5h-8z", "M13 12h8v9h-8z", "M3 15h8v6H3z"],
  seat: ["M6 19v-7a6 6 0 0 1 12 0v7", "M4 19h16", "M8 19v2", "M16 19v2"],
  history: ["M12 22a10 10 0 1 0-10-10", "M2 12h4", "M12 6v6l4 2"],
  people: ["M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  admin: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  help: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
};

function Stat({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl p-5 flex-1 min-w-0" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: T.inkSoft, letterSpacing: "0.08em" }}>{label}</div>
      <div className="mt-2 text-3xl font-semibold" style={{ color: accent || T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {sub && <div className="mt-1 text-xs" style={{ color: T.inkSoft }}>{sub}</div>}
    </div>
  );
}

function CapacityRing({ occupied, capacity }) {
  const pct = capacity ? Math.min(occupied / capacity, 1) : 0;
  const r = 52, c = 2 * Math.PI * r;
  const full = occupied >= capacity;
  return (
    <div className="flex items-center gap-5">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke={T.navySoft} strokeWidth="12" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={full ? T.red : pct > 0.85 ? T.amber : T.green}
          strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 65 65)" style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms" }} />
        <text x="65" y="60" textAnchor="middle" fontSize="24" fontWeight="700" fill={T.ink} fontFamily="'Space Grotesk', sans-serif">{occupied}</text>
        <text x="65" y="80" textAnchor="middle" fontSize="11" fill={T.inkSoft}>of {capacity} WFO slots</text>
      </svg>
      <div>
        <div className="text-sm font-semibold" style={{ color: full ? T.red : T.ink }}>
          {full ? "Show Full — office at capacity" : `${capacity - occupied} WFO slots open`}
        </div>
        <div className="text-xs mt-1 max-w-[190px]" style={{ color: T.inkSoft }}>
          {full ? "Further WFO bookings are blocked. WFH / Leave are unaffected." : "Slots are auto-assigned — no seat selection needed."}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ code }) {
  const s = STATUS[code];
  if (!s) return <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: T.navySoft, color: T.inkSoft }}>Not marked</span>;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.soft, color: s.color }}>
      {s.icon} {s.code === "L" ? "Leave (A)" : s.code}
    </span>
  );
}

/* ————— Instructions ————— */
function Instructions({ role }) {
  const [open, setOpen] = useState(false);
  const employee = [
    "Every working day you mark one category: Work From Office (WFO), Work From Home (WFH) or Leave (A).",
    "No seat selection — booking WFO auto-fills a slot from the 63 total. If you already booked a date, it simply shows your slot as filled.",
    "Only one entry per person per date. Booking the 64th WFO slot triggers 'Show Full'; WFH and Leave are never capacity-blocked.",
    "You can switch WFH ⇄ WFO (or Leave) any time for today or a future date — switching to WFO re-checks capacity.",
    "Today stays editable until the day closes (6:00 PM close-out). After that the date locks.",
    "To correct a previous (closed) date, tap 'Request manager approval'. Once the manager approves, the Edit option unlocks for that date once.",
    "Weekends and manager-declared holidays are never bookable.",
  ];
  const manager = [
    "Everything an employee can do, plus the Admin panel.",
    "Add new employees (name, work email, team) — created as Active so they can book immediately.",
    "Approve or reject employee requests to edit a closed (previous) date — editing unlocks only after your approval.",
    "Shut down any date as a holiday; entries on it are cancelled automatically.",
    "Export the split attendance report (Excel): per employee per day WFO / WFH / L / A, with team-wise totals. Managers only.",
  ];
  const rules = role === "manager" ? manager : employee;
  return (
    <div className="rounded-2xl" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-5 py-3.5 text-sm font-semibold" style={{ color: T.ink }}>
        <Icon d={icons.help} size={16} />
        How BookMySeat works {role === "manager" ? "(manager)" : ""}
        <span className="ml-auto text-xs" style={{ color: T.inkSoft }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ol className="px-5 pb-4 space-y-1.5 text-xs list-decimal list-inside" style={{ color: T.inkSoft }}>
          {rules.map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      )}
    </div>
  );
}

/* ————— Split helpers ————— */
function splitForDate(dayMap, employees) {
  const per = TEAMS.map((t) => {
    const members = employees.filter((e) => e.teamId === t.id && e.active);
    const wfo = members.filter((e) => dayMap[e.id] === "WFO").length;
    const wfh = members.filter((e) => dayMap[e.id] === "WFH").length;
    const leave = members.filter((e) => dayMap[e.id] === "L").length;
    const absent = members.length - wfo - wfh - leave; // active but not marked
    return { ...t, headcount: members.length, wfo, wfh, leave, absent };
  });
  const total = per.reduce((a, t) => ({
    headcount: a.headcount + t.headcount, wfo: a.wfo + t.wfo, wfh: a.wfh + t.wfh,
    leave: a.leave + t.leave, absent: a.absent + t.absent,
  }), { headcount: 0, wfo: 0, wfh: 0, leave: 0, absent: 0 });
  return { per, total };
}

/* ————— Dashboard (split view) ————— */
function Dashboard({ bookings, employees, holidays }) {
  const [dayOffset, setDayOffset] = useState(0);
  const d = addDays(TODAY, dayOffset);
  const k = key(d);
  const closed = isWeekend(d) || holidays.some((h) => h.date === k);
  const dayMap = closed ? {} : (bookings[k] || {});
  const { per, total } = splitForDate(dayMap, employees);
  const full = total.wfo >= CAPACITY;

  const trend = Array.from({ length: 8 }, (_, i) => {
    const dd = addDays(TODAY, i);
    const kk = key(dd);
    const off = isWeekend(dd) || holidays.some((h) => h.date === kk);
    const count = off ? 0 : Object.values(bookings[kk] || {}).filter((s) => s === "WFO").length;
    return { d: dd, closed: off, count };
  });

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
          const dd = addDays(TODAY, o);
          return (
            <button key={o} onClick={() => setDayOffset(o)} className="px-3.5 py-2 rounded-xl text-xs font-medium"
              style={{ background: o === dayOffset ? T.ink : T.panel, color: o === dayOffset ? "#fff" : T.inkSoft, border: `1px solid ${o === dayOffset ? T.ink : T.line}` }}>
              {o === 0 ? "Today" : fmtShort(dd)}
            </button>
          );
        })}
        <span className="text-xs ml-1" style={{ color: T.inkSoft }}>{fmtLong(d)}{closed ? " · office closed" : ""}</span>
      </div>

      {/* Overall split */}
      <div className="flex flex-wrap gap-4">
        <Stat label="WFO (slots filled)" value={`${total.wfo}/${CAPACITY}`} sub={full ? "Show Full — WFO booking blocked" : `${CAPACITY - total.wfo} slots remaining`} accent={full ? T.red : STATUS.WFO.color} />
        <Stat label="WFH" value={total.wfh} sub="Working from home" accent={STATUS.WFH.color} />
        <Stat label="Leave (A)" value={total.leave} sub="Planned leave" accent={STATUS.L.color} />
        <Stat label="Absent / not marked" value={total.absent} sub={`of ${total.headcount} active employees`} accent="#8A98A6" />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="rounded-2xl p-6 flex-1 min-w-[300px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: T.ink }}>WFO slot utilization</h3>
          <CapacityRing occupied={total.wfo} capacity={CAPACITY} />
        </div>

        {/* Team-wise split */}
        <div className="rounded-2xl p-6 flex-[1.6] min-w-[340px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink }}>Team-wise split — WFO · WFH · Leave · Absent</h3>
          <p className="text-[11px] mb-4" style={{ color: T.inkSoft }}>
            Headcount: {per.map((t) => `${t.name} ${t.headcount}`).join(" · ")} ({total.headcount} active, {CAPACITY} WFO slots).
          </p>
          <div className="space-y-4">
            {per.map((t) => (
              <div key={t.id}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium flex items-center gap-1.5" style={{ color: T.ink }}>
                    <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />{t.name}
                  </span>
                  <span style={{ color: T.inkSoft }}>
                    WFO {t.wfo} · WFH {t.wfh} · Leave {t.leave} · Absent {t.absent} · {t.headcount} members
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden flex" style={{ background: T.navySoft }}>
                  {seg(t).map((s) => s.v > 0 && (
                    <div key={s.code} title={`${s.code}: ${s.v}`} style={{ width: `${(s.v / t.headcount) * 100}%`, background: s.color, transition: "width 500ms ease" }} />
                  ))}
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

      {/* Split table + trend */}
      <div className="flex flex-wrap gap-5">
        <div className="rounded-2xl overflow-hidden flex-1 min-w-[320px]" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
          <div className="px-5 py-3.5 text-sm font-semibold" style={{ color: T.ink, borderBottom: `1px solid ${T.line}` }}>Split table — {fmtShort(d)}</div>
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
                <tr key={t.id} style={{ color: T.ink }}>
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
          <p className="text-[11px] mb-4" style={{ color: T.inkSoft }}>Slots filled per day vs the 63 capacity.</p>
          <div className="flex items-end gap-2 h-32">
            {trend.map((t) => (
              <div key={key(t.d)} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold" style={{ color: t.closed ? "#B0BCC8" : T.ink }}>{t.closed ? "—" : t.count}</span>
                <div className="w-full rounded-t-md" style={{
                  height: `${t.closed ? 4 : Math.max((t.count / CAPACITY) * 100, 4)}%`,
                  background: t.closed ? T.line : t.count >= CAPACITY ? T.red : t.count / CAPACITY > 0.7 ? T.amber : T.green,
                  transition: "height 400ms ease",
                }} />
                <span className="text-[9px]" style={{ color: T.inkSoft }}>{t.d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ————— My Status (booking — no seat selection) ————— */
function MyStatus({ role, bookings, setBookings, approvals, setApprovals, employees, holidays, showToast }) {
  const myEmployeeId = 3;
  const me = employees.find((e) => e.id === myEmployeeId);
  const myTeam = TEAMS.find((t) => t.id === me.teamId);

  /* Date strip: previous working days (closed) + today + 7-day window */
  const dates = [];
  for (let o = -PAST_DAYS; o <= BOOKING_WINDOW; o++) dates.push(addDays(TODAY, o));
  const [dateIdx, setDateIdx] = useState(PAST_DAYS); // today
  const [choice, setChoice] = useState(null);

  const d = dates[dateIdx];
  const k = key(d);
  const weekend = isWeekend(d);
  const holiday = holidays.find((h) => h.date === k);
  const closedOffice = weekend || !!holiday;
  const isPast = k < TODAY_KEY;      // day closed (before today)
  const dayMap = bookings[k] || {};
  const wfoCount = Object.values(dayMap).filter((s) => s === "WFO").length;
  const full = wfoCount >= CAPACITY;
  const myStatus = dayMap[myEmployeeId];
  const apKey = `${k}:${myEmployeeId}`;
  const approval = approvals[apKey]; // undefined | "pending" | "approved"
  const editUnlocked = !isPast || approval === "approved";

  const pick = (code) => {
    if (closedOffice) return;
    if (!editUnlocked) return showToast("This day is closed. Request manager approval to edit it.", "error");
    setChoice(choice === code ? null : code);
  };

  const save = () => {
    /* ——— Validations ——— */
    if (weekend) return showToast("Weekends are not bookable — the office is closed Sat & Sun.", "error");
    if (holiday) return showToast(`This date is shut down by the manager: ${holiday.name}.`, "error");
    if (isPast && approval !== "approved") return showToast("Day closed — previous dates can only be edited after manager approval.", "error");
    if (!choice) return showToast("Pick a category first — WFO, WFH or Leave (A).", "error");
    if (choice === myStatus) return showToast(`Already marked ${STATUS[choice].label} for ${fmtShort(d)} — your slot shows as filled.`, "error");
    if (choice === "WFO" && full && myStatus !== "WFO") {
      return showToast(`Show Full — all ${CAPACITY} WFO slots are booked for ${fmtShort(d)}. Choose WFH or try another day.`, "error");
    }

    const isChange = !!myStatus;
    setBookings({ ...bookings, [k]: { ...dayMap, [myEmployeeId]: choice } });
    if (isPast) {
      /* one-time edit: consume the approval */
      const na = { ...approvals }; delete na[apKey];
      setApprovals(na);
    }
    setChoice(null);
    if (choice === "WFO") {
      showToast(`${isChange ? `Changed ${STATUS[myStatus].code} → WFO` : "WFO booked"} for ${fmtShort(d)} — slot auto-assigned (${wfoCount + 1}/${CAPACITY}). No seat selection needed.${isPast ? " Approved edit used." : ""}`, "ok");
    } else {
      showToast(`${isChange ? `Changed ${STATUS[myStatus].code} → ${STATUS[choice].code}` : `${STATUS[choice].label} marked`} for ${fmtShort(d)}.${myStatus === "WFO" ? " Your WFO slot was released." : ""}${isPast ? " Approved edit used." : ""}`, "ok");
    }
  };

  const requestApproval = () => {
    if (approval === "pending") return showToast("Approval request already sent — waiting for your manager.", "error");
    if (approval === "approved") return showToast("Already approved — the Edit option is unlocked for this date.", "ok");
    setApprovals({ ...approvals, [apKey]: "pending" });
    showToast(`Edit request for ${fmtShort(d)} sent to your manager. You'll be able to edit once it's approved.`, "ok");
  };

  const simulateFull = () => {
    if (closedOffice || isPast) return showToast("Pick an open working day (today or future) to run the demo.", "error");
    const next = { ...dayMap };
    let count = Object.values(next).filter((s) => s === "WFO").length;
    employees.filter((e) => e.active && e.id !== myEmployeeId).forEach((e) => {
      if (count < CAPACITY && next[e.id] !== "WFO") { next[e.id] = "WFO"; count++; }
    });
    setBookings({ ...bookings, [k]: next });
    showToast(`Demo: ${fmtShort(d)} filled to ${CAPACITY}/${CAPACITY} WFO. Try booking WFO now — "Show Full".`, "ok");
  };

  return (
    <div className="space-y-5">
      <Instructions role={role} />

      {/* Date strip */}
      <div className="flex flex-wrap items-center gap-2">
        {dates.map((dd, i) => {
          const kk = key(dd);
          const we = isWeekend(dd);
          const hol = holidays.find((h) => h.date === kk);
          const off = we || hol;
          const past = kk < TODAY_KEY;
          const isToday = kk === TODAY_KEY;
          return (
            <button key={kk} onClick={() => { setDateIdx(i); setChoice(null); }}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{
                background: i === dateIdx ? (off ? T.redSoft : T.ink) : T.panel,
                color: i === dateIdx ? (off ? T.red : "#fff") : off ? "#B0BCC8" : past ? "#8A98A6" : T.inkSoft,
                border: `1px solid ${i === dateIdx ? (off ? T.red : T.ink) : T.line}`,
                textDecoration: off && i !== dateIdx ? "line-through" : "none",
              }}>
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
      ) : (
        <>
          {/* Capacity + demo row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: full ? T.redSoft : T.greenSoft, color: full ? T.red : T.green }}>
              {full ? "SHOW FULL — WFO blocked" : `WFO slots: ${wfoCount}/${CAPACITY} filled · ${CAPACITY - wfoCount} open`}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: T.navySoft, color: T.inkSoft }}>
              WFH & Leave (A) are never capacity-blocked
            </span>
            {!isPast && (
              <button onClick={simulateFull} className="ml-auto text-[11px] px-3 py-1.5 rounded-full" style={{ border: `1px dashed ${T.line}`, color: T.inkSoft }}>
                Demo: fill WFO slots
              </button>
            )}
          </div>

          {/* Closed-day approval banner */}
          {isPast && (
            <div className="rounded-2xl p-5 flex flex-wrap items-center gap-4"
              style={{ background: approval === "approved" ? "#F0FAF6" : "#FFF8EC", border: `1px solid ${approval === "approved" ? T.green : T.amber}` }}>
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <span style={{ color: approval === "approved" ? T.green : T.amberDark }}><Icon d={icons.lock} size={20} /></span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: approval === "approved" ? T.green : T.amberDark }}>
                    {approval === "approved" ? "Manager approved — Edit unlocked for this date (one-time)"
                      : approval === "pending" ? "Approval pending with your manager"
                      : "Day closed — editing a previous date needs manager approval"}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
                    {approval === "approved" ? "Update your category below; the edit consumes the approval."
                      : approval === "pending" ? "Ask your manager to approve it in Admin → Edit approvals (switch role to try it)."
                      : "You can freely edit today and future dates. Past dates lock at day close."}
                  </div>
                </div>
              </div>
              {approval !== "approved" && (
                <button onClick={requestApproval} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: approval === "pending" ? T.line : T.amber, color: approval === "pending" ? T.inkSoft : "#3A2600" }}>
                  {approval === "pending" ? "Request sent ✓" : "Request manager approval"}
                </button>
              )}
            </div>
          )}

          {/* Category cards — replaces the seat map */}
          <div className="rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
            <div className="text-sm font-semibold mb-1" style={{ color: T.ink }}>
              Mark your day — {fmtLong(d)}
            </div>
            <p className="text-xs mb-5" style={{ color: T.inkSoft }}>
              One category per date. No seat to pick — WFO slots are auto-assigned from the {CAPACITY} available.
            </p>
            <div className="flex flex-wrap gap-4">
              {STATUS_ORDER.map((code) => {
                const s = STATUS[code];
                const isCurrent = myStatus === code;
                const isChoice = choice === code;
                const wfoBlocked = code === "WFO" && full && !isCurrent;
                const disabled = !editUnlocked || wfoBlocked;
                return (
                  <button key={code} onClick={() => !disabled && pick(code)}
                    className="flex-1 min-w-[180px] rounded-2xl p-5 text-left transition-transform"
                    style={{
                      background: isChoice ? s.soft : T.panel,
                      border: `2px solid ${isChoice ? s.color : isCurrent ? s.color : T.line}`,
                      opacity: disabled ? 0.45 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                      transform: isChoice ? "translateY(-2px)" : "none",
                      boxShadow: isChoice ? "0 4px 14px rgba(22,50,79,0.12)" : "none",
                    }}>
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="text-sm font-semibold" style={{ color: s.color }}>{s.label}</div>
                    <div className="text-[11px] mt-1" style={{ color: T.inkSoft }}>
                      {code === "WFO" ? (wfoBlocked ? "Show Full — no slots left" : `Auto slot · ${CAPACITY - wfoCount} open`)
                        : code === "WFH" ? "No slot needed"
                        : "Marks you absent for the day"}
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

          {/* Action bar */}
          <div className="rounded-2xl p-5 flex flex-wrap items-center gap-4" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-semibold" style={{ color: T.ink }}>{me.name} · {myTeam.name}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: T.inkSoft }}>
                Current for {fmtShort(d)}: <StatusChip code={myStatus} />
                {myStatus && editUnlocked && <span>· pick another category to change it</span>}
                {myStatus && !editUnlocked && <span>· locked (day closed)</span>}
              </div>
            </div>
            <button onClick={save}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-transform active:scale-95"
              style={{
                background: !editUnlocked || !choice ? T.line : T.amber,
                color: !editUnlocked || !choice ? T.inkSoft : "#3A2600",
                cursor: !editUnlocked || !choice ? "not-allowed" : "pointer",
                boxShadow: !editUnlocked || !choice ? "none" : "0 3px 10px rgba(245,165,36,0.4)",
              }}>
              {!editUnlocked ? "🔒 Locked — needs approval"
                : myStatus && choice ? `Change ${STATUS[myStatus].code} → ${STATUS[choice].code}`
                : choice ? `Confirm ${STATUS[choice].code} for ${fmtShort(d)}`
                : myStatus ? "Slot filled ✓" : "Pick a category"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ————— My history ————— */
function MyHistory({ bookings, holidays }) {
  const myEmployeeId = 3;
  const mine = Object.entries(bookings)
    .map(([k, map]) => (map[myEmployeeId] ? { k, status: map[myEmployeeId] } : null))
    .filter(Boolean)
    .sort((a, b) => b.k.localeCompare(a.k));
  const wfoDays = mine.filter((m) => m.status === "WFO").length;
  const wfhDays = mine.filter((m) => m.status === "WFH").length;
  const leaveDays = mine.filter((m) => m.status === "L").length;
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
        {mine.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: T.inkSoft }}>Nothing marked yet — head to "My status".</p>
        ) : mine.map((m) => {
          const s = STATUS[m.status];
          const past = m.k < TODAY_KEY;
          return (
            <div key={m.k} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: s.soft }}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: T.ink }}>{fmtLong(new Date(m.k))}</div>
                <div className="text-[11px]" style={{ color: T.inkSoft }}>
                  {s.label}{past ? " · day closed (edit needs manager approval)" : m.k === TODAY_KEY ? " · editable until day close" : " · editable"}
                </div>
              </div>
              <StatusChip code={m.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ————— Employees ————— */
function Employees({ employees }) {
  const [filter, setFilter] = useState("all");
  const shown = employees.filter((e) => filter === "all" ? true : filter === "active" ? e.active : !e.active);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <div className="flex items-center gap-2 p-4" style={{ borderBottom: `1px solid ${T.line}` }}>
        {["all", "active", "left"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
            style={{ background: filter === f ? T.navySoft : "transparent", color: filter === f ? T.ink : T.inkSoft }}>
            {f === "left" ? "Left (records kept)" : f}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: T.inkSoft }}>{shown.length} people</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {shown.map((e) => {
          const team = TEAMS.find((t) => t.id === e.teamId);
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: team.color, opacity: e.active ? 1 : 0.4 }}>
                {e.name.split(" ").map((w) => w[0]).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: e.active ? T.ink : T.inkSoft }}>{e.name}</div>
                <div className="text-[11px] truncate" style={{ color: T.inkSoft }}>{e.email}</div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: T.navySoft, color: T.inkSoft }}>{team.name}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: e.active ? T.greenSoft : T.redSoft, color: e.active ? T.green : T.red }}>
                {e.active ? "Active" : "Left"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ————— Manager admin ————— */
function Admin({ holidays, setHolidays, bookings, setBookings, approvals, setApprovals, employees, setEmployees, showToast }) {
  const [holDate, setHolDate] = useState("");
  const [holName, setHolName] = useState("");
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empTeam, setEmpTeam] = useState("");
  const upcoming = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).filter((d) => !isWeekend(d));

  const addEmployee = () => {
    /* ——— Validations ——— */
    const name = empName.trim();
    const email = empEmail.trim().toLowerCase();
    if (!name) return showToast("Enter the new employee's full name.", "error");
    if (!email) return showToast("Enter the new employee's work email.", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("That doesn't look like a valid email address.", "error");
    if (employees.some((e) => e.email.toLowerCase() === email)) return showToast("An employee with this email already exists.", "error");
    if (!empTeam) return showToast("Pick a team for the new employee.", "error");
    const nextId = Math.max(...employees.map((e) => e.id)) + 1;
    const emp = { id: nextId, name, email, teamId: parseInt(empTeam, 10), active: true };
    setEmployees([...employees, emp]);
    setEmpName(""); setEmpEmail(""); setEmpTeam("");
    const teamName = TEAMS.find((t) => t.id === emp.teamId).name;
    showToast(`${name} added to ${teamName} as Active — they can book WFO / WFH / Leave immediately. Dashboard counts updated.`, "ok");
  };

  const pending = Object.entries(approvals).filter(([, v]) => v === "pending")
    .map(([k]) => { const [date, empId] = k.split(":"); return { apKey: k, date, empId: parseInt(empId, 10) }; })
    .sort((a, b) => a.date.localeCompare(b.date));

  const decide = (apKey, ok) => {
    const na = { ...approvals };
    if (ok) na[apKey] = "approved"; else delete na[apKey];
    setApprovals(na);
    showToast(ok ? "Approved — the employee's Edit option is now unlocked for that date (one-time edit)."
      : "Rejected — the date stays locked for the employee.", ok ? "ok" : "error");
  };

  const addHoliday = () => {
    if (!holDate) return showToast("Pick a date for the holiday.", "error");
    if (!holName.trim()) return showToast("Give the holiday a name (e.g. Diwali).", "error");
    if (holidays.some((h) => h.date === holDate)) return showToast("That date is already marked as a holiday.", "error");
    const booked = Object.keys(bookings[holDate] || {}).length;
    setHolidays([...holidays, { date: holDate, name: holName.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    if (booked) {
      const nb = { ...bookings }; delete nb[holDate]; setBookings(nb);
      showToast(`Holiday added. ${booked} existing entries on that day were cancelled and members notified.`, "ok");
    } else showToast("Holiday added — that date is now shut down for booking.", "ok");
    setHolDate(""); setHolName("");
  };

  const exportExcel = () => {
    /* last 10 working days incl. today — split report WFO / WFH / L / A */
    const days = []; let d = new Date(TODAY);
    while (days.length < 10) { if (!isWeekend(d)) days.unshift(new Date(d)); d = addDays(d, -1); }
    const header = ["Employee", "Team", "Status", ...days.map((dd) => key(dd)), "WFO days", "WFH days", "Leave (A) days", "Absent days"];
    const rows = employees.map((e) => {
      const team = TEAMS.find((t) => t.id === e.teamId);
      let wfo = 0, wfh = 0, lv = 0, ab = 0;
      const cells = days.map((dd) => {
        const st = (bookings[key(dd)] || {})[e.id];
        if (!e.active) { ab++; return "—"; }
        if (st === "WFO") { wfo++; return "WFO"; }
        if (st === "WFH") { wfh++; return "WFH"; }
        if (st === "L") { lv++; return "L"; }
        ab++; return "A";
      });
      return [e.name, team.name, e.active ? "Active" : "Left", ...cells, wfo, wfh, lv, ab];
    });
    /* Team-wise totals block */
    rows.push([]);
    rows.push(["Team totals (last 10 working days)"]);
    TEAMS.forEach((t) => {
      const members = employees.filter((e) => e.teamId === t.id);
      let wfo = 0, wfh = 0, lv = 0, ab = 0;
      members.forEach((e) => days.forEach((dd) => {
        const st = (bookings[key(dd)] || {})[e.id];
        if (!e.active) { ab++; return; }
        if (st === "WFO") wfo++; else if (st === "WFH") wfh++; else if (st === "L") lv++; else ab++;
      }));
      rows.push([t.name, `${members.filter((e) => e.active).length} active`, "", ...days.map(() => ""), wfo, wfh, lv, ab]);
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: i === 0 ? 22 : i < 3 ? 12 : 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WFO-WFH-Leave");
    XLSX.writeFile(wb, "BookMySeat_Split_Report.xlsx");
    showToast("Split report downloaded (Excel): per-day WFO / WFH / L / A with team totals. Manager-only export.", "ok");
  };

  return (
    <div className="space-y-5">
      <Instructions role="manager" />

      {/* Edit approvals queue */}
      <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${T.line}` }}>
          <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Edit approvals — closed-day change requests</h3>
          <p className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
            Employees can't edit a previous (closed) date on their own. Approving unlocks a one-time edit for that employee & date.
          </p>
        </div>
        {pending.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: T.inkSoft }}>
            No pending requests. (Demo: as an employee, open "My status", pick a closed day 🔒 and tap "Request manager approval".)
          </p>
        ) : pending.map((p) => {
          const emp = employees.find((e) => e.id === p.empId);
          const cur = (bookings[p.date] || {})[p.empId];
          return (
            <div key={p.apKey} className="flex flex-wrap items-center gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${T.line}` }}>
              <div className="flex-1 min-w-[220px]">
                <div className="text-sm font-medium" style={{ color: T.ink }}>{emp?.name} · {TEAMS.find((t) => t.id === emp?.teamId)?.name}</div>
                <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: T.inkSoft }}>
                  Wants to edit {fmtLong(new Date(p.date))} · currently: <StatusChip code={cur} />
                </div>
              </div>
              <button onClick={() => decide(p.apKey, true)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: T.green, color: "#fff" }}>
                Approve — unlock edit
              </button>
              <button onClick={() => decide(p.apKey, false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: T.redSoft, color: T.red }}>
                Reject
              </button>
            </div>
          );
        })}
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
              {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <button onClick={addEmployee} className="text-xs font-semibold px-4 py-2.5 rounded-lg" style={{ background: T.ink, color: "#fff" }}>
            ＋ Add employee
          </button>
        </div>
        <p className="text-[10px] mt-3" style={{ color: T.inkSoft }}>
          Validations: name, valid & unique email, and team are required. Current headcount: {employees.filter((e) => e.active).length} active
          ({TEAMS.map((t) => `${t.name} ${employees.filter((e) => e.teamId === t.id && e.active).length}`).join(" · ")}).
        </p>
      </div>

      {/* Holidays */}
      <div className="rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Company holidays</h3>
        <p className="text-xs mt-1 mb-4" style={{ color: T.inkSoft }}>Shut down a date — employees can't book it. Existing entries on it are cancelled.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={holDate} onChange={(e) => setHolDate(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 flex-1 min-w-[140px]" style={{ border: `1px solid ${T.line}`, color: T.ink, background: T.panel }}>
            <option value="">Pick a date…</option>
            {upcoming.map((d) => <option key={key(d)} value={key(d)}>{fmtShort(d)}</option>)}
          </select>
          <input value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="Holiday name"
            className="text-xs rounded-lg px-3 py-2 flex-1 min-w-[140px]" style={{ border: `1px solid ${T.line}`, color: T.ink }} />
          <button onClick={addHoliday} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: T.ink, color: "#fff" }}>
            Shut down date
          </button>
        </div>
        {holidays.length === 0 ? (
          <p className="text-xs" style={{ color: T.inkSoft }}>No holidays yet. Weekends are always closed automatically.</p>
        ) : holidays.map((h) => (
          <div key={h.date} className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${T.line}` }}>
            <div>
              <div className="text-sm font-medium" style={{ color: T.ink }}>{h.name}</div>
              <div className="text-[11px]" style={{ color: T.inkSoft }}>{fmtLong(new Date(h.date))}</div>
            </div>
            <button onClick={() => { setHolidays(holidays.filter((x) => x.date !== h.date)); showToast(`${h.name} removed — the date is open for booking again.`, "ok"); }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: T.redSoft, color: T.red }}>
              Reopen
            </button>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="rounded-2xl p-6 flex flex-wrap items-center gap-4" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
        <div className="flex-1 min-w-[240px]">
          <h3 className="text-sm font-semibold" style={{ color: T.ink }}>Split report (Excel)</h3>
          <p className="text-xs mt-1" style={{ color: T.inkSoft }}>
            Last 10 working days — per employee per day: WFO / WFH / L / A, plus per-person and team-wise totals. Managers only.
          </p>
        </div>
        <button onClick={exportExcel} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: T.green, color: "#fff" }}>
          ⬇ Export Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}

/* ————— Shell ————— */
export default function App() {
  const [employees, setEmployees] = useState(buildEmployees);
  const [bookings, setBookings] = useState(() => seedBookings(buildEmployees()));
  const [approvals, setApprovals] = useState({});
  const [holidays, setHolidays] = useState([{ date: key(addDays(TODAY, 5)), name: "Company Foundation Day" }]);
  const [role, setRole] = useState("employee");
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const showToast = (msg, kind) => {
    setToast({ msg, kind });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4200);
  };

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: icons.dash },
    { id: "status", label: "My status", icon: icons.seat },
    { id: "history", label: "My history", icon: icons.history },
    { id: "employees", label: "Employees", icon: icons.people },
    ...(role === "manager" ? [{ id: "admin", label: "Admin", icon: icons.admin }] : []),
  ];
  const titles = {
    dashboard: ["Dashboard — split view", "Team-wise WFO · WFH · Leave (A) · Absent counts, live"],
    status: ["My status", `WFO / WFH / Leave (A) · ${CAPACITY} WFO slots · auto-assigned · Mon–Fri, ${BOOKING_WINDOW}-day window`],
    history: ["My history", "Your daily categories and edit rules"],
    employees: ["Employees", `${employees.length} people on record · ${TEAMS.map((t) => `${t.name} ${employees.filter((e) => e.teamId === t.id && e.active).length}`).join(" · ")}`],
    admin: ["Admin panel", "Add employees, edit approvals, holidays and split report — managers only"],
  };

  const switchRole = (r) => {
    setRole(r);
    if (r === "employee" && page === "admin") setPage("dashboard");
    showToast(r === "manager" ? "Manager mode: edit approvals, holidays and Excel export unlocked." : "Employee mode: mark WFO / WFH / Leave and view the split dashboard.", "ok");
  };

  return (
    <div className="min-h-screen flex" style={{ background: T.canvas, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');`}</style>

      <aside className="w-16 md:w-56 shrink-0 flex flex-col py-5 px-2 md:px-4" style={{ background: T.ink }}>
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: T.amber, color: "#3A2600", fontFamily: "'Space Grotesk', sans-serif" }}>B</div>
          <div className="hidden md:block">
            <div className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Book<span style={{ color: T.amber }}>My</span>Seat</div>
            <div className="text-[10px]" style={{ color: "#8FA6BC" }}>{CAPACITY} WFO slots · {employees.filter((e) => e.active).length} people</div>
          </div>
        </div>
        {nav.map((n) => (
          <button key={n.id} onClick={() => setPage(n.id)}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl mb-1 text-sm transition-colors"
            style={{ background: page === n.id ? "rgba(255,255,255,0.12)" : "transparent", color: page === n.id ? "#fff" : "#8FA6BC" }}>
            <Icon d={n.icon} />
            <span className="hidden md:inline font-medium">{n.label}</span>
          </button>
        ))}
        <div className="mt-auto hidden md:block px-2.5 text-[10px] leading-relaxed" style={{ color: "#5F7A94" }}>
          BookMySeat prototype · OutSystems build spec v4 · WFO/WFH/Leave split
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-5 md:p-8 overflow-y-auto">
        <header className="mb-6 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold" style={{ color: T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>{titles[page][0]}</h1>
            <p className="text-sm mt-1" style={{ color: T.inkSoft }}>{titles[page][1]}</p>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
            {["employee", "manager"].map((r) => (
              <button key={r} onClick={() => switchRole(r)} className="px-4 py-2 text-xs font-semibold capitalize"
                style={{ background: role === r ? T.ink : T.panel, color: role === r ? "#fff" : T.inkSoft }}>
                {r}
              </button>
            ))}
          </div>
        </header>

        {page === "dashboard" && <Dashboard bookings={bookings} employees={employees} holidays={holidays} />}
        {page === "status" && <MyStatus role={role} bookings={bookings} setBookings={setBookings}
          approvals={approvals} setApprovals={setApprovals} employees={employees} holidays={holidays} showToast={showToast} />}
        {page === "history" && <MyHistory bookings={bookings} holidays={holidays} />}
        {page === "employees" && <Employees employees={employees} />}
        {page === "admin" && role === "manager" && <Admin holidays={holidays} setHolidays={setHolidays}
          bookings={bookings} setBookings={setBookings} approvals={approvals} setApprovals={setApprovals}
          employees={employees} setEmployees={setEmployees} showToast={showToast} />}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg z-50"
          style={{ background: toast.kind === "error" ? T.red : T.ink, color: "#fff", maxWidth: "90vw" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
