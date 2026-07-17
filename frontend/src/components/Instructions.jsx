import { useState } from "react";
import Icon from "./Icon";
import { T, icons } from "../theme";

const isManagerRole = (role) => role === "manager" || role === "admin";

const employeeRules = (capacity) => [
  "Every working day you mark one category: Work From Office (WFO), Work From Home (WFH) or Leave (A).",
  `No seat selection — booking WFO auto-fills a slot from the ${capacity} total. If you already booked a date, it simply shows your slot as filled.`,
  `Only one entry per person per date. Booking the ${capacity + 1}th WFO slot triggers 'Show Full'; WFH and Leave are never capacity-blocked.`,
  "You can switch WFH ⇄ WFO (or Leave) any time for today or a future date — switching to WFO re-checks capacity.",
  "Today stays editable until the day closes (6:00 PM close-out). After that the date locks.",
  "To correct a previous (closed) date, tap 'Request manager approval'. Once the manager approves, the Edit option unlocks for that date once.",
  "Weekends and manager-declared holidays are never bookable.",
];

const MANAGER_RULES = [
  "Everything an employee can do, plus the Admin panel.",
  "Add new employees (name, work email, team) — created as Active so they can book immediately.",
  "Approve or reject employee requests to edit a closed (previous) date — editing unlocks only after your approval.",
  "Shut down any date as a holiday; entries on it are cancelled automatically.",
  "Change the WFO seat capacity — increases reopen Show Full dates, reductions release the latest bookings to WFH (Admin/Manager only).",
  "Export the split attendance report (Excel): per employee per day WFO / WFH / L / A, with team-wise totals. Admin/Manager only.",
];

export default function Instructions({ role, capacity = 63 }) {
  const [open, setOpen] = useState(false);
  const manager = isManagerRole(role);
  const rules = manager ? MANAGER_RULES : employeeRules(capacity);
  return (
    <div className="rounded-2xl" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-sm font-semibold"
        style={{ color: T.ink }}
      >
        <Icon d={icons.help} size={16} />
        How BookMySeat works {manager ? `(${role})` : ""}
        <span className="ml-auto text-xs" style={{ color: T.inkSoft }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ol className="px-5 pb-4 space-y-1.5 text-xs list-decimal list-inside" style={{ color: T.inkSoft }}>
          {rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
